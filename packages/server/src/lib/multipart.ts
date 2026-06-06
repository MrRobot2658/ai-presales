export interface MultipartField {
  name: string
  filename?: string
  data: Buffer
}

export interface ParsedMultipart {
  fields: Record<string, string>
  files: MultipartField[]
}

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024

export function splitMultipart(raw: Buffer, boundary: Buffer): Buffer[] {
  const parts: Buffer[] = []
  let start = 0
  while (true) {
    const idx = raw.indexOf(boundary, start)
    if (idx === -1) break
    if (start > 0) { parts.push(raw.subarray(start + 2, idx)) }
    start = idx + boundary.length
  }
  return parts
}

export async function readMultipartBody(
  req: AsyncIterable<Buffer>,
  contentType: string,
  maxSize = MAX_UPLOAD_SIZE,
): Promise<ParsedMultipart> {
  if (!contentType.startsWith('multipart/form-data')) {
    throw Object.assign(new Error('Expected multipart/form-data'), { code: 'invalid_content_type' })
  }
  const boundary = '--' + contentType.split('boundary=')[1]
  if (!boundary || boundary === '--undefined') {
    throw Object.assign(new Error('Missing boundary'), { code: 'missing_boundary' })
  }

  const chunks: Buffer[] = []
  let totalSize = 0
  for await (const chunk of req) {
    totalSize += chunk.length
    if (totalSize > maxSize) {
      throw Object.assign(new Error(`File too large (max ${maxSize / 1024 / 1024}MB)`), { code: 'file_too_large' })
    }
    chunks.push(chunk)
  }

  const raw = Buffer.concat(chunks)
  const boundaryBuf = Buffer.from(boundary)
  const parts = splitMultipart(raw, boundaryBuf)
  const fields: Record<string, string> = {}
  const files: MultipartField[] = []

  for (const part of parts) {
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
    if (headerEnd === -1) continue
    const header = part.subarray(0, headerEnd).toString('utf-8')
    const data = part.subarray(headerEnd + 4, part.length - 2)

    const nameMatch = header.match(/name="([^"]+)"/i)
    if (!nameMatch) continue
    const name = nameMatch[1]

    const filenameStarMatch = header.match(/filename\*=UTF-8''(.+)/i)
    const filenameMatch = header.match(/filename="([^"]+)"/i)
    const filename = filenameStarMatch
      ? decodeURIComponent(filenameStarMatch[1])
      : filenameMatch?.[1]

    if (filename) {
      files.push({ name, filename, data })
    } else {
      fields[name] = data.toString('utf-8')
    }
  }

  return { fields, files }
}
