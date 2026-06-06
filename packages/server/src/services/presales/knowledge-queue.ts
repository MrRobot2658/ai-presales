import { Queue } from 'bullmq'

export const KNOWLEDGE_INGEST_QUEUE_NAME = 'presales-knowledge-ingest'

export interface KnowledgeIngestQueuePayload {
  ingestJobId: string
  assetId: string
  tenantId: string
  profileName: string
  cleanRequirement: string
  storagePath: string
  relPath: string
  originalFilename: string
}

let queue: Queue<KnowledgeIngestQueuePayload> | null = null

export function isRedisConfigured(): boolean {
  return !!String(process.env.REDIS_URL || '').trim()
}

function redisUrl(): string {
  const url = String(process.env.REDIS_URL || '').trim()
  if (!url) throw new Error('REDIS_URL is not configured')
  return url
}

export function getRedisConnectionOptions(): { url: string } {
  return { url: redisUrl() }
}

export function getKnowledgeIngestQueue(): Queue<KnowledgeIngestQueuePayload> {
  if (!queue) {
    queue = new Queue<KnowledgeIngestQueuePayload>(KNOWLEDGE_INGEST_QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      },
    })
  }
  return queue
}

export async function enqueueKnowledgeIngest(payload: KnowledgeIngestQueuePayload): Promise<void> {
  const q = getKnowledgeIngestQueue()
  await q.add(`ingest:${payload.assetId}`, payload, {
    jobId: payload.ingestJobId,
  })
}

export async function closeKnowledgeQueue(): Promise<void> {
  if (queue) {
    await queue.close()
    queue = null
  }
}
