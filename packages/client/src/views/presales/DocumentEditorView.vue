<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NInput, NSpin, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { downloadContentFile, exportContentToPptx } from '@/api/presales/content'
import ContentDraftReferencePanel from '@/components/presales/ContentDraftReferencePanel.vue'
import ContentFilePreviewPane from '@/components/presales/ContentFilePreviewPane.vue'
import ContentHtmlComponentPalette from '@/components/presales/ContentHtmlComponentPalette.vue'
import ContentHtmlEditorPane from '@/components/presales/ContentHtmlEditorPane.vue'
import { usePresalesContentHermesEdit } from '@/composables/usePresalesContentHermesEdit'
import { usePresalesStore } from '@/stores/presales'
import { contentFileBasename, resolveContentPreviewKind } from '@/utils/content-preview'
import { parseHtmlToSections } from '@/utils/html-sections'
import type { ContentDraft } from '@/data/presales-mock'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const store = usePresalesStore()
const { isEditing, streamingText, chatMessages, runHermesEdit, stopEdit } = usePresalesContentHermesEdit()

const draftId = computed(() => route.params.draftId as string)
const draft = ref<ContentDraft | null>(null)
const htmlContent = ref('')
const chatInput = ref('')
const previewKey = ref(0)
const loading = ref(true)
const downloading = ref(false)
const htmlEditorRef = ref<InstanceType<typeof ContentHtmlEditorPane> | null>(null)

const previewFileName = computed(() => {
  const name = draft.value?.outputFile || draft.value?.title || ''
  return contentFileBasename(name)
})
const previewKind = computed(() => resolveContentPreviewKind(previewFileName.value))
const isPdfDraft = computed(() => previewKind.value === 'pdf')
const hasPptArtifact = computed(() => previewKind.value === 'ppt')
const isHtmlEditorMode = computed(() => !isPdfDraft.value)

const referenceOpportunity = computed(() => {
  if (!draft.value?.opportunityId) return null
  return store.getOpportunity(draft.value.opportunityId) ?? null
})

const knowledgeLabels = computed(() => {
  if (!draft.value) return []
  return store.knowledgeRefLabels(draft.value.knowledgeRefs)
})

function buildFallbackHtml(item: ContentDraft): string {
  if (item.htmlContent?.trim()) return item.htmlContent
  if (item.sections?.length) {
    return item.sections
      .map((s) => `<section class="slide"><h2>${s.title}</h2><p>${s.content}</p></section>`)
      .join('\n')
  }
  return `<section class="slide"><h1>${item.title || item.companyName}</h1><p>${t('presales.editor.htmlPreviewEmpty')}</p></section>`
}

async function loadDraftData() {
  loading.value = true
  try {
    if (store.opportunities.length === 0) {
      await store.fetchOpportunities()
    }
    if (store.knowledgeFiles.length === 0) {
      await store.fetchKnowledgeFiles()
    }
    draft.value = store.getDraft(draftId.value) || await store.loadContentDraft(draftId.value)
  } catch (err: any) {
    message.error(err?.message || t('presales.editor.loadFailed'))
    draft.value = null
  } finally {
    loading.value = false
  }

  if (!draft.value) {
    router.replace({ name: 'presales.content' })
    return
  }

  htmlContent.value = buildFallbackHtml(draft.value)
}

async function persistDraft() {
  const sections = parseHtmlToSections(htmlContent.value)
  await store.saveDraft(draftId.value, htmlContent.value, sections)
}

async function startHermesEdit(instruction: string) {
  const trimmed = instruction.trim()
  if (!trimmed) return

  if (isPdfDraft.value) {
    chatMessages.value.push({ role: 'user', text: trimmed })
    chatMessages.value.push({
      role: 'assistant',
      text: t('presales.editor.pdfEditHint'),
    })
    return
  }

  if (!draft.value?.outputFile) return

  try {
    await persistDraft()
    await runHermesEdit({
      draftId: draftId.value,
      outputFile: draft.value.outputFile,
      outputFileAbs: draft.value.outputFileAbs,
      title: draft.value.title,
      userInstruction: trimmed,
      tenantSlug: store.tenantSlug ?? undefined,
    })
    draft.value = { ...draft.value, status: 'completed' }
    const refreshed = store.getDraft(draftId.value) || await store.loadContentDraft(draftId.value)
    if (refreshed?.htmlContent?.trim()) {
      htmlContent.value = refreshed.htmlContent
    }
    previewKey.value += 1
  } catch (err: any) {
    message.error(err?.message || t('presales.editor.editFailed'))
  }
}

async function sendChat() {
  const text = chatInput.value.trim()
  if (!text || isEditing.value) return
  chatInput.value = ''
  await startHermesEdit(text)
}

async function saveDraft() {
  await persistDraft()
  message.success(t('presales.editor.saved'))
  router.push({ name: 'presales.content' })
}

async function downloadDoc() {
  downloading.value = true
  try {
    await persistDraft()

    if (hasPptArtifact.value) {
      await exportContentToPptx(draftId.value, {
        htmlContent: htmlContent.value,
        sections: parseHtmlToSections(htmlContent.value),
      }, store.tenantSlug ?? undefined)
      await downloadContentFile(draftId.value, store.tenantSlug ?? undefined)
      message.success(t('presales.editor.downloadPptDone'))
      previewKey.value += 1
      return
    }

    if (draft.value?.outputFile) {
      await downloadContentFile(draftId.value, store.tenantSlug ?? undefined)
      return
    }

    const blob = new Blob([htmlContent.value], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${draft.value?.companyName || 'document'}.html`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err: any) {
    message.error(err?.message || t('presales.editor.exportFailed'))
  } finally {
    downloading.value = false
  }
}

function insertComponent(html: string) {
  htmlEditorRef.value?.insertHtml(html)
}

const displayMessages = computed(() => {
  const items = [...chatMessages.value]
  if (isEditing.value && streamingText.value) {
    items.push({ role: 'assistant' as const, text: streamingText.value })
  }
  return items
})

const chatPlaceholder = computed(() => (
  isPdfDraft.value
    ? t('presales.editor.pptChatPlaceholder')
    : t('presales.editor.chatPlaceholder')
))

onMounted(() => {
  void loadDraftData()
})

onUnmounted(() => {
  stopEdit()
})
</script>

<template>
  <div class="editor-page">
    <header class="editor-toolbar">
      <strong>{{ draft?.title }}</strong>
      <div class="toolbar-actions">
        <NButton v-if="isHtmlEditorMode" size="small" @click="saveDraft">{{ t('presales.editor.saveDraft') }}</NButton>
        <NButton size="small" type="primary" :loading="downloading" :disabled="isEditing" @click="downloadDoc">
          {{ hasPptArtifact ? t('presales.editor.downloadPpt') : t('presales.editor.download') }}
        </NButton>
      </div>
    </header>

    <div v-if="loading" class="loading-wrap">
      <NSpin size="large" />
    </div>

    <div
      v-else
      class="editor-layout"
      :class="{ 'html-mode': isHtmlEditorMode, 'file-mode': !isHtmlEditorMode }"
    >
      <ContentHtmlComponentPalette
        v-if="isHtmlEditorMode"
        :disabled="isEditing"
        @insert="insertComponent"
      />

      <main class="content-area">
        <div v-if="isPdfDraft" class="file-layer">
          <ContentFilePreviewPane
            :draft-id="draftId"
            :file-name="previewFileName"
            :tenant-slug="store.tenantSlug ?? undefined"
            :preview-key="previewKey"
          />
        </div>
        <ContentHtmlEditorPane
          v-else
          ref="htmlEditorRef"
          :title="draft?.title || ''"
          :html-content="htmlContent"
          :disabled="isEditing"
          @update:html-content="htmlContent = $event"
        />
      </main>

      <aside class="ai-panel">
        <h4>{{ t('presales.editor.aiChat') }}</h4>
        <ContentDraftReferencePanel
          v-if="draft && isHtmlEditorMode"
          :draft="draft"
          :opportunity="referenceOpportunity"
          :knowledge-labels="knowledgeLabels"
        />
        <div class="chat-list">
          <div
            v-for="(msg, idx) in displayMessages"
            :key="idx"
            :class="['chat-bubble', msg.role, { streaming: isEditing && idx === displayMessages.length - 1 && msg.role === 'assistant' }]"
          >
            {{ msg.text }}
          </div>
        </div>
        <NInput
          v-model:value="chatInput"
          type="textarea"
          :rows="3"
          :disabled="isEditing"
          :placeholder="chatPlaceholder"
        />
        <NButton type="primary" block size="small" :loading="isEditing" @click="sendChat">
          {{ t('presales.editor.send') }}
        </NButton>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.editor-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.loading-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid $border-color;
  background: $bg-card;

  strong { color: $text-primary; font-size: 14px; }
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.editor-layout {
  flex: 1;
  min-height: 0;
  display: grid;

  &.html-mode {
    grid-template-columns: 220px 1fr 320px;
  }

  &.file-mode {
    grid-template-columns: 1fr 320px;
  }
}

.ai-panel,
.content-area {
  min-height: 0;
  overflow: auto;
}

.ai-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-left: 1px solid $border-color;
}

.ai-panel h4 {
  margin: 0;
  font-size: 13px;
  color: $text-secondary;
}

.content-area {
  position: relative;
  padding: 0;
  min-height: 0;
  overflow: hidden;

  :deep(.html-editor) {
    height: 100%;
  }
}

.file-layer {
  position: relative;
  height: 100%;
  min-height: 420px;
}

.chat-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-height: 120px;
  max-height: 320px;
  overflow: auto;
}

.chat-bubble {
  padding: 8px 10px;
  border-radius: $radius-sm;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;

  &.assistant {
    background: rgba(var(--accent-primary-rgb), 0.08);
    color: $text-secondary;
  }

  &.user {
    background: $bg-sidebar;
    color: $text-primary;
    align-self: flex-end;
  }

  &.streaming {
    border: 1px dashed rgba(var(--accent-primary-rgb), 0.35);
  }
}

@media (max-width: $breakpoint-mobile) {
  .editor-layout.html-mode,
  .editor-layout.file-mode {
    grid-template-columns: 1fr;
  }

  .editor-layout.html-mode :deep(.component-palette) {
    display: none;
  }

  .ai-panel {
    display: none;
  }
}
</style>
