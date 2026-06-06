import { mkdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import {
  CONTENT_DRAFTS_REL,
  CONTENT_EXPORTS_REL,
  CONTENT_PPT_REL,
  CONTENT_REL_ROOT,
  CONTENT_WORD_REL,
  getContentDraftsRoot,
  getContentPptRoot,
  getContentRoot,
  getPresalesManifestPath,
  getPresalesOpportunitiesPath,
  getPresalesRoot,
  PRESALES_REL_ROOT,
} from './presales-profile-paths'
import { getProfileDir } from '../hermes/hermes-profile'
import { getProfileKnowledgeRelRoot, getProfileKnowledgeRoot } from './knowledge-paths'
import { DEFAULT_PRESALES_OPPORTUNITIES } from './presales-opportunity-seed'
import { logger } from '../logger'

export interface PresalesManifest {
  version: number
  profile: string
  bffBaseUrl: string
  auth: {
    type: 'bearer_jwt'
    profileHeader: string
    tenantHeader: string
    note: string
  }
  apis: {
    opportunities: Record<string, string>
    knowledge: Record<string, string>
    content: Record<string, string>
  }
  directories: {
    profileDir: string
    presalesRoot: string
    opportunitiesFile: string
    manifestFile: string
    knowledgeRaw: string
    knowledgeProcessed: string
    contentRoot: string
    contentDrafts: string
    contentPptDefault: string
    contentWord: string
    contentExports: string
  }
  defaults: {
    generatedPptDirectory: string
    generatedWordDirectory: string
    generatedPptNote: string
  }
}

function resolvePresalesBffBaseUrl(): string {
  const explicit = process.env.PRESALES_BFF_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const port = String(process.env.PORT || '6060').trim()
  return `http://127.0.0.1:${port}`
}

export function buildPresalesManifest(profileName: string): PresalesManifest {
  const profileDir = getProfileDir(profileName)
  const rel = (path: string) => path.replace(/\\/g, '/')

  return {
    version: 1,
    profile: profileName,
    bffBaseUrl: resolvePresalesBffBaseUrl(),
    auth: {
      type: 'bearer_jwt',
      profileHeader: `X-Hermes-Profile: ${profileName}`,
      tenantHeader: 'X-Tenant-Slug: <tenant-slug> (optional when account has one tenant)',
      note: 'Use Web UI login JWT in Authorization: Bearer <token>. Agent may also read/write profile files directly.',
    },
    apis: {
      opportunities: {
        list: 'GET /api/presales/opportunities',
        create: 'POST /api/presales/opportunities',
        get: 'GET /api/presales/opportunities/:id',
        update: 'PATCH /api/presales/opportunities/:id',
        profileFile: `${PRESALES_REL_ROOT}/opportunities.json`,
      },
      knowledge: {
        list: 'GET /api/presales/knowledge',
        upload: 'POST /api/presales/knowledge/upload',
        rawDirectory: `${getProfileKnowledgeRelRoot(profileName)}/raw`,
        processedDirectory: `${getProfileKnowledgeRelRoot(profileName)}/processed`,
      },
      content: {
        list: 'GET /api/presales/content',
        create: 'POST /api/presales/content',
        get: 'GET /api/presales/content/:id',
        update: 'PATCH /api/presales/content/:id',
        draftsDirectory: CONTENT_DRAFTS_REL,
        pptDefaultDirectory: CONTENT_PPT_REL,
      },
    },
    directories: {
      profileDir,
      presalesRoot: rel(getPresalesRoot(profileName)),
      opportunitiesFile: rel(getPresalesOpportunitiesPath(profileName)),
      manifestFile: rel(getPresalesManifestPath(profileName)),
      knowledgeRaw: `${getProfileKnowledgeRelRoot(profileName)}/raw`,
      knowledgeProcessed: `${getProfileKnowledgeRelRoot(profileName)}/processed`,
      contentRoot: CONTENT_REL_ROOT,
      contentDrafts: CONTENT_DRAFTS_REL,
      contentPptDefault: CONTENT_PPT_REL,
      contentWord: CONTENT_WORD_REL,
      contentExports: CONTENT_EXPORTS_REL,
    },
    defaults: {
      generatedPptDirectory: CONTENT_PPT_REL,
      generatedWordDirectory: CONTENT_WORD_REL,
      generatedPptNote: 'Save generated PPT files under content/ppt/ (flat or content/ppt/{draftId}/).',
    },
  }
}

async function writeJsonFile(path: string, data: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
}

export async function ensurePresalesProfileLayout(profileName: string): Promise<void> {
  const name = String(profileName || 'default').trim() || 'default'
  const profileDir = getProfileDir(name)

  await mkdir(getPresalesRoot(name), { recursive: true })
  await mkdir(`${getProfileKnowledgeRoot(name)}/raw`, { recursive: true })
  await mkdir(`${getProfileKnowledgeRoot(name)}/processed`, { recursive: true })
  await mkdir(getContentRoot(name), { recursive: true })
  await mkdir(getContentDraftsRoot(name), { recursive: true })
  await mkdir(getContentPptRoot(name), { recursive: true })
  await mkdir(`${profileDir}/${CONTENT_WORD_REL}`, { recursive: true })
  await mkdir(`${profileDir}/${CONTENT_EXPORTS_REL}`, { recursive: true })

  const opportunitiesPath = getPresalesOpportunitiesPath(name)
  if (!existsSync(opportunitiesPath)) {
    await writeJsonFile(opportunitiesPath, {
      version: 1,
      updatedAt: new Date().toISOString(),
      items: DEFAULT_PRESALES_OPPORTUNITIES,
    })
  }

  await writeJsonFile(getPresalesManifestPath(name), buildPresalesManifest(name))

  const readmePath = `${getPresalesRoot(name)}/README.md`
  if (!existsSync(readmePath)) {
    await writeFile(
      readmePath,
      [
        '# Presales Profile Resources',
        '',
        'This directory is managed by aipresales. The Hermes agent can read these files directly.',
        '',
        '- `manifest.json` — BFF API endpoints and profile directory map',
        '- `opportunities.json` — CRM opportunity list (mirrors `/api/presales/opportunities`)',
        '- `../content/ppt/` — generated PPT files (content management default source)',
        '- `../content/knowledge/processed/` — cleaned knowledge markdown from uploads',
        '',
      ].join('\n'),
      'utf-8',
    )
  }
}

export async function ensurePresalesProfilesForAll(): Promise<void> {
  const { listProfileNamesFromDisk } = await import('../hermes/hermes-profile')
  for (const profileName of listProfileNamesFromDisk()) {
    try {
      await ensurePresalesProfileLayout(profileName)
    } catch (err) {
      logger.warn(err, '[presales-profile] failed to provision profile "%s"', profileName)
    }
  }
}

export async function readPresalesManifest(profileName: string): Promise<PresalesManifest> {
  const path = getPresalesManifestPath(profileName)
  if (!existsSync(path)) {
    await ensurePresalesProfileLayout(profileName)
  }
  const raw = await readFile(path, 'utf-8')
  return JSON.parse(raw) as PresalesManifest
}
