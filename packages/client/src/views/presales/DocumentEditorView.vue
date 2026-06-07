<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NInput, NSpin, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { downloadContentFile, exportContentToPptx } from '@/api/presales/content'
import ContentFilePreviewPane from '@/components/presales/ContentFilePreviewPane.vue'
import ContentHtmlPreviewPane from '@/components/presales/ContentHtmlPreviewPane.vue'
import { usePresalesContentHermesEdit } from '@/composables/usePresalesContentHermesEdit'
import { usePresalesStore } from '@/stores/presales'
import { contentFileBasename, resolveContentPreviewKind } from '@/utils/content-preview'
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
const previewKey = ref(0)
const loading = ref(true)
const downloading = ref(false)
const dragIndex = ref<number | null>(null)

const previewFileName = computed(() => {
  const name = draft.value?.outputFile || draft.value?.title || ''
  return contentFileBasename(name)
})
const previewKind = computed(() => resolveContentPreviewKind(previewFileName.value))
const isPdfDraft = computed(() => previewKind.value === 'pdf')
const isPptDraft = computed(() => previewKind.value === 'ppt')
const showOutline = computed(() => !isPdfDraft.value && sections.value.length > 0)

function buildFallbackHtml(item: ContentDraft): string {
  if (item.htmlContent?.trim()) return item.htmlContent
  if (item.sections?.length) {
    return item.sections
      .map((s) => `<section><h2>${s.title}</h2><p>${s.content}</p></section>`)
      .join('\n')
  }
  return `<h1>${item.title || item.companyName}</h1><section><h2>方案概览</h2><p>下载时将转换为 PPT 文件。</p></section>`
}

function buildFallbackSections(item: ContentDraft) {
  if (item.sections?.length) return item.sections.map((s) => ({ ...s }))
  return [
    { id: 's1', title: '封面', content: item.companyName || item.title },
    { id: 's2', title: '方案概览', content: '可在左侧大纲编辑，下载时导出为 PPT。' },
  ]
}

async function loadDraftData() {
  loading.value = true
  try {
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
  sections.value = buildFallbackSections(draft.value)
}

async function persistDraft() {
  await store.saveDraft(draftId.value, htmlContent.value, sections.value)
}

async function startHermesEdit(instruction: string) {
  const trimmed = instruction.trim()
  if (!trimmed) return

  if (isPptDraft.value) {
    chatMessages.value.push({ role: 'user', text: trimmed })
    await persistDraft()
    chatMessages.value.push({
      role: 'assistant',
      text: t('presales.editor.htmlEditHint'),
    })
    return
  }

  if (!draft.value?.outputFile) return

  try {
    await runHermesEdit({
      draftId: draftId.value,
      outputFile: draft.value.outputFile,
      outputFileAbs: draft.value.outputFileAbs,
      title: draft.value.title,
      userInstruction: trimmed,
      tenantSlug: store.tenantSlug ?? undefined,
    })
    draft.value = { ...draft.value, status: 'completed' }
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

    if (isPptDraft.value) {
      await exportContentToPptx(draftId.value, {
        htmlContent: htmlContent.value,
        sections: sections.value,
      }, store.tenantSlug ?? undefined)
      await downloadContentFile(draftId.value, store.tenantSlug ?? undefined)
      message.success(t('presales.editor.downloadPptDone'))
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
  syncAllSectionsToHtml()
}

function syncSectionToHtml(sectionId: string, content: string) {
  const section = sections.value.find((s) => s.id === sectionId)
  if (section) section.content = content
  syncAllSectionsToHtml()
}

function syncAllSectionsToHtml() {
  htmlContent.value = sections.value
    .map((s) => `<section><h2>${s.title}</h2><p>${s.content.replace(/\n/g, '<br/>')}</p></section>`)
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
})
</script>

<template>
  <div class="editor-page">
    <header class="editor-toolbar">
      <strong>{{ draft?.title }}</strong>
      <div class="toolbar-actions">
        <NButton v-if="showOutline" size="small" @click="saveDraft">{{ t('presales.editor.saveDraft') }}</NButton>
        <NButton size="small" type="primary" :loading="downloading" :disabled="isEditing" @click="downloadDoc">
          {{ isPptDraft ? t('presales.editor.downloadPpt') : t('presales.editor.download') }}
        </NButton>
      </div>
    </header>

    <div v-if="loading" class="loading-wrap">
      <NSpin size="large" />
    </div>

    <div v-else class="editor-layout" :class="{ 'with-outline': showOutline, 'pdf-mode': isPdfDraft }">
      <aside v-if="showOutline" class="outline">
        <h4>{{ t('presales.editor.outline') }}</h4>
        <div
          v-for="(section, idx) in sections"
          :key="section.id"
          class="outline-block"
          draggable="true"
          @dragstart="onDragStart(idx)"
          @dragover.prevent
          @drop="onDrop(idx)"
        >
          <strong>{{ section.title }}</strong>
          <NInput
            :value="section.content"
            type="textarea"
            :rows="3"
            :disabled="isEditing"
            @update:value="(v) => syncSectionToHtml(section.id, v)"
          />
        </div>
      </aside>

      <main class="content-area">
        <div v-if="isPdfDraft" class="file-layer">
          <ContentFilePreviewPane
            :draft-id="draftId"
            :file-name="previewFileName"
            :tenant-slug="store.tenantSlug ?? undefined"
            :preview-key="previewKey"
          />
        </div>
        <ContentHtmlPreviewPane
          v-else
          :title="draft?.title || ''"
          :html-content="htmlContent"
        />
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
  grid-template-columns: 1fr 320px;

  &.with-outline {
    grid-template-columns: 280px 1fr 320px;
  }

  &.pdf-mode {
    grid-template-columns: 1fr 320px;
  }
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

.outline-block {
  padding: 10px;
  margin-bottom: 10px;
  border: 1px dashed $border-color;
  border-radius: $radius-sm;
  cursor: grab;

  strong {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    color: $text-primary;
  }
}

.content-area {
  position: relative;
  padding: 0;
}

.file-layer {
  position: relative;
  height: 100%;
  min-height: 420px;
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

@media (max-width: $breakpoint-mobile) {
  .editor-layout,
  .editor-layout.with-outline,
  .editor-layout.pdf-mode {
    grid-template-columns: 1fr;
  }

  .outline,
  .ai-panel {
    display: none;
  }
}
</style>
