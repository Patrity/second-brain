import { randomUUID } from 'crypto'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { generateText, stepCountIs } from 'ai'
import { eq, sql } from 'drizzle-orm'
import { getDb, schema } from '~~/server/db'
import { logTokenUsage } from '~~/server/utils/log-token-usage'
import { sdkEnv } from '~~/server/utils/sdk-env'
import { getDefaultProvider } from '~~/server/ai/get-provider'
import { createModel } from '~~/server/ai/provider'
import { buildSystemPrompt } from '~~/server/ai/prompt-builder'
import { loadConversationHistory } from '~~/server/ai/history'
import { getAiSdkTools } from '~~/server/ai/tools'
import { estimateCost } from '~~/server/ai/cost'
import { sendOutboundMessage } from './router'
import type { NormalizedMessage } from './types'

/**
 * Get or create the Main Chat conversation.
 * There's exactly one conversation with isMain=true.
 */
async function getOrCreateMainChat() {
  const db = getDb()

  const [existing] = await db.select()
    .from(schema.conversations)
    .where(eq(schema.conversations.isMain, true))
    .limit(1)

  if (existing) return existing

  const [created] = await db.insert(schema.conversations)
    .values({
      sessionId: `main-chat-${randomUUID()}`,
      title: 'Main Chat',
      isMain: true,
      status: 'idle',
      messageCount: 0,
      totalCostUsd: 0
    })
    .returning()

  console.log('[bridge] Created Main Chat conversation')
  return created!
}

/**
 * Load memory context directly from DB so the bridge prompt
 * includes user preferences/facts even if the session-start hook
 * can't reach the API (avoids false onboarding).
 */
async function loadMemoryContext(): Promise<string> {
  try {
    const db = getDb()
    const memories = await db.execute<{ content: string }>(sql`
      SELECT content,
        (1.0 + LN(1 + access_count))
        * (1.0 / (1.0 + EXTRACT(EPOCH FROM NOW() - COALESCE(last_accessed_at, created_at)) / 2592000))
        AS score
      FROM memory_chunks
      ORDER BY score DESC
      LIMIT 10
    `)

    if (memories.length === 0) return ''

    const lines = ['[Memory context from previous sessions]']
    for (const m of memories)
      lines.push(`- ${m.content}`)
    return lines.join('\n')
  } catch {
    return ''
  }
}

// SDK result shape
interface SDKResult {
  subtype: string
  total_cost_usd: number
  num_turns: number
  duration_ms: number
  result?: string
  errors?: string[]
  session_id?: string
  usage: { input_tokens: number, output_tokens: number }
}

/**
 * Generate a response to a bridge message using the configured AI provider.
 * Routes through the unified Main Chat conversation.
 */
export async function generateBridgeResponse(
  bridgeId: string,
  message: NormalizedMessage,
  bridgeMessageId: string
): Promise<void> {
  const db = getDb()
  const mainChat = await getOrCreateMainChat()

  // Handle bridge commands
  if (message.text.trim() === '/new') {
    await db.update(schema.conversations)
      .set({ sdkSessionId: null, summary: null })
      .where(eq(schema.conversations.id, mainChat.id))

    await sendOutboundMessage({
      bridgeId,
      platform: message.platform,
      recipient: message.channelId || message.sender,
      text: 'Conversation reset. Send me a message to start fresh.'
    })
    return
  }

  // Link inbound bridge message to main chat
  await db.update(schema.bridgeMessages)
    .set({ conversationId: mainChat.id })
    .where(eq(schema.bridgeMessages.id, bridgeMessageId))

  // Persist user message in the conversation
  await db.insert(schema.conversationMessages).values({
    conversationId: mainChat.id,
    role: 'user',
    content: JSON.stringify([{ type: 'text', text: message.text }]),
    source: message.platform
  })

  // Build the prompt
  const memoryContext = await loadMemoryContext()
  const parts: string[] = []
  if (memoryContext) parts.push(memoryContext)
  parts.push(`The user is messaging you via ${message.platform}. Respond directly to them. Keep responses concise (suitable for chat/messaging). Do not ask what to reply — you ARE the one replying.`)
  parts.push(message.text)
  const prompt = parts.join('\n\n')

  // Update status
  await db.update(schema.conversations)
    .set({ status: 'streaming' })
    .where(eq(schema.conversations.id, mainChat.id))

  let responseText = ''
  let sdkSessionId: string | undefined
  let costUsd = 0
  let durationMs = 0
  let inputTokens = 0
  let outputTokens = 0
  let numTurns = 0

  const provider = await getDefaultProvider()

  try {
    if (provider.type === 'claude-code') {
      // Use Agent SDK for Claude Code provider
      const result = await runSDKQuery(prompt, mainChat.sdkSessionId || undefined)
      responseText = result.text
      sdkSessionId = result.sdkSessionId
      costUsd = result.costUsd
      durationMs = result.durationMs
      inputTokens = result.inputTokens
      outputTokens = result.outputTokens
      numTurns = result.numTurns
    } else {
      // Use AI SDK for all other providers
      const startTime = Date.now()
      const model = await createModel(provider)
      const systemPrompt = await buildSystemPrompt()
      const history = await loadConversationHistory(mainChat.id)

      const result = await generateText({
        model,
        system: systemPrompt,
        messages: [
          ...history,
          { role: 'user', content: prompt }
        ],
        tools: getAiSdkTools(),
        stopWhen: stepCountIs(50)
      })

      responseText = result.text
      inputTokens = result.usage?.inputTokens || 0
      outputTokens = result.usage?.outputTokens || 0
      durationMs = Date.now() - startTime
      costUsd = estimateCost(provider.model, inputTokens, outputTokens)
      numTurns = result.steps?.length || 1
    }
  } catch (error) {
    // If resume fails with SDK, retry without resume
    if (provider.type === 'claude-code' && mainChat.sdkSessionId) {
      console.warn('[bridge] SDK resume failed, retrying fresh:', error instanceof Error ? error.message : error)
      try {
        const result = await runSDKQuery(prompt, undefined)
        responseText = result.text
        sdkSessionId = result.sdkSessionId
        costUsd = result.costUsd
        durationMs = result.durationMs
        inputTokens = result.inputTokens
        outputTokens = result.outputTokens
        numTurns = result.numTurns
      } catch (retryError) {
        console.error('[bridge] SDK query failed:', retryError)
        responseText = 'Sorry, I ran into an issue processing your message. Please try again.'
      }
    } else {
      console.error('[bridge] Query failed:', error)
      responseText = 'Sorry, I ran into an issue processing your message. Please try again.'
    }
  }

  if (!responseText)
    responseText = '(No response generated)'

  // Update conversation metadata
  const msgs = await db.select()
    .from(schema.conversationMessages)
    .where(eq(schema.conversationMessages.conversationId, mainChat.id))

  await db.update(schema.conversations)
    .set({
      status: 'idle',
      sdkSessionId: sdkSessionId || mainChat.sdkSessionId,
      messageCount: msgs.length + 1,
      totalCostUsd: (mainChat.totalCostUsd || 0) + costUsd,
      endedAt: new Date()
    })
    .where(eq(schema.conversations.id, mainChat.id))

  // Persist assistant message
  await db.insert(schema.conversationMessages).values({
    conversationId: mainChat.id,
    role: 'assistant',
    content: JSON.stringify([{ type: 'text', text: responseText }]),
    costUsd,
    durationMs
  })

  // Log token usage
  if (costUsd > 0 || inputTokens > 0) {
    logTokenUsage({
      source: 'bridge',
      sourceId: mainChat.id,
      sourceName: `Bridge: ${message.platform}`,
      provider: provider.type,
      model: provider.model,
      inputTokens,
      outputTokens,
      costUsd,
      durationMs,
      numTurns
    })
  }

  // Send response back through the bridge adapter
  await sendOutboundMessage({
    bridgeId,
    platform: message.platform,
    recipient: message.channelId || message.sender,
    text: responseText
  })
}

/**
 * Run a Claude Agent SDK query and extract the response.
 */
interface SDKQueryResult {
  text: string
  sdkSessionId?: string
  costUsd: number
  durationMs: number
  inputTokens: number
  outputTokens: number
  numTurns: number
}

async function runSDKQuery(
  prompt: string,
  resumeSessionId?: string
): Promise<SDKQueryResult> {
  const projectDir = process.env.COGNOVA_PROJECT_DIR || process.cwd()

  const conversation = query({
    prompt,
    options: {
      cwd: projectDir,
      env: sdkEnv('claude-code'),
      settingSources: ['user', 'project'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: 50,
      ...(resumeSessionId ? { resume: resumeSessionId } : {})
    }
  })

  let text = ''
  let sdkSessionId: string | undefined
  let costUsd = 0
  let durationMs = 0
  let inputTokens = 0
  let outputTokens = 0
  let numTurns = 0

  for await (const message of conversation) {
    if (message.type === 'system' && (message as { subtype?: string }).subtype === 'init') {
      sdkSessionId = (message as { session_id?: string }).session_id
    } else if (message.type === 'result') {
      const msg = message as unknown as SDKResult
      if (msg.subtype === 'success' && msg.result)
        text = msg.result
      else if (msg.errors?.length)
        text = msg.errors.join('\n')

      sdkSessionId = msg.session_id || sdkSessionId
      costUsd = msg.total_cost_usd || 0
      durationMs = msg.duration_ms || 0
      inputTokens = msg.usage?.input_tokens || 0
      outputTokens = msg.usage?.output_tokens || 0
      numTurns = msg.num_turns || 0
    }
  }

  return { text, sdkSessionId, costUsd, durationMs, inputTokens, outputTokens, numTurns }
}
