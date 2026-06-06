import type { Opportunity } from '@/data/presales-mock'
import { presalesBaseUrl, presalesHeaders, type PresalesTenantSummary } from './client'

export interface OpportunityListResponse {
  items: Opportunity[]
  tenant: PresalesTenantSummary
  profileFile?: string
  manifestFile?: string
}

export async function listOpportunities(tenantSlug?: string): Promise<OpportunityListResponse> {
  const params = new URLSearchParams()
  if (tenantSlug) params.set('tenant', tenantSlug)
  const query = params.toString()
  const res = await fetch(`${presalesBaseUrl()}/api/presales/opportunities${query ? `?${query}` : ''}`, {
    headers: presalesHeaders(tenantSlug),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Failed to load opportunities (${res.status})`)
  }
  return res.json() as Promise<OpportunityListResponse>
}

export async function updateOpportunity(
  id: string,
  patch: Partial<Opportunity>,
  tenantSlug?: string,
): Promise<Opportunity> {
  const res = await fetch(`${presalesBaseUrl()}/api/presales/opportunities/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: presalesHeaders(tenantSlug),
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Failed to update opportunity (${res.status})`)
  }
  const data = await res.json() as { item: Opportunity }
  return data.item
}
