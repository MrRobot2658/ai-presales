import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import {
  getContentDraftPath,
  getContentDraftPptDir,
  getContentDraftsRoot,
  toProfileRelPath,
} from './presales-profile-paths'
import { ensurePresalesProfileLayout } from './presales-profile-provision'
import type { PresalesTenantContext } from './tenant-context'

export type ContentDraftStatus = 'generating' | 'draft' | 'completed'

export interface ContentDraftSection {
  id: string
  title: string
  content: string
}

export interface ContentDraftRecord {
  id: string
  opportunityId: string
  companyName: string
  title: string
  scenario: string[]
  knowledgeRefs: string[]
  description: string
  status: ContentDraftStatus
  updatedAt: string
  htmlContent: string
  sections: ContentDraftSection[]
  outputDirectory: string
  outputDirectoryAbs: string
}

export interface CreateContentDraftInput {
  opportunityId: string
  companyName: string
  scenario: string[]
  knowledgeRefs: string[]
  description: string
}

function scenarioLabels(scenario: string[]): string[] {
  return scenario.map((value) => {
    if (value === 'bid-word') return '招投标 Word'
    if (value === 'product-ppt') return '产品介绍 PPT'
    if (value === 'case-ppt') return '案例 PPT'
    return value
  })
}

function defaultDraftHtml(companyName: string, scenarios: string[]): string {
  const scenarioText = scenarios.join('、') || '综合方案'
  return `<h1>${companyName} - ${scenarioText}</h1>
<section><h2>一、项目背景</h2><p>基于客户业务现状与行业趋势，梳理核心诉求与成功指标。</p></section>
<section><h2>二、解决方案</h2><p>结合知识库内容与最佳实践，输出可落地的实施路径。</p></section>
<section><h2>三、价值与 ROI</h2><p>量化预期收益、里程碑与风险控制措施。</p></section>`
}

async function listDraftIds(profileName: string): Promise<string[]> {
  const root = getContentDraftsRoot(profileName)
  if (!existsSync(root)) return []
  const entries = await readdir(root, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.replace(/\.json$/, ''))
}

async function readDraft(profileName: string, draftId: string): Promise<ContentDraftRecord | null> {
  const path = getContentDraftPath(profileName, draftId)
  if (!existsSync(path)) return null
  const raw = await readFile(path, 'utf-8')
  return JSON.parse(raw) as ContentDraftRecord
}

async function writeDraft(profileName: string, draft: ContentDraftRecord): Promise<void> {
  const path = getContentDraftPath(profileName, draft.id)
  await writeFile(path, `${JSON.stringify(draft, null, 2)}\n`, 'utf-8')
}

export async function listContentDrafts(tenant: PresalesTenantContext): Promise<ContentDraftRecord[]> {
  await ensurePresalesProfileLayout(tenant.hermesProfileName)
  const ids = await listDraftIds(tenant.hermesProfileName)
  const drafts = await Promise.all(ids.map((id) => readDraft(tenant.hermesProfileName, id)))
  return drafts
    .filter((draft): draft is ContentDraftRecord => Boolean(draft))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export async function getContentDraft(
  tenant: PresalesTenantContext,
  draftId: string,
): Promise<ContentDraftRecord | null> {
  await ensurePresalesProfileLayout(tenant.hermesProfileName)
  return readDraft(tenant.hermesProfileName, draftId)
}

export async function createContentDraft(
  tenant: PresalesTenantContext,
  input: CreateContentDraftInput,
): Promise<ContentDraftRecord> {
  await ensurePresalesProfileLayout(tenant.hermesProfileName)
  const profileName = tenant.hermesProfileName
  const labels = scenarioLabels(input.scenario)
  const draftId = `draft-${randomUUID()}`
  const outputDirectoryAbs = getContentDraftPptDir(profileName, draftId)
  await mkdir(outputDirectoryAbs, { recursive: true })

  const draft: ContentDraftRecord = {
    id: draftId,
    opportunityId: input.opportunityId,
    companyName: input.companyName,
    title: `${input.companyName} - ${labels.join('/')}`,
    scenario: input.scenario,
    knowledgeRefs: input.knowledgeRefs,
    description: input.description,
    status: 'generating',
    updatedAt: new Date().toISOString(),
    htmlContent: defaultDraftHtml(input.companyName, labels),
    sections: [
      { id: 's1', title: '项目背景', content: '基于客户业务现状与行业趋势，梳理核心诉求。' },
      { id: 's2', title: '解决方案', content: '结合知识库输出可落地实施路径。' },
      { id: 's3', title: '价值与 ROI', content: '量化预期收益与里程碑。' },
    ],
    outputDirectory: toProfileRelPath(profileName, outputDirectoryAbs),
    outputDirectoryAbs,
  }

  await writeDraft(profileName, draft)
  return draft
}

export async function updateContentDraft(
  tenant: PresalesTenantContext,
  draftId: string,
  patch: Partial<Pick<ContentDraftRecord, 'status' | 'htmlContent' | 'sections' | 'title'>>,
): Promise<ContentDraftRecord | null> {
  const current = await getContentDraft(tenant, draftId)
  if (!current) return null

  const next: ContentDraftRecord = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
  }
  await writeDraft(tenant.hermesProfileName, next)
  return next
}
