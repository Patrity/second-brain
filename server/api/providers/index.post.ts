import { eq } from 'drizzle-orm'
import { getDb } from '~~/server/db'
import * as schema from '~~/server/db/schema'
import { PROVIDERS_REQUIRING_KEY, PROVIDERS_WITH_BASE_URL } from '~~/server/ai/types'
import type { ProviderType } from '~~/server/ai/types'

const VALID_TYPES: ProviderType[] = [
  'claude-code', 'anthropic', 'openai', 'google', 'xai', 'openrouter', 'ollama', 'custom'
]

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    name: string
    type: ProviderType
    model: string
    baseUrl?: string
    apiKey?: string
    isDefault?: boolean
  }>(event)

  if (!body?.name || !body?.type || !body?.model)
    throw createError({ statusCode: 400, message: 'name, type, and model are required' })

  if (!VALID_TYPES.includes(body.type))
    throw createError({ statusCode: 400, message: `Invalid provider type: ${body.type}` })

  if (PROVIDERS_REQUIRING_KEY.includes(body.type) && !body.apiKey)
    throw createError({ statusCode: 400, message: `API key is required for ${body.type} provider` })

  if (PROVIDERS_WITH_BASE_URL.includes(body.type) && body.type === 'custom' && !body.baseUrl)
    throw createError({ statusCode: 400, message: 'Base URL is required for custom provider' })

  const db = getDb()

  // If this is set as default, unset any existing default
  if (body.isDefault) {
    await db.update(schema.aiProviders)
      .set({ isDefault: false })
      .where(eq(schema.aiProviders.isDefault, true))
  }

  const [provider] = await db.insert(schema.aiProviders)
    .values({
      name: body.name,
      type: body.type,
      model: body.model,
      baseUrl: body.baseUrl || null,
      apiKey: body.apiKey || null,
      isDefault: body.isDefault ?? false
    })
    .returning()

  return {
    data: {
      id: provider!.id,
      name: provider!.name,
      type: provider!.type,
      model: provider!.model,
      baseUrl: provider!.baseUrl,
      isDefault: provider!.isDefault,
      createdAt: provider!.createdAt,
      updatedAt: provider!.updatedAt
    }
  }
})
