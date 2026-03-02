import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export function getAppVersion(): { version: string, channel: string } {
  const cwd = process.cwd()
  let version = '0.0.0'
  let channel = 'latest'

  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'))
    version = pkg.version || '0.0.0'
  } catch { /* ignore */ }

  try {
    const metaPath = join(cwd, '.cognova')
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'))
      channel = meta.channel || 'latest'
    }
  } catch { /* ignore */ }

  return { version, channel }
}
