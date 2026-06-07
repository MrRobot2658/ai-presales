import { readFile } from 'fs/promises'
import { join } from 'path'
import { createSession } from '../../db/hermes/session-store'
import { pgQuery } from '../../db/postgres/pool'
import { AgentBridgeClient } from '../hermes/agent-bridge'
import { logger } from '../logger'
import {
  getContentDraft,
  syncDraftHtmlFile,
  updateContentDraft,
  type ContentDraftRecord,
} from './content-service'
import { getContentDraftPath } from './presales-profile-paths'
import { getOpportunity } from './opportunity-service'
import { getProfileDir } from '../hermes/hermes-profile'
import { existsSync } from 'fs'
import type { PresalesTenantContext } from './tenant-context'

function scenarioLabels(scenario: string[]): string {
  return scenario.map((value) => {
    if (value === 'bid-word') return '招投标 Word'
    if (value === 'product-ppt') return '产品介绍 PPT'
    if (value === 'case-ppt') return '案例 PPT'
    return value
  }).join('、') || '综合方案'
}

async function resolveKnowledgeHints(
  tenant: PresalesTenantContext,
  knowledgeRefs: string[],
): Promise<string[]> {
  const validRefs = knowledgeRefs.filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  if (validRefs.length === 0) return []
  try {
    const { rows } = await pgQuery<{ id: string; file_name: string }>(
      `SELECT id, file_name
       FROM v_knowledge_assets_list
       WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
      [tenant.tenantId, validRefs],
    )
    return rows.map((row) => {
      const processedRel = `content/knowledge/processed/${row.id}/cleaned.md`
      const processedAbs = join(getProfileDir(tenant.hermesProfileName), processedRel)
      return `- ${row.file_name}（清洗结果：${processedRel}${existsSync(processedAbs) ? '' : '，如不存在请读取 raw 目录'}）`
    })
  } catch (err) {
    logger.warn(err, '[presales-content] failed to resolve knowledge refs, continuing without hints')
    return validRefs.map((id) => `- 知识库资产 ${id}（路径：content/knowledge/processed/${id}/cleaned.md）`)
  }
}

function buildGenerationInstructions(
  draft: ContentDraftRecord,
  opportunityText: string,
  knowledgeLines: string[],
): string {
  return [
    '你是 aipresales 售前方案生成助手。请生成完整的中文方案 HTML，写入草稿文件。',
    '先阅读 presales skill（presales/SKILL.md）与 manifest.json。',
    '预览使用 HTML，下载时才导出 PPT，因此本次只需完善 HTML 草稿。',
    '',
    `草稿 JSON 路径：content/drafts/${draft.id}.json`,
    `HTML 文件路径：content/drafts/${draft.id}.html`,
    '',
    '要求：',
    '1. 更新草稿 JSON 中的 htmlContent（完整 HTML）与 sections（每节一页/一段）',
    '2. 同步写入 content/drafts/{draftId}.html 便于预览',
    '3. 方案 6-12 节，含封面、背景、方案、产品/案例、价值 ROI、下一步',
    '4. 结合知识库事实，不要编造不存在的数据',
    '5. 不要生成 pptx 文件',
    '',
    opportunityText ? `商机信息：\n${opportunityText}` : '',
    knowledgeLines.length ? `参考知识库：\n${knowledgeLines.join('\n')}` : '',
    draft.description ? `用户补充说明：${draft.description}` : '',
  ].filter(Boolean).join('\n')
}

function buildGenerationPrompt(draft: ContentDraftRecord): string {
  const labels = scenarioLabels(draft.scenario)
  return [
    `请为 ${draft.companyName} 生成「${labels}」售前方案 HTML。`,
    `草稿 ID：${draft.id}`,
    '',
    '当前 HTML 参考：',
    draft.htmlContent || '(空)',
    draft.sections?.length
      ? `\n当前章节：\n${draft.sections.map((s) => `- ${s.title}：${s.content}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n')
}

async function reloadDraftFromDisk(profileName: string, draftId: string): Promise<ContentDraftRecord | null> {
  const path = getContentDraftPath(profileName, draftId)
  try {
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw) as ContentDraftRecord
  } catch {
    return null
  }
}

export async function runContentGeneration(
  tenant: PresalesTenantContext,
  draftId: string,
): Promise<{ item: ContentDraftRecord; warning?: string }> {
  const profileName = tenant.hermesProfileName
  let draft = await getContentDraft(tenant, draftId)
  if (!draft) throw new Error('Content draft not found')
  if (draft.status !== 'generating') {
    throw new Error('Draft is not in generating status')
  }

  const opportunity = draft.opportunityId
    ? await getOpportunity(tenant, draft.opportunityId)
    : null

  const opportunityText = opportunity
    ? [
      `公司：${opportunity.companyName}`,
      `行业：${opportunity.industry}`,
      `描述：${opportunity.description}`,
      `洞察：${opportunity.companyInsight}`,
    ].join('\n')
    : `公司：${draft.companyName}`

  const knowledgeLines = await resolveKnowledgeHints(tenant, draft.knowledgeRefs)
  const instructions = buildGenerationInstructions(draft, opportunityText, knowledgeLines)
  const userMessage = buildGenerationPrompt(draft)
  const sessionId = `presales-content-gen-${draftId}`

  createSession({
    id: sessionId,
    profile: profileName,
    source: 'presales_content',
    title: `Generate HTML: ${draft.title}`,
  })

  let bridge: AgentBridgeClient | null = null
  try {
    bridge = new AgentBridgeClient({ connectRetryMs: 15_000, timeoutMs: 600_000 })
    const started = await bridge.chat(sessionId, userMessage, [], instructions, profileName, {
      source: 'presales_content',
    })

    for await (const chunk of bridge.streamOutput(started.run_id, { intervalMs: 300 })) {
      if (chunk.error) throw new Error(String(chunk.error))
    }

    const result = await bridge.getResult(started.run_id, { timeoutMs: 120_000 })
    if (result.error) throw new Error(String(result.error))

    const reloaded = await reloadDraftFromDisk(profileName, draftId)
    const htmlContent = reloaded?.htmlContent?.trim() ? reloaded.htmlContent : draft.htmlContent
    const sections = reloaded?.sections?.length ? reloaded.sections : draft.sections

    const updated = await updateContentDraft(tenant, draftId, {
      status: 'completed',
      htmlContent,
      sections,
    })
    if (!updated) throw new Error('Failed to update draft after generation')
    await syncDraftHtmlFile(profileName, updated)

    logger.info({ draftId, profile: profileName }, '[presales-content] HTML generation completed')
    return { item: updated }
  } catch (err: any) {
    logger.error(err, '[presales-content] generation failed for draft %s', draftId)
    const message = err?.message || String(err)
    const updated = await updateContentDraft(tenant, draftId, {
      status: 'completed',
      htmlContent: draft.htmlContent,
      sections: draft.sections,
    })
    if (updated) {
      await syncDraftHtmlFile(profileName, updated)
      return { item: updated, warning: message }
    }
    throw err
  } finally {
    await bridge?.close()
  }
}
