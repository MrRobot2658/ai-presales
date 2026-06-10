<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildDraftReferenceSources } from '@/utils/draft-reference-sources'
import type { ContentDraft, Opportunity } from '@/data/presales-mock'

const props = defineProps<{
  draft: ContentDraft
  opportunity?: Opportunity | null
  knowledgeLabels: string[]
}>()

const { t } = useI18n()

const items = computed(() => buildDraftReferenceSources({
  draft: props.draft,
  opportunity: props.opportunity,
  knowledgeLabels: props.knowledgeLabels,
  labels: {
    opportunity: t('presales.editor.reference.opportunity'),
    company: t('presales.fields.companyName'),
    requirement: t('presales.fields.description'),
    knowledge: t('presales.editor.reference.knowledge'),
    scenario: t('presales.editor.reference.scenario'),
    description: t('presales.generate.description'),
    outputFile: t('presales.editor.reference.outputFile'),
    updatedAt: t('presales.editor.reference.updatedAt'),
    none: t('presales.editor.reference.none'),
  },
}))
</script>

<template>
  <section class="reference-panel">
    <h5>{{ t('presales.editor.reference.title') }}</h5>
    <dl class="reference-list">
      <div v-for="item in items" :key="item.key" class="reference-item">
        <dt>{{ item.label }}</dt>
        <dd :class="{ multiline: item.multiline }">{{ item.value }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.reference-panel {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: rgba(var(--accent-primary-rgb), 0.04);
}

.reference-panel h5 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: $text-primary;
}

.reference-list {
  margin: 0;
}

.reference-item {
  &:not(:last-child) {
    margin-bottom: 8px;
  }

  dt {
    margin: 0 0 2px;
    font-size: 11px;
    color: $text-muted;
  }

  dd {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: $text-secondary;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &.multiline {
      white-space: pre-wrap;
      overflow: visible;
    }
  }
}
</style>
