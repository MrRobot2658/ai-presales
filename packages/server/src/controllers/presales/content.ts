import type { Context } from 'koa'
import { createReadStream } from 'fs'
import {
  createContentDraft,
  getContentArtifactPath,
  getContentDraft,
  listContentDrafts,
  updateContentDraft,
} from '../../services/presales/content-service'
import { readPresalesManifest } from '../../services/presales/presales-profile-provision'

function tenantSummary(ctx: Context) {
  const tenant = ctx.state.presalesTenant!
  return {
    id: tenant.tenantId,
    slug: tenant.tenantSlug,
    name: tenant.tenantName,
    hermesProfileName: tenant.hermesProfileName,
  }
}

export async function list(ctx: Context) {
  const tenant = ctx.state.presalesTenant
  if (!tenant) {
    ctx.status = 403
    ctx.body = { error: 'Tenant context is required' }
    return
  }

  const items = await listContentDrafts(tenant)
  const manifest = await readPresalesManifest(tenant.hermesProfileName)
  ctx.body = {
    items,
    tenant: tenantSummary(ctx),
    defaultPptDirectory: manifest.defaults.generatedPptDirectory,
  }
}

export async function create(ctx: Context) {
  const tenant = ctx.state.presalesTenant
  if (!tenant) {
    ctx.status = 403
    ctx.body = { error: 'Tenant context is required' }
    return
  }

  const body = (ctx.request.body || {}) as Record<string, unknown>
  const opportunityId = String(body.opportunityId || '').trim()
  const companyName = String(body.companyName || '').trim()
  if (!opportunityId || !companyName) {
    ctx.status = 400
    ctx.body = { error: 'opportunityId and companyName are required' }
    return
  }

  const item = await createContentDraft(tenant, {
    opportunityId,
    companyName,
    scenario: Array.isArray(body.scenario) ? body.scenario.map(String) : [],
    knowledgeRefs: Array.isArray(body.knowledgeRefs) ? body.knowledgeRefs.map(String) : [],
    description: String(body.description || ''),
  })

  ctx.status = 201
  ctx.body = { item, tenant: tenantSummary(ctx) }
}

export async function get(ctx: Context) {
  const tenant = ctx.state.presalesTenant
  if (!tenant) {
    ctx.status = 403
    ctx.body = { error: 'Tenant context is required' }
    return
  }

  const item = await getContentDraft(tenant, ctx.params.id)
  if (!item) {
    ctx.status = 404
    ctx.body = { error: 'Content draft not found' }
    return
  }

  ctx.body = { item, tenant: tenantSummary(ctx) }
}

export async function patch(ctx: Context) {
  const tenant = ctx.state.presalesTenant
  if (!tenant) {
    ctx.status = 403
    ctx.body = { error: 'Tenant context is required' }
    return
  }

  const body = (ctx.request.body || {}) as Record<string, unknown>
  const item = await updateContentDraft(tenant, ctx.params.id, {
    status: body.status as any,
    htmlContent: typeof body.htmlContent === 'string' ? body.htmlContent : undefined,
    sections: Array.isArray(body.sections) ? body.sections as any : undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
  })

  if (!item) {
    ctx.status = 404
    ctx.body = { error: 'Content draft not found' }
    return
  }

  ctx.body = { item, tenant: tenantSummary(ctx) }
}

export async function download(ctx: Context) {
  const tenant = ctx.state.presalesTenant
  if (!tenant) {
    ctx.status = 403
    ctx.body = { error: 'Tenant context is required' }
    return
  }

  const artifact = await getContentArtifactPath(tenant, ctx.params.id)
  if (!artifact) {
    ctx.status = 404
    ctx.body = { error: 'Content file not found' }
    return
  }

  ctx.set('Content-Type', 'application/octet-stream')
  ctx.set('Content-Disposition', `attachment; filename="${encodeURIComponent(artifact.filename)}"`)
  ctx.body = createReadStream(artifact.absPath)
}
