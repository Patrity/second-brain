import { getDb } from '~~/server/db'
import * as schema from '~~/server/db/schema'

interface TokenUsageEntry {
  source: 'chat' | 'agent' | 'memory_extraction' | 'bridge'
  sourceId?: string
  sourceName?: string
  provider?: string
  model?: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs?: number
  numTurns?: number
}

export async function logTokenUsage(entry: TokenUsageEntry) {
  try {
    const db = getDb()
    await db.insert(schema.tokenUsage).values(entry)
  } catch (e) {
    console.error('[token-usage] Failed to log:', e)
  }
}
