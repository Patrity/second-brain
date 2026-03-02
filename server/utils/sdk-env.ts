import { dirname } from 'path'
import type { ProviderType } from '~~/server/ai/types'

/**
 * Build env vars for Claude Agent SDK child processes.
 * Ensures the `node` binary is findable even when the server
 * runs under launchctl/systemd where nvm/fnm aren't in PATH.
 *
 * When providerType is NOT 'claude-code', strips CLAUDE_CODE_OAUTH_TOKEN
 * to prevent accidental TOS-violating usage of OAuth tokens.
 */
export function sdkEnv(providerType?: ProviderType): Record<string, string | undefined> {
  const nodeDir = dirname(process.execPath)
  const currentPath = process.env.PATH || ''

  const env: Record<string, string | undefined> = {
    ...process.env,
    PATH: currentPath.includes(nodeDir)
      ? currentPath
      : `${nodeDir}:${currentPath}`
  }

  // Strip OAuth token for non-Claude-Code providers to prevent TOS violations
  if (providerType && providerType !== 'claude-code') {
    delete env.CLAUDE_CODE_OAUTH_TOKEN
    delete env.CLAUDE_OAUTH_TOKEN
  }

  return env
}
