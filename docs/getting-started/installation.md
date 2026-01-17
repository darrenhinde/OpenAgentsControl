# OpenAgents Control Installation Guide

Complete guide to installing OpenAgents Control components using the automated installer script.

---

## Quick Start

### Default Installation (Local Directory)

```bash
# Interactive mode - choose components
bash <(curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh)

# Quick install with profile
bash <(curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh) developer
```

Installs to `.opencode/` in your current directory.

---

## Installation Methods

### 1. Interactive Installation (Recommended for First-Time Users)

Run the installer without arguments to get an interactive experience:

```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash
```

**Interactive Flow:**
1. **Choose Installation Location**
   - Local (`.opencode/` in current directory)
   - Global (`~/.config/opencode/`)
   - Custom (enter any path)

2. **Choose Installation Mode**
   - Quick Install (select a profile)
   - Custom Install (pick individual components)
   - List Available Components

3. **Select Components** (if custom mode)
   - Choose from agents, subagents, commands, tools, contexts, config

4. **Review & Confirm**
   - See what will be installed
   - Confirm installation directory
   - Proceed or cancel

### 2. Profile-Based Installation (Quick Setup)

Install a pre-configured set of components:

```bash
# Essential - Minimal setup with core agents
bash <(curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh) essential

# Developer - Code-focused development tools
bash <(curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh) developer

# Business - Content and business-focused tools
bash <(curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh) business

# Full - Everything except system-builder
bash <(curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh) full

# Advanced - Complete system with all components
bash <(curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh) advanced
```

### 3. Download & Run (For Offline or Repeated Use)

```bash
# Download the installer
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh -o install.sh

# Make it executable
chmod +x install.sh

# Run interactively
./install.sh

# Or with a profile
./install.sh developer
```

---

## Installation Locations

### Local Installation (Default)

Installs to `.opencode/` in your current directory.

**Best for:**
- Project-specific agents
- Testing and development
- Multiple isolated installations

```bash
# Default behavior
./install.sh developer

# Explicit local installation
./install.sh developer --install-dir .opencode
```

**Result:**
```
your-project/
├── .opencode/
│   ├── agent/
│   ├── command/
│   ├── context/
│   └── tool/
└── your-project-files...
```

### Global Installation

Installs to `~/.config/opencode/` for user-wide access.

**Best for:**
- System-wide agent availability
- Single installation for all projects
- Consistent agent versions

```bash
# Using CLI argument
./install.sh developer --install-dir ~/.config/opencode

# Using environment variable
export OPENCODE_INSTALL_DIR=~/.config/opencode
./install.sh developer
```

**Result:**
```
~/.config/
└── opencode/
    ├── agent/
    ├── command/
    ├── context/
    └── tool/
```

### Custom Installation

Install to any directory you choose.

**Best for:**
- Custom organizational structures
- Shared team installations
- Non-standard setups

```bash
# Custom path
./install.sh developer --install-dir ~/my-agents

# Path with spaces (use quotes)
./install.sh developer --install-dir "~/My Agents/opencode"

# Absolute path
./install.sh developer --install-dir /opt/opencode
```

---

## Installation Directory Options

### CLI Argument

Use `--install-dir` to specify installation directory:

```bash
# Format 1: --install-dir=PATH
./install.sh developer --install-dir=~/.config/opencode

# Format 2: --install-dir PATH
./install.sh developer --install-dir ~/.config/opencode
```

### Environment Variable

Set `OPENCODE_INSTALL_DIR` for persistent configuration:

```bash
# Set once, use multiple times
export OPENCODE_INSTALL_DIR=~/.config/opencode

# Now all installations use this directory
./install.sh developer
./install.sh --list
```

**Add to your shell profile for persistence:**
```bash
# ~/.bashrc or ~/.zshrc
export OPENCODE_INSTALL_DIR=~/.config/opencode
```

### Interactive Selection

When running in interactive mode, you'll be prompted to choose:

```
Choose installation location:

  1) Local - Install to .opencode/ in current directory
     (Best for project-specific agents)
     
  2) Global - Install to ~/.config/opencode/
     (Best for user-wide agents available everywhere)
     
  3) Custom - Enter exact path
     Examples:
       Linux/Mac:  /home/user/my-agents or ~/my-agents
       Windows:    C:/Users/user/my-agents or ~/my-agents
     
Enter your choice [1-3]:
```

### Priority Order

Installation directory is determined by (highest to lowest priority):

1. `--install-dir` CLI argument
2. `OPENCODE_INSTALL_DIR` environment variable
3. Interactive selection (if in interactive mode)
4. Default: `.opencode`

---

## Platform-Specific Installation

### Linux

```bash
# Standard installation
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer

# Global installation
./install.sh developer --install-dir ~/.config/opencode

# System-wide (requires sudo)
sudo ./install.sh developer --install-dir /opt/opencode
```

### macOS

```bash
# Standard installation
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer

# Global installation (XDG standard)
./install.sh developer --install-dir ~/.config/opencode

# macOS native location
./install.sh developer --install-dir ~/Library/Application\ Support/opencode
```

### Windows (Git Bash)

```bash
# Standard installation
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer

# Global installation
./install.sh developer --install-dir ~/.config/opencode

# Windows-style path
./install.sh developer --install-dir C:/Users/username/opencode
```

### Windows (WSL)

```bash
# Same as Linux
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer

# Global installation
./install.sh developer --install-dir ~/.config/opencode
```

---

## Available Profiles

### Essential
**Minimal setup with core agents**

Components:
- Core agents: openagent
- Essential contexts
- Basic configuration

```bash
./install.sh essential
```

### Developer
**Code-focused development tools**

Components:
- Development agents: openagent, opencoder, task-manager
- Code subagents: reviewer, tester, coder-agent, build-agent
- Development commands: test, commit, context
- Development tools and contexts

```bash
./install.sh developer
```

### Business
**Content and business-focused tools**

Components:
- Business agents
- Content creation tools
- Documentation agents
- Business contexts

```bash
./install.sh business
```

### Full
**Everything except system-builder**

Components:
- All agents and subagents
- All commands
- All tools
- All contexts
- All configuration

```bash
./install.sh full
```

### Advanced
**Complete system with all components**

Components:
- Everything in Full profile
- System-builder agents
- Advanced configuration
- Complete toolset

```bash
./install.sh advanced
```

---

## Post-Installation

### 1. Verify Installation

```bash
# Check installed files
ls -la .opencode/

# Or for global installation
ls -la ~/.config/opencode/
```

### 2. Configure Environment

```bash
# Copy example environment file
cp env.example .env

# Edit with your settings
nano .env
```

### 3. Start Using OpenCode

```bash
# Run OpenCode CLI
opencode

# Or use specific agents/commands
# (depends on your OpenCode CLI setup)
```

---

## Collision Handling

When installing into an existing directory, the installer detects file collisions and offers 4 options:

### Option 1: Skip Existing (Safest)
- Only install new files
- Keep all existing files unchanged
- Your customizations are preserved

### Option 2: Overwrite All (Destructive)
- Replace all existing files with new versions
- Your customizations will be lost
- Requires confirmation

### Option 3: Backup & Overwrite (Recommended)
- Backs up existing files to `.opencode.backup.{timestamp}/`
- Then installs new versions
- You can restore from backup if needed

### Option 4: Cancel
- Exit without making changes

**See [Collision Handling Guide](collision-handling.md) for detailed information.**

---

## Updating Installations

### Add New Components

```bash
# Run installer again with "Skip existing" option
./install.sh developer

# When prompted for collision handling, choose:
# Option 1: Skip existing
```

Only new components will be installed, existing files remain unchanged.

### Update All Components

```bash
# Run installer with "Backup & overwrite" option
./install.sh developer

# When prompted for collision handling, choose:
# Option 3: Backup & overwrite
```

All components updated, backup created for safety.

### Migrate to Different Location

```bash
# Option 1: Move existing installation
mv .opencode ~/.config/opencode

# Option 2: Fresh install to new location
./install.sh developer --install-dir ~/.config/opencode
```

---

## Troubleshooting

### Dependencies Missing

**Error:** `curl: command not found` or `jq: command not found`

**Solution:**
```bash
# macOS
brew install curl jq

# Ubuntu/Debian
sudo apt-get install curl jq

# Fedora/RHEL
sudo dnf install curl jq

# Arch Linux
sudo pacman -S curl jq
```

### Permission Denied

**Error:** `Permission denied` when creating directories

**Solution:**
```bash
# Install to a directory you own
./install.sh developer --install-dir ~/opencode

# Or create parent directory first
mkdir -p ~/.config
./install.sh developer --install-dir ~/.config/opencode
```

### Path with Spaces

**Error:** Installation fails with paths containing spaces

**Solution:**
```bash
# Quote the path
./install.sh developer --install-dir "~/My Agents/opencode"
```

### Parent Directory Doesn't Exist

**Error:** `Parent directory does not exist`

**Solution:**
```bash
# Create parent directory first
mkdir -p ~/.config

# Then install
./install.sh developer --install-dir ~/.config/opencode
```

### Bash Version Too Old

**Error:** `This script requires Bash 3.2 or higher`

**Solution:**
```bash
# Check your bash version
bash --version

# macOS: Install newer bash via Homebrew
brew install bash

# Linux: Update bash via package manager
sudo apt-get update && sudo apt-get upgrade bash
```

---

## Advanced Usage

### View Available Components

```bash
# List all components without installing
./install.sh --list
```

### Get Help

```bash
# Show all options and examples
./install.sh --help
```

### Specify Git Branch

```bash
# Install from a different branch
export OPENCODE_BRANCH=develop
./install.sh developer
```

### Non-Interactive Installation (CI/CD)

```bash
# Set environment variables for automation
export OPENCODE_INSTALL_DIR=/opt/opencode
export OPENCODE_BRANCH=main

# Run with profile (no prompts)
./install.sh developer
```

---

## Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `OPENCODE_INSTALL_DIR` | Installation directory | `.opencode` | `~/.config/opencode` |
| `OPENCODE_BRANCH` | Git branch to install from | `main` | `develop` |

---

## Examples

### Example 1: First-Time Local Installation
```bash
# Download and run installer
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer

# Result: Installs to .opencode/ in current directory
```

### Example 2: Global Installation for All Projects
```bash
# Install to global config directory
./install.sh developer --install-dir ~/.config/opencode

# Now available to all projects
```

### Example 3: Team Shared Installation
```bash
# Install to shared directory
sudo ./install.sh full --install-dir /opt/opencode

# Team members can access from /opt/opencode
```

### Example 4: Multiple Installations
```bash
# Project A - local installation
cd ~/projects/project-a
./install.sh developer

# Project B - different local installation
cd ~/projects/project-b
./install.sh business

# Each project has its own .opencode/ directory
```

### Example 5: Update Existing Installation
```bash
# Run installer again
./install.sh developer

# Choose "Skip existing" to add only new components
# Or "Backup & overwrite" to update everything
```

---

## Next Steps

After installation:

1. **Review Components**
   ```bash
   ls -la .opencode/
   ```

2. **Configure Environment**
   ```bash
   cp env.example .env
   nano .env
   ```

3. **Read Documentation**
   - [Collision Handling](collision-handling.md)
   - [Platform Compatibility](platform-compatibility.md)
   - [Building with OpenCode](../guides/building-with-opencode.md)

4. **Start Using OpenCode**
   ```bash
   opencode
   ```

---

## Getting Help

- **View installer help:** `./install.sh --help`
- **List components:** `./install.sh --list`
- **Documentation:** [GitHub Repository](https://github.com/darrenhinde/OpenAgentsControl)
- **Report issues:** [GitHub Issues](https://github.com/darrenhinde/OpenAgentsControl/issues)

---

## Summary

The OpenAgents Control installer provides:

✅ **Flexible installation locations** - Local, global, or custom  
✅ **Multiple installation methods** - Interactive, profile-based, or custom  
✅ **Cross-platform support** - Linux, macOS, Windows  
✅ **Safe updates** - Collision detection and backup options  
✅ **Easy to use** - Simple commands, clear prompts  

Choose the installation method that fits your needs and get started with OpenAgents Control!
