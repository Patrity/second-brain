import { query } from '@anthropic-ai/claude-agent-sdk'
import { streamText, stepCountIs } from 'ai'
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages'
import type { StreamTextResult } from 'ai'
import { sdkEnv } from '~~/server/utils/sdk-env'
import { createModel } from '~~/server/ai/provider'
import { buildSystemPrompt } from '~~/server/ai/prompt-builder'
import { loadConversationHistory } from '~~/server/ai/history'
import { getAiSdkTools } from '~~/server/ai/tools'
import type { ProviderConfig } from '~~/server/ai/types'

export type PromptInput = string | ContentBlockParam[]

interface ActiveSession {
  conversationId: string
  sdkSessionId: string
  provider: ProviderConfig
  // SDK path
  conversation?: ReturnType<typeof query>
  // AI SDK path
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiStream?: StreamTextResult<any, any>
  interrupted: boolean
  startedAt: Date
}

async function* createMultimodalPrompt(content: ContentBlockParam[]): AsyncGenerator<SDKUserMessage> {
  yield {
    type: 'user',
    message: { role: 'user', content },
    parent_tool_use_id: null,
    session_id: ''
  } as SDKUserMessage
}

class ChatSessionManager {
  private sessions = new Map<string, ActiveSession>()

  /**
   * Start a chat session using the Claude Agent SDK.
   */
  startSdkSession(
    conversationId: string,
    prompt: PromptInput,
    provider: ProviderConfig,
    resumeSessionId?: string
  ): ActiveSession {
    const projectDir = process.env.COGNOVA_PROJECT_DIR || process.cwd()

    const promptArg = typeof prompt === 'string'
      ? prompt
      : createMultimodalPrompt(prompt)

    const conversation = query({
      prompt: promptArg,
      options: {
        cwd: projectDir,
        env: sdkEnv('claude-code'),
        settingSources: ['user', 'project'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        maxTurns: 200,
        includePartialMessages: true,
        ...(resumeSessionId ? { resume: resumeSessionId } : {})
      }
    })

    const session: ActiveSession = {
      conversationId,
      sdkSessionId: '',
      provider,
      conversation,
      interrupted: false,
      startedAt: new Date()
    }

    this.sessions.set(conversationId, session)
    return session
  }

  /**
   * Start a chat session using the Vercel AI SDK (streamText).
   */
  async startAiSdkSession(
    conversationId: string,
    prompt: string,
    provider: ProviderConfig
  ): Promise<ActiveSession> {
    const model = await createModel(provider)
    const systemPrompt = await buildSystemPrompt()
    const history = await loadConversationHistory(conversationId)

    const result = streamText({
      model,
      system: systemPrompt,
      messages: [
        ...history,
        { role: 'user' as const, content: prompt }
      ],
      tools: getAiSdkTools(),
      stopWhen: stepCountIs(200)
    })

    const session: ActiveSession = {
      conversationId,
      sdkSessionId: '',
      provider,
      aiStream: result,
      interrupted: false,
      startedAt: new Date()
    }

    this.sessions.set(conversationId, session)
    return session
  }

  getSession(conversationId: string): ActiveSession | undefined {
    return this.sessions.get(conversationId)
  }

  interrupt(conversationId: string): boolean {
    const session = this.sessions.get(conversationId)
    if (!session) return false
    session.interrupted = true
    return true
  }

  removeSession(conversationId: string): void {
    this.sessions.delete(conversationId)
  }
}

export const chatSessionManager = new ChatSessionManager()
