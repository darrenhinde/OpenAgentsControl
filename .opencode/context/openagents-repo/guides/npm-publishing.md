<!-- Context: openagents-repo/guides | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# NPM Publishing Guide

**Purpose**: Quick reference for publishing OpenAgents Control to npm

**Time to Read**: 3 minutes

---

## Core Concept

OpenAgents Control publishes as `@controlstack/oac` on npm. Users install globally and run `oac [profile]` to set up their projects.

> **Status (2026-07-15):** `@controlstack/oac` is **not published yet** — the scope must be
> claimed first (see Security below). The last published release is the legacy
> `@nextsystems/oac` at **0.7.0**, which gets `npm deprecate`d with a pointer at the new name
> when `@controlstack/oac` first ships.

**Key files**:
- `package.json` - Package configuration
- `bin/oac.js` - CLI entry point
- `.npmignore` - Exclude dev files
- `install.sh` - Main installer (runs when user executes `oac`)

---

## Publishing Workflow

### 1. Prepare Release

```bash
# Update version
npm version patch  # 0.7.0 -> 0.7.1
npm version minor  # 0.7.0 -> 0.8.0

# Update VERSION file
node -p "require('./package.json').version" > VERSION

# Update CHANGELOG.md with changes
```

### 2. Test Locally

```bash
# Create package
npm pack

# Install globally from tarball
npm install -g ./nextsystems-oac-0.7.1.tgz

# Test CLI
oac --version
oac --help

# Uninstall
npm uninstall -g @controlstack/oac
```

### 3. Publish

```bash
# Login (one-time)
npm login

# Publish (scoped packages need --access public)
npm publish --access public
```

### 4. Verify

```bash
# Check it's live
npm view @controlstack/oac

# Test installation
npm install -g @controlstack/oac
oac --version
```

### 5. Create GitHub Release

```bash
git tag v0.7.1
git push --tags
# Create release on GitHub with changelog
```

---

## User Installation

Once published, users can:

```bash
# Global install (recommended)
npm install -g @controlstack/oac
oac developer

# Or use npx (no install)
npx @controlstack/oac developer
```

---

## Common Issues

**"You do not have permission to publish"**
```bash
npm whoami  # Check you're logged in
npm publish --access public  # Scoped packages need public access
```

**"Version already exists"**
```bash
npm version patch  # Bump version first
```

**"You must verify your email"**
```bash
npm profile get  # Check email verification status
```

---

## Package Configuration

**What's included** (see `package.json` → `files`):
- `.opencode/` - Agents, commands, context, profiles, skills, tools
- `scripts/` - Installation scripts
- `bin/` - CLI entry point
- `registry.json` - Component registry
- `install.sh` - Main installer
- Docs (README, CHANGELOG, LICENSE)

**What's excluded** (see `.npmignore`):
- `node_modules/`
- `evals/`
- `.tmp/`
- Dev files

---

## Security

- ✅ Enable 2FA: `npm profile enable-2fa auth-and-writes`
- ✅ Use strong npm password
- ⬜ Claim the `@controlstack` scope on npmjs.com and confirm it is protected (only you can
  publish). Not yet verified — the scope currently holds zero packages. Publishing
  `@controlstack/oac` is blocked until this is done.

---

## References

- **Package**: https://www.npmjs.com/package/@controlstack/oac
- **Stats**: https://npm-stat.com/charts.html?package=@controlstack/oac
- **Codebase**: `package.json`, `bin/oac.js`, `.npmignore`

---

**Last Updated**: 2026-01-30
