export type ContentPreviewKind = 'ppt' | 'pdf' | 'unsupported'

export function resolveContentPreviewKind(fileName: string): ContentPreviewKind {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return 'ppt'
  if (lower.endsWith('.pdf')) return 'pdf'
  return 'unsupported'
}

export function contentFileBasename(pathOrName: string): string {
  const normalized = pathOrName.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || normalized
}
