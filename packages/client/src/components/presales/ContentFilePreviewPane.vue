<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { NButton, NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import {
  fetchContentFile,
  getContentPreview,
  type PptxPreviewPayload,
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
const pptxPreview = ref<PptxPreviewPayload | null>(null)
const activeSlideIndex = ref(0)

const previewKind = computed(() => resolveContentPreviewKind(props.fileName))
const displayName = computed(() => contentFileBasename(props.fileName))
const activeSlide = computed(() => pptxPreview.value?.slides[activeSlideIndex.value] ?? null)
const slideCount = computed(() => pptxPreview.value?.slideCount ?? 0)

function clearPdfUrl() {
  if (pdfBlobUrl.value) {
    URL.revokeObjectURL(pdfBlobUrl.value)
    pdfBlobUrl.value = null
  }
}

function resetPreviewState() {
  clearPdfUrl()
  pptxPreview.value = null
  activeSlideIndex.value = 0
}

function showPreviousSlide() {
  if (activeSlideIndex.value <= 0) return
  activeSlideIndex.value -= 1
}

function showNextSlide() {
  if (activeSlideIndex.value >= slideCount.value - 1) return
  activeSlideIndex.value += 1
}

async function loadPdfPreview() {
  const preview = await getContentPreview(props.draftId, props.tenantSlug, true)
  if (preview.type !== 'pdf') {
    throw new Error(`Unexpected preview type: ${preview.type}`)
  }
  const buffer = await fetchContentFile(props.draftId, props.tenantSlug, true)
  pdfBlobUrl.value = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }))
}

async function loadPptPreview() {
  const preview = await getContentPreview(props.draftId, props.tenantSlug, true)
  if (preview.type !== 'pptx' || !preview.slides?.length) {
    throw new Error('PPT preview payload is empty')
  }
  pptxPreview.value = preview
  activeSlideIndex.value = 0
}

async function loadFile() {
  loading.value = true
  renderError.value = false
  resetPreviewState()

  try {
    if (previewKind.value === 'pdf') {
      await loadPdfPreview()
    } else if (previewKind.value === 'ppt') {
      await loadPptPreview()
    } else {
      throw new Error(`Unsupported preview kind: ${previewKind.value}`)
    }
  } catch (err) {
    console.error('[content-preview]', err)
    renderError.value = true
  } finally {
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

    <div v-else-if="pptxPreview && activeSlide && !renderError" class="content-file-preview-ppt">
      <div class="ppt-toolbar">
        <NButton size="small" :disabled="activeSlideIndex <= 0" @click="showPreviousSlide">
          {{ t('presales.editor.slidePrev') }}
        </NButton>
        <span class="ppt-slide-label">
          {{ t('presales.editor.slideLabel', { index: activeSlide.index, total: slideCount }) }}
        </span>
        <NButton size="small" :disabled="activeSlideIndex >= slideCount - 1" @click="showNextSlide">
          {{ t('presales.editor.slideNext') }}
        </NButton>
      </div>

      <article
        class="ppt-slide"
        :style="{ backgroundColor: activeSlide.backgroundColor }"
      >
        <div v-if="activeSlide.images.length" class="ppt-slide-images">
          <img
            v-for="image in activeSlide.images"
            :key="image.fileName"
            :src="image.dataUrl"
            :alt="image.fileName"
          >
        </div>
        <div class="ppt-slide-texts">
          <p
            v-for="(line, idx) in activeSlide.texts"
            :key="`${activeSlide.name}-${idx}`"
            :class="{ title: idx === 0 }"
          >
            {{ line }}
          </p>
        </div>
      </article>
    </div>

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

.content-file-preview-ppt {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 560px;
  padding: 16px;
}

.ppt-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.ppt-slide-label {
  min-width: 120px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.ppt-slide {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 420px;
  padding: 32px 40px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

.ppt-slide-images {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  img {
    max-width: min(100%, 420px);
    max-height: 240px;
    object-fit: contain;
    border-radius: 8px;
  }
}

.ppt-slide-texts {
  display: flex;
  flex-direction: column;
  gap: 8px;

  p {
    margin: 0;
    color: #1e293b;
    font-size: 15px;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .title {
    font-size: 24px;
    font-weight: 700;
    line-height: 1.35;
  }
}

.content-file-preview-error {
  padding: 24px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}
</style>
