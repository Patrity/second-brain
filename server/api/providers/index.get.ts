import { getDb } from '~~/server/db'
import * as schema from '~~/server/db/schema'

export default defineEventHandler(async () => {
  const db = getDb()
  const providers = await db.select({
    id: schema.aiProviders.id,
    name: schema.aiProviders.name,
    type: schema.aiProviders.type,
    model: schema.aiProviders.model,
    baseUrl: schema.aiProviders.baseUrl,
    isDefault: schema.aiProviders.isDefault,
    createdAt: schema.aiProviders.createdAt,
    updatedAt: schema.aiProviders.updatedAt
    // Intentionally omit apiKey from list response
  }).from(schema.aiProviders)

  return { data: providers }
})
