import type { ContentDraft } from '@/data/presales-mock'
import { presalesBaseUrl, presalesHeaders, type PresalesTenantSummary } from './client'

export interface ContentDraftRecord extends ContentDraft {
  outputDirectory?: string
  outputDirectoryAbs?: string
}

export interface ContentListResponse {
  items: ContentDraftRecord[]
  tenant: PresalesTenantSummary
  defaultPptDirectory?: string
}

export async function listContentDrafts(tenantSlug?: string): Promise<ContentListResponse> {
  const params = new URLSearchParams()
  if (tenantSlug) params.set('tenant', tenantSlug)
  const query = params.toString()
  const res = await fetch(`${presalesBaseUrl()}/api/presales/content${query ? `?${query}` : ''}`, {
    headers: presalesHeaders(tenantSlug),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Failed to load content drafts (${res.status})`)
  }
  return res.json() as Promise<ContentListResponse>
}

export async function createContentDraft(
  payload: {
    opportunityId: string
    companyName: string
    scenario: string[]
    knowledgeRefs: string[]
    description: string
  },
  tenantSlug?: string,
): Promise<ContentDraftRecord> {
  const res = await fetch(`${presalesBaseUrl()}/api/presales/content`, {
    method: 'POST',
    headers: presalesHeaders(tenantSlug),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Failed to create content draft (${res.status})`)
  }
  const data = await res.json() as { item: ContentDraftRecord }
  return data.item
}

export async function updateContentDraft(
  id: string,
  patch: Partial<Pick<ContentDraftRecord, 'status' | 'htmlContent' | 'sections' | 'title'>>,
  tenantSlug?: string,
): Promise<ContentDraftRecord> {
  const res = await fetch(`${presalesBaseUrl()}/api/presales/content/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: presalesHeaders(tenantSlug),
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Failed to update content draft (${res.status})`)
  }
  const data = await res.json() as { item: ContentDraftRecord }
  return data.item
}

export async function getContentDraft(id: string, tenantSlug?: string): Promise<ContentDraftRecord> {
  const res = await fetch(`${presalesBaseUrl()}/api/presales/content/${encodeURIComponent(id)}`, {
    headers: presalesHeaders(tenantSlug),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Failed to load content draft (${res.status})`)
  }
  const data = await res.json() as { item: ContentDraftRecord }
  return data.item
}
