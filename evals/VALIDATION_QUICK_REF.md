# Test Suite Validation - Quick Reference

## 🚀 Quick Commands

```bash
# Validate specific agent
cd evals/framework && npm run validate:suites openagent

# Validate all agents
cd evals/framework && npm run validate:suites:all

# Setup pre-commit hook
./scripts/validation/setup-pre-commit-hook.sh

# Run tests with validated suite
npm run eval:sdk -- --agent=openagent --suite=core
```

## ✅ Validation Layers

| Layer | When | Command |
|-------|------|---------|
| **IDE** | While editing | Automatic (JSON schema) |
| **Pre-commit** | Before commit | Automatic (if setup) |
| **Manual** | Anytime | `npm run validate:suites` |
| **CI/CD** | On push/PR | Automatic (GitHub Actions) |

## 📋 Required Fields

```json
{
  "name": "Suite Name",
  "description": "What this suite tests",
  "version": "1.0.0",
  "agent": "openagent",
  "totalTests": 3,
  "estimatedRuntime": "3-5 minutes",
  "tests": [
    {
      "id": 1,
      "name": "Test Name",
      "path": "category/test-file.yaml",
      "category": "critical-rules",
      "priority": "critical"
    }
  ]
}
```

## 🎯 Valid Enum Values

**Agent:** `openagent` | `opencoder`

**Category:**
- `critical-rules`
- `workflow-stages`
- `delegation`
- `execution-paths`
- `edge-cases`
- `integration`
- `negative`
- `behavior`
- `tool-usage`

**Priority:** `critical` | `high` | `medium` | `low`

## 🔧 Common Fixes

### Missing Field
```json
// ❌ Error: agent: Required
{
  "name": "My Suite",
  "version": "1.0.0"
}

// ✅ Fixed
{
  "name": "My Suite",
  "version": "1.0.0",
  "agent": "openagent"
}
```

### Invalid Version
```json
// ❌ Error: version must match pattern ^\d+\.\d+\.\d+$
"version": "1.0"

// ✅ Fixed
"version": "1.0.0"
```

### Invalid Path
```json
// ❌ Error: path must end with .yaml
"path": "tests/my-test.yml"

// ✅ Fixed
"path": "tests/my-test.yaml"
```

### Missing Test File
```json
// ❌ Error: Required test file not found
"path": "01-critical-rules/wrong-path.yaml"

// ✅ Fixed (check actual file name)
"path": "01-critical-rules/approval-gate/05-approval-before-execution-positive.yaml"
```

## 📁 File Locations

```
evals/
├── agents/
│   └── openagent/
│       └── config/
│           ├── suite-schema.json       # JSON Schema
│           ├── core-tests.json         # Core suite
│           └── suites/                 # Custom suites
│               ├── quick.json
│               └── oss.json
└── framework/
    └── src/sdk/
        ├── suite-validator.ts          # TypeScript validator
        └── validate-suites-cli.ts      # CLI tool
```

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| `ajv-cli not found` | `cd evals/framework && npm install` |
| Pre-commit not running | `./scripts/validation/setup-pre-commit-hook.sh` |
| TypeScript errors | `cd evals/framework && npm run build` |
| Validation hangs | Use TypeScript validator: `npm run validate:suites` |

## 📚 Full Documentation

- [Complete Validation Guide](./TEST_SUITE_VALIDATION.md)
- [Suite Configuration README](./agents/openagent/config/README.md)
- [JSON Schema](./agents/openagent/config/suite-schema.json)
