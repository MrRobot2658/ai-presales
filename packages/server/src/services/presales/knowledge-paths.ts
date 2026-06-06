import { basename, join } from 'path'
import { getProfileDir } from '../hermes/hermes-profile'

const UNSAFE_NAME = /[\\/:*?"<>|]/g

export function sanitizeFilename(name: string): string {
  const base = basename(String(name || 'upload').replace(UNSAFE_NAME, '_').trim())
  return base || 'upload'
}

export function getProfileKnowledgeRoot(profileName: string): string {
  return join(getProfileDir(profileName), 'knowledge')
}

export function buildKnowledgeRawPaths(
  profileName: string,
  assetId: string,
  originalFilename: string,
): { absPath: string; relPath: string; dir: string } {
  const safeName = sanitizeFilename(originalFilename)
  const relPath = join('knowledge', 'raw', assetId, safeName).replace(/\\/g, '/')
  const dir = join(getProfileKnowledgeRoot(profileName), 'raw', assetId)
  const absPath = join(dir, safeName)
  return { absPath, relPath, dir }
}

export function inferFileType(filename: string, mimeType?: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'PDF'
  if (ext === 'doc' || ext === 'docx') return 'Word'
  if (ext === 'ppt' || ext === 'pptx') return 'PPT'
  if (ext === 'xls' || ext === 'xlsx') return 'Excel'
  if (ext === 'md') return 'Markdown'
  if (ext === 'txt') return 'Text'
  if (mimeType?.includes('pdf')) return 'PDF'
  if (mimeType?.includes('word')) return 'Word'
  if (mimeType?.includes('presentation')) return 'PPT'
  return ext?.toUpperCase() || 'File'
}

export function inferMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf': return 'application/pdf'
    case 'doc': return 'application/msword'
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'ppt': return 'application/vnd.ms-powerpoint'
    case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    case 'txt': return 'text/plain'
    case 'md': return 'text/markdown'
    default: return 'application/octet-stream'
  }
}
