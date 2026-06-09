#!/usr/bin/env node
/**
 * Provision a presales tenant end-to-end via the Web UI BFF HTTP APIs:
 *
 *   1. POST /api/auth/login
 *   2. POST /api/presales/tenants  (Hermes profile + PG tenant + tenant_account + user_profiles)
 *   3. GET  /api/presales/profile-manifest  (verify layout)
 *
 * Usage:
 *   npm run provision:tenant
 *
 *   node scripts/provision-tenant.mjs \
 *     --base-url http://127.0.0.1:6060 \
 *     --admin-user admin \
 *     --admin-pass 123456
 *
 * Defaults (jingdigital preset):
 *   tenant: jingdigital / Jing Digital
 *   owner:  ethan.lin@jingdigital.com
 *   profile: jingdigital
 *
 * Reuse the logged-in super admin as tenant owner (no new Web UI account):
 *   node scripts/provision-tenant.mjs --tenant-name "Demo" --tenant-slug demo --owner-self
 *
 * Clone the active Hermes profile when creating the tenant profile:
 *   node scripts/provision-tenant.mjs ... --clone
 */

function usage(exitCode = 0) {
  console.log(`Usage: node scripts/provision-tenant.mjs [options]

Options:
  --base-url URL          BFF base URL (default: BFF_BASE_URL or http://127.0.0.1:6060)
  --admin-user USER       Super admin username (default: admin)
  --admin-pass PASS       Super admin password (default: 123456)
  --tenant-name NAME      Tenant display name (default: Jing Digital)
  --tenant-slug SLUG      Tenant slug (default: jingdigital)
  --profile-name NAME     Hermes profile name (default: jingdigital)
  --owner-user USER       Tenant owner Web UI username (default: ethan.lin@jingdigital.com)
  --owner-pass PASS       Tenant owner password (default: preset for jingdigital)
  --owner-self            Use the super admin account as tenant owner
  --clone                 Clone the current Hermes profile instead of creating empty
  --help                  Show this help
`)
  process.exit(exitCode)
}

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.BFF_BASE_URL || 'http://127.0.0.1:6060',
    adminUser: process.env.BFF_ADMIN_USER || 'admin',
    adminPass: process.env.BFF_ADMIN_PASS || '123456',
    tenantName: process.env.TENANT_NAME || 'Jing Digital',
    tenantSlug: process.env.TENANT_SLUG || 'jingdigital',
    profileName: process.env.HERMES_PROFILE_NAME || 'jingdigital',
    ownerUser: process.env.TENANT_OWNER_USER || 'ethan.lin@jingdigital.com',
    ownerPass: process.env.TENANT_OWNER_PASS || 'woaixuexi',
    ownerSelf: false,
    clone: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') usage(0)
    if (arg === '--owner-self') {
      options.ownerSelf = true
      continue
    }
    if (arg === '--clone') {
      options.clone = true
      continue
    }
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      console.error(`Missing value for ${arg}`)
      usage(1)
    }
    switch (arg) {
      case '--base-url': options.baseUrl = next; break
      case '--admin-user': options.adminUser = next; break
      case '--admin-pass': options.adminPass = next; break
      case '--tenant-name': options.tenantName = next; break
      case '--tenant-slug': options.tenantSlug = next; break
      case '--profile-name': options.profileName = next; break
      case '--owner-user': options.ownerUser = next; break
      case '--owner-pass': options.ownerPass = next; break
      default:
        console.error(`Unknown option: ${arg}`)
        usage(1)
    }
    i += 1
  }

  return options
}

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

async function requestJson(baseUrl, path, { method = 'GET', token, headers = {}, body } = {}) {
  const res = await fetch(joinUrl(baseUrl, path), {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { raw: text }
    }
  }

  if (!res.ok) {
    const message = payload?.error || payload?.raw || res.statusText
    throw new Error(`${method} ${path} failed (${res.status}): ${message}`)
  }

  return payload
}

function step(label) {
  console.log(`\n→ ${label}`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (!options.tenantName || !options.tenantSlug) {
    console.error('Missing tenant name or slug')
    usage(1)
  }

  if (!options.ownerSelf && (!options.ownerUser || !options.ownerPass)) {
    console.error('Provide --owner-user/--owner-pass or use --owner-self')
    usage(1)
  }

  const profileName = options.profileName || `tenant-${options.tenantSlug}`

  console.log('Preset:', {
    tenant: `${options.tenantName} (${options.tenantSlug})`,
    profile: profileName,
    owner: options.ownerSelf ? options.adminUser : options.ownerUser,
  })

  step(`Login as ${options.adminUser}`)
  const login = await requestJson(options.baseUrl, '/api/auth/login', {
    method: 'POST',
    body: {
      username: options.adminUser,
      password: options.adminPass,
    },
  })
  const token = login.token
  if (!token) throw new Error('Login succeeded but no token was returned')

  const tenantBody = {
    name: options.tenantName,
    slug: options.tenantSlug,
    hermesProfileName: profileName,
    clone: options.clone,
  }

  if (!options.ownerSelf) {
    tenantBody.owner = {
      username: options.ownerUser,
      password: options.ownerPass,
      role: 'admin',
    }
  }

  step(`Provision tenant "${options.tenantName}" (${options.tenantSlug}) with profile "${profileName}"`)
  const provision = await requestJson(options.baseUrl, '/api/presales/tenants', {
    method: 'POST',
    token,
    body: tenantBody,
  })

  const tenant = provision.tenant
  console.log(JSON.stringify(tenant, null, 2))

  step('Verify presales profile manifest')
  const manifest = await requestJson(options.baseUrl, '/api/presales/profile-manifest', {
    token,
    headers: {
      'X-Tenant-Slug': tenant.tenantSlug,
      'X-Hermes-Profile': tenant.hermesProfileName,
    },
  })
  console.log(`manifest.profile=${manifest.manifest?.profile}`)
  console.log(`manifest.directories.presalesRoot=${manifest.manifest?.directories?.presalesRoot}`)

  step('List tenants visible to super admin')
  const listed = await requestJson(options.baseUrl, '/api/presales/tenants', { token })
  console.log(JSON.stringify(listed.tenants, null, 2))

  console.log('\nDone.')
  console.log(`Tenant owner login: ${options.ownerSelf ? options.adminUser : options.ownerUser}`)
  console.log(`Hermes profile: ${tenant.hermesProfileName}`)
  console.log(`Tenant slug header: X-Tenant-Slug: ${tenant.tenantSlug}`)
}

main().catch((err) => {
  console.error(`\nProvision failed: ${err.message}`)
  process.exit(1)
})
