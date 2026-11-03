---
description: "Test command to verify auto-detection and registry updates work correctly"
oac:
  id: test-new-command
  name: Test New Command
  category: standard
  targets: [opencode, opencode-v1]
---

# Test New Command

This is a test command created to verify that the auto-detection system works.

## Usage

```bash
/test-new-command
```

## Features

- Auto-detected by the system
- Automatically added to registry
- Validates the build system works

## Testing

This file should be:
1. Detected by `auto-detect-components.sh`
2. Added to built-ai-configs/registry/registry.json automatically
3. Validated by `validate-registry.sh`
