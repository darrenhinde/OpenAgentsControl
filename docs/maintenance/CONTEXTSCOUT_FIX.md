# ContextScout Fix - Critical Files Missing from Installer

## Problem
After running the installer, ContextScout fails with errors like:
- "Cannot locate context root"
- "Cannot discover context"
- "paths.json not found"

## Root Cause
Two CRITICAL files required by ContextScout were NOT included in the registry:

1. **paths.json** (`.opencode/context/core/config/paths.json`)
   - Defines the context root location
   - Loaded via @ reference by agents on startup
   - Without it: ContextScout doesn't know where to look for context

2. **navigation.md** (`.opencode/context/navigation.md`)
   - Root navigation file for context discovery
   - ContextScout starts discovery HERE
   - Without it: ContextScout has no entry point for discovery

## Solution

### 1. Added Critical Files to Registry
Created two new registry entries in `built-ai-configs/registry/registry.json`:

```json
{
  "id": "context-paths-config",
  "name": "Context Paths Configuration",
  "type": "context",
  "path": ".opencode/context/core/config/paths.json",
  "description": "CRITICAL: Context root path configuration - loaded via @ reference by agents",
  "tags": ["config", "paths", "critical", "context-system"],
  "dependencies": [],
  "category": "essential"
},
{
  "id": "root-navigation",
  "name": "Root Navigation",
  "type": "context",
  "path": ".opencode/context/navigation.md",
  "description": "CRITICAL: Root navigation file for context discovery - ContextScout starts here",
  "tags": ["navigation", "root", "critical", "context-system"],
  "dependencies": [],
  "category": "essential"
}
```

### 2. Added to All Profiles
Updated all 5 profiles to include these critical files:
- `essential`
- `developer`
- `business`
- `full`
- `advanced`

### 3. Added ContextScout Dependencies
Updated ContextScout's dependencies to explicitly require these files:
```json
"dependencies": [
  "command:check-context-deps",
  "context:registry-dependencies",
  "context:context-system",
  "context:mvi",
  "context:structure",
  "context:workflows",
  "subagent:externalscout",
  "context:root-navigation",
  "context:context-paths-config"
]
```

## Files Modified

### Registry & Configuration
- `built-ai-configs/registry/registry.json` - Added 2 critical context entries, updated ContextScout dependencies

### Profiles
- `.opencode/profiles/essential/profile.json` - Added critical files
- `.opencode/profiles/developer/profile.json` - Added critical files
- `.opencode/profiles/business/profile.json` - Added critical files
- `.opencode/profiles/full/profile.json` - Added critical files
- `.opencode/profiles/advanced/profile.json` - Added critical files

## Validation Results

```
Registry Validator:
✓ Total paths checked:    244
✓ Valid paths:            244
✓ Missing paths:          0
✓ Missing dependencies:   0

Installer File Test:
✓ All files accessible
✓ 0 files would fail
```

## Testing After Fix

1. Run the installer:
```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s essential
```

2. ContextScout should now work without errors:
```bash
opencode
# Then ask ContextScout to discover context
```

3. Verify files were installed:
```bash
ls -la .opencode/context/navigation.md
ls -la .opencode/context/core/config/paths.json
```

## Why This Happened

The installer uses `built-ai-configs/registry/registry.json` to determine which files to download. If a file isn't listed in the registry, it won't be installed. 

These two files were essential infrastructure files that were:
- Referenced by agent code
- Required for ContextScout operation
- Present in the repository
- **BUT** not included in `built-ai-configs/registry/registry.json`

## Prevention

To prevent this in the future:

1. **Always run registry validation before committing:**
```bash
bun run scripts/registry/validate-registry.ts
```

2. **Test the installer after registry changes:**
```bash
./scripts/tests/test-installer-files.sh --local --profile=essential
```

3. **When adding new critical infrastructure files:**
   - Add them to `built-ai-configs/registry/registry.json`
   - Include them in all relevant profiles
   - Add as dependencies to components that require them

## Related Documentation

- See `.opencode/agent/subagents/core/contextscout.md` for ContextScout requirements
- See `.opencode/context/core/config/paths.json` for context path configuration
- See `.opencode/context/navigation.md` for root navigation structure
