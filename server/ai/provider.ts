import type { ProviderConfig } from './types'

/**
 * Create an AI SDK model instance from a provider configuration.
 * Each provider package is dynamically imported to avoid loading
 * all SDKs at startup.
 *
 * Returns the provider's model instance. Different providers may return
 * LanguageModelV1, V2, or V3 — the AI SDK handles version negotiation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createModel(provider: ProviderConfig): Promise<any> {
  switch (provider.type) {
    case 'claude-code': {
      const { claudeCode } = await import('ai-sdk-provider-claude-code')
      return claudeCode(provider.model)
    }
    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic')
      const anthropic = createAnthropic({
        apiKey: provider.apiKey || process.env.ANTHROPIC_API_KEY
      })
      return anthropic(provider.model)
    }
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      const openai = createOpenAI({
        apiKey: provider.apiKey || process.env.OPENAI_API_KEY
      })
      return openai(provider.model)
    }
    case 'google': {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
      const google = createGoogleGenerativeAI({
        apiKey: provider.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY
      })
      return google(provider.model)
    }
    case 'xai': {
      const { createXai } = await import('@ai-sdk/xai')
      const xai = createXai({
        apiKey: provider.apiKey || process.env.XAI_API_KEY
      })
      return xai(provider.model)
    }
    case 'openrouter': {
      const { createOpenRouter } = await import('@openrouter/ai-sdk-provider')
      const openrouter = createOpenRouter({
        apiKey: provider.apiKey || process.env.OPENROUTER_API_KEY
      })
      return openrouter(provider.model)
    }
    case 'ollama': {
      const { createOllama } = await import('ollama-ai-provider')
      const ollama = createOllama({
        baseURL: provider.baseUrl || 'http://localhost:11434/api'
      })
      return ollama(provider.model)
    }
    case 'custom': {
      const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible')
      if (!provider.baseUrl)
        throw new Error('Custom provider requires a base URL')
      const custom = createOpenAICompatible({
        name: provider.name,
        baseURL: provider.baseUrl,
        apiKey: provider.apiKey || undefined
      })
      return custom(provider.model)
    }
    default:
      throw new Error(`Unknown provider type: ${provider.type}`)
  }
}
