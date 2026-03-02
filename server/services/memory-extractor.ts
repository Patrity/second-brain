import { query } from '@anthropic-ai/claude-agent-sdk'
import { generateText } from 'ai'
import type { ExtractedMemory, MemoryChunkType } from '~~/shared/types'
import { logTokenUsage } from '~~/server/utils/log-token-usage'
import { getDefaultProvider } from '~~/server/ai/get-provider'
import { createModel } from '~~/server/ai/provider'
import { estimateCost } from '~~/server/ai/cost'

const EXTRACTION_PROMPT = `You are a memory extraction assistant. Analyze this conversation excerpt and extract key memories worth preserving for future reference.

Output ONLY a JSON array with this exact structure (no markdown, no code blocks, no explanation):
[{"type": "decision|fact|solution|pattern|preference", "content": "concise statement"}]

Memory types:
- decision: Choices made about implementation, architecture, or approach
- fact: Important information about the codebase, APIs, or constraints
- solution: How a problem was solved or a bug was fixed
- pattern: Recurring patterns or conventions identified
- preference: User preferences for code style, tools, or workflows

Rules:
- Only extract genuinely useful information
- Skip routine acknowledgments ("I'll do that", "Sure", "Let me...")
- Skip obvious facts already in code, debugging steps, greetings
- Content max 100 characters
- If nothing worth extracting, return []

Conversation to analyze:
`

export async function extractMemories(transcript: string): Promise<ExtractedMemory[]> {
  if (!transcript || transcript.trim().length < 50)
    return []

  try {
    const provider = await getDefaultProvider()
    const prompt = `${EXTRACTION_PROMPT}\n\n${transcript.slice(0, 8000)}`

    let result = ''
    let costUsd = 0
    let durationMs = 0
    let inputTokens = 0
    let outputTokens = 0

    const startTime = Date.now()

    if (provider.type === 'claude-code') {
      // Use Agent SDK for Claude Code provider
      const sdkResult = await extractViaSDK(prompt)
      result = sdkResult.text
      costUsd = sdkResult.costUsd
      durationMs = sdkResult.durationMs
      inputTokens = sdkResult.inputTokens
      outputTokens = sdkResult.outputTokens
    } else {
      // Use AI SDK for all other providers
      const model = await createModel(provider)
      const response = await generateText({
        model,
        prompt,
        maxOutputTokens: 1000
      })

      result = response.text
      inputTokens = response.usage?.inputTokens || 0
      outputTokens = response.usage?.outputTokens || 0
      durationMs = Date.now() - startTime
      costUsd = estimateCost(provider.model, inputTokens, outputTokens)
    }

    // Log token usage
    if (costUsd > 0 || inputTokens > 0)
      logTokenUsage({
        source: 'memory_extraction',
        sourceName: 'Memory Extraction',
        provider: provider.type,
        model: provider.model,
        inputTokens,
        outputTokens,
        costUsd,
        durationMs,
        numTurns: 1
      })

    return parseMemories(result)
  } catch (error) {
    console.error('[memory-extractor] Failed to extract memories:', error)
    return []
  }
}

/**
 * Extract memories using Claude Agent SDK (for claude-code provider).
 */
async function extractViaSDK(prompt: string) {
  const conversation = query({
    prompt,
    options: {
      maxTurns: 1,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true
    }
  })

  let text = ''
  let costUsd = 0
  let durationMs = 0
  let inputTokens = 0
  let outputTokens = 0

  for await (const message of conversation) {
    if (message.type === 'result') {
      const msg = message as unknown as {
        subtype: string
        result?: string
        total_cost_usd: number
        duration_ms: number
        usage: { input_tokens: number, output_tokens: number }
      }
      if (msg.subtype === 'success' && msg.result)
        text = msg.result
      costUsd = msg.total_cost_usd || 0
      durationMs = msg.duration_ms || 0
      inputTokens = msg.usage?.input_tokens || 0
      outputTokens = msg.usage?.output_tokens || 0
    }
  }

  return { text, costUsd, durationMs, inputTokens, outputTokens }
}

/**
 * Parse JSON memory array from AI response text.
 */
function parseMemories(text: string): ExtractedMemory[] {
  if (!text) return []

  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  try {
    const memories = JSON.parse(jsonMatch[0]) as Array<{
      type: string
      content: string
    }>

    return memories
      .filter(m => isValidMemoryType(m.type) && m.content)
      .map(m => ({
        type: m.type as MemoryChunkType,
        content: m.content.slice(0, 200)
      }))
  } catch {
    return []
  }
}

function isValidMemoryType(type: string): type is MemoryChunkType {
  return ['decision', 'fact', 'solution', 'pattern', 'preference', 'summary'].includes(type)
}

export async function extractMemoriesFromTranscriptFile(transcriptPath: string): Promise<ExtractedMemory[]> {
  const fs = await import('node:fs/promises')

  try {
    const content = await fs.readFile(transcriptPath, 'utf-8')
    const lines = content.trim().split('\n')

    const messages: Array<{ role: string, content: string }> = []
    for (const line of lines.slice(-20)) {
      try {
        const entry = JSON.parse(line)
        if (entry.role && entry.content)
          messages.push({ role: entry.role, content: entry.content })
      } catch {
        // Skip invalid lines
      }
    }

    if (messages.length === 0)
      return []

    const formatted = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content.slice(0, 1000)}`)
      .join('\n\n')

    return extractMemories(formatted)
  } catch (error) {
    console.error('[memory-extractor] Failed to read transcript:', error)
    return []
  }
}
