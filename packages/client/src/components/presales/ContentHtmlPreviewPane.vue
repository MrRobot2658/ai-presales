<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  title: string
  htmlContent: string
}>()

const { t } = useI18n()

const displayHtml = computed(() => {
  const raw = props.htmlContent?.trim()
  if (!raw) {
    return `<section class="slide"><h1>${props.title}</h1><p>${t('presales.editor.htmlPreviewEmpty')}</p></section>`
  }
  return raw
})
</script>

<template>
  <div class="html-preview">
    <div class="html-preview-badge">{{ t('presales.editor.htmlPreviewBadge') }}</div>
    <article class="html-preview-document" v-html="displayHtml" />
  </div>
</template>

<style scoped lang="scss">
.html-preview {
  width: 100%;
  min-height: 560px;
  padding: 20px;
  box-sizing: border-box;
  background: #f1f5f9;
}

.html-preview-badge {
  display: inline-block;
  margin-bottom: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 12px;
}

.html-preview-document {
  max-width: 920px;
  margin: 0 auto;

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

  :deep(ul) {
    padding-left: 20px;
  }
}
</style>
