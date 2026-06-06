import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { getPresalesOpportunitiesPath } from './presales-profile-paths'
import { ensurePresalesProfileLayout } from './presales-profile-provision'
import type { PresalesTenantContext } from './tenant-context'

export type OpportunityStatus = 'new' | 'following' | 'won' | 'lost'

export interface PresalesOpportunityRecord {
  id: string
  source: string
  companyName: string
  description: string
  industry: string
  contactName: string
  phone: string
  email: string
  position: string
  officeAddress: string
  hqLocation: string
  matchScore: number
  status: OpportunityStatus
  createdAt: string
  companyInsight: string
  contactActivities: string[]
}

export interface CreateOpportunityInput {
  source?: string
  companyName: string
  description?: string
  industry?: string
  contactName?: string
  phone?: string
  email?: string
  position?: string
  officeAddress?: string
  hqLocation?: string
  matchScore?: number
  status?: OpportunityStatus
  companyInsight?: string
  contactActivities?: string[]
}

interface OpportunitiesFile {
  version: number
  updatedAt: string
  items: PresalesOpportunityRecord[]
}

async function readOpportunitiesFile(profileName: string): Promise<OpportunitiesFile> {
  await ensurePresalesProfileLayout(profileName)
  const path = getPresalesOpportunitiesPath(profileName)
  if (!existsSync(path)) {
    return { version: 1, updatedAt: new Date().toISOString(), items: [] }
  }
  const raw = await readFile(path, 'utf-8')
  return JSON.parse(raw) as OpportunitiesFile
}

async function writeOpportunitiesFile(profileName: string, items: PresalesOpportunityRecord[]): Promise<void> {
  const path = getPresalesOpportunitiesPath(profileName)
  await writeFile(path, `${JSON.stringify({
    version: 1,
    updatedAt: new Date().toISOString(),
    items,
  }, null, 2)}\n`, 'utf-8')
}

export async function listOpportunities(tenant: PresalesTenantContext): Promise<PresalesOpportunityRecord[]> {
  const file = await readOpportunitiesFile(tenant.hermesProfileName)
  return file.items
}

export async function getOpportunity(
  tenant: PresalesTenantContext,
  opportunityId: string,
): Promise<PresalesOpportunityRecord | null> {
  const items = await listOpportunities(tenant)
  return items.find((item) => item.id === opportunityId) || null
}

export async function createOpportunity(
  tenant: PresalesTenantContext,
  input: CreateOpportunityInput,
): Promise<PresalesOpportunityRecord> {
  const companyName = String(input.companyName || '').trim()
  if (!companyName) {
    throw Object.assign(new Error('companyName is required'), { code: 'missing_company_name' })
  }

  const file = await readOpportunitiesFile(tenant.hermesProfileName)
  const item: PresalesOpportunityRecord = {
    id: `opp-${randomUUID()}`,
    source: input.source?.trim() || 'API',
    companyName,
    description: input.description?.trim() || '',
    industry: input.industry?.trim() || '',
    contactName: input.contactName?.trim() || '',
    phone: input.phone?.trim() || '',
    email: input.email?.trim() || '',
    position: input.position?.trim() || '',
    officeAddress: input.officeAddress?.trim() || '',
    hqLocation: input.hqLocation?.trim() || '',
    matchScore: Number.isFinite(input.matchScore) ? Number(input.matchScore) : 70,
    status: input.status || 'new',
    createdAt: new Date().toISOString().slice(0, 10),
    companyInsight: input.companyInsight?.trim() || '',
    contactActivities: Array.isArray(input.contactActivities)
      ? input.contactActivities.map(String).filter(Boolean)
      : [],
  }

  file.items.unshift(item)
  await writeOpportunitiesFile(tenant.hermesProfileName, file.items)
  return item
}

export async function updateOpportunity(
  tenant: PresalesTenantContext,
  opportunityId: string,
  patch: Partial<PresalesOpportunityRecord>,
): Promise<PresalesOpportunityRecord | null> {
  const file = await readOpportunitiesFile(tenant.hermesProfileName)
  const index = file.items.findIndex((item) => item.id === opportunityId)
  if (index < 0) return null

  const current = file.items[index]
  const next: PresalesOpportunityRecord = {
    ...current,
    ...patch,
    id: current.id,
  }
  file.items[index] = next
  await writeOpportunitiesFile(tenant.hermesProfileName, file.items)
  return next
}
