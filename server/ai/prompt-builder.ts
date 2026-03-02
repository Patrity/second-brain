import { join } from 'path'
import { readFile, readdir, stat } from 'fs/promises'
import { getSkillsDir, parseSkillFrontmatter } from '~~/server/utils/skills-path'
import { runHook } from './hooks'

/**
 * Build a system prompt for non-Claude-Code providers.
 *
 * Reads CLAUDE.md, active skill descriptions, and matching rules,
 * then assembles them into a single system prompt string.
 * Also runs the SessionStart hook and includes its output.
 */
export async function buildSystemPrompt(): Promise<string> {
  const sections: string[] = []

  // 1. CLAUDE.md
  const claudeMd = await readClaudeMd()
  if (claudeMd)
    sections.push(`# Project Instructions\n\n${claudeMd}`)

  // 2. Active skills
  const skills = await readSkillDescriptions()
  if (skills)
    sections.push(`# Available Skills\n\n${skills}`)

  // 3. Rules
  const rules = await readRules()
  if (rules)
    sections.push(`# Rules\n\n${rules}`)

  // 4. SessionStart hook output (memory context, bridge context, etc.)
  const hookResult = await runHook('SessionStart')
  if (hookResult.output)
    sections.push(hookResult.output)

  return sections.join('\n\n---\n\n')
}

/**
 * Read the project's CLAUDE.md file.
 */
async function readClaudeMd(): Promise<string | null> {
  const projectDir = process.env.COGNOVA_PROJECT_DIR || process.cwd()
  const paths = [
    join(projectDir, 'CLAUDE.md'),
    join(projectDir, '.claude', 'CLAUDE.md')
  ]

  for (const p of paths) {
    try {
      return await readFile(p, 'utf-8')
    } catch {
      // Try next path
    }
  }
  return null
}

/**
 * Read active skill descriptions from SKILL.md frontmatter.
 */
async function readSkillDescriptions(): Promise<string | null> {
  const skillsDir = getSkillsDir()

  let entries: string[]
  try {
    entries = await readdir(skillsDir)
  } catch {
    return null
  }

  const lines: string[] = []

  for (const entry of entries) {
    if (entry.startsWith('_')) continue
    const skillMdPath = join(skillsDir, entry, 'SKILL.md')
    try {
      const content = await readFile(skillMdPath, 'utf-8')
      const meta = parseSkillFrontmatter(content)
      if (meta.name && meta.description)
        lines.push(`- **${meta.name}**: ${meta.description}`)
    } catch {
      // Skip skills without SKILL.md
    }
  }

  return lines.length > 0 ? lines.join('\n') : null
}

/**
 * Read rule files from the project's .claude/rules/ directory.
 */
async function readRules(): Promise<string | null> {
  const projectDir = process.env.COGNOVA_PROJECT_DIR || process.cwd()

  // Check both published and dev rule locations
  const rulesDirs = [
    join(projectDir, 'Claude', 'rules'),
    join(projectDir, '.claude', 'rules')
  ]

  const ruleTexts: string[] = []

  for (const rulesDir of rulesDirs) {
    const dirStat = await stat(rulesDir).catch(() => null)
    if (!dirStat?.isDirectory()) continue

    let entries: string[]
    try {
      entries = await readdir(rulesDir)
    } catch {
      continue
    }

    for (const file of entries) {
      if (!file.endsWith('.md')) continue
      try {
        const content = await readFile(join(rulesDir, file), 'utf-8')
        ruleTexts.push(content)
      } catch {
        // Skip unreadable files
      }
    }
  }

  return ruleTexts.length > 0 ? ruleTexts.join('\n\n') : null
}
