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

export async function ensureContentArtifact(id: string, tenantSlug?: string): Promise<ContentDraftRecord> {
  const res = await fetch(`${presalesBaseUrl()}/api/presales/content/${encodeURIComponent(id)}/ensure-artifact`, {
    method: 'POST',
    headers: presalesHeaders(tenantSlug),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Failed to ensure content file (${res.status})`)
  }
  const data = await res.json() as { item: ContentDraftRecord }
  return data.item
}

export async function generateContentDraft(id: string, tenantSlug?: string): Promise<{
  item: ContentDraftRecord
  warning?: string
}> {
  const res = await fetch(`${presalesBaseUrl()}/api/presales/content/${encodeURIComponent(id)}/generate`, {
    method: 'POST',
    headers: presalesHeaders(tenantSlug),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = text
    try {
      const parsed = JSON.parse(text) as { error?: string }
      message = parsed.error || text
    } catch {
      // keep raw text
    }
    throw new Error(message || `Failed to generate content (${res.status})`)
  }
  const data = await res.json() as { item: ContentDraftRecord; warning?: string }
  return data
}

export async function exportContentToPptx(
  id: string,
  payload: { htmlContent: string; sections: ContentDraft['sections'] },
  tenantSlug?: string,
): Promise<ContentDraftRecord> {
  const res = await fetch(`${presalesBaseUrl()}/api/presales/content/${encodeURIComponent(id)}/export-pptx`, {
    method: 'POST',
    headers: presalesHeaders(tenantSlug),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = text
    try {
      const parsed = JSON.parse(text) as { error?: string }
      message = parsed.error || text
    } catch {
      // keep raw text
    }
    throw new Error(message || `Failed to export PPT (${res.status})`)
  }
  const data = await res.json() as { item: ContentDraftRecord }
  return data.item
}

export interface PptxPreviewImage {
  fileName: string
  mimeType: string
  dataUrl: string
}

export interface PptxPreviewSlide {
  index: number
  name: string
  title: string
  backgroundColor: string
  texts: string[]
  images: PptxPreviewImage[]
}

export interface PptxPreviewPayload {
  type: 'pptx'
  fileName: string
  slideCount: number
  slides: PptxPreviewSlide[]
}

export type ContentPreviewPayload = PdfPreviewPayload | PptxPreviewPayload

export interface PdfPreviewPayload {
  type: 'pdf'
  fileName: string
}

export async function getContentPreview(
  id: string,
  tenantSlug?: string,
  cacheBust = false,
): Promise<ContentPreviewPayload> {
  const params = new URLSearchParams()
  if (cacheBust) params.set('t', String(Date.now()))
  const query = params.toString()
  const res = await fetch(
    `${presalesBaseUrl()}/api/presales/content/${encodeURIComponent(id)}/preview${query ? `?${query}` : ''}`,
    { headers: presalesHeaders(tenantSlug), cache: cacheBust ? 'no-store' : 'default' },
  )
  if (!res.ok) {
    throw new Error(`Failed to load content preview (${res.status})`)
  }
  return res.json() as Promise<ContentPreviewPayload>
}

export async function fetchContentFile(
  id: string,
  tenantSlug?: string,
  cacheBust = false,
): Promise<ArrayBuffer> {
  const params = new URLSearchParams()
  if (cacheBust) params.set('t', String(Date.now()))
  const query = params.toString()
  const res = await fetch(
    `${presalesBaseUrl()}/api/presales/content/${encodeURIComponent(id)}/download${query ? `?${query}` : ''}`,
    {
      headers: presalesHeaders(tenantSlug),
      cache: cacheBust ? 'no-store' : 'default',
    },
  )
  if (!res.ok) {
    throw new Error(`Failed to load content file (${res.status})`)
  }
  return res.arrayBuffer()
}

export async function getContentFileArrayBuffer(
  id: string,
  tenantSlug?: string,
  cacheBust = false,
): Promise<ArrayBuffer> {
  return fetchContentFile(id, tenantSlug, cacheBust)
}

export async function getContentFileBlobUrl(
  id: string,
  tenantSlug?: string,
  cacheBust = false,
): Promise<string> {
  const buffer = await fetchContentFile(id, tenantSlug, cacheBust)
  const blob = new Blob([buffer])
  return URL.createObjectURL(blob)
}

export async function downloadContentFile(id: string, tenantSlug?: string): Promise<void> {
  const res = await fetch(`${presalesBaseUrl()}/api/presales/content/${encodeURIComponent(id)}/download`, {
    headers: presalesHeaders(tenantSlug),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Failed to download content file (${res.status})`)
  }
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] ? decodeURIComponent(match[1]) : `content-${id}`
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
