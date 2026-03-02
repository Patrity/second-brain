import { query } from '@anthropic-ai/claude-agent-sdk'
import { generateText, stepCountIs } from 'ai'
import { eq } from 'drizzle-orm'
import { getDb } from '~~/server/db'
import * as schema from '~~/server/db/schema'
import { agentRegistry } from '~~/server/utils/agent-registry'
import { notifyResourceChange } from '~~/server/utils/notify-resource'
import { logTokenUsage } from '~~/server/utils/log-token-usage'
import { getProviderForAgent } from '~~/server/ai/get-provider'
import { createModel } from '~~/server/ai/provider'
import { buildSystemPrompt } from '~~/server/ai/prompt-builder'
import { getAiSdkTools } from '~~/server/ai/tools'
import { estimateCost } from '~~/server/ai/cost'
import type { ProviderConfig } from '~~/server/ai/types'

// Custom error for cancellation
export class AgentCancelledError extends Error {
  constructor() {
    super('Agent execution was cancelled')
    this.name = 'AgentCancelledError'
  }
}

export interface AgentConfig {
  id: string
  name: string
  prompt: string
  maxTurns?: number
  maxBudgetUsd?: number | null
}

// Result type matching SDK structure
interface AgentResult {
  subtype: string
  total_cost_usd: number
  num_turns: number
  result?: string
  errors?: string[]
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export async function executeAgent(config: AgentConfig): Promise<void> {
  const db = getDb()
  const startTime = Date.now()

  // Create run record
  const [run] = await db.insert(schema.cronAgentRuns)
    .values({ agentId: config.id, status: 'running' })
    .returning()

  const runId = run!.id

  // Register in the agent registry for cancellation support
  agentRegistry.register(runId, config.id, config.name)

  // Notify: agent started
  notifyResourceChange({
    resource: 'agent',
    action: 'run',
    resourceId: config.id,
    resourceName: config.name,
    meta: { runId }
  })

  // Determine which provider to use
  const provider = await getProviderForAgent(config.id)

  try {
    let result: AgentResult

    if (provider.type === 'claude-code') {
      result = await runAgentSDK(config, runId)
    } else {
      result = await runAgentAiSdk(config, runId, provider)
    }

    const durationMs = Date.now() - startTime

    // Determine status based on result subtype
    const status = result.subtype === 'success'
      ? 'success'
      : result.subtype === 'error_max_budget_usd'
        ? 'budget_exceeded'
        : 'error'

    // Update run record with full metrics
    await db.update(schema.cronAgentRuns)
      .set({
        status,
        output: result.subtype === 'success' ? result.result : undefined,
        error: result.subtype !== 'success' ? result.errors?.join('\n') : undefined,
        costUsd: result.total_cost_usd,
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
        numTurns: result.num_turns,
        completedAt: new Date(),
        durationMs
      })
      .where(eq(schema.cronAgentRuns.id, run!.id))

    // Update agent last run
    await db.update(schema.cronAgents)
      .set({ lastRunAt: new Date(), lastStatus: status })
      .where(eq(schema.cronAgents.id, config.id))

    // Log token usage
    logTokenUsage({
      source: 'agent',
      sourceId: runId,
      sourceName: config.name,
      provider: provider.type,
      model: provider.model,
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      costUsd: result.total_cost_usd,
      durationMs,
      numTurns: result.num_turns
    })

    console.log(`[agent] ${config.name} completed: ${status} (${durationMs}ms, $${result.total_cost_usd.toFixed(4)})`)

    // Notify: agent completed
    notifyResourceChange({
      resource: 'agent',
      action: 'complete',
      resourceId: config.id,
      resourceName: config.name,
      meta: { runId, status }
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    const isCancelled = error instanceof AgentCancelledError

    if (isCancelled) {
      await db.update(schema.cronAgentRuns)
        .set({
          status: 'cancelled',
          error: 'Cancelled by user',
          completedAt: new Date(),
          durationMs
        })
        .where(eq(schema.cronAgentRuns.id, runId))

      await db.update(schema.cronAgents)
        .set({ lastRunAt: new Date(), lastStatus: 'cancelled' })
        .where(eq(schema.cronAgents.id, config.id))

      console.log(`[agent] ${config.name} cancelled after ${durationMs}ms`)

      notifyResourceChange({
        resource: 'agent',
        action: 'cancel',
        resourceId: config.id,
        resourceName: config.name,
        meta: { runId }
      })
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error)

      await db.update(schema.cronAgentRuns)
        .set({
          status: 'error',
          error: errorMessage,
          completedAt: new Date(),
          durationMs
        })
        .where(eq(schema.cronAgentRuns.id, runId))

      await db.update(schema.cronAgents)
        .set({ lastRunAt: new Date(), lastStatus: 'error' })
        .where(eq(schema.cronAgents.id, config.id))

      console.error(`[agent] ${config.name} failed:`, errorMessage)

      notifyResourceChange({
        resource: 'agent',
        action: 'fail',
        resourceId: config.id,
        resourceName: config.name,
        message: errorMessage,
        meta: { runId }
      })
    }
  } finally {
    agentRegistry.unregister(runId)
  }
}

/**
 * Run agent via Claude Agent SDK (claude-code provider).
 */
async function runAgentSDK(config: AgentConfig, runId: string): Promise<AgentResult> {
  const conversation = query({
    prompt: config.prompt,
    options: {
      cwd: process.env.VAULT_PATH || process.cwd(),
      settingSources: ['user', 'project'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: config.maxTurns ?? 50,
      maxBudgetUsd: config.maxBudgetUsd ?? undefined
    }
  })

  let resultMessage: AgentResult | undefined

  for await (const message of conversation) {
    if (agentRegistry.isCancelled(runId))
      throw new AgentCancelledError()

    if (message.type === 'result') {
      const msg = message as unknown as {
        subtype: string
        total_cost_usd: number
        num_turns: number
        result?: string
        errors?: string[]
        usage: { input_tokens: number, output_tokens: number }
      }
      resultMessage = {
        subtype: msg.subtype,
        total_cost_usd: msg.total_cost_usd,
        num_turns: msg.num_turns,
        result: msg.result,
        errors: msg.errors,
        usage: {
          input_tokens: msg.usage.input_tokens,
          output_tokens: msg.usage.output_tokens
        }
      }
    }
  }

  if (!resultMessage)
    throw new Error('No result message received from SDK')

  return resultMessage
}

/**
 * Run agent via AI SDK (all non-claude-code providers).
 */
async function runAgentAiSdk(
  config: AgentConfig,
  runId: string,
  provider: ProviderConfig
): Promise<AgentResult> {
  const model = await createModel(provider)
  const systemPrompt = await buildSystemPrompt()

  const abortController = new AbortController()

  // Check cancellation periodically
  const cancelCheck = setInterval(() => {
    if (agentRegistry.isCancelled(runId))
      abortController.abort()
  }, 1000)

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: config.prompt,
      tools: getAiSdkTools(),
      stopWhen: stepCountIs(config.maxTurns ?? 50),
      abortSignal: abortController.signal
    })

    const inputTokens = result.usage?.inputTokens || 0
    const outputTokens = result.usage?.outputTokens || 0
    const cost = estimateCost(provider.model, inputTokens, outputTokens)

    return {
      subtype: 'success',
      total_cost_usd: cost,
      num_turns: result.steps?.length || 1,
      result: result.text,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens
      }
    }
  } catch (error) {
    if (agentRegistry.isCancelled(runId))
      throw new AgentCancelledError()
    throw error
  } finally {
    clearInterval(cancelCheck)
  }
}
