import type { Context } from 'koa'
import { pgQuery } from '../../db/postgres/pool'

export interface PresalesTenantContext {
  tenantId: string
  tenantSlug: string
  tenantName: string
  hermesProfileName: string
  accountId: string
  webuiUserId: number
  username: string
}

interface TenantRow {
  tenant_id: string
  tenant_slug: string
  tenant_name: string
  hermes_profile_name: string
  account_id: string
  webui_user_id: number
  username: string
}

function requestedTenantSlug(ctx: Context): string {
  const header = ctx.get('x-tenant-slug').trim()
  const query = typeof ctx.query.tenant === 'string' ? ctx.query.tenant.trim() : ''
  return header || query
}

export async function resolvePresalesTenantForUser(
  webuiUserId: number,
  tenantSlug?: string,
): Promise<PresalesTenantContext | null> {
  const params: unknown[] = [webuiUserId]
  let slugFilter = ''
  if (tenantSlug) {
    params.push(tenantSlug)
    slugFilter = 'AND t.slug = $2'
  }

  const { rows } = await pgQuery<TenantRow>(
    `SELECT
       t.id AS tenant_id,
       t.slug AS tenant_slug,
       t.name AS tenant_name,
       t.hermes_profile_name,
       ta.id AS account_id,
       ta.webui_user_id,
       ta.username
     FROM tenant_accounts ta
     JOIN tenants t ON t.id = ta.tenant_id
     WHERE ta.webui_user_id = $1
       AND ta.status = 'active'
       AND t.status = 'active'
       ${slugFilter}
     ORDER BY ta.is_tenant_owner DESC, ta.created_at ASC
     LIMIT 1`,
    params,
  )

  const row = rows[0]
  if (!row) return null

  return {
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantName: row.tenant_name,
    hermesProfileName: row.hermes_profile_name,
    accountId: row.account_id,
    webuiUserId: row.webui_user_id,
    username: row.username,
  }
}

interface SuperAdminTenantRow {
  tenant_id: string
  tenant_slug: string
  tenant_name: string
  hermes_profile_name: string
  account_id: string | null
  owner_username: string | null
}

export async function resolvePresalesTenantForSuperAdmin(
  user: { id: number; username: string },
  tenantSlug?: string,
): Promise<PresalesTenantContext | null> {
  const params: unknown[] = []
  let slugFilter = "WHERE t.status = 'active'"
  if (tenantSlug) {
    params.push(tenantSlug)
    slugFilter = "WHERE t.slug = $1 AND t.status = 'active'"
  }

  const { rows } = await pgQuery<SuperAdminTenantRow>(
    `SELECT
       t.id AS tenant_id,
       t.slug AS tenant_slug,
       t.name AS tenant_name,
       t.hermes_profile_name,
       ta.id AS account_id,
       ta.username AS owner_username
     FROM tenants t
     LEFT JOIN LATERAL (
       SELECT id, username
       FROM tenant_accounts
       WHERE tenant_id = t.id
         AND status = 'active'
       ORDER BY is_tenant_owner DESC, created_at ASC
       LIMIT 1
     ) ta ON true
     ${slugFilter}
     ORDER BY t.created_at ASC
     LIMIT 1`,
    params,
  )

  const row = rows[0]
  if (!row) return null

  return {
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantName: row.tenant_name,
    hermesProfileName: row.hermes_profile_name,
    accountId: row.account_id || '',
    webuiUserId: user.id,
    username: user.username,
  }
}

export async function resolvePresalesTenant(
  user: { id: number; username: string; role: string },
  tenantSlug?: string,
): Promise<PresalesTenantContext | null> {
  const memberTenant = await resolvePresalesTenantForUser(user.id, tenantSlug)
  if (memberTenant) return memberTenant
  if (user.role !== 'super_admin') return null
  return resolvePresalesTenantForSuperAdmin(user, tenantSlug)
}

declare module 'koa' {
  interface DefaultState {
    presalesTenant?: PresalesTenantContext
  }
}

export async function requirePresalesTenant(ctx: Context, next: () => Promise<void>): Promise<void> {
  const user = ctx.state.user
  if (!user) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }

  try {
    const tenant = await resolvePresalesTenant(user, requestedTenantSlug(ctx) || undefined)
    if (!tenant) {
      ctx.status = 403
      ctx.body = { error: 'No active presales tenant is available for this account' }
      return
    }

    ctx.state.presalesTenant = tenant
    ctx.state.profile = { name: tenant.hermesProfileName }
    await next()
  } catch (err: any) {
    if (err?.code === 'postgres_unavailable') {
      ctx.status = 503
      ctx.body = { error: 'Presales database is unavailable' }
      return
    }
    throw err
  }
}
