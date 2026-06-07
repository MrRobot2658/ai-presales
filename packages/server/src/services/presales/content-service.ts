import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { basename, extname, join } from 'path'
import { createHash, randomUUID } from 'crypto'
import {
  CONTENT_PPT_REL,
  getContentDraftPath,
  getContentDraftPptDir,
  getContentDraftsRoot,
  getContentPptRoot,
  toProfileRelPath,
} from './presales-profile-paths'
import { ensurePresalesProfileLayout } from './presales-profile-provision'
import type { PresalesTenantContext } from './tenant-context'

export type ContentDraftStatus = 'generating' | 'draft' | 'editing' | 'completed'

export interface ContentDraftSection {
  id: string
  title: string
  content: string
}

export type ContentDraftSource = 'draft' | 'imported'

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
  outputFile?: string
  outputFileAbs?: string
  source?: ContentDraftSource
}

export interface CreateContentDraftInput {
  opportunityId: string
  companyName: string
  scenario: string[]
  knowledgeRefs: string[]
  description: string
}

const CONTENT_PREVIEW_EXTENSIONS = new Set(['pptx', 'ppt', 'pdf'])

function isPresentableContentFilename(filename: string): boolean {
  const lower = filename.toLowerCase()
  if (filename.startsWith('.') || filename.startsWith('~$')) return false
  if (lower.endsWith('.bak')) return false
  const ext = extname(filename).replace(/^\./, '').toLowerCase()
  return CONTENT_PREVIEW_EXTENSIONS.has(ext)
}

function outputFileBasename(outputFile?: string): string {
  if (!outputFile) return ''
  return basename(outputFile.replace(/\\/g, '/'))
}

function sanitizeFileStem(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff-]+/g, '-').replace(/^-+|-+$/g, '') || '方案'
}

function buildDraftOutputPaths(profileName: string, draftId: string, companyName: string) {
  const outputDirectoryAbs = getContentDraftPptDir(profileName, draftId)
  const stem = sanitizeFileStem(`${companyName}-方案`)
  const outputFileAbs = join(outputDirectoryAbs, `${stem}.pptx`)
  return {
    outputDirectoryAbs,
    outputDirectory: toProfileRelPath(profileName, outputDirectoryAbs),
    outputFileAbs,
    outputFile: toProfileRelPath(profileName, outputFileAbs),
  }
}

export async function syncDraftHtmlFile(profileName: string, draft: ContentDraftRecord): Promise<void> {
  if (!draft.htmlContent?.trim()) return
  const htmlPath = join(getContentDraftsRoot(profileName), `${draft.id}.html`)
  const body = draft.htmlContent.trim()
  const title = draft.title || draft.companyName || '方案预览'
  const document = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${title.replace(/[<>&"]/g, '')}</title>
</head>
<body>
${body}
</body>
</html>`
  await writeFile(htmlPath, document, 'utf-8')
}

export async function ensureContentArtifact(
  tenant: PresalesTenantContext,
  draftId: string,
): Promise<ContentDraftRecord> {
  await ensurePresalesProfileLayout(tenant.hermesProfileName)
  const profileName = tenant.hermesProfileName
  let draft = await readDraft(profileName, draftId)
  if (!draft) throw new Error('Content draft not found')

  const paths = draft.outputFile && draft.outputFileAbs
    ? {
      outputDirectory: draft.outputDirectory,
      outputDirectoryAbs: draft.outputDirectoryAbs,
      outputFile: draft.outputFile,
      outputFileAbs: draft.outputFileAbs,
    }
    : buildDraftOutputPaths(profileName, draftId, draft.companyName || draft.title || '方案')

  if (draft.outputFileAbs && existsSync(draft.outputFileAbs)) {
    if (!draft.outputFile) {
      draft = {
        ...draft,
        ...paths,
        updatedAt: new Date().toISOString(),
      }
      await writeDraft(profileName, draft)
    }
    return draft
  }

  const { writeBlankPptx } = await import('./presales-pptx-blank')
  await mkdir(paths.outputDirectoryAbs!, { recursive: true })
  await writeBlankPptx(paths.outputFileAbs!, draft.title || draft.companyName || '新方案')

  const next: ContentDraftRecord = {
    ...draft,
    outputDirectory: paths.outputDirectory ?? draft.outputDirectory,
    outputDirectoryAbs: paths.outputDirectoryAbs ?? draft.outputDirectoryAbs,
    outputFile: paths.outputFile,
    outputFileAbs: paths.outputFileAbs,
    status: draft.status === 'generating' ? 'generating' : (draft.status || 'draft'),
    updatedAt: new Date().toISOString(),
  }
  await writeDraft(profileName, next)
  return next
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

function inferCompanyNameFromFilename(filename: string): string {
  const stem = basename(filename, extname(filename))
  const cleaned = stem.replace(/[-_]+/g, ' ').trim()
  return cleaned || 'Imported'
}

function buildImportDraftId(relPath: string): string {
  const hash = createHash('sha1').update(relPath).digest('hex').slice(0, 12)
  return `import-${hash}`
}

async function walkPptFiles(rootDir: string): Promise<string[]> {
  if (!existsSync(rootDir)) return []
  const files: string[] = []

  async function walk(current: string) {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const absPath = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(absPath)
        continue
      }
      if (isPresentableContentFilename(entry.name)) files.push(absPath)
    }
  }

  await walk(rootDir)
  return files
}

function collectKnownOutputFiles(drafts: ContentDraftRecord[]): Set<string> {
  const known = new Set<string>()
  for (const draft of drafts) {
    if (draft.outputFile) known.add(draft.outputFile.replace(/\\/g, '/'))
  }
  return known
}

/** Default content source: scan content/ppt/ and mirror into drafts metadata. */
async function syncProfilePptArtifacts(profileName: string): Promise<void> {
  const draftsRoot = getContentDraftsRoot(profileName)
  await mkdir(draftsRoot, { recursive: true })

  const existingIds = new Set(await listDraftIds(profileName))
  const existingDrafts = (await Promise.all(
    [...existingIds].map((id) => readDraft(profileName, id)),
  )).filter((draft): draft is ContentDraftRecord => Boolean(draft))

  const knownOutputFiles = collectKnownOutputFiles(existingDrafts)
  const outputFileToDraftId = new Map<string, string>()
  for (const draft of existingDrafts) {
    if (draft.outputFile) outputFileToDraftId.set(draft.outputFile.replace(/\\/g, '/'), draft.id)
  }

  const pptRoot = getContentPptRoot(profileName)
  const files = await walkPptFiles(pptRoot)
  const pptRelPaths = new Set<string>()

  for (const absPath of files) {
    const relPath = toProfileRelPath(profileName, absPath).replace(/\\/g, '/')
    pptRelPaths.add(relPath)
    const fileStat = await stat(absPath)
    const filename = basename(absPath)
    const mtime = fileStat.mtime.toISOString()
    const existingDraftId = outputFileToDraftId.get(relPath)

    if (existingDraftId) {
      const existing = existingDrafts.find((draft) => draft.id === existingDraftId)
      if (existing) {
        const next: ContentDraftRecord = {
          ...existing,
          title: filename,
          updatedAt: mtime,
          outputFile: relPath,
          outputFileAbs: absPath,
          outputDirectory: CONTENT_PPT_REL,
          outputDirectoryAbs: pptRoot,
        }
        if (
          existing.title !== next.title
          || existing.updatedAt !== next.updatedAt
          || existing.outputFile !== next.outputFile
          || existing.outputFileAbs !== next.outputFileAbs
        ) {
          await writeDraft(profileName, next)
        }
      }
      continue
    }

    if (knownOutputFiles.has(relPath)) continue

    const draftId = buildImportDraftId(relPath)
    if (existingIds.has(draftId)) {
      const existing = existingDrafts.find((draft) => draft.id === draftId)
      if (existing) {
        await writeDraft(profileName, {
          ...existing,
          title: filename,
          updatedAt: mtime,
          outputFile: relPath,
          outputFileAbs: absPath,
          outputDirectory: CONTENT_PPT_REL,
          outputDirectoryAbs: pptRoot,
          source: 'imported',
          status: 'completed',
        })
      }
      continue
    }

    const draft: ContentDraftRecord = {
      id: draftId,
      opportunityId: '',
      companyName: inferCompanyNameFromFilename(filename),
      title: filename,
      scenario: ['product-ppt'],
      knowledgeRefs: [],
      description: 'Imported from content/ppt',
      status: 'completed',
      updatedAt: mtime,
      htmlContent: '',
      sections: [],
      outputDirectory: CONTENT_PPT_REL,
      outputDirectoryAbs: pptRoot,
      outputFile: relPath,
      outputFileAbs: absPath,
      source: 'imported',
    }

    await writeDraft(profileName, draft)
    existingIds.add(draftId)
    knownOutputFiles.add(relPath)
    outputFileToDraftId.set(relPath, draftId)
  }

  for (const draft of existingDrafts) {
    if (draft.source !== 'imported' || !draft.outputFile) continue
    const relPath = draft.outputFile.replace(/\\/g, '/')
    if (pptRelPaths.has(relPath)) continue
    await unlink(getContentDraftPath(profileName, draft.id)).catch(() => undefined)
  }
}

export async function getContentArtifactPath(
  tenant: PresalesTenantContext,
  draftId: string,
): Promise<{ absPath: string; filename: string } | null> {
  await ensurePresalesProfileLayout(tenant.hermesProfileName)
  const draft = await readDraft(tenant.hermesProfileName, draftId)
  if (draft?.outputFileAbs && existsSync(draft.outputFileAbs)) {
    return { absPath: draft.outputFileAbs, filename: basename(draft.outputFileAbs) }
  }

  const pptRoot = getContentPptRoot(tenant.hermesProfileName)
  const files = await walkPptFiles(pptRoot)
  for (const absPath of files) {
    if (buildImportDraftId(toProfileRelPath(tenant.hermesProfileName, absPath)) === draftId) {
      return { absPath, filename: basename(absPath) }
    }
  }

  return null
}

export async function listContentDrafts(tenant: PresalesTenantContext): Promise<ContentDraftRecord[]> {
  await ensurePresalesProfileLayout(tenant.hermesProfileName)
  await syncProfilePptArtifacts(tenant.hermesProfileName)

  const ids = await listDraftIds(tenant.hermesProfileName)
  const drafts = await Promise.all(ids.map((id) => readDraft(tenant.hermesProfileName, id)))

  return drafts
    .filter((draft): draft is ContentDraftRecord => Boolean(draft))
    .filter((draft) => {
      if (draft.source === 'imported' || draft.status === 'completed' || draft.status === 'editing') {
        return Boolean(draft.outputFile?.startsWith(`${CONTENT_PPT_REL}/`))
      }
      return draft.status === 'generating' || draft.status === 'draft'
    })
    .map((draft) => ({
      ...draft,
      title: outputFileBasename(draft.outputFile) || draft.title,
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export async function getContentDraft(
  tenant: PresalesTenantContext,
  draftId: string,
): Promise<ContentDraftRecord | null> {
  await ensurePresalesProfileLayout(tenant.hermesProfileName)
  await syncProfilePptArtifacts(tenant.hermesProfileName)
  const draft = await readDraft(tenant.hermesProfileName, draftId)
  if (!draft) return null
  return {
    ...draft,
    title: outputFileBasename(draft.outputFile) || draft.title,
  }
}

export async function createContentDraft(
  tenant: PresalesTenantContext,
  input: CreateContentDraftInput,
): Promise<ContentDraftRecord> {
  await ensurePresalesProfileLayout(tenant.hermesProfileName)
  const profileName = tenant.hermesProfileName
  const labels = scenarioLabels(input.scenario)
  const draftId = `draft-${randomUUID()}`
  const outputPaths = buildDraftOutputPaths(profileName, draftId, input.companyName)
  await mkdir(outputPaths.outputDirectoryAbs, { recursive: true })

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
    outputDirectory: outputPaths.outputDirectory,
    outputDirectoryAbs: outputPaths.outputDirectoryAbs,
    outputFile: outputPaths.outputFile,
    outputFileAbs: outputPaths.outputFileAbs,
    source: 'draft',
  }

  await writeDraft(profileName, draft)
  await syncDraftHtmlFile(profileName, draft)
  return draft
}

export async function updateContentDraft(
  tenant: PresalesTenantContext,
  draftId: string,
  patch: Partial<Pick<ContentDraftRecord, 'status' | 'htmlContent' | 'sections' | 'title' | 'outputFile' | 'outputFileAbs'>>,
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
  await syncDraftHtmlFile(tenant.hermesProfileName, next)
  return next
}
