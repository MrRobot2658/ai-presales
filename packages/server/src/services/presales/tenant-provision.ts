import {
  createUser,
  findUserById,
  findUserByUsername,
  listUserProfiles,
  replaceUserProfiles,
  type UserRole,
} from '../../db/hermes/users-store'
import { isPostgresConfigured, withPgTransaction } from '../../db/postgres/pool'
import { listProfileNamesFromDisk } from '../hermes/hermes-profile'
import * as hermesCli from '../hermes/hermes-cli'
import { ensurePresalesProfileLayout } from './presales-profile-provision'
import { logger } from '../logger'

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$/
const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/

export interface ProvisionTenantInput {
  name: string
  slug: string
  hermesProfileName?: string
  clone?: boolean
  ownerUserId?: number
  owner?: {
    username: string
    password: string
    role?: UserRole
  }
}

export interface ProvisionedTenant {
  tenantId: string
  tenantSlug: string
  tenantName: string
  hermesProfileName: string
  ownerUserId: number
  ownerUsername: string
  accountId: string
  profileCreated: boolean
}

function normalizeSlug(slug: string): string {
  return String(slug || '').trim().toLowerCase()
}

function defaultProfileName(slug: string): string {
  return `tenant-${slug}`
}

function mergeUserProfiles(userId: number, profileName: string, asDefault: boolean): void {
  const existing = listUserProfiles(userId).map(row => row.profile_name)
  const merged = [...new Set([...existing, profileName])]
  const currentDefault = listUserProfiles(userId).find(row => row.is_default === 1)?.profile_name
  const defaultProfile = asDefault ? profileName : (currentDefault && merged.includes(currentDefault) ? currentDefault : profileName)
  replaceUserProfiles(userId, merged, defaultProfile)
}

async function injectBundledSkillsForProfile(name: string): Promise<void> {
  try {
    const { HermesSkillInjector } = await import('../hermes/skill-injector')
    const targetDir = HermesSkillInjector.resolveTargetDirForProfile(name)
    await new HermesSkillInjector(undefined, targetDir).injectMissingSkills()
  } catch (err) {
    logger.warn(err, '[tenant-provision] failed to inject bundled skills for profile "%s"', name)
  }
}

export async function provisionTenant(input: ProvisionTenantInput): Promise<ProvisionedTenant> {
  if (!isPostgresConfigured()) {
    throw Object.assign(new Error('PostgreSQL is not configured'), { code: 'postgres_unavailable' })
  }

  const tenantName = String(input.name || '').trim()
  const slug = normalizeSlug(input.slug)
  const hermesProfileName = String(input.hermesProfileName || defaultProfileName(slug)).trim()

  if (!tenantName) {
    throw Object.assign(new Error('Tenant name is required'), { code: 'missing_tenant_name' })
  }
  if (!SLUG_PATTERN.test(slug)) {
    throw Object.assign(new Error('Tenant slug must be 3-64 lowercase letters, numbers, underscores, or hyphens'), { code: 'invalid_slug' })
  }
  if (!PROFILE_NAME_PATTERN.test(hermesProfileName)) {
    throw Object.assign(new Error('Hermes profile name is invalid'), { code: 'invalid_profile_name' })
  }
  if (hermesProfileName === 'default') {
    throw Object.assign(new Error('Tenant profiles cannot use the reserved name "default"'), { code: 'invalid_profile_name' })
  }

  const existingProfiles = new Set(listProfileNamesFromDisk())
  let profileCreated = false
  if (!existingProfiles.has(hermesProfileName)) {
    await hermesCli.createProfile(hermesProfileName, !!input.clone)
    await injectBundledSkillsForProfile(hermesProfileName)
    profileCreated = true
  }

  await ensurePresalesProfileLayout(hermesProfileName)

  let ownerUserId = input.ownerUserId
  let ownerUsername = ''

  if (input.owner) {
    const username = String(input.owner.username || '').trim()
    const password = String(input.owner.password || '')
    const role = input.owner.role === 'super_admin' ? 'super_admin' : 'admin'
    if (username.length < 2) {
      throw Object.assign(new Error('Owner username must be at least 2 characters'), { code: 'invalid_owner_username' })
    }
    if (password.length < 6) {
      throw Object.assign(new Error('Owner password must be at least 6 characters'), { code: 'invalid_owner_password' })
    }
    const existing = findUserByUsername(username)
    if (existing) {
      throw Object.assign(new Error(`Username "${username}" already exists`), { code: 'owner_username_exists' })
    }
    const user = createUser({
      username,
      password,
      role,
      status: 'active',
      profiles: [hermesProfileName],
      defaultProfile: hermesProfileName,
    })
    if (!user) {
      throw Object.assign(new Error('Failed to create owner user'), { code: 'owner_create_failed' })
    }
    ownerUserId = user.id
    ownerUsername = user.username
  } else {
    if (!ownerUserId || !Number.isInteger(ownerUserId) || ownerUserId <= 0) {
      throw Object.assign(new Error('ownerUserId or owner credentials are required'), { code: 'missing_owner' })
    }
    const owner = findUserById(ownerUserId)
    if (!owner || owner.status !== 'active') {
      throw Object.assign(new Error('Owner user was not found or is not active'), { code: 'owner_not_found' })
    }
    ownerUsername = owner.username
    mergeUserProfiles(ownerUserId, hermesProfileName, true)
  }

  return withPgTransaction(async (client) => {
    const existingTenant = await client.query<{ id: string }>(
      'SELECT id FROM tenants WHERE slug = $1 OR hermes_profile_name = $2 LIMIT 1',
      [slug, hermesProfileName],
    )
    if (existingTenant.rows[0]) {
      throw Object.assign(new Error(`Tenant "${slug}" or profile "${hermesProfileName}" already exists`), { code: 'tenant_exists' })
    }

    const tenantResult = await client.query<{
      id: string
      slug: string
      name: string
      hermes_profile_name: string
    }>(
      `INSERT INTO tenants (name, slug, hermes_profile_name, status, provisioned_at)
       VALUES ($1, $2, $3, 'active', now())
       RETURNING id, slug, name, hermes_profile_name`,
      [tenantName, slug, hermesProfileName],
    )
    const tenant = tenantResult.rows[0]

    const accountResult = await client.query<{ id: string }>(
      `INSERT INTO tenant_accounts (
         tenant_id, webui_user_id, username, role, status, is_tenant_owner
       ) VALUES ($1, $2, $3, 'owner', 'active', true)
       RETURNING id`,
      [tenant.id, ownerUserId, ownerUsername],
    )

    return {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      hermesProfileName: tenant.hermes_profile_name,
      ownerUserId: ownerUserId!,
      ownerUsername,
      accountId: accountResult.rows[0].id,
      profileCreated,
    }
  })
}
