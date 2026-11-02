<!-- Context: openagents-repo/examples | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Example: Zod Schema Migration Pattern

**Purpose**: Migrate TypeScript definitions to runtime-validated Zod schemas

**Last Updated**: 2026-02-04

---

## Why Zod?

**Benefits**: Runtime validation + single source of truth + better error messages

---

## Basic Pattern

```typescript
// BEFORE: .d.ts interface
interface AgentFrontmatter {
  name: string
  mode: 'primary' | 'subagent' | 'all'
  temperature?: number
}

// AFTER: Zod schema
import { z } from 'zod'

export const AgentFrontmatterSchema = z.object({
  name: z.string(),
  mode: z.enum(['primary', 'subagent', 'all']),
  temperature: z.number().min(0).max(2).optional()
})

export type AgentFrontmatter = z.infer<typeof AgentFrontmatterSchema>
```

---

## Complex Schema

```typescript
// Granular permissions
export const GranularPermissionSchema = z.object({
  allow: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
  ask: z.array(z.string()).optional()
})

export const PermissionRuleSchema = z.union([
  z.literal('allow'),
  z.literal('deny'),
  z.boolean(),
  GranularPermissionSchema
])

export const ToolAccessSchema = z.object({
  read: PermissionRuleSchema.optional(),
  write: PermissionRuleSchema.optional(),
  bash: PermissionRuleSchema.optional()
})

export type ToolAccess = z.infer<typeof ToolAccessSchema>
```

---

## Validation Usage

```typescript
// Strict parsing (throws on invalid)
const frontmatter = AgentFrontmatterSchema.parse(data)

// Safe parsing (returns result object)
const result = AgentFrontmatterSchema.safeParse(data)

if (result.success) {
  console.log(result.data)  // Typed correctly
} else {
  console.error(result.error.errors)  // Detailed errors
}
```

---

## Common Patterns

### Enums
```typescript
export const ModeSchema = z.enum(['primary', 'subagent']).default('primary')
```

### Arrays
```typescript
export const SkillSchema = z.union([
  z.string(),                    // "skill-name"
  z.object({ name: z.string() }) // { name, config }
])
export const SkillsSchema = z.array(SkillSchema).optional()
```

### Records
```typescript
export const MetadataSchema = z.record(z.unknown())  // { [key: string]: any }
```

### Optionals
```typescript
z.string().optional()        // string | undefined
z.number().default(0.7)      // number with default
```

---

## Full Example: OpenAgent

```typescript
export const OpenAgentSchema = z.object({
  frontmatter: AgentFrontmatterSchema,
  metadata: AgentMetadataSchema.optional(),
  systemPrompt: z.string(),
  contexts: z.array(ContextReferenceSchema).optional()
})

export type OpenAgent = z.infer<typeof OpenAgentSchema>
```

---

## Migration Checklist

- [ ] `interface` → `z.object()`
- [ ] `type X = Y | Z` → `z.union([...])`
- [ ] `?` optional → `.optional()`
- [ ] Add constraints (`.min()`, `.max()`)
- [ ] Export schema AND type
- [ ] Test with valid/invalid data

---

## Testing

```typescript
describe('AgentFrontmatterSchema', () => {
  it('validates correct data', () => {
    expect(() => AgentFrontmatterSchema.parse({
      name: 'TestAgent',
      mode: 'primary'
    })).not.toThrow()
  })
  
  it('rejects invalid mode', () => {
    expect(() => AgentFrontmatterSchema.parse({
      name: 'Test',
      mode: 'invalid'
    })).toThrow()
  })
  
  it('rejects out-of-range temperature', () => {
    expect(() => AgentFrontmatterSchema.parse({
      name: 'Test',
      temperature: 5.0  // Max 2.0
    })).toThrow()
  })
})
```

---

## Key Schemas (Compatibility Layer)

**20+ schemas migrated**:
- `OpenAgentSchema` - Complete agent
- `AgentFrontmatterSchema` - YAML frontmatter
- `ToolAccessSchema` - Tool permissions
- `PermissionRuleSchema` - Permission types
- `SkillReferenceSchema` - Skill definitions
- `HookDefinitionSchema` - Hook configs

---

## Reference

- **Implementation**: `packages/agent-compiler/src/types.ts` (315 lines)
- **Original**: `packages/agent-compiler/dist/src/types.d.ts` (679 lines)
- **Zod Docs**: https://zod.dev
- **Related**:
  - examples/baseadapter-pattern.md
  - concepts/compatibility-layer.md
