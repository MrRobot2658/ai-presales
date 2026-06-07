<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { usePresalesStore } from '@/stores/presales'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const store = usePresalesStore()

const draftId = computed(() => route.params.draftId as string)
const draft = computed(() => store.getDraft(draftId.value))
const steps = computed(() => [
  t('presales.generating.step1'),
  t('presales.generating.step2'),
  t('presales.generating.step3'),
  t('presales.generating.step4'),
])
const activeStep = ref(0)
const chainLines = ref<string[]>([])
const failed = ref(false)
const errorMessage = ref('')

function advanceSteps(totalMs: number) {
  const intervalMs = Math.max(800, Math.floor(totalMs / steps.value.length))
  let idx = 0
  const timer = setInterval(() => {
    if (idx < steps.value.length - 1) {
      idx += 1
      activeStep.value = idx
    } else {
      clearInterval(timer)
    }
  }, intervalMs)
  return () => clearInterval(timer)
}

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
  activeStep.value = 0

  const stopSteps = advanceSteps(120_000)

  try {
    const result = await store.generateDraft(draftId.value)
    activeStep.value = steps.value.length - 1
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
  } finally {
    stopSteps()
  }
})
</script>

<template>
  <div class="generating-page">
    <div class="generating-card">
      <h2>{{ failed ? t('presales.generating.failedTitle') : t('presales.generating.title') }}</h2>
      <p>{{ draft?.title }}</p>

      <ul v-if="!failed" class="steps">
        <li v-for="(step, idx) in steps" :key="idx" :class="{ active: idx <= activeStep, done: idx < activeStep }">
          {{ step }}
        </li>
      </ul>

      <p v-else class="error-text">{{ errorMessage }}</p>

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
  width: min(640px, 100%);
  padding: 28px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;

  h2 { margin: 0 0 8px; color: $text-primary; }
  p { margin: 0 0 20px; color: $text-secondary; }
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

.chain {
  h4 { margin: 0 0 8px; font-size: 14px; color: $text-primary; }
  p { margin: 0 0 6px; font-size: 13px; color: $text-secondary; line-height: 1.5; }
}
</style>
