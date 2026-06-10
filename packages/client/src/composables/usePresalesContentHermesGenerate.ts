import { onUnmounted, ref } from 'vue'
import { startRunViaSocket, type RunEvent } from '@/api/hermes/chat'
import {
  finalizeContentGeneration,
  getContentGenerationPayload,
  type ContentGenerationRunPayload,
} from '@/api/presales/content'
import type { ContentDraft } from '@/data/presales-mock'

const PROGRESS_CAP_BEFORE_DONE = 92
const PROGRESS_DRAFT_BASE = 58
const PROGRESS_DRAFT_STREAM_CAP = 88

export type HermesProcessEntryKind = 'info' | 'tool' | 'text' | 'error' | 'success'

export interface HermesProcessEntry {
  id: string
  kind: HermesProcessEntryKind
  label: string
  detail?: string
  status?: 'running' | 'done' | 'error'
  timestamp: number
}

function extractEventText(evt: RunEvent): string {
  if (typeof evt.delta === 'string' && evt.delta) return evt.delta
  if (typeof evt.text === 'string' && evt.text) return evt.text
  if (typeof evt.output === 'string' && evt.output) return evt.output
  return ''
}

function toolLabel(evt: RunEvent): string {
  return String(evt.tool || evt.name || 'tool')
}

function previewText(value: string, max = 120): string {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export function usePresalesContentHermesGenerate() {
  const isGenerating = ref(false)
  const processEntries = ref<HermesProcessEntry[]>([])
  const streamingPreview = ref('')
  const activeStep = ref(0)
  const progressPercent = ref(0)

  let abortRun: (() => void) | null = null
  let entryCounter = 0
  let streamBuffer = ''
  let runFailed = false
  let runError = ''
  let toolCompletedCount = 0
  let creepTimer: ReturnType<typeof setInterval> | null = null
  const toolEntryByName = new Map<string, string>()

  function bumpProgress(next: number) {
    const capped = Math.min(100, Math.max(progressPercent.value, next))
    progressPercent.value = capped
  }

  function startProgressCreep() {
    stopProgressCreep()
    creepTimer = setInterval(() => {
      if (progressPercent.value >= PROGRESS_CAP_BEFORE_DONE) return
      const room = PROGRESS_CAP_BEFORE_DONE - progressPercent.value
      bumpProgress(progressPercent.value + Math.max(0.25, room * 0.018))
    }, 1200)
  }

  function stopProgressCreep() {
    if (creepTimer) {
      clearInterval(creepTimer)
      creepTimer = null
    }
  }

  function updateDraftProgress() {
    activeStep.value = Math.max(activeStep.value, 3)
    const streamBoost = Math.min(22, streamBuffer.length / 350)
    bumpProgress(Math.min(
      PROGRESS_DRAFT_STREAM_CAP,
      PROGRESS_DRAFT_BASE + toolCompletedCount * 2.5 + streamBoost,
    ))
  }

  function nextId(prefix: string) {
    entryCounter += 1
    return `${prefix}-${entryCounter}`
  }

  function pushEntry(entry: Omit<HermesProcessEntry, 'id' | 'timestamp'>) {
    processEntries.value.push({
      ...entry,
      id: nextId(entry.kind),
      timestamp: Date.now(),
    })
  }

  function updateEntry(id: string, patch: Partial<HermesProcessEntry>) {
    const index = processEntries.value.findIndex((item) => item.id === id)
    if (index < 0) return
    processEntries.value[index] = { ...processEntries.value[index], ...patch }
  }

  function resetState() {
    processEntries.value = []
    streamingPreview.value = ''
    activeStep.value = 0
    progressPercent.value = 0
    streamBuffer = ''
    runFailed = false
    runError = ''
    toolCompletedCount = 0
    toolEntryByName.clear()
    entryCounter = 0
    stopProgressCreep()
  }

  function handleRunEvent(evt: RunEvent) {
    const name = evt.event || ''

    if (name === 'run.started') {
      activeStep.value = Math.max(activeStep.value, 1)
      bumpProgress(22)
      startProgressCreep()
      pushEntry({ kind: 'info', label: 'run.started', status: 'done' })
      return
    }

    if (name === 'tool.started') {
      activeStep.value = Math.max(activeStep.value, 2)
      bumpProgress(28 + toolCompletedCount * 3)
      const label = toolLabel(evt)
      const id = nextId('tool')
      toolEntryByName.set(label, id)
      processEntries.value.push({
        id,
        kind: 'tool',
        label,
        detail: evt.preview ? previewText(String(evt.preview)) : undefined,
        status: 'running',
        timestamp: Date.now(),
      })
      return
    }

    if (name === 'tool.completed') {
      toolCompletedCount += 1
      updateDraftProgress()
      const label = toolLabel(evt)
      const existingId = toolEntryByName.get(label)
      const detail = evt.preview ? previewText(String(evt.preview)) : undefined
      if (existingId) {
        updateEntry(existingId, { status: 'done', detail })
        toolEntryByName.delete(label)
      } else {
        pushEntry({ kind: 'tool', label, detail, status: 'done' })
      }
      return
    }

    if (name === 'message.delta' || name === 'reasoning.delta' || name === 'thinking.delta') {
      const chunk = extractEventText(evt)
      if (!chunk) return
      streamBuffer += chunk
      streamingPreview.value = previewText(streamBuffer, 240)
      updateDraftProgress()
      return
    }

    if (name === 'run.completed') {
      stopProgressCreep()
      activeStep.value = 3
      bumpProgress(90)
      const output = extractEventText(evt)
      if (output) {
        streamBuffer = output
        streamingPreview.value = previewText(output, 240)
      }
      pushEntry({ kind: 'success', label: 'run.completed', status: 'done' })
      return
    }

    if (name === 'run.failed') {
      stopProgressCreep()
      runFailed = true
      runError = evt.error || 'Run failed'
      pushEntry({
        kind: 'error',
        label: 'run.failed',
        detail: runError,
        status: 'error',
      })
    }
  }

  async function runSocketGeneration(
    payload: ContentGenerationRunPayload,
  ): Promise<{ failed: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
      const { abort } = startRunViaSocket(
        {
          session_id: payload.sessionId,
          profile: payload.profile,
          input: payload.input,
          instructions: payload.instructions,
          source: 'api_server',
        },
        handleRunEvent,
        () => {
          resolve({ failed: runFailed, error: runError || undefined })
        },
        (err) => reject(err),
        undefined,
        {
          onReconnectResume: () => {
            isGenerating.value = true
          },
        },
      )
      abortRun = abort
    })
  }

  async function runGeneration(options: {
    draftId: string
    tenantSlug?: string
  }): Promise<{ item: ContentDraft; warning?: string }> {
    abortRun?.()
    resetState()
    isGenerating.value = true

    pushEntry({ kind: 'info', label: 'prepare', status: 'running' })
    bumpProgress(5)

    try {
      const payload = await getContentGenerationPayload(options.draftId, options.tenantSlug)
      updateEntry(processEntries.value[0]?.id || '', {
        kind: 'info',
        label: 'prepare',
        status: 'done',
        detail: payload.profile,
      })

      activeStep.value = 0
      bumpProgress(12)
      const runResult = await runSocketGeneration(payload)
      stopProgressCreep()
      bumpProgress(93)

      const finalized = await finalizeContentGeneration(
        options.draftId,
        runResult.failed ? { error: runResult.error || 'Generation failed' } : {},
        options.tenantSlug,
      )

      if (finalized.warning) {
        pushEntry({
          kind: 'error',
          label: 'finalize.warning',
          detail: finalized.warning,
          status: 'error',
        })
      }

      activeStep.value = 4
      bumpProgress(100)

      return finalized
    } finally {
      stopProgressCreep()
      isGenerating.value = false
      abortRun = null
    }
  }

  function stopGeneration() {
    abortRun?.()
    abortRun = null
    isGenerating.value = false
    stopProgressCreep()
  }

  onUnmounted(() => {
    stopGeneration()
  })

  return {
    isGenerating,
    processEntries,
    streamingPreview,
    activeStep,
    progressPercent,
    runGeneration,
    stopGeneration,
  }
}
