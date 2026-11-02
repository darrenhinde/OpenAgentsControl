<!-- Context: openagents-repo/examples | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Example: BaseAdapter Implementation Pattern

**Purpose**: Template Method pattern for AI coding tool adapters

**Last Updated**: 2026-02-04

---

## Core Pattern

Template Method: BaseAdapter defines algorithm structure, subclasses implement tool-specific details.

---

## BaseAdapter Structure

```typescript
export abstract class BaseAdapter {
  abstract name: string
  abstract displayName: string
  
  // Must implement
  abstract toOAC(source: string): Promise<OpenAgent>
  abstract fromOAC(agent: OpenAgent): Promise<ConversionResult>
  abstract getConfigPath(): string
  abstract getCapabilities(): ToolCapabilities
  abstract validateConversion(agent: OpenAgent): string[]
  
  // Shared utilities
  supportsFeature(feature: keyof ToolCapabilities): boolean
  warn(message: string): void
  createSuccessResult(configs, warnings): ConversionResult
  safeParseJSON(content, filename): unknown | null
}
```

---

## ClaudeAdapter Example

```typescript
export class ClaudeAdapter extends BaseAdapter {
  name = 'claude'
  displayName = 'Claude Code'
  
  async toOAC(source: string): Promise<OpenAgent> {
    const config = this.safeParseJSON(source, 'config.json')
    return {
      frontmatter: {
        name: config.name,
        mode: config.mode || 'primary',
        model: this.mapModel(config.model),
        tools: config.tools,
        skills: config.skills?.map(s => ({ name: s }))
      },
      systemPrompt: config.systemPrompt || ''
    }
  }
  
  async fromOAC(agent: OpenAgent): Promise<ConversionResult> {
    const warnings: string[] = []
    
    // Warn on unsupported features
    if (agent.frontmatter.temperature) {
      warnings.push(this.unsupportedFeatureWarning('temperature'))
    }
    
    const config = {
      name: agent.frontmatter.name,
      model: agent.frontmatter.model,
      systemPrompt: agent.systemPrompt,
      tools: agent.frontmatter.tools
    }
    
    return this.createSuccessResult([
      { fileName: '.claude/config.json', content: JSON.stringify(config) }
    ], warnings)
  }
  
  getConfigPath() { return '.claude/' }
  
  getCapabilities(): ToolCapabilities {
    return {
      supportsMultipleAgents: true,
      supportsSkills: true,
      supportsHooks: true,
      supportsTemperature: false
    }
  }
  
  validateConversion(agent: OpenAgent): string[] {
    return agent.frontmatter.name ? [] : ['Agent name required']
  }
}
```

---

## Key Methods

### toOAC()
Parse tool format → OpenAgent object

**Steps**: Parse source → Map fields → Validate with Zod → Return

---

### fromOAC()
Convert OpenAgent → tool format

**Steps**: Validate → Map fields → Detect unsupported features → Generate warnings → Create files

---

### getCapabilities()
Declare supported features

```typescript
{
  supportsMultipleAgents: boolean
  supportsSkills: boolean
  supportsHooks: boolean
  supportsGranularPermissions: boolean
  supportsTemperature: boolean
}
```

---

## Utility Usage

```typescript
// Safe parsing
const config = this.safeParseJSON(content, 'config.json')

// Feature checks
if (this.supportsFeature('supportsTemperature')) {
  config.temperature = agent.frontmatter.temperature
}

// Warnings
if (!this.supportsFeature('supportsHooks')) {
  warnings.push(this.unsupportedFeatureWarning('hooks'))
}

// Results
return this.createSuccessResult([{ fileName: 'config.json', content }], warnings)
```

---

## Design Principles

1. **Template Method** - Base defines structure, subs fill details
2. **Pure toOAC/fromOAC** - Deterministic conversion
3. **Capabilities First** - Declare support upfront
4. **Graceful Degradation** - Warn, don't fail
5. **Validate Early** - Check before converting

---

## Testing Pattern

```typescript
describe('ClaudeAdapter', () => {
  it('converts OAC to Claude', async () => {
    const agent: OpenAgent = { /* ... */ }
    const result = await adapter.fromOAC(agent)
    
    expect(result.success).toBe(true)
    expect(result.configs[0].fileName).toBe('.claude/config.json')
  })
  
  it('warns on unsupported temperature', async () => {
    const agent: OpenAgent = { frontmatter: { temperature: 0.7 } }
    const result = await adapter.fromOAC(agent)
    
    expect(result.warnings).toContainEqual(
      expect.stringContaining('temperature')
    )
  })
})
```

---

## Reference

- **Implementation**: `packages/agent-compiler/src/adapters/BaseAdapter.ts`
- **Adapters**: `ClaudeAdapter.ts`, `CursorAdapter.ts`, `WindsurfAdapter.ts`
- **Related**:
  - concepts/compatibility-layer.md
  - examples/zod-schema-migration.md
  - guides/compatibility-layer-workflow.md
