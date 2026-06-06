<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NInput, NSpin, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { downloadContentFile } from '@/api/presales/content'
import { usePresalesContentHermesEdit } from '@/composables/usePresalesContentHermesEdit'
import { usePresalesStore } from '@/stores/presales'
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
const sections = ref<{ id: string; title: string; content: string }[]>([])
const chatInput = ref('')
const filePreviewUrl = ref<string | null>(null)
const loading = ref(true)
const dragIndex = ref<number | null>(null)

const hasOutputFile = computed(() => Boolean(draft.value?.outputFile))
const fileExt = computed(() => {
  const name = draft.value?.outputFile || draft.value?.title || ''
  const parts = name.split('.')
  return (parts.pop() || '').toLowerCase()
})

function fileTypeLabel() {
  if (fileExt.value === 'pptx' || fileExt.value === 'ppt') return 'PPT'
  if (fileExt.value === 'docx' || fileExt.value === 'doc') return 'Word'
  if (fileExt.value === 'html') return 'HTML'
  return fileExt.value.toUpperCase() || 'FILE'
}

async function loadDraftData() {
  loading.value = true
  try {
    draft.value = store.getDraft(draftId.value) || await store.loadContentDraft(draftId.value)
  } catch {
    draft.value = null
  } finally {
    loading.value = false
  }

  if (!draft.value) {
    router.replace({ name: 'presales.content' })
    return
  }

  htmlContent.value = draft.value.htmlContent
  sections.value = draft.value.sections?.map((s) => ({ ...s })) || []

  if (draft.value.outputFile) {
    try {
      const { getContentFileBlobUrl } = await import('@/api/presales/content')
      if (filePreviewUrl.value) URL.revokeObjectURL(filePreviewUrl.value)
      filePreviewUrl.value = await getContentFileBlobUrl(draftId.value, store.tenantSlug ?? undefined)
    } catch {
      filePreviewUrl.value = null
    }
    await startHermesEdit(t('presales.editor.editPrompt'))
  }
}

async function startHermesEdit(instruction?: string) {
  if (!draft.value?.outputFile) return
  try {
    await runHermesEdit({
      draftId: draftId.value,
      outputFile: draft.value.outputFile,
      outputFileAbs: draft.value.outputFileAbs,
      title: draft.value.title,
      userInstruction: instruction || chatInput.value.trim() || t('presales.editor.editPrompt'),
      tenantSlug: store.tenantSlug ?? undefined,
    })
    draft.value = { ...draft.value, status: 'completed' }
    const index = store.contentDrafts.findIndex((d) => d.id === draftId.value)
    if (index >= 0) store.contentDrafts[index] = { ...store.contentDrafts[index], status: 'completed' }
  } catch (err: any) {
    message.error(err?.message || t('presales.editor.editFailed'))
  }
}

async function sendChat() {
  const text = chatInput.value.trim()
  if (!text || isEditing.value) return
  chatInput.value = ''

  if (hasOutputFile.value) {
    await startHermesEdit(text)
    return
  }

  chatMessages.value.push({ role: 'user', text })
  setTimeout(() => {
    chatMessages.value.push({
      role: 'assistant',
      text: `已根据你的要求更新建议：${text}。你可以在中间编辑区继续微调段落内容。`,
    })
  }, 600)
}

async function saveDraft() {
  await store.saveDraft(draftId.value, htmlContent.value, sections.value)
  message.success(t('presales.editor.saved'))
  router.push({ name: 'presales.content' })
}

async function downloadDoc() {
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
}

function onDragStart(idx: number) {
  dragIndex.value = idx
}

function onDrop(idx: number) {
  if (dragIndex.value === null || dragIndex.value === idx) return
  const list = [...sections.value]
  const [item] = list.splice(dragIndex.value, 1)
  list.splice(idx, 0, item)
  sections.value = list
  dragIndex.value = null
}

function syncSectionToHtml(sectionId: string, content: string) {
  const section = sections.value.find((s) => s.id === sectionId)
  if (section) section.content = content
  htmlContent.value = sections.value
    .map((s) => `<section><h2>${s.title}</h2><p>${s.content}</p></section>`)
    .join('\n')
}

const displayMessages = computed(() => {
  const items = [...chatMessages.value]
  if (isEditing.value && streamingText.value) {
    items.push({ role: 'assistant' as const, text: streamingText.value })
  }
  return items
})

onMounted(() => {
  void loadDraftData()
})

onUnmounted(() => {
  stopEdit()
  if (filePreviewUrl.value) URL.revokeObjectURL(filePreviewUrl.value)
})
</script>

<template>
  <div class="editor-page">
    <header class="editor-toolbar">
      <strong>{{ draft?.title }}</strong>
      <div class="toolbar-actions">
        <NButton v-if="!hasOutputFile" size="small" @click="saveDraft">{{ t('presales.editor.saveDraft') }}</NButton>
        <NButton size="small" type="primary" :disabled="isEditing" @click="downloadDoc">
          {{ t('presales.editor.download') }}
        </NButton>
      </div>
    </header>

    <div v-if="loading" class="loading-wrap">
      <NSpin size="large" />
    </div>

    <div v-else class="editor-layout">
      <aside v-if="!hasOutputFile" class="outline">
        <h4>{{ t('presales.editor.outline') }}</h4>
        <div
          v-for="(section, idx) in sections"
          :key="section.id"
          class="outline-item"
          draggable="true"
          @dragstart="onDragStart(idx)"
          @dragover.prevent
          @drop="onDrop(idx)"
        >
          {{ section.title }}
        </div>
      </aside>

      <main class="content-area">
        <div v-if="hasOutputFile" class="file-layer">
          <div class="file-card">
            <div class="file-badge">{{ fileTypeLabel() }}</div>
            <h3>{{ draft?.title }}</h3>
            <p class="file-path">
              <span>{{ t('presales.editor.filePath') }}：</span>
              {{ draft?.outputFile }}
            </p>
            <a
              v-if="filePreviewUrl"
              class="file-open-link"
              :href="filePreviewUrl"
              target="_blank"
              rel="noopener"
            >
              {{ t('presales.content.downloadFile') }}
            </a>
          </div>

          <div v-if="isEditing" class="editing-overlay">
            <NSpin size="medium" />
            <strong>{{ t('presales.editor.editingOverlay') }}</strong>
            <p>{{ t('presales.editor.openWithHermes') }}</p>
          </div>
        </div>

        <template v-else>
          <div v-for="section in sections" :key="section.id" class="section-editor">
            <h3>{{ section.title }}</h3>
            <NInput
              :value="section.content"
              type="textarea"
              :rows="4"
              :disabled="isEditing"
              @update:value="(v) => syncSectionToHtml(section.id, v)"
            />
          </div>
        </template>
      </main>

      <aside class="ai-panel">
        <h4>{{ t('presales.editor.aiChat') }}</h4>
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
          :placeholder="t('presales.editor.chatPlaceholder')"
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
  grid-template-columns: 200px 1fr 280px;
}

.outline,
.ai-panel,
.content-area {
  min-height: 0;
  overflow: auto;
  padding: 14px;
  border-right: 1px solid $border-color;
}

.ai-panel { border-right: none; border-left: 1px solid $border-color; }

.outline h4,
.ai-panel h4 {
  margin: 0 0 10px;
  font-size: 13px;
  color: $text-secondary;
}

.outline-item {
  padding: 8px 10px;
  margin-bottom: 6px;
  border: 1px dashed $border-color;
  border-radius: $radius-sm;
  font-size: 13px;
  color: $text-primary;
  cursor: grab;
}

.content-area {
  position: relative;
}

.file-layer {
  position: relative;
  min-height: 420px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: linear-gradient(180deg, rgba(var(--accent-primary-rgb), 0.04), $bg-card);
  overflow: hidden;
}

.file-card {
  padding: 48px 32px;
  text-align: center;

  h3 {
    margin: 16px 0 8px;
    color: $text-primary;
    word-break: break-all;
  }
}

.file-badge {
  display: inline-flex;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(var(--accent-primary-rgb), 0.12);
  color: $accent-primary;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.file-path {
  margin: 0;
  font-size: 13px;
  color: $text-muted;
  word-break: break-all;
}

.file-open-link {
  display: inline-block;
  margin-top: 16px;
  color: $accent-primary;
  font-size: 13px;
}

.editing-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(2px);
  color: #fff;
  text-align: center;
  z-index: 2;

  strong {
    font-size: 18px;
    letter-spacing: 0.08em;
  }

  p {
    margin: 0;
    font-size: 13px;
    opacity: 0.9;
  }
}

.section-editor {
  margin-bottom: 16px;

  h3 {
    margin: 0 0 8px;
    font-size: 15px;
    color: $text-primary;
  }
}

.chat-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
  max-height: 360px;
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

.editor-layout:has(.content-area .file-layer) {
  grid-template-columns: 1fr 320px;
}

@media (max-width: $breakpoint-mobile) {
  .editor-layout,
  .editor-layout:has(.content-area .file-layer) {
    grid-template-columns: 1fr;
  }

  .outline,
  .ai-panel {
    display: none;
  }
}
</style>
