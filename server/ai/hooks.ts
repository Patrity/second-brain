import { spawn } from 'child_process'
import { join } from 'path'
import { homedir } from 'os'

export type HookEvent
  = 'SessionStart'
    | 'Stop'
    | 'PreToolUse'
    | 'PostToolUse'

export interface HookResult {
  blocked: boolean
  reason?: string
  output?: string
}

const HOOK_SCRIPTS: Record<HookEvent, string> = {
  SessionStart: 'session-start.py',
  Stop: 'stop-extract.py',
  PreToolUse: 'log-event.py',
  PostToolUse: 'log-event.py'
}

const HOOK_TIMEOUT_MS = 15000

/**
 * Run a hook Python script and return its result.
 *
 * Exit codes:
 *   0 = allow (output injected into context for SessionStart)
 *   2 = block (for PreToolUse — tool execution is prevented)
 *   other = treated as allow with warning
 */
export async function runHook(
  event: HookEvent,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>
): Promise<HookResult> {
  const scriptName = HOOK_SCRIPTS[event]
  if (!scriptName) return { blocked: false }

  const hooksDir = join(homedir(), '.claude', 'hooks')
  const scriptPath = join(hooksDir, scriptName)

  // Check if script exists
  const fs = await import('fs/promises')
  const exists = await fs.stat(scriptPath).catch(() => null)
  if (!exists) return { blocked: false }

  return new Promise((resolve) => {
    const proc = spawn('python3', [scriptPath], {
      cwd: process.env.COGNOVA_PROJECT_DIR || process.cwd(),
      env: {
        ...process.env,
        COGNOVA_API_URL: `http://localhost:${process.env.PORT || '3000'}`
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    // Send hook data as JSON on stdin
    if (data) {
      const payload = {
        hook_event: event,
        tool_name: data.tool_name,
        tool_input: data.tool_input,
        output: data.output,
        session_id: data.session_id,
        ...data
      }
      proc.stdin.write(JSON.stringify(payload))
    }
    proc.stdin.end()

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM')
      resolve({ blocked: false, output: '', reason: 'Hook timed out' })
    }, HOOK_TIMEOUT_MS)

    proc.on('close', (code) => {
      clearTimeout(timeout)

      if (code === 2) {
        // PreToolUse exit code 2 = block
        resolve({
          blocked: true,
          reason: stderr.trim() || stdout.trim() || 'Blocked by hook',
          output: stdout.trim()
        })
      } else {
        if (stderr.trim())
          console.warn(`[hooks] ${event} stderr:`, stderr.trim())

        resolve({
          blocked: false,
          output: stdout.trim()
        })
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timeout)
      console.error(`[hooks] Failed to run ${scriptName}:`, err.message)
      resolve({ blocked: false })
    })
  })
}
