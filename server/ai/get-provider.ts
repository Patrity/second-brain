import { eq } from 'drizzle-orm'
import { getDb } from '~~/server/db'
import * as schema from '~~/server/db/schema'
import type { ProviderConfig } from './types'

/**
 * Get a provider config by ID.
 */
export async function getProviderById(id: string): Promise<ProviderConfig | null> {
  const db = getDb()
  const [row] = await db.select()
    .from(schema.aiProviders)
    .where(eq(schema.aiProviders.id, id))
    .limit(1)

  if (!row) return null
  return toProviderConfig(row)
}

/**
 * Get the default provider config (isDefault = true).
 * Falls back to a claude-code stub if none configured.
 */
export async function getDefaultProvider(): Promise<ProviderConfig> {
  const db = getDb()
  const [row] = await db.select()
    .from(schema.aiProviders)
    .where(eq(schema.aiProviders.isDefault, true))
    .limit(1)

  if (row) return toProviderConfig(row)

  // Fallback: no providers configured, use claude-code with default model
  return {
    id: 'fallback',
    name: 'Claude Code (default)',
    type: 'claude-code',
    model: 'sonnet',
    isDefault: true
  }
}

/**
 * Get the provider for a specific conversation, falling back to default.
 */
export async function getProviderForConversation(conversationId: string): Promise<ProviderConfig> {
  const db = getDb()
  const [conv] = await db.select({ providerId: schema.conversations.providerId })
    .from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId))
    .limit(1)

  if (conv?.providerId) {
    const provider = await getProviderById(conv.providerId)
    if (provider) return provider
  }

  return getDefaultProvider()
}

/**
 * Get the provider for a cron agent, falling back to default.
 */
export async function getProviderForAgent(agentId: string): Promise<ProviderConfig> {
  const db = getDb()
  const [agent] = await db.select({ providerId: schema.cronAgents.providerId })
    .from(schema.cronAgents)
    .where(eq(schema.cronAgents.id, agentId))
    .limit(1)

  if (agent?.providerId) {
    const provider = await getProviderById(agent.providerId)
    if (provider) return provider
  }

  return getDefaultProvider()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProviderConfig(row: any): ProviderConfig {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    model: row.model,
    baseUrl: row.baseUrl,
    apiKey: row.apiKey,
    isDefault: row.isDefault
  }
}
