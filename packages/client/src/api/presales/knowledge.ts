import { getActiveProfileName, getApiKey, getBaseUrlValue } from '../client'
import type { KnowledgeFile } from '@/data/presales-mock'

export interface PresalesTenantSummary {
  id: string
  slug: string
  name: string
  hermesProfileName: string
}

export interface KnowledgeListResponse {
  items: KnowledgeFile[]
  tenant: PresalesTenantSummary
}

function presalesHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const token = getApiKey()
  if (token) headers.Authorization = `Bearer ${token}`
  const profileName = getActiveProfileName()
  if (profileName) headers['X-Hermes-Profile'] = profileName
  return headers
}

export async function listKnowledgeFiles(tenantSlug?: string): Promise<KnowledgeListResponse> {
  const base = getBaseUrlValue()
  const params = new URLSearchParams()
  if (tenantSlug) params.set('tenant', tenantSlug)
  const query = params.toString()
  const headers = presalesHeaders()
  if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug

  const res = await fetch(`${base}/api/presales/knowledge${query ? `?${query}` : ''}`, { headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Failed to load knowledge files (${res.status})`)
  }
  return res.json() as Promise<KnowledgeListResponse>
}

export async function uploadKnowledgeFile(
  file: File,
  cleanRequirement: string,
  tenantSlug?: string,
): Promise<KnowledgeFile> {
  const base = getBaseUrlValue()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('cleanRequirement', cleanRequirement)

  const headers = presalesHeaders()
  if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug

  const res = await fetch(`${base}/api/presales/knowledge/upload`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Upload failed (${res.status})`)
  }

  const data = await res.json() as { item: KnowledgeFile }
  return data.item
}
