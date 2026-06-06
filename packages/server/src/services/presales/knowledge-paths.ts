import { basename, join } from 'path'
import { existsSync } from 'fs'
import { getProfileDir } from '../hermes/hermes-profile'
import { CONTENT_REL_ROOT } from './presales-profile-paths'

const UNSAFE_NAME = /[\\/:*?"<>|]/g
export const CONTENT_KNOWLEDGE_REL = join(CONTENT_REL_ROOT, 'knowledge').replace(/\\/g, '/')
const LEGACY_KNOWLEDGE_REL = 'knowledge'

export function sanitizeFilename(name: string): string {
  const base = basename(String(name || 'upload').replace(UNSAFE_NAME, '_').trim())
  return base || 'upload'
}

export function getProfileKnowledgeRoot(profileName: string): string {
  const profileDir = getProfileDir(profileName)
  const contentKnowledge = join(profileDir, CONTENT_KNOWLEDGE_REL)
  if (existsSync(contentKnowledge)) return contentKnowledge
  const legacyKnowledge = join(profileDir, LEGACY_KNOWLEDGE_REL)
  if (existsSync(legacyKnowledge)) return legacyKnowledge
  return contentKnowledge
}

export function getProfileKnowledgeRelRoot(profileName: string): string {
  const absRoot = getProfileKnowledgeRoot(profileName)
  const profileDir = getProfileDir(profileName)
  if (absRoot.startsWith(profileDir)) {
    return absRoot.slice(profileDir.length).replace(/^[/\\]+/, '').replace(/\\/g, '/')
  }
  return CONTENT_KNOWLEDGE_REL
}

export function buildKnowledgeRawPaths(
  profileName: string,
  assetId: string,
  originalFilename: string,
): { absPath: string; relPath: string; dir: string } {
  const safeName = sanitizeFilename(originalFilename)
  const relRoot = getProfileKnowledgeRelRoot(profileName)
  const relPath = join(relRoot, 'raw', assetId, safeName).replace(/\\/g, '/')
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
