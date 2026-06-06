import type { Context } from 'koa'
import {
  createOpportunity,
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

export async function create(ctx: Context) {
  const tenant = ctx.state.presalesTenant
  if (!tenant) {
    ctx.status = 403
    ctx.body = { error: 'Tenant context is required' }
    return
  }

  const body = (ctx.request.body || {}) as Record<string, unknown>
  const companyName = String(body.companyName || '').trim()
  if (!companyName) {
    ctx.status = 400
    ctx.body = { error: 'companyName is required', code: 'missing_company_name' }
    return
  }

  try {
    const item = await createOpportunity(tenant, {
      source: typeof body.source === 'string' ? body.source : undefined,
      companyName,
      description: typeof body.description === 'string' ? body.description : undefined,
      industry: typeof body.industry === 'string' ? body.industry : undefined,
      contactName: typeof body.contactName === 'string' ? body.contactName : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      email: typeof body.email === 'string' ? body.email : undefined,
      position: typeof body.position === 'string' ? body.position : undefined,
      officeAddress: typeof body.officeAddress === 'string' ? body.officeAddress : undefined,
      hqLocation: typeof body.hqLocation === 'string' ? body.hqLocation : undefined,
      matchScore: typeof body.matchScore === 'number' ? body.matchScore : Number(body.matchScore),
      status: typeof body.status === 'string' ? body.status as any : undefined,
      companyInsight: typeof body.companyInsight === 'string' ? body.companyInsight : undefined,
      contactActivities: Array.isArray(body.contactActivities) ? body.contactActivities.map(String) : undefined,
    })
    ctx.status = 201
    ctx.body = { item, tenant: tenantSummary(ctx) }
  } catch (err: any) {
    if (err?.code === 'missing_company_name') {
      ctx.status = 400
      ctx.body = { error: err.message, code: err.code }
      return
    }
    throw err
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
