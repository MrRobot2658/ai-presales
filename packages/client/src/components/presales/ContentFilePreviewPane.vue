<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import {
  fetchContentFile,
  getContentPreview,
} from '@/api/presales/content'
import { contentFileBasename, resolveContentPreviewKind } from '@/utils/content-preview'

const props = defineProps<{
  draftId: string
  fileName: string
  tenantSlug?: string
  previewKey?: number
}>()

const { t } = useI18n()

const loading = ref(true)
const renderError = ref(false)
const pdfBlobUrl = ref<string | null>(null)

const previewKind = computed(() => resolveContentPreviewKind(props.fileName))
const displayName = computed(() => contentFileBasename(props.fileName))

function clearPdfUrl() {
  if (pdfBlobUrl.value) {
    URL.revokeObjectURL(pdfBlobUrl.value)
    pdfBlobUrl.value = null
  }
}

async function loadFile() {
  loading.value = true
  renderError.value = false
  clearPdfUrl()

  if (previewKind.value !== 'pdf') {
    loading.value = false
    renderError.value = true
    return
  }

  try {
    const preview = await getContentPreview(props.draftId, props.tenantSlug, true)
    if (preview.type !== 'pdf') {
      renderError.value = true
      loading.value = false
      return
    }
    const buffer = await fetchContentFile(props.draftId, props.tenantSlug, true)
    pdfBlobUrl.value = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }))
    loading.value = false
  } catch (err) {
    console.error('[content-preview]', err)
    renderError.value = true
    loading.value = false
  }
}

watch(
  () => [props.draftId, props.fileName, props.previewKey] as const,
  () => { void loadFile() },
)

onMounted(() => {
  void loadFile()
})

onUnmounted(() => {
  clearPdfUrl()
})
</script>

<template>
  <div class="content-file-preview">
    <div v-if="loading" class="content-file-preview-loading">
      <NSpin size="medium" />
      <span>{{ t('presales.editor.previewLoading') }}</span>
    </div>

    <iframe
      v-if="pdfBlobUrl && !renderError"
      :key="`pdf-${previewKey ?? 0}-${displayName}`"
      :src="pdfBlobUrl"
      class="content-file-preview-inner pdf"
      title="PDF preview"
    />

    <p v-else-if="renderError" class="content-file-preview-error">
      {{ t('presales.editor.previewFailed', { name: displayName }) }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.content-file-preview {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 560px;
  overflow: auto;
  background: #f8fafc;
}

.content-file-preview-loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #ffffff;
  color: #64748b;
  font-size: 13px;
}

.content-file-preview-inner.pdf {
  display: block;
  width: 100%;
  height: calc(100vh - 180px);
  min-height: 560px;
  border: 0;
  background: #ffffff;
}

.content-file-preview-error {
  padding: 24px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}
</style>
