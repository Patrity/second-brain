// =============================================================================
// AI Provider Types & Model Catalogs
// =============================================================================

export type ProviderType
  = 'claude-code'
    | 'anthropic'
    | 'openai'
    | 'google'
    | 'xai'
    | 'openrouter'
    | 'ollama'
    | 'custom'

export interface ProviderConfig {
  id: string
  name: string
  type: ProviderType
  model: string
  baseUrl?: string | null
  apiKey?: string | null
  isDefault: boolean
}

export interface ModelInfo {
  id: string
  label: string
  contextWindow?: number
}

// Per-provider model catalogs
export const MODEL_CATALOG: Record<ProviderType, ModelInfo[]> = {
  'claude-code': [
    { id: 'sonnet', label: 'Claude Sonnet (default)' },
    { id: 'opus', label: 'Claude Opus' },
    { id: 'haiku', label: 'Claude Haiku' }
  ],
  'anthropic': [
    { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', contextWindow: 200000 },
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', contextWindow: 200000 },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', contextWindow: 200000 }
  ],
  'openai': [
    { id: 'gpt-4o', label: 'GPT-4o', contextWindow: 128000 },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', contextWindow: 128000 },
    { id: 'gpt-4.1', label: 'GPT-4.1', contextWindow: 1048576 },
    { id: 'o3-mini', label: 'o3-mini', contextWindow: 200000 }
  ],
  'google': [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', contextWindow: 1048576 },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', contextWindow: 1048576 }
  ],
  'xai': [
    { id: 'grok-3', label: 'Grok 3', contextWindow: 131072 },
    { id: 'grok-3-mini', label: 'Grok 3 Mini', contextWindow: 131072 }
  ],
  'openrouter': [
    { id: 'anthropic/claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (via OpenRouter)' },
    { id: 'openai/gpt-4o', label: 'GPT-4o (via OpenRouter)' },
    { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (via OpenRouter)' }
  ],
  'ollama': [
    { id: 'llama3', label: 'Llama 3' },
    { id: 'mistral', label: 'Mistral' },
    { id: 'codellama', label: 'Code Llama' },
    { id: 'deepseek-coder', label: 'DeepSeek Coder' }
  ],
  'custom': []
}

// Providers that require an API key
export const PROVIDERS_REQUIRING_KEY: ProviderType[] = [
  'anthropic', 'openai', 'google', 'xai', 'openrouter'
]

// Providers that use a base URL
export const PROVIDERS_WITH_BASE_URL: ProviderType[] = [
  'ollama', 'custom'
]

// Environment variable names for provider API keys
export const PROVIDER_ENV_KEYS: Partial<Record<ProviderType, string>> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  xai: 'XAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY'
}

// Default base URLs
export const DEFAULT_BASE_URLS: Partial<Record<ProviderType, string>> = {
  ollama: 'http://localhost:11434'
}

export const OAUTH_TOS_WARNING
  = 'Using your Claude subscription (OAuth token) in third-party applications '
    + 'may violate Anthropic\'s Consumer Terms of Service. Anthropic has banned '
    + 'accounts for this. Use at your own risk. For compliant usage, choose '
    + '\'Anthropic API\' with a pay-per-token API key instead.'
