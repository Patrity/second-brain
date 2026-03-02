import { eq } from 'drizzle-orm'
import { getDb } from '~~/server/db'
import * as schema from '~~/server/db/schema'
import type { ProviderType } from '~~/server/ai/types'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, message: 'Provider ID is required' })

  const body = await readBody<{
    name?: string
    model?: string
    baseUrl?: string | null
    apiKey?: string | null
    isDefault?: boolean
    type?: ProviderType
  }>(event)

  const db = getDb()

  // Verify provider exists
  const [existing] = await db.select()
    .from(schema.aiProviders)
    .where(eq(schema.aiProviders.id, id))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, message: 'Provider not found' })

  // If setting as default, unset any existing default
  if (body.isDefault) {
    await db.update(schema.aiProviders)
      .set({ isDefault: false })
      .where(eq(schema.aiProviders.isDefault, true))
  }

  // Build update payload — only include provided fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updatedAt: new Date() }
  if (body.name !== undefined) updates.name = body.name
  if (body.model !== undefined) updates.model = body.model
  if (body.baseUrl !== undefined) updates.baseUrl = body.baseUrl
  if (body.apiKey !== undefined) updates.apiKey = body.apiKey
  if (body.isDefault !== undefined) updates.isDefault = body.isDefault
  if (body.type !== undefined) updates.type = body.type

  const [updated] = await db.update(schema.aiProviders)
    .set(updates)
    .where(eq(schema.aiProviders.id, id))
    .returning()

  return {
    data: {
      id: updated!.id,
      name: updated!.name,
      type: updated!.type,
      model: updated!.model,
      baseUrl: updated!.baseUrl,
      isDefault: updated!.isDefault,
      createdAt: updated!.createdAt,
      updatedAt: updated!.updatedAt
    }
  }
})
