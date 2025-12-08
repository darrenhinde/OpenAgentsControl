# Test Suite Configuration

This directory contains test suite definitions for the OpenAgent evaluation framework.

## 📁 Structure

```
config/
├── suite-schema.json       # JSON Schema for validation
├── core-tests.json         # Core test suite (legacy location)
├── suites/                 # Test suite definitions (recommended)
│   ├── core.json          # Core tests (7 tests, ~5-8 min)
│   ├── quick.json         # Quick smoke tests (3 tests, ~2-3 min)
│   ├── critical.json      # All critical rules (~10 tests)
│   ├── oss.json           # OSS-optimized tests (5 tests)
│   └── custom-*.json      # Your custom suites
└── README.md              # This file
```

## 🎯 Creating a Test Suite

### Step 1: Copy Template

```bash
cp evals/agents/openagent/config/suites/core.json \
   evals/agents/openagent/config/suites/my-suite.json
```

### Step 2: Edit Suite Definition

```json
{
  "name": "My Custom Suite",
  "description": "Tests for specific use case",
  "version": "1.0.0",
  "agent": "openagent",
  "totalTests": 3,
  "estimatedRuntime": "3-5 minutes",
  "tests": [
    {
      "id": 1,
      "name": "Approval Gate",
      "path": "01-critical-rules/approval-gate/05-approval-before-execution-positive.yaml",
      "category": "critical-rules",
      "priority": "critical",
      "required": true,
      "estimatedTime": "30-60s",
      "description": "Validates approval workflow"
    }
  ]
}
```

### Step 3: Validate

```bash
# Validate your suite
npm run validate:suites

# Or validate all suites
npm run validate:suites:all
```

### Step 4: Run Tests

```bash
# Run your custom suite
npm run eval:sdk -- --agent=openagent --suite=my-suite

# With prompt variant
npm run eval:sdk -- --agent=openagent --suite=my-suite --prompt-variant=XOSS
```

## ✅ Validation Layers

### 1. JSON Schema Validation

**File:** `suite-schema.json`

Validates:
- ✅ Required fields present
- ✅ Correct data types
- ✅ Valid enum values (category, priority)
- ✅ Proper format (version, estimatedTime)
- ✅ Path format (must end with .yaml)

**Example Error:**
```
❌ Schema validation failed
   tests[0].priority: Invalid enum value. Expected 'critical' | 'high' | 'medium' | 'low', received 'urgent'
```

### 2. Path Validation

Checks that all test files exist:

```bash
./scripts/validation/validate-test-suites.sh openagent
```

**Example Output:**
```
🔍 Validating Test Suites

Validating: openagent/core
  ✅ Valid (7 tests)

Validating: openagent/my-suite
  ❌ Missing test files (1):
     - 01-critical-rules/approval-gate/WRONG-PATH.yaml
       Did you mean?
         - 05-approval-before-execution-positive.yaml
         - 01-basic-approval.yaml
  ❌ Invalid (1 errors, 0 warnings)
```

### 3. TypeScript Type Safety

**File:** `evals/framework/src/sdk/suite-validator.ts`

Provides compile-time type checking:

```typescript
import { TestSuite, SuiteValidator } from './suite-validator';

// Type-safe suite loading
const validator = new SuiteValidator(agentsDir);
const result = validator.validateSuiteFile('openagent', suitePath);

if (result.valid && result.suite) {
  // result.suite is fully typed!
  const testCount: number = result.suite.totalTests;
  const firstTest: TestDefinition = result.suite.tests[0];
}
```

### 4. Pre-Commit Hook

Automatically validates suites before committing:

```bash
# Setup (one-time)
./scripts/validation/setup-pre-commit-hook.sh

# Now validation runs automatically on commit
git add evals/agents/openagent/config/suites/my-suite.json
git commit -m "Add custom suite"

# Output:
🔍 Validating test suite JSON files...
✅ Test suite validation passed
```

### 5. GitHub Actions (CI/CD)

**File:** `.github/workflows/validate-test-suites.yml`

Runs on:
- Push to `main`
- Pull requests
- Changes to suite files or test files

Automatically comments on PRs if validation fails.

## 📋 Suite Schema Reference

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Human-readable suite name | `"Core Test Suite"` |
| `description` | string | Brief description | `"Essential tests"` |
| `version` | string | Semver version | `"1.0.0"` |
| `agent` | enum | Agent name | `"openagent"` |
| `totalTests` | number | Total test count | `7` |
| `estimatedRuntime` | string | Estimated runtime | `"5-8 minutes"` |
| `tests` | array | Test definitions | See below |

### Test Definition Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | ✅ | Unique test ID (within suite) |
| `name` | string | ✅ | Human-readable test name |
| `path` | string | ✅ | Relative path from `tests/` directory |
| `category` | enum | ✅ | Test category (see below) |
| `priority` | enum | ✅ | Priority level |
| `required` | boolean | ❌ | Whether test must exist (default: true) |
| `estimatedTime` | string | ❌ | Estimated runtime (e.g., "30-60s") |
| `description` | string | ❌ | Brief description |

### Valid Categories

- `critical-rules`
- `workflow-stages`
- `delegation`
- `execution-paths`
- `edge-cases`
- `integration`
- `negative`
- `behavior`
- `tool-usage`

### Valid Priorities

- `critical` - Must pass
- `high` - Important
- `medium` - Standard
- `low` - Nice to have

## 🔧 Validation Commands

```bash
# Validate specific agent
./scripts/validation/validate-test-suites.sh openagent

# Validate all agents
./scripts/validation/validate-test-suites.sh --all

# Via npm (from evals/framework/)
npm run validate:suites          # Current agent
npm run validate:suites:all      # All agents

# Setup pre-commit hook
./scripts/validation/setup-pre-commit-hook.sh
```

## 🚨 Common Errors

### 1. Invalid JSON Syntax

**Error:**
```
❌ Invalid JSON syntax
```

**Fix:** Check for:
- Missing commas
- Trailing commas
- Unquoted keys
- Unclosed brackets

Use a JSON validator or IDE with JSON support.

### 2. Schema Validation Failed

**Error:**
```
❌ Schema validation failed
   version: String must match pattern ^\d+\.\d+\.\d+$
```

**Fix:** Ensure version follows semver format: `"1.0.0"`

### 3. Missing Test Files

**Error:**
```
❌ Missing test files (1):
   - 01-critical-rules/approval-gate/wrong-path.yaml
```

**Fix:** 
1. Check the path is correct
2. Verify file exists in `evals/agents/openagent/tests/`
3. Use suggested similar files

### 4. Test Count Mismatch

**Warning:**
```
⚠️  Test count mismatch: found 6, declared 7
```

**Fix:** Update `totalTests` field to match actual test count.

## 💡 Best Practices

### 1. Use Descriptive Names

```json
// ❌ Bad
"name": "Test 1"

// ✅ Good
"name": "Approval Gate - Positive Case"
```

### 2. Mark Optional Tests

```json
{
  "id": 5,
  "name": "Experimental Feature",
  "path": "experimental/new-feature.yaml",
  "required": false  // Won't fail validation if missing
}
```

### 3. Keep Test IDs Sequential

```json
"tests": [
  { "id": 1, ... },
  { "id": 2, ... },
  { "id": 3, ... }
]
```

### 4. Document Your Rationale

```json
{
  "rationale": {
    "why7Tests": "These 7 tests provide 85% coverage with 90% fewer tests",
    "useCases": [
      "Quick validation before commits",
      "CI/CD pull request checks"
    ]
  }
}
```

### 5. Version Your Suites

When making breaking changes, bump the version:

```json
// Before
"version": "1.0.0"

// After adding new required tests
"version": "2.0.0"
```

## 🔗 Related Documentation

- [Eval Framework Guide](../../../EVAL_FRAMEWORK_GUIDE.md)
- [Test Design Guide](../../../framework/docs/test-design-guide.md)
- [Core Test Suite](./CORE_TESTS.md)

## 🆘 Troubleshooting

### Validation Script Not Found

```bash
# Make sure script is executable
chmod +x scripts/validation/validate-test-suites.sh
```

### ajv-cli Not Installed

```bash
# Install globally
npm install -g ajv-cli

# Or install in framework
cd evals/framework
npm install
```

### Pre-Commit Hook Not Running

```bash
# Re-run setup
./scripts/validation/setup-pre-commit-hook.sh

# Verify hook exists
ls -la .git/hooks/pre-commit
```

## 📞 Support

If you encounter issues:

1. Check this README
2. Run validation with `--debug` flag (coming soon)
3. Check GitHub Actions logs
4. Open an issue with validation output
