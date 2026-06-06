# aipresales

AI-powered presales CRM built on [Hermes Agent](https://github.com/NousResearch/hermes-agent).

[中文](./README_zh.md)

---

## Features

### Opportunity Overview

- KPI dashboard: total opportunities, new this month, in-progress count
- AI match score ranking
- Industry and region distribution
- AI follow-up suggestions by priority

### Opportunity List

- CRM lead list with company, contact, industry, and source fields
- Create and update opportunities via API
- AI match insight per opportunity
- Company profile insight
- Generate presales plan / PPT from an opportunity

### Knowledge Base

- Upload PDF, PPT, DOCX, and other documents
- Background Agent cleaning — no manual review step
- Status tracking: `processing` → `ready` / `failed`
- Frontend auto-polls while cleaning is in progress
- Cleaned output stored as Markdown with searchable chunks

### Content Management

- Lists PPT files under `content/ppt/` (including Agent-generated files)
- Download any completed document
- **Continue editing** — open a file and edit it with Hermes Agent
- Editing overlay and side-panel chat for follow-up instructions
- Draft metadata for Word and PPT generation workflows

### Agent Integration

Each tenant profile includes a presales manifest and bundled skill so Hermes Agent can:

- Read and update the opportunity list
- Query knowledge base assets and cleaned content
- Create content drafts and write PPTs to `content/ppt/`
- Call presales BFF APIs or read profile files directly

**Profile data layout:**

```text
presales/
  manifest.json          # API endpoints and directory map
  opportunities.json     # Opportunity list (source of truth)
content/
  ppt/                   # Generated PPTs (content management default)
  word/                  # Generated Word documents
  drafts/                # Draft metadata
  knowledge/
    raw/{assetId}/       # Uploaded originals
    processed/{assetId}/   # Agent-cleaned Markdown
skills/presales/         # Agent skill for presales workflows
```

### Multi-Tenant

- One tenant → one Hermes profile → multiple Web UI accounts
- All presales data is isolated per profile
- BFF resolves tenant context and scopes every API call to the active profile
