import { existsSync } from 'fs'
import { createSession } from '../../db/hermes/session-store'
import { AgentBridgeClient } from '../hermes/agent-bridge'
import { logger } from '../logger'
import {
  ensureContentArtifact,
  getContentDraft,
  type ContentDraftRecord,
} from './content-service'
import type { PresalesTenantContext } from './tenant-context'

function buildExportInstructions(draft: ContentDraftRecord): string {
  return [
    '你是 aipresales 售前方案导出助手。请把 HTML 方案转换为 PowerPoint（.pptx）。',
    '先阅读 presales skill（presales/SKILL.md）。',
    '',
    `草稿 JSON：content/drafts/${draft.id}.json（含 htmlContent 与 sections）`,
    `HTML 文件：content/drafts/${draft.id}.html（若存在）`,
    `输出 PPT（Profile 相对路径）：${draft.outputFile}`,
    `输出绝对路径：${draft.outputFileAbs}`,
    '',
    '要求：',
    '1. 读取 HTML/sections 内容，生成 6-12 页中文 PPT，结构与 HTML 一致',
    '2. 保存到上述绝对路径（覆盖已有文件）',
    '3. 完成后简要说明已保存路径',
  ].join('\n')
}

function buildExportPrompt(draft: ContentDraftRecord): string {
  return [
    `请将「${draft.companyName}」方案 HTML 导出为 PPT。`,
    `草稿 ID：${draft.id}`,
    '',
    'HTML 内容：',
    draft.htmlContent || '(空)',
    '',
    draft.sections?.length
      ? `章节：\n${draft.sections.map((s) => `- ${s.title}：${s.content}`).join('\n')}`
      : '',
    '',
    `目标文件：${draft.outputFileAbs}`,
  ].join('\n')
}

export async function runContentExportPptx(
  tenant: PresalesTenantContext,
  draftId: string,
): Promise<ContentDraftRecord> {
  const profileName = tenant.hermesProfileName
  let draft = await getContentDraft(tenant, draftId)
  if (!draft) throw new Error('Content draft not found')
  if (!draft.htmlContent?.trim() && !draft.sections?.length) {
    throw new Error('Draft has no HTML content to export')
  }

  draft = await ensureContentArtifact(tenant, draftId)
  if (!draft.outputFileAbs) throw new Error('Draft output path is not configured')

  const sessionId = `presales-content-export-${draftId}`
  createSession({
    id: sessionId,
    profile: profileName,
    source: 'presales_content',
    title: `Export PPT: ${draft.title}`,
  })

  let bridge: AgentBridgeClient | null = null
  try {
    bridge = new AgentBridgeClient({ connectRetryMs: 15_000, timeoutMs: 600_000 })
    const started = await bridge.chat(
      sessionId,
      buildExportPrompt(draft),
      [],
      buildExportInstructions(draft),
      profileName,
      { source: 'presales_content' },
    )

    for await (const chunk of bridge.streamOutput(started.run_id, { intervalMs: 300 })) {
      if (chunk.error) throw new Error(String(chunk.error))
    }

    const result = await bridge.getResult(started.run_id, { timeoutMs: 60_000 })
    if (result.error) throw new Error(String(result.error))

    if (!existsSync(draft.outputFileAbs)) {
      throw new Error(`PPT was not created at ${draft.outputFileAbs}`)
    }

    const refreshed = await getContentDraft(tenant, draftId)
    logger.info(
      { draftId, outputFile: draft.outputFile },
      '[presales-content] export pptx completed',
    )
    return refreshed || draft
  } catch (err) {
    logger.error(err, '[presales-content] export pptx failed for draft %s', draftId)
    throw err
  } finally {
    await bridge?.close()
  }
}
