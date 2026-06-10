// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { buildDraftReferenceSources } from '@/utils/draft-reference-sources'
import { parseHtmlToSections } from '@/utils/html-sections'
import type { ContentDraft } from '@/data/presales-mock'

describe('parseHtmlToSections', () => {
  it('parses section blocks with headings', () => {
    const html = [
      '<section class="slide"><h2>背景</h2><p>客户现状</p></section>',
      '<section><h2>方案</h2><p>实施路径</p></section>',
    ].join('')
    expect(parseHtmlToSections(html)).toEqual([
      { id: 's1', title: '背景', content: '客户现状' },
      { id: 's2', title: '方案', content: '实施路径' },
    ])
  })
})

describe('buildDraftReferenceSources', () => {
  it('includes knowledge and scenario labels', () => {
    const draft: ContentDraft = {
      id: 'draft-1',
      opportunityId: 'opp-1',
      companyName: 'Demo Co',
      title: 'Demo Co - 招投标 Word',
      scenario: ['bid-word'],
      knowledgeRefs: ['kb-1'],
      description: '重点强调 ROI',
      status: 'draft',
      updatedAt: '2026-06-09T08:00:00.000Z',
      htmlContent: '',
      sections: [],
      outputFile: 'content/drafts/draft-1.html',
    }

    const items = buildDraftReferenceSources({
      draft,
      opportunity: null,
      knowledgeLabels: ['产品手册.pdf'],
      labels: {
        opportunity: 'Opportunity',
        company: 'Company',
        requirement: 'Requirement',
        knowledge: 'Knowledge',
        scenario: 'Scenario',
        description: 'Description',
        outputFile: 'Output',
        updatedAt: 'Updated',
        none: '—',
      },
    })

    expect(items.find((item) => item.key === 'knowledge')?.value).toBe('产品手册.pdf')
    expect(items.find((item) => item.key === 'scenario')?.value).toContain('招投标')
    expect(items.find((item) => item.key === 'description')?.value).toBe('重点强调 ROI')
  })
})
