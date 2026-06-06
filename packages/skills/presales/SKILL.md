---
name: presales
description: "Access aipresales CRM opportunities, knowledge base, and content generation APIs and profile directories. Use when listing商机, reading knowledge assets, creating售前方案/PPT drafts, or saving generated presentations."
version: 1.0.0
author: aipresales
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    source: presales
    tags: [presales, crm, opportunities, knowledge, content, ppt]
---

# aipresales Presales Assistant

Use this skill for售前 CRM workflows inside the active Hermes profile.

## First step

Read the profile presales manifest:

```text
presales/manifest.json
```

It contains:

- BFF API endpoints (`/api/presales/opportunities`, `/api/presales/knowledge`, `/api/presales/content`)
- Profile-relative directories for knowledge and generated content
- Default output directory for PPT files

You can also read data files directly without HTTP:

| Resource | Profile path |
| --- | --- |
| Opportunity list | `presales/opportunities.json` |
| Knowledge raw uploads | `knowledge/raw/{assetId}/` |
| Cleaned knowledge | `knowledge/processed/{assetId}/cleaned.md` |
| Content drafts | `content/drafts/{draftId}.json` |
| Generated PPT (default) | `content/ppt/{draftId}/` |
| Generated Word (default) | `content/word/{draftId}/` |

## HTTP APIs (BFF)

When calling APIs from the Web UI runtime, use JWT auth and profile header from `manifest.json`.

### Opportunities

- `GET /api/presales/opportunities` — list商机
- `GET /api/presales/opportunities/:id` — detail
- `PATCH /api/presales/opportunities/:id` — update status/fields

Profile mirror: `presales/opportunities.json`

### Knowledge base

- `GET /api/presales/knowledge` — list assets (`ready` / `processing` / `failed`)
- `POST /api/presales/knowledge/upload` — multipart upload + clean requirement

Cleaned output: `knowledge/processed/{assetId}/cleaned.md`

### Content management

- `GET /api/presales/content` — list drafts
- `POST /api/presales/content` — create draft (returns `outputDirectory`)
- `GET /api/presales/content/:id` — draft detail
- `PATCH /api/presales/content/:id` — update draft HTML/sections/status

## PPT generation default

When generating a PPT or slide deck for a content draft:

1. Read the draft from `content/drafts/{draftId}.json`
2. Use `outputDirectory` (default `content/ppt/{draftId}/`) as the save location
3. Write the final `.pptx` (or slide assets) into that directory
4. Update draft status via `PATCH /api/presales/content/:id` or edit the draft JSON file

Do not save generated PPTs outside `content/ppt/` unless the user explicitly requests another path.

## Workflow tips

- Prefer `ready` knowledge assets when building方案 or PPT content.
- Reference cleaned markdown under `knowledge/processed/` for factual product/case details.
- Keep opportunity status in sync between API updates and `presales/opportunities.json` (API writes the file).
