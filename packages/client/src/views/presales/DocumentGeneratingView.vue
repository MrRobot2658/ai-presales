<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { usePresalesStore } from '@/stores/presales'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
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

onMounted(async () => {
  if (!draft.value) {
    router.replace({ name: 'presales.content' })
    return
  }

  const knowledgeNames = draft.value.knowledgeRefs.join(', ')
  const chain = [
    `${t('presales.generating.chain1')} ${draft.value.companyName}`,
    `${t('presales.generating.chain2')} ${knowledgeNames || 'kb-1'}`,
    t('presales.generating.chain3'),
    t('presales.generating.chain4'),
  ]

  for (let i = 0; i < steps.value.length; i++) {
    activeStep.value = i
    chainLines.value = chain.slice(0, i + 1)
    await new Promise((r) => setTimeout(r, 1200))
  }

  store.finishGenerating(draftId.value)
  router.replace({ name: 'presales.editor', params: { draftId: draftId.value } })
})
</script>

<template>
  <div class="generating-page">
    <div class="generating-card">
      <h2>{{ t('presales.generating.title') }}</h2>
      <p>{{ draft?.title }}</p>

      <ul class="steps">
        <li v-for="(step, idx) in steps" :key="idx" :class="{ active: idx <= activeStep, done: idx < activeStep }">
          {{ step }}
        </li>
      </ul>

      <div class="chain">
        <h4>{{ t('presales.generating.knowledgeChain') }}</h4>
        <p v-for="(line, idx) in chainLines" :key="idx">{{ line }}</p>
      </div>
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
