<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NModal, NSelect, NCheckboxGroup, NCheckbox, NInput, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { SCENARIO_OPTIONS } from '@/data/presales-mock'
import { usePresalesStore } from '@/stores/presales'
import type { Opportunity } from '@/data/presales-mock'

const props = defineProps<{
  show: boolean
  opportunity: Opportunity | null
}>()

const emit = defineEmits<{ 'update:show': [value: boolean] }>()

const { t } = useI18n()
const router = useRouter()
const store = usePresalesStore()

const knowledgeRefs = ref<string[]>([])
const scenario = ref<string[]>(['bid-word'])
const description = ref('')

watch(() => props.show, (open) => {
  if (open) {
    knowledgeRefs.value = store.knowledgeOptions[0]?.value ? [store.knowledgeOptions[0].value] : []
    scenario.value = ['bid-word']
    description.value = ''
  }
})

async function handleGenerate() {
  if (!props.opportunity) return
  const draft = await store.createDraft({
    opportunityId: props.opportunity.id,
    companyName: props.opportunity.companyName,
    scenario: scenario.value,
    knowledgeRefs: knowledgeRefs.value,
    description: description.value,
  })
  emit('update:show', false)
  router.push({ name: 'presales.generating', params: { draftId: draft.id } })
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="t('presales.generate.title')"
    style="width: min(560px, 96vw);"
    @update:show="emit('update:show', $event)"
  >
    <div class="form">
      <label>{{ t('presales.generate.knowledge') }}</label>
      <NSelect v-model:value="knowledgeRefs" multiple :options="store.knowledgeOptions" />

      <label>{{ t('presales.generate.scenario') }}</label>
      <NCheckboxGroup v-model:value="scenario">
        <NCheckbox v-for="opt in SCENARIO_OPTIONS" :key="opt.value" :value="opt.value" :label="opt.label" />
      </NCheckboxGroup>

      <label>{{ t('presales.generate.description') }}</label>
      <NInput v-model:value="description" type="textarea" :rows="4" :placeholder="t('presales.generate.descriptionPlaceholder')" />

      <NButton type="primary" block @click="handleGenerate">
        {{ t('presales.generate.submit') }}
      </NButton>
    </div>
  </NModal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;

  label {
    font-size: 13px;
    color: $text-secondary;
  }
}
</style>
