// Per-model pricing in USD per million tokens
const PRICING: Record<string, { input: number, output: number }> = {
  // Anthropic
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.0 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'o3-mini': { input: 1.10, output: 4.40 },
  // Google
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  // xAI
  'grok-3': { input: 3.0, output: 15.0 },
  'grok-3-mini': { input: 0.30, output: 0.50 }
}

/**
 * Estimate cost for a given model based on token counts.
 * Returns 0 for unknown or local models.
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Strip provider prefix for OpenRouter models (e.g. "anthropic/claude-sonnet-4-5-20250929")
  const modelId = model.includes('/') ? model.split('/').pop()! : model
  const pricing = PRICING[modelId]
  if (!pricing) return 0

  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}
