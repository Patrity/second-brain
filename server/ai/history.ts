import { eq, asc } from 'drizzle-orm'
import type { ModelMessage } from 'ai'
import { getDb } from '~~/server/db'
import * as schema from '~~/server/db/schema'
import type { ChatContentBlock } from '~~/shared/types'

/**
 * Load conversation history from the database and convert
 * to AI SDK ModelMessage[] format for use with generateText/streamText.
 */
export async function loadConversationHistory(conversationId: string): Promise<ModelMessage[]> {
  const db = getDb()

  const rows = await db.select()
    .from(schema.conversationMessages)
    .where(eq(schema.conversationMessages.conversationId, conversationId))
    .orderBy(asc(schema.conversationMessages.createdAt))

  const messages: ModelMessage[] = []

  for (const row of rows) {
    let blocks: ChatContentBlock[]
    try {
      blocks = JSON.parse(row.content)
    } catch {
      continue
    }

    if (row.role === 'user') {
      const parts = blocksToUserContent(blocks)
      if (parts.length > 0)
        messages.push({ role: 'user', content: parts } as ModelMessage)
    } else if (row.role === 'assistant') {
      const parts = blocksToAssistantContent(blocks)
      if (parts.length > 0)
        messages.push({ role: 'assistant', content: parts } as ModelMessage)
    }
  }

  return messages
}

/**
 * Convert our ChatContentBlock[] to AI SDK user message content parts.
 */
function blocksToUserContent(blocks: ChatContentBlock[]): Array<{ type: 'text', text: string } | { type: 'image', image: string, mediaType: string }> {
  const parts: Array<{ type: 'text', text: string } | { type: 'image', image: string, mediaType: string }> = []

  for (const block of blocks) {
    if (block.type === 'text')
      parts.push({ type: 'text', text: block.text })
    else if (block.type === 'image')
      parts.push({ type: 'image', image: block.source.data, mediaType: block.source.media_type })
    // Skip tool_result blocks — they're from the SDK path
  }

  return parts
}

/**
 * Convert our ChatContentBlock[] to AI SDK assistant message content parts.
 */
function blocksToAssistantContent(blocks: ChatContentBlock[]): Array<{ type: 'text', text: string } | { type: 'tool-call', toolCallId: string, toolName: string, input: Record<string, unknown> }> {
  const parts: Array<{ type: 'text', text: string } | { type: 'tool-call', toolCallId: string, toolName: string, input: Record<string, unknown> }> = []

  for (const block of blocks) {
    if (block.type === 'text')
      parts.push({ type: 'text', text: block.text })
    else if (block.type === 'tool_use')
      parts.push({ type: 'tool-call', toolCallId: block.id, toolName: block.name, input: block.input })
    // Skip tool_result blocks
  }

  return parts
}
