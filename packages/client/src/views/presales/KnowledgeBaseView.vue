<script setup lang="ts">
import { h, ref } from 'vue'
import { NButton, NDataTable, NModal, NInput, NUpload, NTag, useMessage, type DataTableColumns } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { usePresalesStore } from '@/stores/presales'
import type { KnowledgeFile } from '@/data/presales-mock'

const { t } = useI18n()
const message = useMessage()
const store = usePresalesStore()

const showUpload = ref(false)
const fileName = ref('')
const fileType = ref('PDF')
const cleanRequirement = ref('')

const columns: DataTableColumns<KnowledgeFile> = [
  { title: () => t('presales.knowledge.fileName'), key: 'fileName', minWidth: 220 },
  { title: () => t('presales.knowledge.fileType'), key: 'fileType', width: 90 },
  { title: () => t('presales.knowledge.uploadedAt'), key: 'uploadedAt', width: 160 },
  {
    title: () => t('presales.knowledge.status'),
    key: 'status',
    width: 100,
    render(row) {
      const type = row.status === 'ready' ? 'success' : row.status === 'reviewing' ? 'warning' : 'error'
      return h(NTag, { size: 'small', type }, () => t(`presales.knowledge.status_${row.status}`))
    },
  },
  {
    title: () => t('presales.knowledge.eta'),
    key: 'eta',
    width: 160,
    render(row) {
      return row.eta || '-'
    },
  },
]

function openUpload() {
  fileName.value = ''
  fileType.value = 'PDF'
  cleanRequirement.value = ''
  showUpload.value = true
}

function handleUploadChange(options: { file: { name?: string } }) {
  if (options.file.name) {
    fileName.value = options.file.name
    const ext = options.file.name.split('.').pop()?.toUpperCase()
    if (ext) fileType.value = ext
  }
}

function submitTicket() {
  if (!fileName.value.trim()) {
    message.warning(t('presales.knowledge.fileRequired'))
    return
  }
  store.submitKnowledgeTicket(fileName.value.trim(), fileType.value, cleanRequirement.value.trim())
  message.success(t('presales.knowledge.submitted'))
  showUpload.value = false
}
</script>

<template>
  <div class="presales-page">
    <header class="page-header row">
      <h2>{{ t('presales.knowledge.title') }}</h2>
      <NButton type="primary" @click="openUpload">{{ t('presales.knowledge.upload') }}</NButton>
    </header>

    <NDataTable :columns="columns" :data="store.knowledgeFiles" :bordered="false" size="small" />

    <NModal v-model:show="showUpload" preset="card" :title="t('presales.knowledge.uploadTitle')" style="width: min(520px, 96vw);">
      <div class="upload-form">
        <NUpload :default-upload="false" :max="1" @change="handleUploadChange">
          <NButton>{{ t('presales.knowledge.selectFile') }}</NButton>
        </NUpload>
        <p v-if="fileName" class="file-name">{{ fileName }}</p>
        <label>{{ t('presales.knowledge.cleanRequirement') }}</label>
        <NInput v-model:value="cleanRequirement" type="textarea" :rows="4" :placeholder="t('presales.knowledge.cleanPlaceholder')" />
        <p class="eta-hint">{{ t('presales.knowledge.etaHint') }}</p>
        <NButton type="primary" block @click="submitTicket">{{ t('presales.knowledge.submitTicket') }}</NButton>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/presales-page.scss';

.page-header.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.upload-form {
  display: flex;
  flex-direction: column;
  gap: 12px;

  label { font-size: 13px; color: $text-secondary; }
  .file-name { margin: 0; font-size: 13px; color: $text-primary; }
  .eta-hint { margin: 0; font-size: 12px; color: $text-muted; }
}
</style>
