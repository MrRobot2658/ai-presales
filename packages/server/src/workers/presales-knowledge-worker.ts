import { Worker } from 'bullmq'
import { initAllStores } from '../db/hermes/init'
import { logger } from '../services/logger'
import {
  KNOWLEDGE_INGEST_QUEUE_NAME,
  closeKnowledgeQueue,
  getRedisConnectionOptions,
  type KnowledgeIngestQueuePayload,
} from '../services/presales/knowledge-queue'
import { getIngestJobPayload, runKnowledgeIngestJob } from '../services/presales/knowledge-ingest'

async function main() {
  console.log('[presales-worker] starting knowledge ingest worker')
  initAllStores()

  const worker = new Worker<KnowledgeIngestQueuePayload>(
    KNOWLEDGE_INGEST_QUEUE_NAME,
    async (job) => {
      const payload = job.data?.assetId
        ? job.data
        : await getIngestJobPayload(String(job.id))
      if (!payload) {
        throw new Error(`Ingest job payload not found for ${job.id}`)
      }
      await runKnowledgeIngestJob(payload)
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: Number(process.env.PRESALES_WORKER_CONCURRENCY || 1),
    },
  )

  worker.on('failed', (job, err) => {
    logger.error(err, '[presales-worker] job %s failed', job?.id)
  })

  worker.on('completed', (job) => {
    logger.info('[presales-worker] job %s completed', job.id)
  })

  const shutdown = async (signal: string) => {
    console.log(`[presales-worker] received ${signal}, shutting down`)
    await worker.close()
    await closeKnowledgeQueue()
    process.exit(0)
  }

  process.on('SIGINT', () => { void shutdown('SIGINT') })
  process.on('SIGTERM', () => { void shutdown('SIGTERM') })

  console.log('[presales-worker] listening on queue', KNOWLEDGE_INGEST_QUEUE_NAME)
}

main().catch((err) => {
  console.error('[presales-worker] fatal error', err)
  process.exit(1)
})
