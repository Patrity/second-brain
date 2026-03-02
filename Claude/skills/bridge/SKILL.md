---
name: bridge
description: Manage message bridge integrations (Telegram, Discord, iMessage, Google Suite, Email). List, enable, disable, configure, send messages, and look up contacts.
metadata:
  version: "1.0.0"
  requires-secrets: []
  author: Cognova
  repository: ""
  installed-from: ""
---

# Message Bridge Skill

Manage external platform integrations for the message bridge system.

## Commands

> All commands that take a bridge identifier accept a full UUID, a bridge name (case-insensitive), or a short ID prefix (first 8+ characters).

### List all bridges

```bash
python3 ~/.claude/skills/bridge/bridge.py list
```

Shows all configured bridges with their short ID, platform, status, and health. Use the short ID or name with any other command.

### Get bridge details

```bash
python3 ~/.claude/skills/bridge/bridge.py get <NAME_OR_ID>
```

Shows detailed configuration for a specific bridge.

### Create a bridge

```bash
python3 ~/.claude/skills/bridge/bridge.py create --platform <PLATFORM> --name <NAME> [--enabled]
```

Creates a new bridge integration. Platforms: `telegram`, `discord`, `imessage`, `google`, `email`.

### Enable/disable a bridge

```bash
python3 ~/.claude/skills/bridge/bridge.py enable <NAME_OR_ID>
python3 ~/.claude/skills/bridge/bridge.py disable <NAME_OR_ID>
```

### Update bridge config

```bash
python3 ~/.claude/skills/bridge/bridge.py configure <NAME_OR_ID> --config '{"key": "value"}'
```

Updates platform-specific configuration (JSON).

### Delete a bridge

```bash
python3 ~/.claude/skills/bridge/bridge.py delete <NAME_OR_ID>
```

Permanently removes a bridge and all its message history.

### List contacts for a bridge

```bash
python3 ~/.claude/skills/bridge/bridge.py contacts <NAME_OR_ID> [--query "search"] [--limit 50]
```

Lists people who have messaged through this bridge. Returns name, platform ID (needed for sending), message count, and last message time. Use `--query` to filter by name or ID.

### Send a message through a bridge

```bash
python3 ~/.claude/skills/bridge/bridge.py send <NAME_OR_ID> --recipient <RECIPIENT_ID> --text "Hello!"
```

Sends a message to a specific recipient. The `--recipient` is the platform-specific ID (e.g., Telegram chat_id, Discord user_id). Use `contacts` to look up recipient IDs first.

**Workflow for sending a message to someone:**
1. `list` → identify the bridge name for the platform
2. `contacts <NAME> --query "name"` → find the recipient's platform ID
3. `send <NAME> --recipient <ID> --text "message"` → send the message

### Show integration context

```bash
python3 ~/.claude/skills/bridge/bridge.py context
```

Shows the current integration context that gets injected into sessions.

## Natural Language Patterns

- "Set up Telegram" → Create telegram bridge, walk user through BotFather setup
- "Connect Discord" → Create discord bridge, guide through bot setup
- "Enable iMessage" → Check platform, recommend imsg or BlueBubbles
- "Connect my Google Calendar" → Create google bridge with calendar service
- "What integrations do I have?" → Use `list`
- "Disable Discord" → Use `disable`
- "Check bridge status" → Use `list` (shows health)
- "Send a message to X on Telegram" → `contacts telegram --query "X"` → `send telegram --recipient <ID> --text "..."`
- "Who has messaged me on Telegram?" → `contacts telegram`
- "Message @username on Discord" → `contacts discord --query username` → `send discord --recipient <ID> --text "..."`

### Wiring bridge notifications into cron agents

When a user asks to set up a cron/scheduled agent that should notify them (e.g. "send me a daily Discord summary"), follow this workflow before creating the agent:

1. **Check for a connected bridge** — `list` → find the requested platform
   - If no bridge for that platform: offer to set one up first (see Setup Guides below)
   - If bridge exists but health is not `connected`: warn the user before proceeding
2. **Resolve the user's own recipient ID** — `contacts <bridge> --query "<username or name>"` → get their platform ID
   - If not found: ask the user to send the bot a message first so it can learn their ID, then re-run contacts
3. **Create the cron agent** — include the bridge send command directly in the agent's prompt so it fires at the end of each run:

```
POST /api/agents
{
  "name": "Daily Discord Summary",
  "schedule": "0 9 * * *",
  "prompt": "... do the work ... then send a summary:\npython3 ~/.claude/skills/bridge/bridge.py send discord --recipient <RESOLVED_ID> --text \"<summary>\""
}
```

The recipient ID must be resolved at agent-creation time and hardcoded into the prompt — the cron agent has no interactive way to look it up at runtime.

## Setup Guides

### Telegram Setup
1. User creates bot via [@BotFather](https://t.me/BotFather)
2. Store token: `/secret set TELEGRAM_BOT_TOKEN --value "<token>"`
3. Create bridge: `create --platform telegram --name "My Telegram Bot"`
4. Configure: `configure <id> --config '{"botUsername": "my_bot"}'`
5. Enable: `enable <id>`

### Discord Setup
1. User creates bot in Discord Developer Portal
2. Store token: `/secret set DISCORD_BOT_TOKEN --value "<token>"`
3. Create bridge: `create --platform discord --name "My Discord Bot"`
4. Configure listen mode: `configure <id> --config '{"listenMode": "mentions"}'`
5. Enable: `enable <id>`

### iMessage Setup (macOS — imsg)
1. Install: `brew install steipete/tap/imsg`
2. Grant Full Disk Access + Automation permissions
3. Create bridge: `create --platform imessage --name "iMessage"`
4. Configure: `configure <id> --config '{"strategy": "imsg"}'`
5. Enable: `enable <id>`

### iMessage Setup (Remote — BlueBubbles)
1. Install BlueBubbles on Mac
2. Store credentials: `/secret set BLUEBUBBLES_URL --value "..."` and `/secret set BLUEBUBBLES_PASSWORD --value "..."`
3. Create bridge: `create --platform imessage --name "iMessage (BlueBubbles)"`
4. Configure: `configure <id> --config '{"strategy": "bluebubbles"}'`
5. Enable: `enable <id>`

### Google Suite Setup
1. Install: `brew install steipete/tap/gogcli`
2. Set up OAuth: `gog auth credentials <file.json>` then `gog auth add user@gmail.com`
3. Create bridge: `create --platform google --name "Google Suite"`
4. Configure services: `configure <id> --config '{"enabledServices": ["gmail", "calendar"], "account": "user@gmail.com"}'`
5. Enable: `enable <id>`

## Security Rules

1. **Never expose secret values** — Reference secret keys by name only
2. **Always confirm before enabling** — Ask user before activating a bridge
3. **Platform checks** — Only suggest imsg on macOS; suggest BlueBubbles on Linux
