import { execSync } from 'child_process'
import { existsSync, cpSync, rmSync } from 'fs'
import { join } from 'path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { findInstallDir, readMetadata } from '../lib/paths'
import { copyAppSource, writeMetadata } from '../lib/install'
import { syncClaudeConfig } from '../lib/claude-config'
import { loadEnvFile } from '../lib/config'
import { restartDaemon } from '../lib/daemon'

/** Directories/files that make up the app source (backed up before update) */
const BACKUP_ITEMS = [
  'app',
  'server',
  'shared',
  'Claude',
  '.output',
  'nuxt.config.ts',
  'tsconfig.json',
  'drizzle.config.ts',
  'package.json',
  'pnpm-lock.yaml'
]

function createBackup(installDir: string): string {
  const backupDir = join(installDir, '.update-backup')
  if (existsSync(backupDir))
    rmSync(backupDir, { recursive: true })

  for (const item of BACKUP_ITEMS) {
    const src = join(installDir, item)
    if (!existsSync(src)) continue
    const dest = join(backupDir, item)
    cpSync(src, dest, { recursive: true })
  }

  return backupDir
}

function restoreBackup(installDir: string, backupDir: string) {
  for (const item of BACKUP_ITEMS) {
    const src = join(backupDir, item)
    if (!existsSync(src)) continue
    const dest = join(installDir, item)
    if (existsSync(dest))
      rmSync(dest, { recursive: true })
    cpSync(src, dest, { recursive: true })
  }
}

function cleanupBackup(backupDir: string) {
  if (existsSync(backupDir))
    rmSync(backupDir, { recursive: true })
}

export async function update() {
  // Parse --channel flag: defaults to 'latest' which also acts as "switch back to stable"
  const args = process.argv.slice(2)
  const channelIdx = args.indexOf('--channel')
  const channel = channelIdx !== -1 ? (args[channelIdx + 1] || 'latest') : 'latest'
  const npmTag = channel === 'latest' ? 'latest' : channel

  p.intro(pc.bgCyan(pc.black(' Cognova Update ')))

  const installDir = findInstallDir()
  const metadata = readMetadata(installDir)

  if (!metadata) {
    p.log.error('No Cognova installation found. Run `cognova init` first.')
    process.exit(1)
  }

  const currentChannel = metadata.channel || 'latest'
  if (channel !== currentChannel)
    p.log.info(`Switching channel: ${pc.yellow(`@${currentChannel}`)} → ${pc.cyan(`@${channel}`)}`)
  else
    p.log.info(`Channel: ${pc.cyan(`@${channel}`)}`)

  const s = p.spinner()

  // Check for newer version on the target channel
  s.start(`Checking for updates on @${channel}`)
  let latestVersion: string
  try {
    latestVersion = execSync(`npm view cognova@${npmTag} version`, { encoding: 'utf-8' }).trim()
  } catch {
    s.stop('Could not check npm registry')
    p.log.warn('Unable to check for updates. Rebuilding current version.')
    latestVersion = metadata.version
  }

  if (latestVersion === metadata.version && channel === currentChannel) {
    s.stop(`Already on ${latestVersion} (@${channel})`)
    p.outro('Nothing to update.')
    return
  }

  s.stop(`Update available: ${metadata.version} → ${pc.green(latestVersion)} (@${channel})`)

  // Create backup before making any changes
  s.start('Creating backup')
  const backupDir = createBackup(installDir)
  s.stop('Backup created')

  let updateFailed = false

  try {
    // Download and extract latest
    s.start('Downloading latest version')
    const tmpDir = execSync('mktemp -d', { encoding: 'utf-8' }).trim()
    try {
      execSync(`npm pack cognova@${latestVersion} --pack-destination ${tmpDir}`, { stdio: 'pipe' })
      execSync(`tar -xzf ${tmpDir}/cognova-${latestVersion}.tgz -C ${tmpDir}`, { stdio: 'pipe' })
      copyAppSource(`${tmpDir}/package`, installDir)
      s.stop('Source files updated')
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }

    // Sync bundled Claude config (skills, hooks, rules) to ~/.claude/
    s.start('Syncing Claude config')
    syncClaudeConfig(installDir)
    s.stop('Claude config synced (skills, hooks, rules)')

    // Load .env from install dir so child processes get DATABASE_URL etc.
    const dotenv = loadEnvFile(installDir)
    const envWithDotenv = { ...process.env, ...dotenv }

    // Rebuild
    s.start('Installing dependencies')
    execSync('pnpm install', { cwd: installDir, stdio: 'pipe' })
    // Rebuild native addons (node-pty etc.) for this machine's architecture
    execSync('pnpm rebuild', { cwd: installDir, stdio: 'pipe' })
    s.stop('Dependencies installed')

    // Run database migrations
    s.start('Running database migrations')
    execSync('pnpm db:migrate', { cwd: installDir, stdio: 'pipe', env: envWithDotenv })
    s.stop('Migrations complete')

    // Update the global CLI binary so `cognova -v`, `--channel`, etc. stay current
    s.start('Updating CLI')
    try {
      const cmd = process.platform === 'linux'
        ? `sudo npm install -g cognova@${latestVersion}`
        : `npm install -g cognova@${latestVersion}`
      execSync(cmd, { stdio: process.platform === 'linux' ? 'inherit' : 'pipe' })
      s.stop('CLI updated')
    } catch {
      s.stop('CLI update skipped — run manually: npm install -g cognova@' + latestVersion)
    }
  } catch (err) {
    updateFailed = true
    s.stop(pc.red('Update failed'))

    const execErr = err as { message?: string, stderr?: Buffer | string, stdout?: Buffer | string }
    p.log.error(`Error: ${execErr.message || err}`)
    if (execErr.stdout)
      p.log.error(pc.dim(String(execErr.stdout).trim()))
    if (execErr.stderr)
      p.log.error(pc.dim(String(execErr.stderr).trim()))
    p.log.step(pc.bold('Rolling back'))

    const rollbackSpinner = p.spinner()
    rollbackSpinner.start('Restoring previous version')
    try {
      restoreBackup(installDir, backupDir)

      // Reinstall dependencies for the restored version
      execSync('pnpm install', { cwd: installDir, stdio: 'pipe' })

      rollbackSpinner.stop('Previous version restored')
      p.log.info('Your previous installation has been restored.')
    } catch (rollbackErr) {
      rollbackSpinner.stop(pc.red('Rollback failed'))
      p.log.error(`Rollback failed: ${rollbackErr instanceof Error ? rollbackErr.message : rollbackErr}`)
      p.log.error(`Manual recovery: backup is at ${backupDir}`)
      p.outro('Update and rollback both failed. See errors above.')
      process.exit(1)
    }
  }

  // Update metadata and clean up backup on success
  if (!updateFailed) {
    // Only persist non-default channel; omit field for 'latest' to keep metadata clean
    const channelToStore = channel === 'latest' ? undefined : channel
    writeMetadata(installDir, metadata.vaultPath, latestVersion, metadata.dbPassword, metadata.dbPort, channelToStore)
    cleanupBackup(backupDir)
  }

  if (updateFailed) {
    p.outro('Update failed. Previous version has been restored. Try again later.')
    process.exit(1)
  }

  // Restart
  s.start('Restarting application')
  try {
    restartDaemon(installDir)
    s.stop('Application restarted')
  } catch {
    s.stop('Restart failed — start manually with `cognova start`')
  }

  p.log.info(`Run ${pc.cyan('cognova reset')} to regenerate CLAUDE.md or settings.json.`)
  p.outro(`Updated to v${latestVersion} (@${channel})`)
}
