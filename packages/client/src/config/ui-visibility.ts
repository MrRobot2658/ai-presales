function parseHiddenList(value: string | undefined): Set<string> {
  if (!value?.trim()) return new Set()
  return new Set(value.split(',').map((part) => part.trim()).filter(Boolean))
}

function isTruthy(value: string | undefined): boolean {
  return value === '1' || value === 'true' || value === 'yes'
}

const hiddenGroups = parseHiddenList(import.meta.env.VITE_HERMES_HIDE_SIDEBAR_GROUPS)
const hiddenItems = parseHiddenList(import.meta.env.VITE_HERMES_HIDE_SIDEBAR_ITEMS)

export function isSidebarGroupHidden(key: string): boolean {
  return hiddenGroups.has(key)
}

export function isSidebarItemHidden(key: string): boolean {
  return hiddenItems.has(key)
}

export function isGithubLinkHidden(): boolean {
  return isTruthy(import.meta.env.VITE_HERMES_HIDE_GITHUB)
}

export function isStudioVersionHidden(): boolean {
  return isTruthy(import.meta.env.VITE_HERMES_HIDE_STUDIO_VERSION)
}

export function isWebsiteLinkHidden(): boolean {
  return isTruthy(import.meta.env.VITE_HERMES_HIDE_WEBSITE)
}
