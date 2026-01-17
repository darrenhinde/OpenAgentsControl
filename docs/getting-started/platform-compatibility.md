# Platform Compatibility Guide

The OpenAgents Control installer is designed to work across multiple platforms and bash versions.

## Supported Platforms

### ✅ macOS
- **Bash Version:** 3.2+ (default macOS bash is 3.2.57)
- **Installation Method:** curl + bash
- **Status:** Fully Supported

```bash
# Standard installation
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash

# Profile-based installation
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s core
```

**Dependencies:**
```bash
# Install via Homebrew
brew install curl jq
```

---

### ✅ Linux
- **Bash Version:** 3.2+ (most distros ship with 4.0+)
- **Installation Method:** curl + bash
- **Status:** Fully Supported

```bash
# Standard installation
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash

# Profile-based installation
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer
```

**Dependencies:**

<details>
<summary><b>Ubuntu / Debian</b></summary>

```bash
sudo apt-get update
sudo apt-get install curl jq
```
</details>

<details>
<summary><b>Fedora / RHEL / CentOS</b></summary>

```bash
sudo dnf install curl jq
```
</details>

<details>
<summary><b>Arch Linux</b></summary>

```bash
sudo pacman -S curl jq
```
</details>

<details>
<summary><b>Alpine Linux</b></summary>

```bash
apk add curl jq bash
```
</details>

---

### ✅ Windows

#### Option 1: Git Bash (Recommended)
- **Bash Version:** 4.4+ (included with Git for Windows)
- **Installation Method:** curl + bash
- **Status:** Fully Supported

**Install Git for Windows:**
1. Download from [git-scm.com](https://git-scm.com/download/win)
2. Install with default options
3. Open "Git Bash" from Start Menu

**Run Installer:**
```bash
# Standard installation
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash

# Profile-based installation
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s full
```

#### Option 2: WSL (Windows Subsystem for Linux)
- **Bash Version:** 4.0+ (depends on WSL distro)
- **Installation Method:** curl + bash
- **Status:** Fully Supported

**Setup WSL:**
```powershell
# In PowerShell (Admin)
wsl --install
```

**Run Installer:**
```bash
# In WSL terminal
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash
```

**Dependencies:**
```bash
# Ubuntu/Debian on WSL
sudo apt-get update
sudo apt-get install curl jq
```

#### Option 3: PowerShell (Download + Run)
- **Status:** Supported (requires Git Bash installed)

```powershell
# Download the script
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh" -OutFile "install.sh"

# Run with Git Bash
& "C:\Program Files\Git\bin\bash.exe" install.sh core

# Or with WSL
wsl bash install.sh core
```

---

## Requirements

### Minimum Requirements
- **Bash:** 3.2 or higher
- **curl:** Any recent version
- **jq:** 1.5 or higher
- **Disk Space:** ~5MB for full installation
- **Internet:** Required for downloading components

### Tested Configurations

| Platform | Bash Version | Status | Notes |
|----------|--------------|--------|-------|
| macOS 13+ | 3.2.57 | ✅ Pass | Default system bash |
| macOS 13+ | 5.2 (Homebrew) | ✅ Pass | Upgraded bash |
| Ubuntu 24.04 | 5.2.21 | ✅ Pass | Fixed in v1.1.0 |
| Ubuntu 22.04 | 5.1.16 | ✅ Pass | Default |
| Ubuntu 20.04 | 5.0.17 | ✅ Pass | Default |
| Debian 11 | 5.1.4 | ✅ Pass | Default |
| Fedora 38 | 5.2.15 | ✅ Pass | Default |
| Arch Linux | 5.2.21 | ✅ Pass | Default |
| Alpine 3.18 | 5.2.15 | ✅ Pass | Requires bash package |
| Git Bash (Windows) | 4.4.23 | ✅ Pass | Git for Windows |
| WSL2 Ubuntu | 5.1.16 | ✅ Pass | Default |

---

## Compatibility Features

### Bash 3.2 Compatibility
The installer is specifically designed to work with bash 3.2 (macOS default):

✅ **No `mapfile` usage** - Uses while-read loops instead  
✅ **No process substitution issues** - Uses temp files for compatibility  
✅ **POSIX-compliant** - Avoids bash 4+ specific features  
✅ **Array operations** - Uses bash 3.2 compatible syntax  

### Bash 5.x Compatibility (Fixed in v1.1.0)
The installer now works correctly with bash 5.x (Ubuntu 24.04, modern Linux):

✅ **set -e compatible arithmetic** - Uses `variable=$((variable + 1))` instead of `((variable++))`  
✅ **No premature exits** - Fixed issue where counters starting at 0 caused script exit  
✅ **Tested on bash 5.2.21** - Fully compatible with Ubuntu 24.04 and newer systems  

**What was fixed:**
- Changed all arithmetic increment operations from `((variable++))` to `variable=$((variable + 1))`
- This prevents `set -e` from triggering exit when variables start at 0
- Maintains error detection while ensuring compatibility across all bash versions

### Cross-Platform Features
✅ **Platform detection** - Automatically detects macOS/Linux/Windows  
✅ **Color support detection** - Disables colors on unsupported terminals  
✅ **Path handling** - Works with Unix and Windows paths (tilde expansion, backslash conversion)  
✅ **Line endings** - Handles both LF and CRLF  
✅ **Custom install directories** - Supports local, global, and custom installation paths  

---

## Testing Your System

Run the compatibility test to verify your system:

```bash
# Download and run the test
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/scripts/tests/test-compatibility.sh | bash
```

Or manually:

```bash
# Clone the repo
git clone https://github.com/darrenhinde/OpenAgentsControl.git
cd OpenAgentsControl

# Run the test
bash scripts/tests/test-compatibility.sh
```

The test checks:
- ✅ Bash version (3.2+)
- ✅ Required dependencies (curl, jq)
- ✅ Script syntax
- ✅ Argument parsing
- ✅ Array operations
- ✅ File operations
- ✅ Network connectivity

---

## Troubleshooting

### Script exits immediately on Ubuntu 24.04 / bash 5.x
**Cause:** Older versions of the installer had a `set -e` compatibility issue with bash 5.x  
**Status:** ✅ **FIXED in v1.1.0**  
**Solution:** Update to the latest installer:
```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh > install.sh
bash install.sh developer
```

**Technical Details:**
- Issue: `((variable++))` returns 0 when variable is 0, triggering `set -e` exit in bash 5.x
- Fix: Changed to `variable=$((variable + 1))` which is safe with `set -e`
- Affected: Ubuntu 24.04 (bash 5.2.21) and other modern Linux distributions
- All arithmetic operations now use the safe pattern

### "mapfile: command not found"
**Cause:** Using bash version < 4.0  
**Solution:** This should be fixed in the latest version. Update the installer:
```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh > install.sh
bash install.sh developer
```

### "curl: command not found"
**Cause:** curl is not installed  
**Solution:**
```bash
# macOS
brew install curl

# Ubuntu/Debian
sudo apt-get install curl

# Fedora/RHEL
sudo dnf install curl

# Windows: Install Git for Windows (includes curl)
```

### "jq: command not found"
**Cause:** jq is not installed  
**Solution:**
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Fedora/RHEL
sudo dnf install jq

# Windows Git Bash
curl -L -o /usr/bin/jq.exe https://github.com/stedolan/jq/releases/latest/download/jq-win64.exe
```

### Colors not displaying correctly (Windows)
**Cause:** Terminal doesn't support ANSI colors  
**Solution:** Use Windows Terminal, Git Bash, or WSL instead of cmd.exe

### "Permission denied" errors
**Cause:** Insufficient permissions  
**Solution:**
```bash
# Don't use sudo with the installer
# It installs to .opencode/ in current directory

# If you need to install globally:
sudo bash install.sh core
```

### Script fails on Windows PowerShell
**Cause:** PowerShell can't run bash scripts directly  
**Solution:** Use Git Bash or WSL:
```powershell
# Download first
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh" -OutFile "install.sh"

# Run with Git Bash
& "C:\Program Files\Git\bin\bash.exe" install.sh
```

---

## Known Limitations

### Windows cmd.exe
❌ **Not Supported** - Use Git Bash or WSL instead

### Bash < 3.2
❌ **Not Supported** - Upgrade bash or use a different system

### No Internet Connection
❌ **Not Supported** - Installer requires internet to download components  
**Workaround:** Use manual installation (clone repo and copy files)

---

## Manual Installation (No Internet)

If you can't use the installer:

```bash
# 1. Clone or download the repository
git clone https://github.com/darrenhinde/OpenAgentsControl.git
cd OpenAgentsControl

# 2. Copy to OpenCode directory
mkdir -p ~/.opencode
cp -r .opencode/agent ~/.opencode/
cp -r .opencode/command ~/.opencode/
cp -r .opencode/context ~/.opencode/
cp -r .opencode/tool ~/.opencode/
cp -r .opencode/plugin ~/.opencode/

# 3. Configure environment
cp env.example .env
# Edit .env with your settings
```

---

## Getting Help

If you encounter issues:

1. **Run the compatibility test:**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/scripts/tests/test-compatibility.sh | bash
   ```

2. **Check your bash version:**
   ```bash
   bash --version
   ```

3. **Verify dependencies:**
   ```bash
   curl --version
   jq --version
   ```

4. **Report issues:**
   - [GitHub Issues](https://github.com/darrenhinde/OpenAgentsControl/issues)
   - Include: Platform, Bash version, Error message

---

## Summary

✅ **macOS** - Works out of the box (bash 3.2+)  
✅ **Linux** - Works on all major distributions  
✅ **Windows** - Use Git Bash or WSL  
✅ **Bash 3.2+** - Fully compatible  
✅ **Cross-platform** - Same commands everywhere  

The installer is designed to "just work" on any modern system with bash 3.2+.
