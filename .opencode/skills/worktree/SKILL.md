---
name: worktree
description: Git worktree management skill — creates isolated sibling worktrees with auto-computed ports, .env generation, dependency install, and cleanup. Designed for Turborepo/pnpm monorepos but works with any stack.
version: 1.0.0
author: opencode
type: skill
category: development
tags:
  - git
  - worktree
  - ports
  - monorepo
  - turborepo
  - environment
---

# Worktree Skill

> **Purpose**: Create and manage fully isolated git worktrees as sibling directories. Each worktree gets its own port range, `.env` files, and (optionally) a Zellij terminal session — so you can run `main`, a feature branch, and a hotfix simultaneously without anything conflicting.

---

## What I Do

- **Create** a new worktree as a sibling directory with a clean name
- **Compute ports** automatically using an index scheme (no manual port tracking)
- **Generate `.env` files** for each app from a shared `.env.template`
- **Copy secrets** (`.env.local`) from the main worktree
- **Install dependencies** (pnpm / yarn / npm, auto-detected)
- **Launch Zellij** session named after the worktree (if Zellij is installed)
- **Remove** a worktree cleanly — stops Docker, kills Zellij session, prunes branch

---

## Quick Start

```bash
# Create a worktree for a new feature branch
bash .opencode/skills/worktree/router.sh create feature/auth

# Create with a custom short name (used for the directory suffix)
bash .opencode/skills/worktree/router.sh create feature/auth feature-auth

# List all worktrees and their paths
bash .opencode/skills/worktree/router.sh list

# Show port assignments for all worktrees
bash .opencode/skills/worktree/router.sh ports

# Remove a worktree after the branch is merged
bash .opencode/skills/worktree/router.sh remove feature-auth

# Remove but keep the branch
bash .opencode/skills/worktree/router.sh remove feature-auth --keep-branch
```

---

## Directory Structure

Worktrees are created as **siblings** to the main repo, not inside it:

```
~/Documents/github/
  my-app/                       ← main worktree (main branch)
  my-app-feature-auth/          ← created by: create feature/auth
  my-app-bugfix-payments/       ← created by: create bugfix/payments
  my-app-experiment-ai/         ← created by: create experiment/ai
```

Each directory is a full working tree sharing the same `.git` — completely isolated, with its own `.env` files and installed packages.

---

## Port Index Scheme

Each worktree is assigned a numeric **index** derived from how many worktrees exist at the moment `create` runs. The formula is `BASE + (INDEX × 10)`.

How the index is calculated at creation time:
- Only main exists (1 line from `git worktree list`): `1 - 1 = index 0` → main
- main + 1 feature (2 lines): `2 - 1 = index 1` → first feature
- main + 2 features (3 lines): `3 - 1 = index 2` → second feature

| Index | Worktree       | Web  | Admin | API  | DB   | Redis |
|-------|----------------|------|-------|------|------|-------|
| 0     | main           | 3000 | 3001  | 3002 | 5432 | 6379  |
| 1     | first feature  | 3010 | 3011  | 3012 | 5442 | 6389  |
| 2     | second feature | 3020 | 3021  | 3022 | 5452 | 6399  |
| 3     | third feature  | 3030 | 3031  | 3032 | 5462 | 6409  |

> **Note:** If you remove a worktree, its index slot is freed and will be reused by the next `create`. Run `ports` before creating a new worktree to see current assignments.

Run `bash .opencode/skills/worktree/router.sh ports` to see the live table.

---

## `.env.template` Setup

Add a `.env.template` to your repo root (commit it). The script replaces `__PLACEHOLDER__` tokens at worktree creation time.

```bash
# .env.template
WORKTREE_INDEX=__INDEX__
WORKTREE_NAME=__NAME__

WEB_PORT=__WEB_PORT__
ADMIN_PORT=__ADMIN_PORT__
API_PORT=__API_PORT__
DB_PORT=__DB_PORT__
REDIS_PORT=__REDIS_PORT__

DATABASE_URL=postgresql://postgres:postgres@localhost:__DB_PORT__/myapp
REDIS_URL=redis://localhost:__REDIS_PORT__
NEXT_PUBLIC_API_URL=http://localhost:__API_PORT__
```

Generated `.env` files are placed at:
- `{worktree}/.env` — root
- `{worktree}/apps/web/.env` — if directory exists
- `{worktree}/apps/admin/.env` — if directory exists
- `{worktree}/apps/api/.env` — if directory exists

> **Limitation:** Per-app `.env` generation is hardcoded to `apps/web`, `apps/admin`, and `apps/api`. Directories that don't exist are silently skipped. If your monorepo uses different app names, edit `wt-new.sh` lines ~148-151 to match your structure.

Add to `.gitignore`:
```
.env
.env.local
apps/**/.env
apps/**/.env.local
```

---

## Per-App Port Configuration

### Next.js (`apps/web`, `apps/admin`)

Next.js does not read `PORT` from `.env` automatically — pass it via the script:

```json
{
  "scripts": {
    "dev": "dotenv -e .env -- next dev -p $WEB_PORT"
  }
}
```

Install `dotenv-cli` once at the workspace root:
```bash
pnpm add -Dw dotenv-cli
```

### Vite (`apps/admin` or any Vite app)

`vite.config.ts`:
```ts
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      port: Number(env.WEB_PORT || 5173),
      strictPort: true,
    },
  };
});
```

### NestJS (`apps/api`)

`src/main.ts`:
```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.API_PORT || 3002);
}
bootstrap();
```

NestJS picks up `.env` via `@nestjs/config` automatically.

### Turborepo `turbo.json`

Declare port env vars so Turbo doesn't use stale cache across worktrees:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "env": ["WEB_PORT", "ADMIN_PORT", "API_PORT", "DB_PORT", "REDIS_PORT", "WORKTREE_INDEX"]
    },
    "build": {
      "dependsOn": ["^build"],
      "env": ["WEB_PORT", "ADMIN_PORT", "API_PORT"]
    }
  }
}
```

---

## Docker Compose

Use the same env values for fully isolated DB/Redis volumes per worktree:

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    ports:
      - "${DB_PORT:-5432}:5432"
    environment:
      POSTGRES_DB: myapp_${WORKTREE_NAME:-main}
    volumes:
      - pgdata_${WORKTREE_INDEX:-0}:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "${REDIS_PORT:-6379}:6379"

volumes:
  pgdata_0:
  pgdata_1:
  pgdata_2:
  pgdata_3:
```

Run from worktree root:
```bash
docker compose --env-file .env up -d
```

---

## Everyday Workflow

```bash
# 1. Create a worktree for a new feature
bash .opencode/skills/worktree/router.sh create feature/checkout feature-checkout

# 2. In the new directory, start everything
cd ~/Documents/github/my-app-feature-checkout
pnpm dev                                      # all apps on unique ports
docker compose --env-file .env up -d          # DB + Redis isolated

# 3. Check what's running
bash .opencode/skills/worktree/router.sh list
bash .opencode/skills/worktree/router.sh ports

# 4. Clean up after merge
bash .opencode/skills/worktree/router.sh remove feature-checkout
```

---

## Command Reference

| Command | Description |
|---------|-------------|
| `create <branch> [name]` | Create worktree from branch (creates branch if new) |
| `remove <name> [--keep-branch]` | Remove worktree, stop Docker, kill Zellij session |
| `list` | Show all worktrees with paths and branches |
| `ports` | Show port index table for all worktrees |
| `help` | Show usage |

---

## File Structure

```
.opencode/skills/worktree/
├── SKILL.md                    # This file
├── router.sh                   # CLI entry point
└── scripts/
    ├── wt-new.sh               # Create worktree logic
    └── wt-close.sh             # Remove worktree logic
```

---

## Troubleshooting

### "Branch already exists"
The script detects existing local and remote branches and checks them out instead of creating new ones.

### "Directory already exists"
The target sibling directory is already present. Remove it manually or use a different name.

### ".env.template not found"
`.env` generation is skipped. Create a `.env.template` in your repo root to enable it.

### Ports already in use
Run `ports` to see current assignments. If a worktree was removed without pruning, run `git worktree prune` in the main repo to reclaim the index slot.

### Zellij not launching
Zellij is optional. If not installed, the script prints the `cd` path and exits normally.
