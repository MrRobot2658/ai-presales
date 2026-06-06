<script setup lang="ts">
import { h, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NDataTable, NTag, type DataTableColumns } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { usePresalesStore } from '@/stores/presales'
import type { ContentDraft } from '@/data/presales-mock'

const { t } = useI18n()
const router = useRouter()
const store = usePresalesStore()

onMounted(() => {
  void store.fetchContentDrafts()
})

const columns: DataTableColumns<ContentDraft> = [
  { title: () => t('presales.content.company'), key: 'companyName', minWidth: 160 },
  { title: () => t('presales.content.titleCol'), key: 'title', minWidth: 220 },
  {
    title: () => t('presales.content.status'),
    key: 'status',
    width: 110,
    render(row) {
      const type = row.status === 'completed' ? 'success' : row.status === 'generating' ? 'warning' : 'info'
      return h(NTag, { size: 'small', type }, () => t(`presales.content.status_${row.status}`))
    },
  },
  {
    title: () => t('presales.content.updatedAt'),
    key: 'updatedAt',
    width: 180,
    render(row) {
      return new Date(row.updatedAt).toLocaleString('zh-CN', { hour12: false })
    },
  },
  {
    title: () => t('presales.list.actions'),
    key: 'actions',
    width: 120,
    render(row) {
      if (row.status === 'generating') {
        return h(NButton, {
          size: 'tiny',
          onClick: () => router.push({ name: 'presales.generating', params: { draftId: row.id } }),
        }, () => t('presales.content.viewProgress'))
      }
      return h(NButton, {
        size: 'tiny',
        type: 'primary',
        ghost: true,
        onClick: () => router.push({ name: 'presales.editor', params: { draftId: row.id } }),
      }, () => t('presales.content.continueEdit'))
    },
  },
]
</script>

<template>
  <div class="presales-page">
    <header class="page-header">
      <h2>{{ t('presales.content.title') }}</h2>
      <p class="subtitle">{{ t('presales.content.subtitle') }}</p>
    </header>

    <NDataTable
      :columns="columns"
      :data="store.drafts"
      :bordered="false"
      size="small"
      :empty-text="t('presales.content.empty')"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/presales-page.scss';

.subtitle {
  margin: -12px 0 16px;
  font-size: 13px;
  color: $text-muted;
}
</style>
