import { pgTable, text, uuid, timestamp, integer, boolean, real } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// =============================================================================
// Auth Tables (BetterAuth)
// =============================================================================

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'), // Hashed password for credential auth
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

// Auth relations
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account)
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id]
  })
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id]
  })
}))

// =============================================================================
// Application Tables
// =============================================================================

// Projects table
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  color: text('color').notNull(), // Hex color string e.g., "#3b82f6"
  description: text('description'), // Optional markdown
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // Soft delete
  // Audit fields
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  modifiedBy: text('modified_by').references(() => user.id, { onDelete: 'set null' }),
  deletedBy: text('deleted_by').references(() => user.id, { onDelete: 'set null' })
})

// Tasks table
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', {
    enum: ['todo', 'in_progress', 'done', 'blocked']
  }).default('todo').notNull(),
  priority: integer('priority').default(2).notNull(), // 1=Low, 2=Medium, 3=High
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // Soft delete
  // Audit fields
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  modifiedBy: text('modified_by').references(() => user.id, { onDelete: 'set null' }),
  deletedBy: text('deleted_by').references(() => user.id, { onDelete: 'set null' })
})

export const reminders = pgTable('reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
  notified: boolean('notified').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
})

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull().unique(),
  sdkSessionId: text('sdk_session_id'),
  providerId: uuid('provider_id').references(() => aiProviders.id, { onDelete: 'set null' }),
  title: text('title'),
  summary: text('summary'),
  status: text('status', {
    enum: ['idle', 'streaming', 'interrupted', 'error']
  }).default('idle').notNull(),
  totalCostUsd: real('total_cost_usd').default(0).notNull(),
  isMain: boolean('is_main').default(false).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  messageCount: integer('message_count').default(0).notNull()
})

export const conversationMessages = pgTable('conversation_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(), // JSON string of ChatContentBlock[]
  source: text('source', { enum: ['web', 'telegram', 'discord', 'imessage', 'email', 'google'] }),
  costUsd: real('cost_usd'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
})

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  messages: many(conversationMessages),
  provider: one(aiProviders, { fields: [conversations.providerId], references: [aiProviders.id] })
}))

export const conversationMessagesRelations = relations(conversationMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationMessages.conversationId],
    references: [conversations.id]
  })
}))

// Relations for query builder
export const projectsRelations = relations(projects, ({ one, many }) => ({
  tasks: many(tasks),
  creator: one(user, { fields: [projects.createdBy], references: [user.id] }),
  modifier: one(user, { fields: [projects.modifiedBy], references: [user.id] }),
  deleter: one(user, { fields: [projects.deletedBy], references: [user.id] })
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id]
  }),
  reminders: many(reminders),
  creator: one(user, { fields: [tasks.createdBy], references: [user.id] }),
  modifier: one(user, { fields: [tasks.modifiedBy], references: [user.id] }),
  deleter: one(user, { fields: [tasks.deletedBy], references: [user.id] })
}))

export const remindersRelations = relations(reminders, ({ one }) => ({
  task: one(tasks, {
    fields: [reminders.taskId],
    references: [tasks.id]
  })
}))

// Documents table - stores metadata for vault files
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  path: text('path').notNull().unique(),
  content: text('content'),
  contentHash: text('content_hash'),
  tags: text('tags').array().default([]),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  shared: boolean('shared').default(false).notNull(),
  shareType: text('share_type', { enum: ['public', 'private'] }),
  fileType: text('file_type').notNull(),
  mimeType: text('mime_type'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  modifiedAt: timestamp('modified_at', { withTimezone: true }),
  modifiedBy: text('modified_by').references(() => user.id, { onDelete: 'set null' }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: text('deleted_by').references(() => user.id, { onDelete: 'set null' })
})

export const documentsRelations = relations(documents, ({ one }) => ({
  project: one(projects, { fields: [documents.projectId], references: [projects.id] }),
  creator: one(user, { fields: [documents.createdBy], references: [user.id] }),
  modifier: one(user, { fields: [documents.modifiedBy], references: [user.id] }),
  deleter: one(user, { fields: [documents.deletedBy], references: [user.id] })
}))

// =============================================================================
// AI Providers - Multi-provider configuration
// =============================================================================

export const aiProviders = pgTable('ai_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type', {
    enum: ['claude-code', 'anthropic', 'openai', 'google', 'xai', 'openrouter', 'ollama', 'custom']
  }).notNull(),
  model: text('model').notNull(),
  baseUrl: text('base_url'),
  apiKey: text('api_key'), // Encrypted at rest
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
})

// =============================================================================
// Cron Agents - Scheduled Claude agents
// =============================================================================

export const cronAgents = pgTable('cron_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  schedule: text('schedule').notNull(), // Cron expression: "0 4 * * *"
  prompt: text('prompt').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  providerId: uuid('provider_id').references(() => aiProviders.id, { onDelete: 'set null' }),
  maxTurns: integer('max_turns').default(50),
  maxBudgetUsd: real('max_budget_usd'),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  lastStatus: text('last_status', { enum: ['success', 'error', 'budget_exceeded', 'cancelled'] }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' })
})

export const cronAgentRuns = pgTable('cron_agent_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => cronAgents.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['running', 'success', 'error', 'budget_exceeded', 'cancelled'] }).notNull(),
  output: text('output'),
  error: text('error'),
  costUsd: real('cost_usd'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  numTurns: integer('num_turns'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMs: integer('duration_ms')
})

export const cronAgentsRelations = relations(cronAgents, ({ many, one }) => ({
  runs: many(cronAgentRuns),
  creator: one(user, { fields: [cronAgents.createdBy], references: [user.id] }),
  provider: one(aiProviders, { fields: [cronAgents.providerId], references: [aiProviders.id] })
}))

export const cronAgentRunsRelations = relations(cronAgentRuns, ({ one }) => ({
  agent: one(cronAgents, { fields: [cronAgentRuns.agentId], references: [cronAgents.id] })
}))

// =============================================================================
// Secrets - Encrypted key-value store for skills
// =============================================================================

export const secrets = pgTable('secrets', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  encryptedValue: text('encrypted_value').notNull(),
  iv: text('iv').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' })
})

export const secretsRelations = relations(secrets, ({ one }) => ({
  creator: one(user, { fields: [secrets.createdBy], references: [user.id] })
}))

// =============================================================================
// Hook Events - Analytics for Claude Code hooks
// =============================================================================

export const hookEvents = pgTable('hook_events', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Event identification
  eventType: text('event_type', {
    enum: ['SessionStart', 'SessionEnd', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'UserPromptSubmit']
  }).notNull(),

  // Session tracking
  sessionId: text('session_id'),
  projectDir: text('project_dir'),

  // Tool information (for tool-related events)
  toolName: text('tool_name'),
  toolMatcher: text('tool_matcher'),

  // Flexible JSON data for event-specific info
  eventData: text('event_data'),

  // Outcome tracking
  exitCode: integer('exit_code'),
  blocked: boolean('blocked').default(false).notNull(),
  blockReason: text('block_reason'),

  // Timing
  durationMs: integer('duration_ms'),

  // Metadata
  hookScript: text('hook_script'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
})

// =============================================================================
// Memory System - Persistent memory for Claude Code conversations
// =============================================================================

export const memoryChunks = pgTable('memory_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Source tracking
  sessionId: text('session_id'), // Claude session that created this memory
  projectPath: text('project_path'), // For project-scoped queries

  // Content
  chunkType: text('chunk_type', {
    enum: ['decision', 'fact', 'solution', 'pattern', 'preference', 'summary']
  }).notNull(),
  content: text('content').notNull(), // The extracted memory (concise)
  sourceExcerpt: text('source_excerpt'), // Original context (truncated for reference)

  // Usage tracking (relevance is computed at query time from access + recency)
  accessCount: integer('access_count').default(0).notNull(), // How often retrieved
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),

  // Search (embedding added in Phase 4 with pgvector)
  // embedding: vector('embedding', { dimensions: 1536 }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }) // For dynamic forgetting
})

// =============================================================================
// User Settings - Generic app settings per user (JSON as text)
// =============================================================================

export const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  settings: text('settings').notNull().default('{}'), // JSON string of UserSettings
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
})

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, { fields: [userSettings.userId], references: [user.id] })
}))

// =============================================================================
// Skills Catalog - Cache of community skills registry
// =============================================================================

export const skillsCatalog = pgTable('skills_catalog', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  version: text('version').notNull(),
  author: text('author').notNull(),
  tags: text('tags').array().default([]),
  requiresSecrets: text('requires_secrets').array().default([]),
  files: text('files').array().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull()
})

// =============================================================================
// Token Usage - Unified AI cost & token tracking
// =============================================================================

export const tokenUsage = pgTable('token_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source', { enum: ['chat', 'agent', 'memory_extraction', 'bridge'] }).notNull(),
  sourceId: text('source_id'),
  sourceName: text('source_name'),
  provider: text('provider'), // Provider type used (e.g. 'anthropic', 'openai')
  model: text('model'), // Model ID used (e.g. 'claude-sonnet-4-5-20250929')
  inputTokens: integer('input_tokens').default(0).notNull(),
  outputTokens: integer('output_tokens').default(0).notNull(),
  costUsd: real('cost_usd').default(0).notNull(),
  durationMs: integer('duration_ms'),
  numTurns: integer('num_turns'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
})

// =============================================================================
// Message Bridge - External platform integrations
// =============================================================================

export const bridges = pgTable('bridges', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: text('platform', {
    enum: ['telegram', 'discord', 'imessage', 'google', 'email']
  }).notNull(),
  name: text('name').notNull(),
  enabled: boolean('enabled').default(false).notNull(),
  config: text('config'), // JSON: platform-specific config (channel mappings, filters, strategy)
  secretKeys: text('secret_keys').array().default([]), // References to secrets table key names
  healthStatus: text('health_status', {
    enum: ['connected', 'disconnected', 'error', 'unconfigured']
  }).default('unconfigured').notNull(),
  healthMessage: text('health_message'),
  lastHealthCheck: timestamp('last_health_check', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' })
})

export const bridgeMessages = pgTable('bridge_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  bridgeId: uuid('bridge_id').notNull().references(() => bridges.id, { onDelete: 'cascade' }),
  direction: text('direction', { enum: ['inbound', 'outbound'] }).notNull(),
  platform: text('platform').notNull(),
  sender: text('sender'),
  senderName: text('sender_name'),
  content: text('content').notNull(),
  attachments: text('attachments'), // JSON array of attachment metadata
  platformMessageId: text('platform_message_id'),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  status: text('status', {
    enum: ['pending', 'sent', 'delivered', 'failed']
  }).default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true })
})

export const bridgesRelations = relations(bridges, ({ one, many }) => ({
  creator: one(user, { fields: [bridges.createdBy], references: [user.id] }),
  messages: many(bridgeMessages)
}))

export const bridgeMessagesRelations = relations(bridgeMessages, ({ one }) => ({
  bridge: one(bridges, { fields: [bridgeMessages.bridgeId], references: [bridges.id] }),
  conversation: one(conversations, { fields: [bridgeMessages.conversationId], references: [conversations.id] })
}))
