import { eq } from 'drizzle-orm'
import { getDb } from '~~/server/db'
import * as schema from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, message: 'Provider ID is required' })

  const db = getDb()
  const [provider] = await db.select({
    id: schema.aiProviders.id,
    name: schema.aiProviders.name,
    type: schema.aiProviders.type,
    model: schema.aiProviders.model,
    baseUrl: schema.aiProviders.baseUrl,
    isDefault: schema.aiProviders.isDefault,
    createdAt: schema.aiProviders.createdAt,
    updatedAt: schema.aiProviders.updatedAt
  })
    .from(schema.aiProviders)
    .where(eq(schema.aiProviders.id, id))
    .limit(1)

  if (!provider)
    throw createError({ statusCode: 404, message: 'Provider not found' })

  return { data: provider }
})
