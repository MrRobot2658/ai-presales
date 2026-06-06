import { getActiveProfileName, getApiKey, getBaseUrlValue } from '../client'

export function presalesHeaders(tenantSlug?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = getApiKey()
  if (token) headers.Authorization = `Bearer ${token}`
  const profileName = getActiveProfileName()
  if (profileName) headers['X-Hermes-Profile'] = profileName
  if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug
  return headers
}

export function presalesBaseUrl(): string {
  return getBaseUrlValue()
}

export interface PresalesTenantSummary {
  id: string
  slug: string
  name: string
  hermesProfileName: string
}
