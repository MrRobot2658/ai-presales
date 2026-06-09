import type { Context } from 'koa'
import { pgQuery } from '../../db/postgres/pool'
import { provisionTenant } from '../../services/presales/tenant-provision'

interface TenantListRow {
  tenant_id: string
  tenant_slug: string
  tenant_name: string
  hermes_profile_name: string
  account_id: string
  role: string
  is_tenant_owner: boolean
}

function mapTenantRow(row: TenantListRow) {
  return {
    id: row.tenant_id,
    slug: row.tenant_slug,
    name: row.tenant_name,
    hermesProfileName: row.hermes_profile_name,
    accountId: row.account_id,
    role: row.role,
    isTenantOwner: row.is_tenant_owner,
  }
}

export async function list(ctx: Context) {
  const user = ctx.state.user
  if (!user) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }

  try {
    const { rows } = await pgQuery<TenantListRow>(
      `SELECT
         t.id AS tenant_id,
         t.slug AS tenant_slug,
         t.name AS tenant_name,
         t.hermes_profile_name,
         ta.id AS account_id,
         ta.role,
         ta.is_tenant_owner
       FROM tenant_accounts ta
       JOIN tenants t ON t.id = ta.tenant_id
       WHERE ta.webui_user_id = $1
         AND ta.status = 'active'
         AND t.status = 'active'
       ORDER BY ta.is_tenant_owner DESC, ta.created_at ASC`,
      [user.id],
    )
    ctx.body = { tenants: rows.map(mapTenantRow) }
  } catch (err: any) {
    if (err?.code === 'postgres_unavailable') {
      ctx.status = 503
      ctx.body = { error: 'Presales database is unavailable' }
      return
    }
    throw err
  }
}

export async function create(ctx: Context) {
  const user = ctx.state.user
  if (!user) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }

  const body = (ctx.request.body || {}) as {
    name?: string
    slug?: string
    hermesProfileName?: string
    clone?: boolean
    ownerUserId?: number
    owner?: {
      username?: string
      password?: string
      role?: string
    }
  }

  const ownerUserId = body.ownerUserId == null
    ? user.id
    : Number(body.ownerUserId)

  if (user.role !== 'super_admin' && ownerUserId !== user.id && !body.owner) {
    ctx.status = 403
    ctx.body = { error: 'Only super administrators can provision tenants for other users' }
    return
  }

  try {
    const tenant = await provisionTenant({
      name: String(body.name || ''),
      slug: String(body.slug || ''),
      hermesProfileName: body.hermesProfileName,
      clone: !!body.clone,
      ownerUserId: body.owner ? undefined : ownerUserId,
      owner: body.owner?.username
        ? {
            username: String(body.owner.username),
            password: String(body.owner.password || ''),
            role: body.owner.role === 'super_admin' ? 'super_admin' : 'admin',
          }
        : undefined,
    })
    ctx.status = 201
    ctx.body = { tenant }
  } catch (err: any) {
    const code = err?.code
    if (code === 'postgres_unavailable') {
      ctx.status = 503
      ctx.body = { error: 'Presales database is unavailable' }
      return
    }
    if (code === 'missing_tenant_name' || code === 'invalid_slug' || code === 'invalid_profile_name'
      || code === 'invalid_owner_username' || code === 'invalid_owner_password' || code === 'missing_owner') {
      ctx.status = 400
      ctx.body = { error: err.message, code }
      return
    }
    if (code === 'owner_username_exists' || code === 'tenant_exists') {
      ctx.status = 409
      ctx.body = { error: err.message, code }
      return
    }
    if (code === 'owner_create_failed') {
      ctx.status = 500
      ctx.body = { error: err.message, code }
      return
    }
    if (code === 'owner_not_found') {
      ctx.status = 404
      ctx.body = { error: err.message, code }
      return
    }
    throw err
  }
}
