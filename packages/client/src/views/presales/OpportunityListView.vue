<script setup lang="ts">
import { h, ref } from 'vue'
import { NButton, NDataTable, type DataTableColumns } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { usePresalesStore } from '@/stores/presales'
import type { Opportunity } from '@/data/presales-mock'
import OpportunityInsightModal from '@/components/presales/OpportunityInsightModal.vue'
import CompanyInsightModal from '@/components/presales/CompanyInsightModal.vue'
import GeneratePlanModal from '@/components/presales/GeneratePlanModal.vue'

const { t } = useI18n()
const store = usePresalesStore()

const selected = ref<Opportunity | null>(null)
const showInsight = ref(false)
const showCompany = ref(false)
const showGenerate = ref(false)

function openInsight(row: Opportunity) {
  selected.value = row
  showInsight.value = true
}

function openCompanyFromInsight() {
  showInsight.value = false
  showCompany.value = true
}

function openGenerate(row: Opportunity) {
  selected.value = row
  showGenerate.value = true
}

const columns: DataTableColumns<Opportunity> = [
  { title: () => t('presales.fields.source'), key: 'source', width: 100 },
  { title: () => t('presales.fields.companyName'), key: 'companyName', minWidth: 160 },
  { title: () => t('presales.fields.description'), key: 'description', ellipsis: { tooltip: true }, minWidth: 200 },
  { title: () => t('presales.fields.industry'), key: 'industry', width: 90 },
  { title: () => t('presales.fields.contactName'), key: 'contactName', width: 90 },
  { title: () => t('presales.fields.phone'), key: 'phone', width: 120 },
  { title: () => t('presales.fields.email'), key: 'email', width: 160 },
  { title: () => t('presales.fields.position'), key: 'position', width: 100 },
  { title: () => t('presales.fields.officeAddress'), key: 'officeAddress', ellipsis: { tooltip: true }, minWidth: 160 },
  { title: () => t('presales.fields.hqLocation'), key: 'hqLocation', width: 80 },
  {
    title: () => t('presales.list.actions'),
    key: 'actions',
    width: 220,
    fixed: 'right',
    render(row) {
      return h('div', { class: 'action-cell' }, [
        h(NButton, { size: 'tiny', type: 'primary', ghost: true, onClick: () => openInsight(row) }, () => t('presales.list.match')),
        h(NButton, { size: 'tiny', type: 'info', ghost: true, onClick: () => openGenerate(row) }, () => t('presales.list.generate')),
      ])
    },
  },
]
</script>

<template>
  <div class="presales-page list-page">
    <header class="page-header">
      <h2>{{ t('presales.list.title') }}</h2>
    </header>

    <NDataTable
      :columns="columns"
      :data="store.opportunities"
      :scroll-x="1800"
      :bordered="false"
      size="small"
      class="opp-table"
    />

    <OpportunityInsightModal
      v-model:show="showInsight"
      :opportunity="selected"
      @open-company="openCompanyFromInsight"
    />
    <CompanyInsightModal v-model:show="showCompany" :opportunity="selected" />
    <GeneratePlanModal v-model:show="showGenerate" :opportunity="selected" />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/presales-page.scss';

.list-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.opp-table {
  flex: 1;
}

:deep(.action-cell) {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
