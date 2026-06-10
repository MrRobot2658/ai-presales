<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { NInput, NTabPane, NTabs } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  title: string
  htmlContent: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:htmlContent': [value: string]
}>()

const { t } = useI18n()
const mode = ref<'visual' | 'source'>('visual')
const visualRef = ref<HTMLElement | null>(null)
const syncingVisual = ref(false)

function normalizeHtml(html: string): string {
  const trimmed = html.trim()
  if (trimmed) return trimmed
  return `<section class="slide"><h1>${props.title}</h1><p>${t('presales.editor.htmlPreviewEmpty')}</p></section>`
}

function emitHtml(next: string) {
  emit('update:htmlContent', next.trim())
}

function syncVisualFromProp() {
  const el = visualRef.value
  if (!el) return
  syncingVisual.value = true
  el.innerHTML = normalizeHtml(props.htmlContent)
  syncingVisual.value = false
}

watch(
  () => props.htmlContent,
  () => {
    if (mode.value !== 'visual') return
    const el = visualRef.value
    if (!el) return
    if (el.innerHTML.trim() === normalizeHtml(props.htmlContent)) return
    syncVisualFromProp()
  },
)

watch(mode, async (next) => {
  if (next === 'visual') {
    await nextTick()
    syncVisualFromProp()
  }
})

function onVisualInput() {
  if (syncingVisual.value || !visualRef.value) return
  emitHtml(visualRef.value.innerHTML)
}

function onSourceUpdate(value: string) {
  emitHtml(value)
}

function insertHtml(html: string) {
  if (props.disabled) return

  if (mode.value === 'source') {
    const current = props.htmlContent.trim()
    emitHtml(current ? `${current}\n${html}` : html)
    return
  }

  const el = visualRef.value
  if (!el) return

  el.focus()
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    if (el.contains(range.commonAncestorContainer)) {
      range.deleteContents()
      const template = document.createElement('template')
      template.innerHTML = html
      const fragment = template.content
      const lastNode = fragment.lastChild
      range.insertNode(fragment)
      if (lastNode) {
        range.setStartAfter(lastNode)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      emitHtml(el.innerHTML)
      return
    }
  }

  el.insertAdjacentHTML('beforeend', html)
  emitHtml(el.innerHTML)
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  if (props.disabled) return
  const html = event.dataTransfer?.getData('application/x-presales-html')
    || event.dataTransfer?.getData('text/plain')
  if (html) insertHtml(html)
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

defineExpose({ insertHtml })

onMounted(async () => {
  await nextTick()
  syncVisualFromProp()
})
</script>

<template>
  <div class="html-editor">
    <div class="html-editor-toolbar">
      <NTabs v-model:value="mode" type="segment" size="small">
        <NTabPane name="visual" :tab="t('presales.editor.modeVisual')" />
        <NTabPane name="source" :tab="t('presales.editor.modeSource')" />
      </NTabs>
    </div>

    <div v-if="mode === 'visual'" class="html-editor-visual">
      <article
        ref="visualRef"
        class="html-editor-document"
        :contenteditable="!disabled"
        spellcheck="false"
        @input="onVisualInput"
        @drop="onDrop"
        @dragover="onDragOver"
      />
    </div>

    <div v-else class="html-editor-source">
      <NInput
        :value="htmlContent"
        type="textarea"
        :rows="24"
        :disabled="disabled"
        :placeholder="t('presales.editor.sourcePlaceholder')"
        @update:value="onSourceUpdate"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.html-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #f1f5f9;
}

.html-editor-toolbar {
  padding: 12px 16px 0;
  border-bottom: 1px solid $border-color;
  background: $bg-card;
}

.html-editor-visual,
.html-editor-source {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.html-editor-visual {
  padding: 20px;
}

.html-editor-source {
  padding: 16px;
}

.html-editor-document {
  max-width: 920px;
  min-height: 520px;
  margin: 0 auto;
  outline: none;

  &:focus {
    box-shadow: 0 0 0 2px rgba(var(--accent-primary-rgb), 0.15);
    border-radius: 12px;
  }

  :deep(h1),
  :deep(h2),
  :deep(h3) {
    margin: 0 0 12px;
    color: #0f172a;
    line-height: 1.35;
  }

  :deep(h1) {
    font-size: 28px;
    margin-bottom: 20px;
  }

  :deep(h2) {
    font-size: 20px;
    margin-top: 8px;
  }

  :deep(p),
  :deep(li) {
    margin: 0 0 10px;
    color: #334155;
    font-size: 15px;
    line-height: 1.7;
  }

  :deep(section),
  :deep(.slide) {
    margin-bottom: 20px;
    padding: 28px 32px;
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
    border: 1px solid #e2e8f0;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 20px;
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
  }

  :deep(th),
  :deep(td) {
    border: 1px solid #e2e8f0;
    padding: 8px 10px;
    font-size: 14px;
  }

  :deep(blockquote) {
    margin: 0 0 12px;
    padding: 10px 14px;
    border-left: 3px solid #6366f1;
    background: #eef2ff;
    color: #334155;
  }

  :deep(hr) {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 16px 0;
  }

  :deep(img) {
    max-width: 100%;
    border-radius: 8px;
  }
}
</style>
