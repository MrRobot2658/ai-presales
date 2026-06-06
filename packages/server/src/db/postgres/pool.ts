import { Pool, type PoolClient, type QueryResultRow } from 'pg'
import { logger } from '../../services/logger'

let pool: Pool | null = null

function databaseUrl(): string | null {
  const url = String(process.env.DATABASE_URL || '').trim()
  return url || null
}

export function isPostgresConfigured(): boolean {
  return !!databaseUrl()
}

export function getPgPool(): Pool | null {
  if (!isPostgresConfigured()) return null
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl()!,
      max: 10,
      idleTimeoutMillis: 30_000,
    })
    pool.on('error', (err) => {
      logger.error(err, '[postgres] idle client error')
    })
  }
  return pool
}

export async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; rowCount: number }> {
  const client = getPgPool()
  if (!client) {
    throw Object.assign(new Error('PostgreSQL is not configured'), { code: 'postgres_unavailable' })
  }
  const result = await client.query<T>(text, params)
  return { rows: result.rows, rowCount: result.rowCount ?? 0 }
}

export async function withPgTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = getPgPool()
  if (!client) {
    throw Object.assign(new Error('PostgreSQL is not configured'), { code: 'postgres_unavailable' })
  }
  const connection = await client.connect()
  try {
    await connection.query('BEGIN')
    const value = await fn(connection)
    await connection.query('COMMIT')
    return value
  } catch (err) {
    await connection.query('ROLLBACK')
    throw err
  } finally {
    connection.release()
  }
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
