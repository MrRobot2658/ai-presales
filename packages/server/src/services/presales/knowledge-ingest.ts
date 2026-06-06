import { mkdir, readFile, writeFile } from 'fs/promises'
import { join, extname } from 'path'
import { pgQuery, withPgTransaction } from '../../db/postgres/pool'
import { createSession } from '../../db/hermes/session-store'
import { AgentBridgeClient } from '../hermes/agent-bridge'
import { getProfileDir } from '../hermes/hermes-profile'
import { logger } from '../logger'
import type { KnowledgeIngestQueuePayload } from './knowledge-queue'
import { sanitizeFilename } from './knowledge-paths'

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'json'])

interface ParsedCleanResult {
  summary: string
  markdown: string
  sections: Array<{ title: string; content: string }>
}

function buildProcessedPaths(profileName: string, assetId: string) {
  const dir = join(getProfileDir(profileName), 'knowledge', 'processed', assetId)
  const relPath = `knowledge/processed/${assetId}/cleaned.md`
  const absPath = join(dir, 'cleaned.md')
  return { dir, relPath, absPath }
}

async function readSourceSnippet(absPath: string, originalFilename: string): Promise<string> {
  const ext = extname(originalFilename).replace(/^\./, '').toLowerCase()
  if (!TEXT_EXTENSIONS.has(ext)) return ''
  try {
    const content = await readFile(absPath, 'utf-8')
    return content.slice(0, 120_000)
  } catch {
    return ''
  }
}

function buildIngestInstructions(cleanRequirement: string, originalFilename: string, relPath: string, absPath: string): string {
  return [
    '你是售前知识库清洗助手。请阅读用户提供的文档内容或文件路径，整理为结构化 Markdown 知识条目。',
    cleanRequirement ? `清洗要求：${cleanRequirement}` : '清洗要求：保留章节结构，去除无关噪声，输出清晰 Markdown。',
    `原始文件：${originalFilename}`,
    `Profile 内路径：${relPath}`,
    `绝对路径（可用工具读取）：${absPath}`,
    '输出要求：',
    '1. 先输出完整 Markdown 正文',
    '2. 最后一行单独输出 JSON（不要代码块包裹），格式：',
    '{"summary":"一句话摘要","sections":[{"title":"章节标题","content":"章节正文"}]}',
  ].join('\n')
}

function parseAgentOutput(output: string): ParsedCleanResult {
  const trimmed = output.trim()
  const lines = trimmed.split('\n')
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]?.trim()
    if (!line?.startsWith('{') || !line.endsWith('}')) continue
    try {
      const parsed = JSON.parse(line) as { summary?: string; sections?: Array<{ title?: string; content?: string }> }
      const markdown = lines.slice(0, i).join('\n').trim() || trimmed
      const sections = Array.isArray(parsed.sections)
        ? parsed.sections
          .filter(section => section?.title && section?.content)
          .map(section => ({ title: String(section.title), content: String(section.content) }))
        : []
      return {
        summary: String(parsed.summary || '').trim(),
        markdown: markdown || trimmed,
        sections: sections.length > 0 ? sections : splitMarkdownSections(markdown || trimmed),
      }
    } catch {
      continue
    }
  }

  const markdown = trimmed
  return {
    summary: markdown.split('\n').find(line => line.trim())?.slice(0, 200) || originalFallbackSummary(markdown),
    markdown,
    sections: splitMarkdownSections(markdown),
  }
}

function originalFallbackSummary(markdown: string): string {
  return markdown.replace(/\s+/g, ' ').slice(0, 120)
}

function splitMarkdownSections(markdown: string): Array<{ title: string; content: string }> {
  const parts = markdown.split(/^##\s+/m).filter(Boolean)
  if (parts.length <= 1) {
    return [{ title: '正文', content: markdown.trim() }]
  }
  return parts.map((part, index) => {
    const [titleLine, ...rest] = part.split('\n')
    return {
      title: (titleLine || `章节 ${index + 1}`).trim(),
      content: rest.join('\n').trim(),
    }
  })
}

async function markJobProcessing(ingestJobId: string, assetId: string, sessionId: string): Promise<void> {
  await withPgTransaction(async (client) => {
    await client.query(
      `UPDATE knowledge_ingest_jobs
       SET status = 'processing', started_at = now(), hermes_session_id = $2, updated_at = now()
       WHERE id = $1`,
      [ingestJobId, sessionId],
    )
    await client.query(
      `UPDATE knowledge_assets SET status = 'processing', updated_at = now() WHERE id = $1`,
      [assetId],
    )
  })
}

async function markJobSuccess(
  payload: KnowledgeIngestQueuePayload,
  sessionId: string,
  parsed: ParsedCleanResult,
  processedAbsPath: string,
  processedRelPath: string,
): Promise<void> {
  await withPgTransaction(async (client) => {
    await client.query(
      `UPDATE knowledge_ingest_jobs
       SET status = 'completed',
           completed_at = now(),
           result_storage_path = $2,
           result_preview = $3,
           hermes_session_id = $4,
           updated_at = now()
       WHERE id = $1`,
      [payload.ingestJobId, processedAbsPath, parsed.summary.slice(0, 500), sessionId],
    )

    await client.query(
      `UPDATE knowledge_assets
       SET status = 'ready',
           clean_summary = $2,
           ready_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [payload.assetId, parsed.summary || null],
    )

    await client.query(`DELETE FROM knowledge_chunks WHERE asset_id = $1`, [payload.assetId])

    const sections = parsed.sections.length > 0
      ? parsed.sections
      : [{ title: '正文', content: parsed.markdown }]

    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index]
      await client.query(
        `INSERT INTO knowledge_chunks (asset_id, job_id, chunk_index, heading, content)
         VALUES ($1, $2, $3, $4, $5)`,
        [payload.assetId, payload.ingestJobId, index, section.title, section.content],
      )
    }

    await client.query(
      `INSERT INTO knowledge_asset_events (asset_id, job_id, event_type, payload)
       VALUES ($1, $2, 'ingest_completed', $3::jsonb)`,
      [payload.assetId, payload.ingestJobId, JSON.stringify({ relPath: processedRelPath, chunks: sections.length })],
    )
  })
}

async function markJobFailed(payload: KnowledgeIngestQueuePayload, sessionId: string | null, errorMessage: string): Promise<void> {
  await withPgTransaction(async (client) => {
    await client.query(
      `UPDATE knowledge_ingest_jobs
       SET status = 'failed',
           completed_at = now(),
           error_message = $2,
           hermes_session_id = COALESCE($3, hermes_session_id),
           updated_at = now()
       WHERE id = $1`,
      [payload.ingestJobId, errorMessage.slice(0, 4000), sessionId],
    )
    await client.query(
      `UPDATE knowledge_assets SET status = 'failed', updated_at = now() WHERE id = $1`,
      [payload.assetId],
    )
    await client.query(
      `INSERT INTO knowledge_asset_events (asset_id, job_id, event_type, payload)
       VALUES ($1, $2, 'ingest_failed', $3::jsonb)`,
      [payload.assetId, payload.ingestJobId, JSON.stringify({ error: errorMessage.slice(0, 1000) })],
    )
  })
}

export async function runKnowledgeIngestJob(payload: KnowledgeIngestQueuePayload): Promise<void> {
  const sessionId = `pk-${payload.assetId}`
  let bridge: AgentBridgeClient | null = null

  try {
    createSession({
      id: sessionId,
      profile: payload.profileName,
      source: 'presales_knowledge',
      title: `Knowledge ingest: ${payload.originalFilename}`,
    })

    await markJobProcessing(payload.ingestJobId, payload.assetId, sessionId)

    const sourceSnippet = await readSourceSnippet(payload.storagePath, payload.originalFilename)
    const instructions = buildIngestInstructions(
      payload.cleanRequirement,
      payload.originalFilename,
      payload.relPath,
      payload.storagePath,
    )

    const userMessage = sourceSnippet
      ? `请清洗以下文档内容：\n\n${sourceSnippet}`
      : `请清洗附件文档。文件路径：${payload.storagePath}`

    bridge = new AgentBridgeClient({ connectRetryMs: 15_000, timeoutMs: 300_000 })
    const started = await bridge.chat(sessionId, userMessage, [], instructions, payload.profileName, {
      source: 'presales_knowledge',
    })

    let output = ''
    for await (const chunk of bridge.streamOutput(started.run_id, { intervalMs: 200 })) {
      if (chunk.output) output = chunk.output
      if (chunk.error) throw new Error(String(chunk.error))
    }

    if (!output.trim()) {
      const result = await bridge.getResult(started.run_id, { timeoutMs: 300_000 })
      output = result.output || ''
      if (result.error) throw new Error(String(result.error))
    }

    if (!output.trim()) {
      throw new Error('Agent returned empty output')
    }

    const parsed = parseAgentOutput(output)
    const processed = buildProcessedPaths(payload.profileName, payload.assetId)
    await mkdir(processed.dir, { recursive: true })
    await writeFile(processed.absPath, parsed.markdown, 'utf-8')

    await markJobSuccess(payload, sessionId, parsed, processed.absPath, processed.relPath)
    logger.info(
      { assetId: payload.assetId, profile: payload.profileName, chunks: parsed.sections.length },
      '[presales-knowledge] ingest completed',
    )
  } catch (err: any) {
    const message = err?.message || String(err)
    logger.error(err, '[presales-knowledge] ingest failed for asset %s', payload.assetId)
    await markJobFailed(payload, sessionId, message)
    throw err
  } finally {
    await bridge?.close()
  }
}

export async function getIngestJobPayload(ingestJobId: string): Promise<KnowledgeIngestQueuePayload | null> {
  const { rows } = await pgQuery<{
    ingest_job_id: string
    asset_id: string
    tenant_id: string
    profile: string
    clean_requirement: string
    storage_path: string
    hermes_profile_rel_path: string
    original_filename: string
  }>(
    `SELECT
       j.id AS ingest_job_id,
       a.id AS asset_id,
       a.tenant_id,
       a.profile,
       j.clean_requirement,
       a.storage_path,
       a.hermes_profile_rel_path,
       a.original_filename
     FROM knowledge_ingest_jobs j
     JOIN knowledge_assets a ON a.id = j.asset_id
     WHERE j.id = $1`,
    [ingestJobId],
  )

  const row = rows[0]
  if (!row?.tenant_id || !row.storage_path || !row.hermes_profile_rel_path) return null

  return {
    ingestJobId: row.ingest_job_id,
    assetId: row.asset_id,
    tenantId: row.tenant_id,
    profileName: row.profile,
    cleanRequirement: row.clean_requirement || '',
    storagePath: row.storage_path,
    relPath: row.hermes_profile_rel_path,
    originalFilename: sanitizeFilename(row.original_filename),
  }
}
