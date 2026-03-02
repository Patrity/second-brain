import { cpSync, rmSync, mkdirSync, existsSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'
import * as p from '@clack/prompts'
import { getPackageDir } from './paths'
import type { SecondBrainMetadata } from './types'

/** Files/dirs to preserve during updates (never overwrite) */
const PRESERVE_ON_UPDATE = new Set([
  '.env',
  '.api-token',
  '.cognova',
  'node_modules',
  'ecosystem.config.cjs',
  'logs',
  '.update-backup'
])

/** Copy app source files from the npm package to the install directory */
export function copyAppSource(sourceDir: string, installDir: string) {
  mkdirSync(installDir, { recursive: true })

  // Directories/files that make up the app source
  const appItems = [
    'app',
    'server',
    'shared',
    'Claude',
    '.output',
    'nuxt.config.ts',
    'tsconfig.json',
    'drizzle.config.ts',
    'package.json',
    'pnpm-lock.yaml',
    '.env.example'
  ]

  for (const item of appItems) {
    const src = join(sourceDir, item)
    if (!existsSync(src)) continue

    const dest = join(installDir, item)

    // Skip items that should be preserved during updates
    if (PRESERVE_ON_UPDATE.has(item) && existsSync(dest)) continue

    // Remove existing destination first to avoid stale files / broken symlinks
    if (existsSync(dest))
      rmSync(dest, { recursive: true, force: true })

    cpSync(src, dest, { recursive: true, force: true })
  }
}

/** Set up initial install from the npm package */
export async function setupInstallDir(installDir: string): Promise<void> {
  if (existsSync(installDir) && readdirSync(installDir).length > 0) {
    const overwrite = await p.confirm({
      message: `${installDir} already exists and is not empty. Continue?`,
      initialValue: false
    })
    if (p.isCancel(overwrite) || !overwrite) process.exit(0)
  }

  const packageDir = getPackageDir()
  const s = p.spinner()
  s.start('Copying application files')
  copyAppSource(packageDir, installDir)
  s.stop('Application files installed')
}

/** Write .cognova metadata file */
export function writeMetadata(
  installDir: string,
  vaultPath: string,
  version: string,
  dbPassword?: string,
  dbPort?: number,
  channel?: string
) {
  const metadata: SecondBrainMetadata = {
    version,
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    installDir,
    vaultPath,
    dbPassword,
    dbPort,
    channel
  }

  // Write to install dir
  writeFileSync(join(installDir, '.cognova'), JSON.stringify(metadata, null, 2))

  // Also write a pointer in home dir so CLI can find the install from anywhere
  const homeMeta = join(process.env.HOME || '~', '.cognova')
  writeFileSync(homeMeta, JSON.stringify(metadata, null, 2))
}
