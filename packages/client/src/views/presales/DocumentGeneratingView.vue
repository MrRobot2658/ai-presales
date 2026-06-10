<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NProgress, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { usePresalesStore } from '@/stores/presales'
import {
  usePresalesContentHermesGenerate,
  type HermesProcessEntry,
} from '@/composables/usePresalesContentHermesGenerate'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const store = usePresalesStore()
const {
  processEntries,
  streamingPreview,
  activeStep,
  progressPercent,
  runGeneration,
} = usePresalesContentHermesGenerate()

const draftId = computed(() => route.params.draftId as string)
const draft = computed(() => store.getDraft(draftId.value))
const steps = computed(() => [
  t('presales.generating.step1'),
  t('presales.generating.step2'),
  t('presales.generating.step3'),
  t('presales.generating.step4'),
])
const progressRounded = computed(() => Math.min(100, Math.round(progressPercent.value)))
const currentStepLabel = computed(() => {
  const idx = Math.min(activeStep.value, steps.value.length - 1)
  return steps.value[idx] || steps.value[0]
})
const isDraftingStep = computed(() => activeStep.value >= 3 && progressRounded.value < 100)
const chainLines = ref<string[]>([])
const failed = ref(false)
const errorMessage = ref('')
const processLogRef = ref<HTMLElement | null>(null)

function formatProcessLabel(entry: HermesProcessEntry): string {
  if (entry.kind === 'tool') return entry.label
  if (entry.label === 'prepare') return t('presales.generating.processPrepare')
  if (entry.label === 'run.started') return t('presales.generating.processRunStarted')
  if (entry.label === 'run.completed') return t('presales.generating.processRunCompleted')
  if (entry.label === 'run.failed') return t('presales.generating.processRunFailed')
  if (entry.label === 'finalize.warning') return t('presales.generating.processFinalizeWarning')
  return entry.label
}

watch(processEntries, async () => {
  await nextTick()
  const el = processLogRef.value
  if (el) el.scrollTop = el.scrollHeight
}, { deep: true })

onMounted(async () => {
  if (!store.getDraft(draftId.value)) {
    await store.fetchContentDrafts()
  }
  const loadedDraft = store.getDraft(draftId.value)
  if (!loadedDraft) {
    router.replace({ name: 'presales.content' })
    return
  }

  if (store.knowledgeFiles.length === 0) {
    await store.fetchKnowledgeFiles()
  }

  const knowledgeNames = store.knowledgeRefLabels(loadedDraft.knowledgeRefs).join(', ')
  chainLines.value = [
    `${t('presales.generating.chain1')} ${loadedDraft.companyName}`,
    `${t('presales.generating.chain2')} ${knowledgeNames || '—'}`,
    t('presales.generating.chain3'),
    t('presales.generating.chain4'),
  ]

  try {
    const result = await runGeneration({
      draftId: draftId.value,
      tenantSlug: store.tenantSlug ?? undefined,
    })

    const index = store.contentDrafts.findIndex((d) => d.id === draftId.value)
    if (index >= 0) store.contentDrafts[index] = result.item
    else store.contentDrafts.unshift(result.item)

    if (result.warning) {
      message.warning(t('presales.generating.partial', { reason: result.warning }))
    }
    router.replace({ name: 'presales.editor', params: { draftId: draftId.value } })
  } catch (err: any) {
    try {
      await store.ensureDraftArtifact(draftId.value)
      message.warning(t('presales.generating.partialFallback'))
      router.replace({ name: 'presales.editor', params: { draftId: draftId.value } })
    } catch {
      failed.value = true
      errorMessage.value = err?.message || t('presales.generating.failed')
      message.error(errorMessage.value)
    }
  }
})
</script>

<template>
  <div class="generating-page">
    <div class="generating-card">
      <h2>{{ failed ? t('presales.generating.failedTitle') : t('presales.generating.title') }}</h2>
      <p>{{ draft?.title }}</p>

      <div v-if="!failed" class="progress-section">
        <div class="progress-header">
          <span class="progress-step">{{ currentStepLabel }}</span>
          <span class="progress-percent">{{ progressRounded }}%</span>
        </div>
        <NProgress
          type="line"
          :percentage="progressRounded"
          :show-indicator="false"
          :height="10"
          :border-radius="5"
          :processing="progressRounded < 100"
        />
        <p v-if="isDraftingStep" class="progress-hint">{{ t('presales.generating.draftProgressHint') }}</p>
      </div>

      <ul v-if="!failed" class="steps">
        <li v-for="(step, idx) in steps" :key="idx" :class="{ active: idx <= activeStep, done: idx < activeStep }">
          {{ step }}
        </li>
      </ul>

      <p v-else class="error-text">{{ errorMessage }}</p>

      <div v-if="!failed" class="process-panel">
        <h4>{{ t('presales.generating.hermesProcess') }}</h4>
        <div ref="processLogRef" class="process-log">
          <div
            v-for="entry in processEntries"
            :key="entry.id"
            class="process-entry"
            :class="[`kind-${entry.kind}`, entry.status ? `status-${entry.status}` : '']"
          >
            <span v-if="entry.status === 'running'" class="process-spinner" />
            <span v-else-if="entry.status === 'done'" class="process-check">✓</span>
            <span v-else-if="entry.status === 'error'" class="process-error">!</span>
            <span class="process-label">{{ formatProcessLabel(entry) }}</span>
            <span v-if="entry.detail" class="process-detail">{{ entry.detail }}</span>
          </div>
          <p v-if="streamingPreview" class="stream-preview">{{ streamingPreview }}</p>
        </div>
      </div>

      <div class="chain">
        <h4>{{ t('presales.generating.knowledgeChain') }}</h4>
        <p v-for="(line, idx) in chainLines" :key="idx">{{ line }}</p>
      </div>

      <NButton v-if="failed" type="primary" @click="router.push({ name: 'presales.content' })">
        {{ t('presales.generating.backToContent') }}
      </NButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.generating-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.generating-card {
  width: min(720px, 100%);
  padding: 28px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;

  h2 { margin: 0 0 8px; color: $text-primary; }
  > p { margin: 0 0 20px; color: $text-secondary; }
}

.progress-section {
  margin-bottom: 20px;
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.progress-step {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
}

.progress-percent {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: $accent-primary;
  font-weight: 600;
}

.progress-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: $text-muted;
  line-height: 1.5;
}

.error-text {
  color: $error;
  font-size: 14px;
  line-height: 1.6;
}

.steps {
  list-style: none;
  margin: 0 0 20px;
  padding: 0;

  li {
    padding: 10px 12px;
    margin-bottom: 8px;
    border-radius: $radius-sm;
    background: rgba(var(--accent-primary-rgb), 0.06);
    color: $text-muted;
    font-size: 14px;

    &.active { color: $accent-primary; font-weight: 600; }
    &.done { color: $success; }
  }
}

.process-panel {
  margin-bottom: 20px;

  h4 {
    margin: 0 0 8px;
    font-size: 14px;
    color: $text-primary;
  }
}

.process-log {
  max-height: 220px;
  overflow-y: auto;
  padding: 12px;
  border-radius: $radius-sm;
  border: 1px solid $border-color;
  background: rgba(var(--accent-primary-rgb), 0.03);
}

.process-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
  line-height: 1.45;
  color: $text-secondary;
  border-bottom: 1px solid rgba(var(--accent-primary-rgb), 0.06);

  &:last-of-type { border-bottom: none; }

  &.kind-success .process-label { color: $success; }
  &.kind-error .process-label { color: $error; }
  &.kind-tool.status-running .process-label { color: $accent-primary; font-weight: 600; }
}

.process-label {
  flex: 0 0 auto;
  max-width: 45%;
  word-break: break-word;
}

.process-detail {
  flex: 1;
  color: $text-muted;
  word-break: break-word;
}

.process-check {
  color: $success;
  font-weight: 700;
  width: 14px;
}

.process-error {
  color: $error;
  font-weight: 700;
  width: 14px;
}

.process-spinner {
  width: 12px;
  height: 12px;
  margin-top: 2px;
  border: 2px solid rgba(var(--accent-primary-rgb), 0.2);
  border-top-color: $accent-primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

.stream-preview {
  margin: 10px 0 0;
  padding-top: 8px;
  border-top: 1px dashed $border-color;
  font-size: 12px;
  line-height: 1.5;
  color: $text-muted;
  white-space: pre-wrap;
  word-break: break-word;
}

.chain {
  h4 { margin: 0 0 8px; font-size: 14px; color: $text-primary; }
  p { margin: 0 0 6px; font-size: 13px; color: $text-secondary; line-height: 1.5; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
