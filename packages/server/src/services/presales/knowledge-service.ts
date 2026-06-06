import { createHash } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { extname } from 'path'
import { pgQuery, withPgTransaction } from '../../db/postgres/pool'
import { enqueueKnowledgeIngest, isRedisConfigured } from './knowledge-queue'
import type { PresalesTenantContext } from './tenant-context'
import {
  buildKnowledgeRawPaths,
  inferFileType,
  inferMimeType,
  sanitizeFilename,
} from './knowledge-paths'
import { ensurePresalesProfileLayout } from './presales-profile-provision'

export interface KnowledgeListItem {
  id: string
  fileName: string
  fileType: string
  uploadedAt: string
  status: 'ready' | 'processing' | 'failed'
  cleanRequirement?: string
  hermesProfileRelPath?: string
  profile: string
}

interface KnowledgeListRow {
  id: string
  file_name: string
  file_type: string
  uploaded_at: Date
  status: string
  clean_requirement: string | null
  hermes_profile_rel_path: string | null
  profile: string
}

function mapStatus(status: string): KnowledgeListItem['status'] {
  if (status === 'ready') return 'ready'
  if (status === 'failed') return 'failed'
  if (status === 'processing' || status === 'reviewing' || status === 'pending') return 'processing'
  return 'processing'
}

function formatDisplayTime(value: Date | string | null | undefined): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', { hour12: false })
}

export async function listKnowledgeAssets(tenant: PresalesTenantContext): Promise<KnowledgeListItem[]> {
  const { rows } = await pgQuery<KnowledgeListRow>(
    `SELECT
       id,
       file_name,
       file_type,
       uploaded_at,
       status::text,
       clean_requirement,
       hermes_profile_rel_path,
       profile
     FROM v_knowledge_assets_list
     WHERE tenant_id = $1
     ORDER BY uploaded_at DESC`,
    [tenant.tenantId],
  )

  return rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    fileType: row.file_type,
    uploadedAt: formatDisplayTime(row.uploaded_at),
    status: mapStatus(row.status),
    cleanRequirement: row.clean_requirement || undefined,
    hermesProfileRelPath: row.hermes_profile_rel_path || undefined,
    profile: row.profile,
  }))
}

export interface UploadKnowledgeInput {
  tenant: PresalesTenantContext
  fileBuffer: Buffer
  originalFilename: string
  cleanRequirement: string
  mimeType?: string
}

export async function uploadKnowledgeAsset(input: UploadKnowledgeInput): Promise<KnowledgeListItem> {
  const { tenant, fileBuffer, cleanRequirement } = input
  await ensurePresalesProfileLayout(tenant.hermesProfileName)
  const originalFilename = sanitizeFilename(input.originalFilename)
  const mimeType = input.mimeType || inferMimeType(originalFilename)
  const fileType = inferFileType(originalFilename, mimeType)
  const fileExt = extname(originalFilename).replace(/^\./, '')
  const checksum = createHash('sha256').update(fileBuffer).digest('hex')

  const created = await withPgTransaction(async (client) => {
    const assetInsert = await client.query<{ id: string }>(
      `INSERT INTO knowledge_assets (
         tenant_id, profile, uploaded_by, uploaded_by_account_id,
         original_filename, file_type, mime_type, file_ext, size_bytes,
         storage_path, checksum_sha256, status,
         hermes_profile_rel_path, hermes_sync_status, hermes_synced_at
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8, $9,
         $10, $11, 'processing',
         $12, 'pending', NULL
       )
       RETURNING id`,
      [
        tenant.tenantId,
        tenant.hermesProfileName,
        tenant.username,
        tenant.accountId,
        originalFilename,
        fileType,
        mimeType,
        fileExt,
        fileBuffer.length,
        'pending',
        checksum,
        'pending',
      ],
    )

    const assetId = assetInsert.rows[0]?.id
    if (!assetId) throw new Error('Failed to create knowledge asset')

    const paths = buildKnowledgeRawPaths(tenant.hermesProfileName, assetId, originalFilename)
    await mkdir(paths.dir, { recursive: true })
    await writeFile(paths.absPath, fileBuffer)

    await client.query(
      `UPDATE knowledge_assets
       SET storage_path = $2,
           hermes_profile_rel_path = $3,
           hermes_sync_status = 'synced',
           hermes_synced_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [assetId, paths.absPath, paths.relPath],
    )

    const jobInsert = await client.query<{ id: string }>(
      `INSERT INTO knowledge_ingest_jobs (
         asset_id, tenant_id, profile, clean_requirement, status, trigger_type
       ) VALUES ($1, $2, $3, $4, 'queued', 'upload')
       RETURNING id`,
      [assetId, tenant.tenantId, tenant.hermesProfileName, cleanRequirement],
    )
    const ingestJobId = jobInsert.rows[0]?.id
    if (!ingestJobId) throw new Error('Failed to create ingest job')

    await client.query(
      `INSERT INTO knowledge_asset_events (asset_id, event_type, actor_user_id, payload)
       VALUES ($1, 'upload', $2, $3::jsonb)`,
      [
        assetId,
        tenant.username,
        JSON.stringify({
          profile: tenant.hermesProfileName,
          relPath: paths.relPath,
          sizeBytes: fileBuffer.length,
        }),
      ],
    )

    const { rows } = await client.query<KnowledgeListRow & { ingest_job_id: string }>(
      `SELECT
         a.id,
         a.original_filename AS file_name,
         a.file_type,
         a.created_at AS uploaded_at,
         a.status::text,
         j.clean_requirement,
         a.hermes_profile_rel_path,
         a.profile,
         j.id AS ingest_job_id
       FROM knowledge_assets a
       JOIN knowledge_ingest_jobs j ON j.id = $2
       WHERE a.id = $1`,
      [assetId, ingestJobId],
    )

    const row = rows[0]
    if (!row) return null

    return {
      row: {
        id: row.id,
        file_name: row.file_name,
        file_type: row.file_type,
        uploaded_at: row.uploaded_at,
        status: row.status,
        clean_requirement: row.clean_requirement,
        hermes_profile_rel_path: row.hermes_profile_rel_path,
        profile: row.profile,
      },
      ingestJobId,
      assetId,
      paths,
    }
  })

  if (!created) throw new Error('Failed to load uploaded knowledge asset')

  if (isRedisConfigured()) {
    await enqueueKnowledgeIngest({
      ingestJobId: created.ingestJobId,
      assetId: created.assetId,
      tenantId: tenant.tenantId,
      profileName: tenant.hermesProfileName,
      cleanRequirement,
      storagePath: created.paths.absPath,
      relPath: created.paths.relPath,
      originalFilename,
    })
  }

  const item = created.row
  return {
    id: item.id,
    fileName: item.file_name,
    fileType: item.file_type,
    uploadedAt: formatDisplayTime(item.uploaded_at),
    status: mapStatus(item.status),
    cleanRequirement: item.clean_requirement || undefined,
    hermesProfileRelPath: item.hermes_profile_rel_path || undefined,
    profile: item.profile,
  }
}
