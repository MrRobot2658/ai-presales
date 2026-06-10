<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { HTML_COMPONENT_DEFS } from './html-components'

defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  insert: [html: string]
}>()

const { t } = useI18n()

function handleInsert(html: string) {
  emit('insert', html)
}

function onDragStart(event: DragEvent, html: string) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('application/x-presales-html', html)
  event.dataTransfer.setData('text/plain', html)
  event.dataTransfer.effectAllowed = 'copy'
}
</script>

<template>
  <aside class="component-palette">
    <h4>{{ t('presales.editor.componentPalette') }}</h4>
    <p class="palette-hint">{{ t('presales.editor.componentPaletteHint') }}</p>
    <div class="component-grid">
      <button
        v-for="item in HTML_COMPONENT_DEFS"
        :key="item.type"
        type="button"
        class="component-item"
        :disabled="disabled"
        draggable="true"
        @click="handleInsert(item.html)"
        @dragstart="onDragStart($event, item.html)"
      >
        {{ t(item.labelKey) }}
      </button>
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.component-palette {
  min-height: 0;
  overflow: auto;
  padding: 14px;
  border-right: 1px solid $border-color;
}

.component-palette h4 {
  margin: 0 0 6px;
  font-size: 13px;
  color: $text-secondary;
}

.palette-hint {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.5;
  color: $text-muted;
}

.component-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.component-item {
  padding: 10px 8px;
  border: 1px dashed $border-color;
  border-radius: $radius-sm;
  background: $bg-card;
  color: $text-primary;
  font-size: 12px;
  cursor: grab;
  text-align: center;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover:not(:disabled) {
    border-color: rgba(var(--accent-primary-rgb), 0.45);
    background: rgba(var(--accent-primary-rgb), 0.06);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}
</style>
