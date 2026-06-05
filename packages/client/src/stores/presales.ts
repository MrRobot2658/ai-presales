import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  MOCK_KNOWLEDGE_FILES,
  MOCK_OPPORTUNITIES,
  type ContentDraft,
  type KnowledgeFile,
  type Opportunity,
} from '@/data/presales-mock'

const DRAFTS_KEY = 'aipresales.content.drafts'
const KNOWLEDGE_KEY = 'aipresales.knowledge.files'

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function defaultDraftHtml(companyName: string, scenarios: string[]): string {
  const scenarioText = scenarios.join('、') || '综合方案'
  return `<h1>${companyName} - ${scenarioText}</h1>
<section><h2>一、项目背景</h2><p>基于客户业务现状与行业趋势，梳理核心诉求与成功指标。</p></section>
<section><h2>二、解决方案</h2><p>结合知识库内容与最佳实践，输出可落地的实施路径。</p></section>
<section><h2>三、价值与 ROI</h2><p>量化预期收益、里程碑与风险控制措施。</p></section>`
}

export const usePresalesStore = defineStore('presales', () => {
  const opportunities = ref<Opportunity[]>([...MOCK_OPPORTUNITIES])
  const knowledgeFiles = ref<KnowledgeFile[]>(loadJson(KNOWLEDGE_KEY, MOCK_KNOWLEDGE_FILES))
  const drafts = ref<ContentDraft[]>(loadJson(DRAFTS_KEY, []))

  const totalCount = computed(() => opportunities.value.length)
  const newThisMonth = computed(() =>
    opportunities.value.filter((o) => o.createdAt >= '2026-06-01').length,
  )
  const inProgressCount = computed(() =>
    opportunities.value.filter((o) => o.status === 'following').length,
  )
  const rankingTop5 = computed(() =>
    [...opportunities.value].sort((a, b) => b.matchScore - a.matchScore).slice(0, 5),
  )

  function persistDrafts() {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts.value))
  }

  function persistKnowledge() {
    localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(knowledgeFiles.value))
  }

  function getOpportunity(id: string) {
    return opportunities.value.find((o) => o.id === id)
  }

  function submitKnowledgeTicket(fileName: string, fileType: string, cleanRequirement: string) {
    const eta = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    const item: KnowledgeFile = {
      id: `kb-${Date.now()}`,
      fileName,
      fileType,
      uploadedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      status: 'reviewing',
      cleanRequirement,
      eta: eta.toLocaleString('zh-CN', { hour12: false }),
    }
    knowledgeFiles.value.unshift(item)
    persistKnowledge()
    return item
  }

  function createDraft(payload: {
    opportunityId: string
    companyName: string
    scenario: string[]
    knowledgeRefs: string[]
    description: string
  }): ContentDraft {
    const scenarioLabels = payload.scenario.map((s) => {
      if (s === 'bid-word') return '招投标 Word'
      if (s === 'product-ppt') return '产品介绍 PPT'
      if (s === 'case-ppt') return '案例 PPT'
      return s
    })
    const draft: ContentDraft = {
      id: `draft-${Date.now()}`,
      opportunityId: payload.opportunityId,
      companyName: payload.companyName,
      title: `${payload.companyName} - ${scenarioLabels.join('/')}`,
      scenario: payload.scenario,
      knowledgeRefs: payload.knowledgeRefs,
      description: payload.description,
      status: 'generating',
      updatedAt: new Date().toISOString(),
      htmlContent: defaultDraftHtml(payload.companyName, scenarioLabels),
      sections: [
        { id: 's1', title: '项目背景', content: '基于客户业务现状与行业趋势，梳理核心诉求。' },
        { id: 's2', title: '解决方案', content: '结合知识库输出可落地实施路径。' },
        { id: 's3', title: '价值与 ROI', content: '量化预期收益与里程碑。' },
      ],
    }
    drafts.value.unshift(draft)
    persistDrafts()
    return draft
  }

  function finishGenerating(draftId: string) {
    const draft = drafts.value.find((d) => d.id === draftId)
    if (draft) {
      draft.status = 'draft'
      draft.updatedAt = new Date().toISOString()
      persistDrafts()
    }
  }

  function saveDraft(draftId: string, htmlContent: string, sections: ContentDraft['sections']) {
    const draft = drafts.value.find((d) => d.id === draftId)
    if (!draft) return
    draft.htmlContent = htmlContent
    draft.sections = sections
    draft.updatedAt = new Date().toISOString()
    draft.status = 'draft'
    persistDrafts()
  }

  function getDraft(id: string) {
    return drafts.value.find((d) => d.id === id)
  }

  return {
    opportunities,
    knowledgeFiles,
    drafts,
    totalCount,
    newThisMonth,
    inProgressCount,
    rankingTop5,
    getOpportunity,
    submitKnowledgeTicket,
    createDraft,
    finishGenerating,
    saveDraft,
    getDraft,
  }
})
