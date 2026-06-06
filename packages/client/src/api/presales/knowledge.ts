import type { KnowledgeFile } from '@/data/presales-mock'
import { presalesHeaders, presalesBaseUrl, type PresalesTenantSummary } from './client'

export type { PresalesTenantSummary }

export interface KnowledgeListResponse {
  items: KnowledgeFile[]
  tenant: PresalesTenantSummary
}

function presalesUploadHeaders(tenantSlug?: string): Record<string, string> {
  const headers = presalesHeaders(tenantSlug)
  delete headers['Content-Type']
  return headers
}

export async function listKnowledgeFiles(tenantSlug?: string): Promise<KnowledgeListResponse> {
  const params = new URLSearchParams()
  if (tenantSlug) params.set('tenant', tenantSlug)
  const query = params.toString()

  const res = await fetch(`${presalesBaseUrl()}/api/presales/knowledge${query ? `?${query}` : ''}`, {
    headers: presalesUploadHeaders(tenantSlug),
  })
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
  const formData = new FormData()
  formData.append('file', file)
  formData.append('cleanRequirement', cleanRequirement)

  const res = await fetch(`${presalesBaseUrl()}/api/presales/knowledge/upload`, {
    method: 'POST',
    headers: presalesUploadHeaders(tenantSlug),
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Upload failed (${res.status})`)
  }

  const data = await res.json() as { item: KnowledgeFile }
  return data.item
}
