import type { Context } from 'koa'
import { readMultipartBody } from '../../lib/multipart'
import { isPostgresConfigured } from '../../db/postgres/pool'
import { isRedisConfigured } from '../../services/presales/knowledge-queue'
import { listKnowledgeAssets, uploadKnowledgeAsset } from '../../services/presales/knowledge-service'

function handleServiceError(ctx: Context, err: any): void {
  const code = err?.code || 'unknown'
  const statusMap: Record<string, number> = {
    postgres_unavailable: 503,
    invalid_content_type: 400,
    missing_boundary: 400,
    file_too_large: 413,
    missing_file: 400,
  }
  ctx.status = statusMap[code] || 500
  ctx.body = { error: err?.message || 'Request failed', code }
}

export async function list(ctx: Context) {
  if (!isPostgresConfigured()) {
    ctx.status = 503
    ctx.body = { error: 'PostgreSQL is not configured' }
    return
  }

  const tenant = ctx.state.presalesTenant
  if (!tenant) {
    ctx.status = 403
    ctx.body = { error: 'Tenant context is required' }
    return
  }

  try {
    const items = await listKnowledgeAssets(tenant)
    ctx.body = {
      items,
      tenant: {
        id: tenant.tenantId,
        slug: tenant.tenantSlug,
        name: tenant.tenantName,
        hermesProfileName: tenant.hermesProfileName,
      },
    }
  } catch (err: any) {
    handleServiceError(ctx, err)
  }
}

export async function upload(ctx: Context) {
  if (!isPostgresConfigured()) {
    ctx.status = 503
    ctx.body = { error: 'PostgreSQL is not configured' }
    return
  }

  const tenant = ctx.state.presalesTenant
  if (!tenant) {
    ctx.status = 403
    ctx.body = { error: 'Tenant context is required' }
    return
  }

  if (!isRedisConfigured()) {
    ctx.status = 503
    ctx.body = { error: 'Redis queue is not configured for knowledge ingest' }
    return
  }

  try {
    const contentType = ctx.get('content-type') || ''
    const parsed = await readMultipartBody(ctx.req, contentType)
    const file = parsed.files.find((entry) => entry.name === 'file') || parsed.files[0]
    if (!file?.filename) {
      ctx.status = 400
      ctx.body = { error: 'Missing file upload', code: 'missing_file' }
      return
    }

    const cleanRequirement = (parsed.fields.cleanRequirement || '').trim()
    const item = await uploadKnowledgeAsset({
      tenant,
      fileBuffer: file.data,
      originalFilename: file.filename,
      cleanRequirement,
    })

    ctx.status = 201
    ctx.body = { item }
  } catch (err: any) {
    handleServiceError(ctx, err)
  }
}
