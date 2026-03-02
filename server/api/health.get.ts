import { sql } from 'drizzle-orm'
import { getDbState, isDbAvailable } from '~~/server/utils/db-state'
import { getDb } from '~~/server/db'
import { getAppVersion } from '~~/server/utils/app-version'

function getDeploymentType(url: string): 'local' | 'remote' | null {
  if (!url) return null
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1') || url.includes('db:5432')
  return isLocal ? 'local' : 'remote'
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const dbState = getDbState()

  let dbLatency: number | null = null
  let dbError: string | null = null

  if (isDbAvailable()) {
    try {
      const start = Date.now()
      const db = getDb()
      await db.execute(sql`SELECT 1`)
      dbLatency = Date.now() - start
    } catch (e) {
      dbError = e instanceof Error ? e.message : 'Unknown error'
    }
  }

  const { version, channel } = getAppVersion()

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version,
    channel,
    appUrl: process.env.BETTER_AUTH_URL || null,
    database: {
      configured: !!config.databaseUrl,
      deployment: getDeploymentType(config.databaseUrl),
      available: dbState.available,
      latency: dbLatency,
      error: dbError || dbState.error || null
    }
  }
})
