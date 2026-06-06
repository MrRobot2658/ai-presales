import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  MOCK_OPPORTUNITIES,
  type ContentDraft,
  type KnowledgeFile,
  type Opportunity,
} from '@/data/presales-mock'
import { listKnowledgeFiles, uploadKnowledgeFile } from '@/api/presales/knowledge'
import { listOpportunities } from '@/api/presales/opportunities'
import {
  createContentDraft as createContentDraftApi,
  listContentDrafts,
  updateContentDraft as updateContentDraftApi,
} from '@/api/presales/content'

export const usePresalesStore = defineStore('presales', () => {
  const opportunities = ref<Opportunity[]>([...MOCK_OPPORTUNITIES])
  const opportunitiesLoading = ref(false)
  const knowledgeFiles = ref<KnowledgeFile[]>([])
  const knowledgeLoading = ref(false)
  const knowledgeTenantSlug = ref<string | null>(null)
  const contentDrafts = ref<ContentDraft[]>([])
  const contentLoading = ref(false)
  const tenantSlug = ref<string | null>(null)
  let knowledgePollTimer: ReturnType<typeof setInterval> | null = null

  function hasProcessingKnowledge() {
    return knowledgeFiles.value.some((item) => item.status === 'processing')
  }

  function stopKnowledgePolling() {
    if (knowledgePollTimer) {
      clearInterval(knowledgePollTimer)
      knowledgePollTimer = null
    }
  }

  function startKnowledgePolling() {
    if (knowledgePollTimer) return
    knowledgePollTimer = setInterval(async () => {
      if (!hasProcessingKnowledge()) {
        stopKnowledgePolling()
        return
      }
      try {
        await fetchKnowledgeFiles(tenantSlug.value ?? undefined, { silent: true })
      } catch {
        // keep polling; user can refresh manually
      }
    }, 3000)
  }

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

  const knowledgeOptions = computed(() =>
    knowledgeFiles.value
      .filter((item) => item.status === 'ready')
      .map((item) => ({ label: item.fileName, value: item.id })),
  )

  async function fetchOpportunities(activeTenantSlug?: string) {
    opportunitiesLoading.value = true
    try {
      const response = await listOpportunities(activeTenantSlug ?? tenantSlug.value ?? undefined)
      opportunities.value = response.items
      tenantSlug.value = response.tenant.slug
    } catch {
      opportunities.value = [...MOCK_OPPORTUNITIES]
    } finally {
      opportunitiesLoading.value = false
    }
  }

  async function fetchKnowledgeFiles(activeTenantSlug?: string, options?: { silent?: boolean }) {
    if (!options?.silent) knowledgeLoading.value = true
    try {
      const response = await listKnowledgeFiles(activeTenantSlug ?? tenantSlug.value ?? undefined)
      knowledgeFiles.value = response.items
      tenantSlug.value = response.tenant.slug
      if (hasProcessingKnowledge()) startKnowledgePolling()
      else stopKnowledgePolling()
    } finally {
      if (!options?.silent) knowledgeLoading.value = false
    }
  }

  async function fetchContentDrafts(activeTenantSlug?: string) {
    contentLoading.value = true
    try {
      const response = await listContentDrafts(activeTenantSlug ?? tenantSlug.value ?? undefined)
      contentDrafts.value = response.items
      tenantSlug.value = response.tenant.slug
    } finally {
      contentLoading.value = false
    }
  }

  async function submitKnowledgeTicket(file: File, cleanRequirement: string, activeTenantSlug?: string) {
    const item = await uploadKnowledgeFile(
      file,
      cleanRequirement,
      activeTenantSlug ?? tenantSlug.value ?? undefined,
    )
    knowledgeFiles.value.unshift(item)
    if (item.status === 'processing') startKnowledgePolling()
    return item
  }

  function getOpportunity(id: string) {
    return opportunities.value.find((o) => o.id === id)
  }

  async function createDraft(payload: {
    opportunityId: string
    companyName: string
    scenario: string[]
    knowledgeRefs: string[]
    description: string
  }): Promise<ContentDraft> {
    const draft = await createContentDraftApi(payload, tenantSlug.value ?? undefined)
    contentDrafts.value.unshift(draft)
    return draft
  }

  async function finishGenerating(draftId: string) {
    const draft = contentDrafts.value.find((d) => d.id === draftId)
    if (!draft) return
    const updated = await updateContentDraftApi(
      draftId,
      { status: 'draft' },
      tenantSlug.value ?? undefined,
    )
    const index = contentDrafts.value.findIndex((d) => d.id === draftId)
    if (index >= 0) contentDrafts.value[index] = updated
  }

  async function saveDraft(draftId: string, htmlContent: string, sections: ContentDraft['sections']) {
    const updated = await updateContentDraftApi(
      draftId,
      { htmlContent, sections, status: 'draft' },
      tenantSlug.value ?? undefined,
    )
    const index = contentDrafts.value.findIndex((d) => d.id === draftId)
    if (index >= 0) contentDrafts.value[index] = updated
  }

  function getDraft(id: string) {
    return contentDrafts.value.find((d) => d.id === id)
  }

  return {
    opportunities,
    opportunitiesLoading,
    knowledgeFiles,
    knowledgeLoading,
    knowledgeOptions,
    knowledgeTenantSlug,
    contentDrafts,
    contentLoading,
    tenantSlug,
    drafts: contentDrafts,
    totalCount,
    newThisMonth,
    inProgressCount,
    rankingTop5,
    getOpportunity,
    fetchOpportunities,
    fetchKnowledgeFiles,
    fetchContentDrafts,
    stopKnowledgePolling,
    submitKnowledgeTicket,
    createDraft,
    finishGenerating,
    saveDraft,
    getDraft,
  }
})
