import { join } from 'path'
import { getProfileDir } from '../hermes/hermes-profile'

export const PRESALES_REL_ROOT = 'presales'
export const CONTENT_REL_ROOT = 'content'
export const CONTENT_PPT_REL = join(CONTENT_REL_ROOT, 'ppt').replace(/\\/g, '/')
export const CONTENT_WORD_REL = join(CONTENT_REL_ROOT, 'word').replace(/\\/g, '/')
export const CONTENT_DRAFTS_REL = join(CONTENT_REL_ROOT, 'drafts').replace(/\\/g, '/')
export const CONTENT_EXPORTS_REL = join(CONTENT_REL_ROOT, 'exports').replace(/\\/g, '/')

export function getPresalesRoot(profileName: string): string {
  return join(getProfileDir(profileName), PRESALES_REL_ROOT)
}

export function getPresalesManifestPath(profileName: string): string {
  return join(getPresalesRoot(profileName), 'manifest.json')
}

export function getPresalesOpportunitiesPath(profileName: string): string {
  return join(getPresalesRoot(profileName), 'opportunities.json')
}

export function getContentRoot(profileName: string): string {
  return join(getProfileDir(profileName), CONTENT_REL_ROOT)
}

export function getContentPptRoot(profileName: string): string {
  return join(getProfileDir(profileName), CONTENT_PPT_REL)
}

export function getContentWordRoot(profileName: string): string {
  return join(getProfileDir(profileName), CONTENT_WORD_REL)
}

export function getContentDraftsRoot(profileName: string): string {
  return join(getProfileDir(profileName), CONTENT_DRAFTS_REL)
}

export function getContentDraftPath(profileName: string, draftId: string): string {
  return join(getContentDraftsRoot(profileName), `${draftId}.json`)
}

export function getContentDraftPptDir(profileName: string, draftId: string): string {
  return join(getContentPptRoot(profileName), draftId)
}

export function toProfileRelPath(profileName: string, absPath: string): string {
  const profileDir = getProfileDir(profileName)
  if (!absPath.startsWith(profileDir)) return absPath
  return absPath.slice(profileDir.length).replace(/^[/\\]+/, '').replace(/\\/g, '/')
}
