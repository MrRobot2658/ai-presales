<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NInput, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { usePresalesStore } from '@/stores/presales'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const store = usePresalesStore()

const draftId = computed(() => route.params.draftId as string)
const draft = computed(() => store.getDraft(draftId.value))
const htmlContent = ref('')
const sections = ref<{ id: string; title: string; content: string }[]>([])
const chatInput = ref('')
const chatMessages = ref<{ role: 'user' | 'assistant'; text: string }[]>([
  { role: 'assistant', text: '你好，我可以帮你调整方案结构与措辞。' },
])
const dragIndex = ref<number | null>(null)

onMounted(() => {
  if (!draft.value) {
    router.replace({ name: 'presales.content' })
    return
  }
  htmlContent.value = draft.value.htmlContent
  sections.value = draft.value.sections.map((s) => ({ ...s }))
})

function saveDraft() {
  store.saveDraft(draftId.value, htmlContent.value, sections.value)
  message.success(t('presales.editor.saved'))
  router.push({ name: 'presales.content' })
}

function downloadDoc() {
  const blob = new Blob([htmlContent.value], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${draft.value?.companyName || 'document'}.html`
  a.click()
  URL.revokeObjectURL(url)
}

function sendChat() {
  const text = chatInput.value.trim()
  if (!text) return
  chatMessages.value.push({ role: 'user', text })
  chatInput.value = ''
  setTimeout(() => {
    chatMessages.value.push({
      role: 'assistant',
      text: `已根据你的要求更新建议：${text}。你可以在中间编辑区继续微调段落内容。`,
    })
  }, 600)
}

function onDragStart(idx: number) {
  dragIndex.value = idx
}

function onDrop(idx: number) {
  if (dragIndex.value === null || dragIndex.value === idx) return
  const list = [...sections.value]
  const [item] = list.splice(dragIndex.value, 1)
  list.splice(idx, 0, item)
  sections.value = list
  dragIndex.value = null
}

function syncSectionToHtml(sectionId: string, content: string) {
  const section = sections.value.find((s) => s.id === sectionId)
  if (section) section.content = content
  htmlContent.value = sections.value
    .map((s) => `<section><h2>${s.title}</h2><p>${s.content}</p></section>`)
    .join('\n')
}
</script>

<template>
  <div class="editor-page">
    <header class="editor-toolbar">
      <strong>{{ draft?.title }}</strong>
      <div class="toolbar-actions">
        <NButton size="small" @click="saveDraft">{{ t('presales.editor.saveDraft') }}</NButton>
        <NButton size="small" type="primary" @click="downloadDoc">{{ t('presales.editor.download') }}</NButton>
      </div>
    </header>

    <div class="editor-layout">
      <aside class="outline">
        <h4>{{ t('presales.editor.outline') }}</h4>
        <div
          v-for="(section, idx) in sections"
          :key="section.id"
          class="outline-item"
          draggable="true"
          @dragstart="onDragStart(idx)"
          @dragover.prevent
          @drop="onDrop(idx)"
        >
          {{ section.title }}
        </div>
      </aside>

      <main class="content-area">
        <div v-for="section in sections" :key="section.id" class="section-editor">
          <h3>{{ section.title }}</h3>
          <NInput
            :value="section.content"
            type="textarea"
            :rows="4"
            @update:value="(v) => syncSectionToHtml(section.id, v)"
          />
        </div>
      </main>

      <aside class="ai-panel">
        <h4>{{ t('presales.editor.aiChat') }}</h4>
        <div class="chat-list">
          <div v-for="(msg, idx) in chatMessages" :key="idx" :class="['chat-bubble', msg.role]">
            {{ msg.text }}
          </div>
        </div>
        <NInput v-model:value="chatInput" type="textarea" :rows="3" :placeholder="t('presales.editor.chatPlaceholder')" />
        <NButton type="primary" block size="small" @click="sendChat">{{ t('presales.editor.send') }}</NButton>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.editor-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid $border-color;
  background: $bg-card;

  strong { color: $text-primary; font-size: 14px; }
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.editor-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 200px 1fr 280px;
}

.outline,
.ai-panel,
.content-area {
  min-height: 0;
  overflow: auto;
  padding: 14px;
  border-right: 1px solid $border-color;
}

.ai-panel { border-right: none; border-left: 1px solid $border-color; }

.outline h4,
.ai-panel h4 {
  margin: 0 0 10px;
  font-size: 13px;
  color: $text-secondary;
}

.outline-item {
  padding: 8px 10px;
  margin-bottom: 6px;
  border: 1px dashed $border-color;
  border-radius: $radius-sm;
  font-size: 13px;
  color: $text-primary;
  cursor: grab;
}

.section-editor {
  margin-bottom: 16px;

  h3 {
    margin: 0 0 8px;
    font-size: 15px;
    color: $text-primary;
  }
}

.chat-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
  max-height: 360px;
  overflow: auto;
}

.chat-bubble {
  padding: 8px 10px;
  border-radius: $radius-sm;
  font-size: 13px;
  line-height: 1.5;

  &.assistant {
    background: rgba(var(--accent-primary-rgb), 0.08);
    color: $text-secondary;
  }

  &.user {
    background: $bg-sidebar;
    color: $text-primary;
    align-self: flex-end;
  }
}

@media (max-width: $breakpoint-mobile) {
  .editor-layout {
    grid-template-columns: 1fr;
  }

  .outline,
  .ai-panel {
    display: none;
  }
}
</style>
