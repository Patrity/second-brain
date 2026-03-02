# Contributing to Cognova

Thanks for considering contributing! This is a personal project that I've open-sourced, so contributions are welcome but the scope is intentionally limited to my use cases.

## Ways to Contribute

### Bug Reports

Found a bug? Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Node version, browser)

### Feature Requests

Open an issue describing:
- What you want to accomplish
- Why existing features don't solve it
- Any implementation ideas you have

Note: This is an opinionated tool for my workflow. Features that don't align with the project's direction may be declined, but forks are encouraged.

### Pull Requests

1. Fork the repo
2. Branch off `develop` (`git checkout -b feature/my-feature develop`)
3. Make your changes
4. Run linting (`pnpm lint`)
5. Run type checking (`pnpm typecheck`)
6. Commit with clear messages
7. Open a PR against `develop`

## Development Setup

```bash
git clone https://github.com/patrity/cognova.git
cd cognova
pnpm install
cp .env.example .env
# Edit .env with your VAULT_PATH

# Start local postgres (requires Docker)
pnpm db:up

# Start dev server
pnpm dev

# Run linting
pnpm lint

# Type check
pnpm typecheck

# Build for production
pnpm build
```

## Code Style

- TypeScript with strict mode
- No semicolons
- Single-line if/else when body is one line
- Vue 3 Composition API with `<script setup>`
- Follow existing patterns in the codebase

ESLint handles most formatting - just run `pnpm lint` before committing.

## Project Structure

```
app/
├── components/    # Vue components, organized by feature
├── composables/   # Shared reactive logic
├── layouts/       # Page layouts
└── pages/         # File-based routing

server/
├── api/           # REST endpoints (Nitro)
└── routes/        # WebSocket handlers
```

## Commit Messages

Keep them concise and descriptive:
- `fix: resolve editor crash on empty files`
- `feat: add file search to tree`
- `docs: update deployment guide`

## Releasing (Maintainers)

Cognova is published to npm. Users install and update via the CLI (`cognova init`, `cognova update`).

### Branches

| Branch | Purpose |
|--------|---------|
| `master` | Stable, production-ready. All releases (next and stable) publish from here. |
| `develop` | Active feature development. Merge to master when ready to release. |

### Pre-release (`@next`)

Use this to test changes on a real server without touching `@latest`.

```bash
# 1. Merge develop → master when ready
git checkout master
git merge develop

# 2. Publish pre-release
pnpm release:next
```

This bumps the prerelease version (e.g. `0.3.0-next.0` → `0.3.0-next.1`), builds, publishes to the `@next` npm tag, and pushes the git tag. Test servers can pull it with `cognova update --channel next`.

### Stable Release

```bash
# 1. Merge develop → master (if not already)
git checkout master
git merge develop

# 2. Run the release script
pnpm release:patch   # 0.2.x → 0.2.x+1 (bug fixes)
pnpm release:minor   # 0.x.0 → 0.x+1.0 (new features)
pnpm release:major   # x.0.0 → x+1.0.0 (breaking changes)

# 3. Merge the version bump back to develop
git checkout develop
git merge master
```

The release script bumps the version, builds the app and CLI, publishes to `@latest`, pushes to GitHub, and creates a GitHub Release with auto-generated notes.

### How Users Get Updates

When a user runs `cognova update`, the CLI:
1. Checks npm for the latest version on their channel (`@latest` by default)
2. Downloads the package via `npm pack` (includes pre-built `.output/`)
3. Backs up the current install (automatic rollback on failure)
4. Copies source files, reinstalls native deps, runs migrations
5. Restarts the system service (launchd/systemd)

### Pre-publish Checklist

- [ ] `pnpm lint` passes
- [ ] `pnpm build` succeeds (app output ships in the package)
- [ ] `pnpm cli:build` succeeds
- [ ] `node dist/cli/index.js --help` shows correct version and output
- [ ] `npm pack --dry-run` includes expected files (including `.output/`)

## Questions?

Open an issue or start a discussion. I'll respond when I can.
