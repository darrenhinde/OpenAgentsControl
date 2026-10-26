# Tool Template

This is a template for creating new tools in the modular structure.

## How to Create a New Tool

1. **Copy this template directory:**
   ```bash
   cp -r template/ your-tool-name/
   ```

2. **Edit `index.ts`:**
   - Replace `exampleFunction` with your tool's logic
   - Update the tool definition with proper description and args
   - Export your functions and tool

3. **Add to main index:**
   - Add the tool definition (only the `tool({...})` export) to `/tool/index.ts`:
   ```typescript
   export { yourTool } from "./your-tool-name"
   ```
   - Do not re-export plain helper functions there: OpenCode treats every export of
     `/tool/index.ts` as a tool, and 1.14.49+ fails on the first prompt when one is not.

4. **Test your tool:**
   ```bash
   bun -e "import('./your-tool-name/index.ts').then(m => console.log('Exports:', Object.keys(m)))"
   ```

## Structure

```
your-tool-name/
└── index.ts          # All tool functionality
```

Keep it simple - one file per tool with all functionality included.