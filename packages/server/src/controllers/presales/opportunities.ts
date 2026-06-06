import type { Context } from 'koa'
import {
  getOpportunity,
  listOpportunities,
  updateOpportunity,
} from '../../services/presales/opportunity-service'
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

  const items = await listOpportunities(tenant)
  const manifest = await readPresalesManifest(tenant.hermesProfileName)
  ctx.body = {
    items,
    tenant: tenantSummary(ctx),
    profileFile: manifest.directories.opportunitiesFile,
    manifestFile: manifest.directories.manifestFile,
  }
}

export async function get(ctx: Context) {
  const tenant = ctx.state.presalesTenant
  if (!tenant) {
    ctx.status = 403
    ctx.body = { error: 'Tenant context is required' }
    return
  }

  const item = await getOpportunity(tenant, ctx.params.id)
  if (!item) {
    ctx.status = 404
    ctx.body = { error: 'Opportunity not found' }
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
  const item = await updateOpportunity(tenant, ctx.params.id, body as any)
  if (!item) {
    ctx.status = 404
    ctx.body = { error: 'Opportunity not found' }
    return
  }

  ctx.body = { item, tenant: tenantSummary(ctx) }
}

export async function manifest(ctx: Context) {
  const tenant = ctx.state.presalesTenant
  if (!tenant) {
    ctx.status = 403
    ctx.body = { error: 'Tenant context is required' }
    return
  }

  ctx.body = {
    manifest: await readPresalesManifest(tenant.hermesProfileName),
    tenant: tenantSummary(ctx),
  }
}
