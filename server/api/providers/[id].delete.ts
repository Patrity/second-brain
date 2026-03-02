import { eq } from 'drizzle-orm'
import { getDb } from '~~/server/db'
import * as schema from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, message: 'Provider ID is required' })

  const db = getDb()

  const [existing] = await db.select()
    .from(schema.aiProviders)
    .where(eq(schema.aiProviders.id, id))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, message: 'Provider not found' })

  await db.delete(schema.aiProviders)
    .where(eq(schema.aiProviders.id, id))

  return { data: { deleted: true } }
})
