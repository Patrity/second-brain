export interface PersonalityConfig {
  agentName: string
  userName: string
  tone: 'concise' | 'casual' | 'formal' | 'custom'
  customTone?: string
  traits: string[]
  communicationStyle: 'bullets' | 'narrative' | 'mixed'
  proactivity: 'reactive' | 'balanced' | 'proactive'
}

export interface VaultConfig {
  path: string
}

export interface DatabaseConfig {
  type: 'local' | 'remote'
  connectionString: string
  password?: string
  port?: number
}

export interface AuthConfig {
  adminEmail: string
  adminPassword: string
  adminName: string
  authSecret: string
}

export type AIProviderType
  = 'claude-code'
    | 'anthropic'
    | 'openai'
    | 'google'
    | 'xai'
    | 'openrouter'
    | 'ollama'
    | 'custom'

export interface AIProviderConfig {
  type: AIProviderType
  name: string
  model: string
  apiKey?: string
  baseUrl?: string
  envKey?: string
  isDefault: boolean
}

export interface InitConfig {
  personality: PersonalityConfig
  vault: VaultConfig
  database: DatabaseConfig
  auth: AuthConfig
  appUrl: string
  accessMode: 'localhost' | 'specific' | 'any'
  installDir: string
  aiProvider?: AIProviderConfig
}

export interface SecondBrainMetadata {
  version: string
  installedAt: string
  updatedAt: string
  installDir: string
  vaultPath: string
  dbPassword?: string
  dbPort?: number
  channel?: string
}

export interface SetupProgress {
  completedSteps: string[]
  partialConfig: Partial<InitConfig>
  startedAt: string
}
