import { readFile } from 'fs/promises'
import JSZip from 'jszip'
import { parseString } from 'xml2js'

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

type PptxContent = Record<string, unknown>

function parseXml(xml: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    parseString(xml, (err: Error | null, result: unknown) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

function slideSortKey(name: string): number {
  const match = /^slide(\d+)$/.exec(name)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

function collectTexts(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    node.forEach((item) => collectTexts(item, out))
    return out
  }

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'a:t') {
      const items = Array.isArray(value) ? value : [value]
      for (const item of items) {
        const text = typeof item === 'string' ? item : String((item as { _?: string })?._ ?? '')
        if (text.trim()) out.push(text)
      }
      continue
    }
    collectTexts(value, out)
  }
  return out
}

function findFirstColor(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const color = findFirstColor(item)
      if (color) return color
    }
    return null
  }

  const record = node as Record<string, unknown>
  if (record['a:srgbClr'] && Array.isArray(record['a:srgbClr'])) {
    const clr = record['a:srgbClr'][0] as { $?: { val?: string } }
    const val = clr?.$?.val
    if (val) return `#${val}`
  }

  for (const value of Object.values(record)) {
    const color = findFirstColor(value)
    if (color) return color
  }
  return null
}

function mimeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}

function parseSlideRelationships(content: PptxContent, slideName: string): Map<string, string> {
  const relKey = `ppt/slides/_rels/${slideName}.xml.rels`
  const relDoc = content[relKey] as {
    Relationships?: { Relationship?: Array<{ $?: { Id?: string; Target?: string } }> }
  } | undefined
  const map = new Map<string, string>()
  const relationships = relDoc?.Relationships?.Relationship ?? []
  for (const rel of relationships) {
    const id = rel?.$?.Id
    const target = rel?.$?.Target
    if (id && target) map.set(id, target.replace(/^\.\.\//, 'ppt/'))
  }
  return map
}

function collectEmbedIds(node: unknown, out: Set<string> = new Set()): Set<string> {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    node.forEach((item) => collectEmbedIds(item, out))
    return out
  }

  const record = node as Record<string, unknown>
  if (record['a:blip']) {
    const blips = Array.isArray(record['a:blip']) ? record['a:blip'] : [record['a:blip']]
    for (const blip of blips) {
      const embed = (blip as { $?: { 'r:embed'?: string } })?.$?.['r:embed']
      if (embed) out.add(embed)
    }
  }

  for (const value of Object.values(record)) collectEmbedIds(value, out)
  return out
}

function buildSlideImages(
  content: PptxContent,
  slideName: string,
  slideContent: unknown,
): PptxPreviewImage[] {
  const relMap = parseSlideRelationships(content, slideName)
  const embedIds = collectEmbedIds(slideContent)
  const images: PptxPreviewImage[] = []

  for (const embedId of embedIds) {
    const target = relMap.get(embedId)
    if (!target) continue
    const buffer = content[target]
    if (!Buffer.isBuffer(buffer)) continue
    const fileName = target.split('/').pop() || target
    const mimeType = mimeFromFileName(fileName)
    images.push({
      fileName,
      mimeType,
      dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
    })
  }

  return images
}

async function loadPptxContent(absPath: string): Promise<PptxContent> {
  const data = await readFile(absPath)
  const zip = await JSZip.loadAsync(data)
  const content: PptxContent = {}

  for (const key of Object.keys(zip.files)) {
    const ext = key.slice(key.lastIndexOf('.'))
    if (ext === '.xml' || ext === '.rels') {
      const xml = await zip.file(key)!.async('string')
      content[key] = await parseXml(xml)
    } else if (!key.endsWith('/')) {
      content[key] = await zip.file(key)!.async('nodebuffer')
    }
  }

  return content
}

function listSlideNames(content: PptxContent): string[] {
  return Object.keys(content)
    .filter((key) => /^ppt\/slides\/slide\d+\.xml$/.test(key))
    .map((key) => key.replace('ppt/slides/', '').replace('.xml', ''))
    .sort((a, b) => slideSortKey(a) - slideSortKey(b))
}

export async function buildPptxPreview(absPath: string, fileName: string): Promise<PptxPreviewPayload> {
  const content = await loadPptxContent(absPath)
  const slideNames = listSlideNames(content)

  const slides: PptxPreviewSlide[] = slideNames.map((slideName, idx) => {
    const slideContent = content[`ppt/slides/${slideName}.xml`]
    const texts = collectTexts(slideContent)
    const backgroundColor = findFirstColor(slideContent) ?? '#ffffff'
    const images = buildSlideImages(content, slideName, slideContent)

    return {
      index: idx + 1,
      name: slideName,
      title: texts[0] || `Slide ${idx + 1}`,
      backgroundColor,
      texts,
      images,
    }
  })

  return {
    type: 'pptx',
    fileName,
    slideCount: slides.length,
    slides,
  }
}
