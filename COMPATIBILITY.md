# Cross-Platform Compatibility Summary

## ✅ Fully Tested & Supported

| Platform | Bash Version | Status | Installation Method |
|----------|--------------|--------|---------------------|
| **macOS** | 3.2.57+ | ✅ Works | `curl ... \| bash` |
| **Linux** | 3.2+ | ✅ Works | `curl ... \| bash` |
| **Windows (Git Bash)** | 4.4+ | ✅ Works | `curl ... \| bash` |
| **Windows (WSL)** | 4.0+ | ✅ Works | `curl ... \| bash` |
| **Windows (PowerShell)** | N/A | ✅ Works | Download + Git Bash |

## Quick Start by Platform

### macOS / Linux
```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s essential
```

### Windows (Git Bash)
```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s essential
```

### Windows (PowerShell)
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh" -OutFile "install.sh"
& "C:\Program Files\Git\bin\bash.exe" install.sh essential
```

## Test Your System

```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/scripts/tests/test-compatibility.sh | bash
```

## Key Compatibility Features

✅ **Bash 3.2+ Compatible** - Works on macOS default bash  
✅ **No mapfile** - Uses while-read loops for compatibility  
✅ **No process substitution issues** - Uses temp files  
✅ **Cross-platform paths** - Handles Unix and Windows  
✅ **Color detection** - Disables on unsupported terminals  
✅ **Platform detection** - Auto-detects macOS/Linux/Windows  

## Requirements

- **Bash:** 3.2 or higher
- **curl:** Any recent version
- **jq:** 1.5 or higher

## Full Documentation

See [Platform Compatibility Guide](docs/getting-started/platform-compatibility.md) for:
- Detailed platform instructions
- Troubleshooting guide
- Manual installation steps
- Known limitations

## Issues?

1. Run compatibility test: `bash scripts/tests/test-compatibility.sh`
2. Check bash version: `bash --version`
3. Report issues: [GitHub Issues](https://github.com/darrenhinde/OpenAgentsControl/issues)
