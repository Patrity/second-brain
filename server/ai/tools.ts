import { execFile } from 'child_process'
import { resolve, relative } from 'path'
import { readFile, readdir, stat } from 'fs/promises'
import { z } from 'zod'
import { tool } from 'ai'
import { runHook } from './hooks'

/**
 * Get the allowed root directories for file operations.
 */
function getAllowedRoots(): string[] {
  const roots: string[] = []
  if (process.env.VAULT_PATH) roots.push(resolve(process.env.VAULT_PATH))
  if (process.env.COGNOVA_PROJECT_DIR) roots.push(resolve(process.env.COGNOVA_PROJECT_DIR))
  if (roots.length === 0) roots.push(process.cwd())
  return roots
}

/**
 * Validate that a path stays within allowed directories.
 */
function validateToolPath(filePath: string): string {
  const resolved = resolve(filePath)
  const roots = getAllowedRoots()

  for (const root of roots) {
    const rel = relative(root, resolved)
    if (!rel.startsWith('..') && resolved.startsWith(root))
      return resolved
  }

  throw new Error(`Path outside allowed directories: ${filePath}`)
}

// =============================================================================
// Bash Tool
// =============================================================================

export const bashTool = tool({
  description: 'Execute a shell command. Use for running scripts, git operations, build commands, etc.',
  inputSchema: z.object({
    command: z.string().describe('The shell command to execute')
  }),
  execute: async ({ command }) => {
    // PreToolUse hook
    const pre = await runHook('PreToolUse', {
      tool_name: 'Bash',
      tool_input: { command }
    })
    if (pre.blocked)
      return `BLOCKED: ${pre.reason}`

    try {
      const result = await execCommand(command)

      // PostToolUse hook
      await runHook('PostToolUse', {
        tool_name: 'Bash',
        tool_input: { command },
        output: result
      })

      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      return `ERROR: ${errorMsg}`
    }
  }
})

function execCommand(command: string, timeoutMs = 120000): Promise<string> {
  return new Promise((resolve, reject) => {
    const cwd = process.env.COGNOVA_PROJECT_DIR || process.cwd()
    execFile('bash', ['-c', command], {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024, // 1MB
      env: process.env as Record<string, string>
    }, (error, stdout, stderr) => {
      if (error && !stdout && !stderr)
        return reject(error)
      // Return combined output even if there's a non-zero exit code
      const output = [stdout, stderr].filter(Boolean).join('\n').trim()
      resolve(output || '(no output)')
    })
  })
}

// =============================================================================
// Read Tool
// =============================================================================

export const readTool = tool({
  description: 'Read the contents of a file. Returns the full text content.',
  inputSchema: z.object({
    file_path: z.string().describe('Absolute or relative path to the file to read'),
    offset: z.number().optional().describe('Line number to start reading from (1-based)'),
    limit: z.number().optional().describe('Maximum number of lines to read')
  }),
  execute: async ({ file_path, offset, limit }) => {
    const pre = await runHook('PreToolUse', {
      tool_name: 'Read',
      tool_input: { file_path }
    })
    if (pre.blocked)
      return `BLOCKED: ${pre.reason}`

    try {
      const safePath = validateToolPath(file_path)
      let content = await readFile(safePath, 'utf-8')

      if (offset || limit) {
        const lines = content.split('\n')
        const start = (offset || 1) - 1
        const end = limit ? start + limit : lines.length
        content = lines.slice(start, end).join('\n')
      }

      // Truncate very large outputs
      if (content.length > 100000)
        content = content.slice(0, 100000) + '\n... (truncated)'

      await runHook('PostToolUse', {
        tool_name: 'Read',
        tool_input: { file_path },
        output: content.slice(0, 1000)
      })

      return content
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      return `ERROR: ${errorMsg}`
    }
  }
})

// =============================================================================
// Glob Tool
// =============================================================================

export const globTool = tool({
  description: 'Find files matching a glob pattern. Returns a list of matching file paths.',
  inputSchema: z.object({
    pattern: z.string().describe('Glob pattern to match (e.g. "**/*.ts", "src/**/*.vue")'),
    path: z.string().optional().describe('Directory to search in. Defaults to project directory.')
  }),
  execute: async ({ pattern, path: searchPath }) => {
    const pre = await runHook('PreToolUse', {
      tool_name: 'Glob',
      tool_input: { pattern, path: searchPath }
    })
    if (pre.blocked)
      return `BLOCKED: ${pre.reason}`

    try {
      const cwd = searchPath
        ? validateToolPath(searchPath)
        : (process.env.COGNOVA_PROJECT_DIR || process.cwd())

      // Use find + bash globbing as a portable glob implementation
      const result = await execCommand(
        `find ${JSON.stringify(cwd)} -path ${JSON.stringify(`${cwd}/${pattern}`)} -type f 2>/dev/null | head -200`
      )

      await runHook('PostToolUse', {
        tool_name: 'Glob',
        tool_input: { pattern },
        output: result.slice(0, 1000)
      })

      return result || '(no matches)'
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      return `ERROR: ${errorMsg}`
    }
  }
})

// =============================================================================
// Grep Tool
// =============================================================================

export const grepTool = tool({
  description: 'Search file contents for a regex pattern. Returns matching lines with context.',
  inputSchema: z.object({
    pattern: z.string().describe('Regular expression pattern to search for'),
    path: z.string().optional().describe('File or directory to search in. Defaults to project directory.'),
    include: z.string().optional().describe('Glob pattern to filter files (e.g. "*.ts")')
  }),
  execute: async ({ pattern, path: searchPath, include }) => {
    const pre = await runHook('PreToolUse', {
      tool_name: 'Grep',
      tool_input: { pattern, path: searchPath }
    })
    if (pre.blocked)
      return `BLOCKED: ${pre.reason}`

    try {
      const cwd = searchPath
        ? validateToolPath(searchPath)
        : (process.env.COGNOVA_PROJECT_DIR || process.cwd())

      const args = ['grep', '-rn', '--color=never']
      if (include) args.push('--include', include)
      args.push(pattern, cwd)

      const result = await execCommand(args.join(' '))

      await runHook('PostToolUse', {
        tool_name: 'Grep',
        tool_input: { pattern },
        output: result.slice(0, 1000)
      })

      return result || '(no matches)'
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      return `ERROR: ${errorMsg}`
    }
  }
})

// =============================================================================
// Ls Tool (for directory listing)
// =============================================================================

export const lsTool = tool({
  description: 'List files and directories at a given path.',
  inputSchema: z.object({
    path: z.string().describe('Directory path to list')
  }),
  execute: async ({ path: dirPath }) => {
    try {
      const safePath = validateToolPath(dirPath)
      const entries = await readdir(safePath)
      const results: string[] = []

      for (const entry of entries) {
        const fullPath = resolve(safePath, entry)
        const s = await stat(fullPath).catch(() => null)
        if (s)
          results.push(`${s.isDirectory() ? 'd' : '-'} ${entry}`)
      }

      return results.join('\n') || '(empty directory)'
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      return `ERROR: ${errorMsg}`
    }
  }
})

/**
 * Get all tools for non-Claude-Code providers.
 */
export function getAiSdkTools() {
  return {
    bash: bashTool,
    read: readTool,
    glob: globTool,
    grep: grepTool,
    ls: lsTool
  }
}
