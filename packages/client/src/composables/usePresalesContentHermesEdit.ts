import { onUnmounted, ref } from 'vue'
import { startRunViaSocket, type RunEvent } from '@/api/hermes/chat'
import { getActiveProfileName } from '@/api/client'
import { updateContentDraft } from '@/api/presales/content'

export interface PresalesChatMessage {
  role: 'user' | 'assistant' | 'system'
  text: string
}

function extractEventText(evt: RunEvent): string {
  if (typeof evt.delta === 'string' && evt.delta) return evt.delta
  if (typeof evt.text === 'string' && evt.text) return evt.text
  if (typeof evt.output === 'string' && evt.output) return evt.output
  return ''
}

export function usePresalesContentHermesEdit() {
  const isEditing = ref(false)
  const streamingText = ref('')
  const chatMessages = ref<PresalesChatMessage[]>([])
  let abortRun: (() => void) | null = null
  let streamBuffer = ''

  function pushAssistantIfNeeded(finalText: string) {
    const text = finalText.trim()
    if (!text) return
    const last = chatMessages.value[chatMessages.value.length - 1]
    if (last?.role === 'assistant' && last.text === text) return
    chatMessages.value.push({ role: 'assistant', text })
  }

  function resetStream() {
    streamBuffer = ''
    streamingText.value = ''
  }

  async function markDraftStatus(
    draftId: string,
    status: 'editing' | 'completed' | 'draft',
    tenantSlug?: string,
  ) {
    try {
      await updateContentDraft(draftId, { status }, tenantSlug)
    } catch {
      // non-blocking for UI
    }
  }

  async function runHermesEdit(options: {
    draftId: string
    outputFile: string
    outputFileAbs?: string
    title: string
    userInstruction: string
    tenantSlug?: string
    profile?: string
  }) {
    abortRun?.()
    resetStream()
    isEditing.value = true
    await markDraftStatus(options.draftId, 'editing', options.tenantSlug)

    const userInstruction = options.userInstruction.trim() || '请对文件进行编辑'
    chatMessages.value.push({ role: 'user', text: userInstruction })

    const input = [
      userInstruction,
      '',
      `文档标题：${options.title}`,
      `Profile 相对路径：${options.outputFile}`,
      options.outputFileAbs ? `绝对路径：${options.outputFileAbs}` : '',
      '',
      '请打开该文件，理解现有内容后进行二次编辑，并保存回原路径或同目录。',
    ].filter(Boolean).join('\n')

    const instructions = [
      '你是 aipresales 售前内容编辑助手。',
      '用户需要你编辑 Hermes profile 内的文档（PPT/Word/HTML）。',
      '使用可用工具读取并修改文件；完成后简要说明改动要点。',
    ].join('\n')

    const profile = options.profile || getActiveProfileName() || 'default'
    const sessionId = `presales-content-${options.draftId}`

    return new Promise<void>((resolve, reject) => {
      const handleEvent = (evt: RunEvent) => {
        const name = evt.event || ''
        if (name === 'message.delta' || name === 'reasoning.delta' || name === 'thinking.delta') {
          const chunk = extractEventText(evt)
          if (!chunk) return
          streamBuffer += chunk
          streamingText.value = streamBuffer
          return
        }
        if (name === 'run.completed') {
          const output = typeof evt.output === 'string' && evt.output.trim()
            ? evt.output
            : streamBuffer
          if (output) {
            streamBuffer = output
            streamingText.value = output
            pushAssistantIfNeeded(output)
          }
        }
      }

      const { abort } = startRunViaSocket(
        {
          session_id: sessionId,
          profile,
          input,
          instructions,
          source: 'api_server',
        },
        handleEvent,
        async () => {
          isEditing.value = false
          if (streamBuffer.trim()) pushAssistantIfNeeded(streamBuffer)
          resetStream()
          await markDraftStatus(options.draftId, 'completed', options.tenantSlug)
          resolve()
        },
        async (err) => {
          isEditing.value = false
          resetStream()
          await markDraftStatus(options.draftId, 'completed', options.tenantSlug)
          reject(err)
        },
        undefined,
        {
          onReconnectResume: () => {
            isEditing.value = true
          },
        },
      )
      abortRun = abort
    })
  }

  function stopEdit() {
    abortRun?.()
    abortRun = null
    isEditing.value = false
    resetStream()
  }

  onUnmounted(() => {
    stopEdit()
  })

  return {
    isEditing,
    streamingText,
    chatMessages,
    runHermesEdit,
    stopEdit,
  }
}
