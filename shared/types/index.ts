// === Users ===

export interface User {
  id: string
  name: string
  email: string
  image?: string
}

// === Projects ===

export interface Project {
  id: string
  name: string
  color: string
  description?: string
  createdAt: Date
  modifiedAt?: Date
  deletedAt?: Date
  createdBy?: string
  modifiedBy?: string
  deletedBy?: string
  creator?: User
}

export interface CreateProjectInput {
  name: string
  color: string
  description?: string
}

export interface UpdateProjectInput {
  name?: string
  color?: string
  description?: string
}

// === Tasks ===

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: number // 1=Low, 2=Medium, 3=High
  projectId?: string
  project?: Project // Populated on fetch
  dueDate?: Date
  tags: string[]
  createdAt: Date
  modifiedAt?: Date
  completedAt?: Date
  deletedAt?: Date
  createdBy?: string
  modifiedBy?: string
  deletedBy?: string
  creator?: User // Populated on fetch
}

export interface CreateTaskInput {
  title: string
  description?: string
  status?: TaskStatus
  priority?: number // 1-3, defaults to 2
  projectId?: string
  dueDate?: string
  tags?: string[]
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: number
  projectId?: string | null
  dueDate?: string | null
  tags?: string[]
}

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[]
  projectId?: string
  search?: string
  includeDeleted?: boolean
}

// === Reminders ===

export interface Reminder {
  id: string
  taskId?: string
  message: string
  remindAt: Date
  notified: boolean
  createdAt: Date
}

// === Files ===

export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modifiedAt?: Date
  children?: FileEntry[]
}

export interface FileContent {
  path: string
  content: string
  modifiedAt: Date
}

// === Documents ===

export type ShareType = 'public' | 'private'
export type FileType = 'markdown' | 'text' | 'binary'

export type CodeLanguage
  = 'markdown'
    | 'javascript'
    | 'typescript'
    | 'json'
    | 'html'
    | 'css'
    | 'vue'
    | 'python'
    | 'sql'
    | 'yaml'
    | 'bash'
    | 'go'
    | 'rust'
    | 'dockerfile'
    | 'java'
    | 'cpp'
    | 'xml'
    | 'plaintext'

export interface Document {
  id: string
  title: string
  path: string
  content?: string
  contentHash?: string
  tags: string[]
  projectId?: string
  project?: Project
  shared: boolean
  shareType?: ShareType
  fileType: FileType
  mimeType?: string
  syncedAt?: Date
  createdAt: Date
  createdBy?: string
  creator?: User
  modifiedAt?: Date
  modifiedBy?: string
  deletedAt?: Date
  deletedBy?: string
}

export interface DocumentMetadata {
  title: string
  tags: string[]
  projectId?: string
  shared: boolean
  shareType?: ShareType
  [key: string]: unknown
}

export interface DocumentWithContent {
  document: Document
  metadata: DocumentMetadata
  body: string
}

export interface UpdateDocumentInput {
  title?: string
  tags?: string[]
  projectId?: string | null
  shared?: boolean
  shareType?: ShareType | null
  body?: string
}

// TOC types for MDC parseMarkdown output
export interface TocLink {
  id: string
  text: string
  depth: number
  children?: TocLink[]
}

// Public document viewer API response
export interface PublicDocumentResponse {
  document: Pick<Document, 'id' | 'title' | 'path' | 'fileType' | 'shared' | 'shareType' | 'tags' | 'createdAt' | 'modifiedAt'> & {
    creatorName: string | null
  }
  content: string | null
  isOwner: boolean
}

// === Conversations ===

export interface Conversation {
  id: string
  sessionId: string
  sdkSessionId?: string
  providerId?: string
  title?: string
  summary?: string
  status: 'idle' | 'streaming' | 'interrupted' | 'error'
  totalCostUsd: number
  isMain: boolean
  startedAt: Date
  endedAt?: Date
  messageCount: number
}

export interface ConversationDetail extends Conversation {
  messages: ConversationMessage[]
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// === API ===

export interface ApiResponse<T> {
  data?: T
  error?: string
}

// === Editor ===

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// === Cron Agents ===

export type AgentStatus = 'success' | 'error' | 'budget_exceeded' | 'cancelled'
export type RunStatus = 'running' | 'success' | 'error' | 'budget_exceeded' | 'cancelled'

export interface CronAgent {
  id: string
  name: string
  description?: string
  schedule: string
  prompt: string
  enabled: boolean
  providerId?: string
  maxTurns?: number
  maxBudgetUsd?: number
  lastRunAt?: Date
  lastStatus?: AgentStatus
  createdAt: Date
  updatedAt: Date
  createdBy?: string
  creator?: User
}

export interface CronAgentRun {
  id: string
  agentId: string
  status: RunStatus
  output?: string
  error?: string
  costUsd?: number
  inputTokens?: number
  outputTokens?: number
  numTurns?: number
  startedAt: Date
  completedAt?: Date
  durationMs?: number
}

export interface CreateAgentInput {
  name: string
  description?: string
  schedule: string
  prompt: string
  enabled?: boolean
  providerId?: string
  maxTurns?: number
  maxBudgetUsd?: number
}

export interface UpdateAgentInput {
  name?: string
  description?: string
  schedule?: string
  prompt?: string
  enabled?: boolean
  providerId?: string | null
  maxTurns?: number
  maxBudgetUsd?: number | null
}

// === Notification System ===

export type NotificationResource
  = 'task'
    | 'reminder'
    | 'agent'
    | 'hook'
    | 'memory'
    | 'document'
    | 'project'
    | 'conversation'
    | 'secret'
    | 'bridge'

export type NotificationAction
  = 'create'
    | 'edit'
    | 'delete'
    | 'restore'
    | 'run'
    | 'cancel'
    | 'complete'
    | 'fail'

export type NotificationColor = 'success' | 'error' | 'warning' | 'info'

export interface NotificationPayload {
  type: 'resource_change'
  resource: NotificationResource
  action: NotificationAction
  resourceId?: string
  resourceName?: string
  message?: string
  title?: string
  color?: NotificationColor
  meta?: Record<string, unknown>
  timestamp?: string
}

// === Notification Preferences ===

export interface NotificationResourcePreference {
  enabled: boolean
  subtypes?: Partial<Record<NotificationAction, boolean>>
}

export type NotificationPreferences = Record<NotificationResource, NotificationResourcePreference>

export interface BridgePreferences {
  globalEnabled: boolean
  respondToUnknown: boolean
  autoReplyMessage?: string
}

export interface UserSettings {
  notifications: NotificationPreferences
  bridges?: BridgePreferences
}

// === Agent Stats ===

export type StatsPeriod = '24h' | '7d' | '30d'
export type UsageDisplayMode = 'cost' | 'tokens'

export interface DailyRunData {
  date: string
  success: number
  error: number
  total: number
  costUsd: number
}

export interface AgentGlobalStats {
  totalAgents: number
  activeAgents: number
  runsInPeriod: number
  successRate: number
  totalCostUsd: number
  runningAgentIds: string[]
  dailyRuns: DailyRunData[]
}

export interface AgentDetailStats {
  totalRuns: number
  successRate: number
  avgDurationMs: number
  totalCostUsd: number
  lastRunAt: string | null
  dailyRuns: DailyRunData[]
}

// === AI Providers ===

export type AIProviderType
  = 'claude-code'
    | 'anthropic'
    | 'openai'
    | 'google'
    | 'xai'
    | 'openrouter'
    | 'ollama'
    | 'custom'

export interface AIProvider {
  id: string
  name: string
  type: AIProviderType
  model: string
  baseUrl?: string | null
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateProviderInput {
  name: string
  type: AIProviderType
  model: string
  baseUrl?: string
  apiKey?: string
  isDefault?: boolean
}

export interface UpdateProviderInput {
  name?: string
  type?: AIProviderType
  model?: string
  baseUrl?: string | null
  apiKey?: string | null
  isDefault?: boolean
}

// === Token Usage ===

export type TokenUsageSource
  = | 'chat'
    | 'agent'
    | 'memory_extraction'
    | 'bridge'

export interface TokenUsageRecord {
  id: string
  source: TokenUsageSource
  sourceId?: string
  sourceName?: string
  provider?: string
  model?: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs?: number
  numTurns?: number
  createdAt: Date
}

export interface DailyUsageData {
  date: string
  chat: number
  agent: number
  memory: number
  bridge: number
  totalCost: number
  inputTokens: number
  outputTokens: number
  calls: number
}

export interface UsageStats {
  totalCostUsd: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCalls: number
  avgCostPerCall: number
  dailyUsage: DailyUsageData[]
  bySource: { source: TokenUsageSource, cost: number, calls: number, tokens: number }[]
  topConsumers: { name: string, source: TokenUsageSource, cost: number, calls: number, tokens: number }[]
}

// === Dashboard ===

export interface DashboardOverview {
  tasks: {
    todoCount: number
    inProgressCount: number
    upcoming: Array<{
      id: string
      title: string
      status: TaskStatus
      priority: number
      dueDate: string | null
      projectName: string | null
      projectColor: string | null
    }>
  }
  conversations: Array<{
    id: string
    sessionId: string
    title: string | null
    messageCount: number
    startedAt: string
  }>
  documents: Array<{
    id: string
    title: string
    path: string
    modifiedAt: string | null
    projectName: string | null
    projectColor: string | null
  }>
  usage: {
    totalCost7d: number
    totalCalls7d: number
    totalInputTokens7d: number
    totalOutputTokens7d: number
  }
}

// === Skills ===

export interface SkillMeta {
  name: string
  description: string
  version: string
  author: string
  tags: string[]
  allowedTools: string[]
  requiresSecrets: string[]
  repository: string
  installedFrom: string
  disableModelInvocation: boolean
  userInvocable: boolean
  context: string
  agent: string
}

export interface SkillListItem {
  name: string
  description: string
  version: string
  author: string
  active: boolean
  core: boolean
  allowedTools: string[]
  requiresSecrets: string[]
  installedFrom: string
  fileCount: number
  hasUpdate?: boolean
}

export interface SkillDetail extends SkillListItem {
  meta: SkillMeta
  files: SkillFile[]
}

export interface SkillFile {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: SkillFile[]
}

// === Skills Library ===

// First tag must be 'community' or 'official'. Up to 4 additional free-form tags.
export type SkillSourceTag = 'community' | 'official'

export interface SkillCatalogItem {
  id: string
  name: string
  description: string
  version: string
  author: string
  tags: string[]
  requiresSecrets: string[]
  files: string[]
  updatedAt: string
  installed?: boolean
  installedVersion?: string
  hasUpdate?: boolean
}

// === Hook Events ===

export type HookEventType
  = | 'SessionStart'
    | 'SessionEnd'
    | 'PreToolUse'
    | 'PostToolUse'
    | 'PostToolUseFailure'
    | 'UserPromptSubmit'

export interface HookEvent {
  id: string
  eventType: HookEventType
  sessionId?: string
  projectDir?: string
  toolName?: string
  toolMatcher?: string
  eventData?: Record<string, unknown>
  exitCode?: number
  blocked: boolean
  blockReason?: string
  durationMs?: number
  hookScript?: string
  createdAt: Date
}

export interface CreateHookEventInput {
  eventType: HookEventType
  sessionId?: string
  projectDir?: string
  toolName?: string
  toolMatcher?: string
  eventData?: Record<string, unknown>
  exitCode?: number
  blocked?: boolean
  blockReason?: string
  durationMs?: number
  hookScript?: string
}

export interface HookEventFilters {
  eventType?: HookEventType | HookEventType[]
  sessionId?: string
  toolName?: string
  blocked?: boolean | string // Query params can be string 'true'/'false'
  since?: string
  limit?: number
}

// === Hook Analytics Stats ===

export interface HookDailyData {
  date: string
  total: number
  blocked: number
  allowed: number
  avgDurationMs: number
}

export interface HookToolBreakdown {
  toolName: string
  total: number
  blocked: number
  avgDurationMs: number
}

export interface HookEventStats {
  totalEvents: number
  blockedEvents: number
  blockRate: number
  avgDurationMs: number
  eventsByType: Partial<Record<HookEventType, number>>
  toolBreakdown: HookToolBreakdown[]
  dailyActivity: HookDailyData[]
  recentSessions: string[]
}

// === Memory System ===

export type MemoryChunkType
  = | 'decision'
    | 'fact'
    | 'solution'
    | 'pattern'
    | 'preference'
    | 'summary'

export interface MemoryChunk {
  id: string
  sessionId?: string
  projectPath?: string
  chunkType: MemoryChunkType
  content: string
  sourceExcerpt?: string
  accessCount: number
  lastAccessedAt?: Date
  createdAt: Date
  expiresAt?: Date
}

export interface CreateMemoryInput {
  sessionId?: string
  projectPath?: string
  chunkType: MemoryChunkType
  content: string
  sourceExcerpt?: string
}

export interface MemorySearchFilters {
  query?: string
  projectPath?: string
  chunkType?: MemoryChunkType | MemoryChunkType[]
  limit?: number
}

export interface ExtractMemoryInput {
  transcript: string
  sessionId?: string
  projectPath?: string
}

export interface ExtractedMemory {
  type: MemoryChunkType
  content: string
}

export interface MemoryContextResponse {
  memories: MemoryChunk[]
  formatted: string
}

// === Chat System ===

export type ChatSessionStatus = 'idle' | 'streaming' | 'interrupted' | 'error'
export type ChatConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// Content blocks (maps to SDK content structure)
export interface ChatTextBlock {
  type: 'text'
  text: string
}

export interface ChatToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ChatToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

export type ChatImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export interface ChatImageBlock {
  type: 'image'
  source: {
    type: 'base64'
    media_type: ChatImageMediaType
    data: string
  }
}

export interface ChatDocumentBlock {
  type: 'document'
  source:
    | { type: 'base64', media_type: 'application/pdf', data: string }
    | { type: 'text', media_type: 'text/plain', data: string }
  title?: string
}

export type ChatContentBlock
  = ChatTextBlock
    | ChatImageBlock
    | ChatDocumentBlock
    | ChatToolUseBlock
    | ChatToolResultBlock

export type MessageSource = 'web' | 'telegram' | 'discord' | 'imessage' | 'email' | 'google'

// Persisted message
export interface ChatMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: ChatContentBlock[]
  source?: MessageSource
  costUsd?: number
  durationMs?: number
  createdAt: Date
}

// Conversation metadata
export interface ChatConversation {
  id: string
  sessionId: string
  sdkSessionId?: string
  providerId?: string
  title?: string
  summary?: string
  status: ChatSessionStatus
  totalCostUsd: number
  isMain: boolean
  messageCount: number
  startedAt: Date
  endedAt?: Date
}

// WebSocket protocol: Client -> Server
export interface ChatSendMessage {
  type: 'chat:send'
  message: string
  attachments?: ChatImageBlock[]
  documents?: ChatDocumentBlock[]
  conversationId?: string
}

export interface ChatInterruptMessage {
  type: 'chat:interrupt'
  conversationId: string
}

export type ChatClientMessage = ChatSendMessage | ChatInterruptMessage

// WebSocket protocol: Server -> Client
export interface ChatSessionCreated {
  type: 'chat:session_created'
  conversationId: string
}

export interface ChatStreamStart {
  type: 'chat:stream_start'
  conversationId: string
}

export interface ChatTextDelta {
  type: 'chat:text_delta'
  conversationId: string
  delta: string
}

export interface ChatToolStart {
  type: 'chat:tool_start'
  conversationId: string
  toolUseId: string
  toolName: string
}

export interface ChatToolEnd {
  type: 'chat:tool_end'
  conversationId: string
  toolUseId: string
  result: string
  isError: boolean
}

export interface ChatStreamEnd {
  type: 'chat:stream_end'
  conversationId: string
  costUsd: number
  durationMs: number
}

export interface ChatError {
  type: 'chat:error'
  conversationId?: string
  message: string
}

export interface ChatInterrupted {
  type: 'chat:interrupted'
  conversationId: string
}

export type ChatServerMessage
  = ChatSessionCreated
    | ChatStreamStart
    | ChatTextDelta
    | ChatToolStart
    | ChatToolEnd
    | ChatStreamEnd
    | ChatError
    | ChatInterrupted

// === Message Bridge ===

export type BridgePlatform
  = 'telegram'
    | 'discord'
    | 'imessage'
    | 'google'
    | 'email'

export type BridgeHealthStatus
  = 'connected'
    | 'disconnected'
    | 'error'
    | 'unconfigured'

export type BridgeMessageDirection = 'inbound' | 'outbound'

export type BridgeMessageStatus
  = 'pending'
    | 'sent'
    | 'delivered'
    | 'failed'

export interface Bridge {
  id: string
  platform: BridgePlatform
  name: string
  enabled: boolean
  config?: string // JSON string
  secretKeys: string[]
  healthStatus: BridgeHealthStatus
  healthMessage?: string
  lastHealthCheck?: Date
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}

export interface BridgeMessage {
  id: string
  bridgeId: string
  direction: BridgeMessageDirection
  platform: string
  sender?: string
  senderName?: string
  content: string
  attachments?: string // JSON string
  platformMessageId?: string
  conversationId?: string
  status: BridgeMessageStatus
  attempts: number
  lastError?: string
  createdAt: Date
  sentAt?: Date
}

export interface CreateBridgeInput {
  platform: BridgePlatform
  name: string
  enabled?: boolean
  config?: Record<string, unknown>
  secretKeys?: string[]
}

export interface UpdateBridgeInput {
  name?: string
  enabled?: boolean
  config?: Record<string, unknown>
  secretKeys?: string[]
}

// Platform-specific config shapes (stored as JSON in config column)

export interface TelegramBridgeConfig {
  botUsername?: string
  allowedChatIds?: string[]
}

export interface DiscordBridgeConfig {
  guildId?: string
  channelId?: string
  listenMode: 'mentions' | 'dm' | 'all'
}

export interface IMessageBridgeConfig {
  strategy?: 'imsg' | 'bluebubbles'
  allowedNumbers?: string[]
  blueBubblesUrl?: string
}

export interface GoogleBridgeConfig {
  enabledServices: string[] // ['gmail', 'calendar', 'drive', 'contacts', 'tasks']
  account?: string // Google account email
}

export interface EmailBridgeConfig {
  imapHost?: string
  imapPort?: number
  smtpHost?: string
  smtpPort?: number
  emailAddress?: string
}
