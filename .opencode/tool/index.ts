/**
 * OpenCode Gemini Tool - Main entry point
 *
 * Intentionally empty. opencode >= 1.14.49 scans `.opencode/tool/index.ts`
 * as a tool module during ToolRegistry.state(); any re-exports from this
 * barrel cause `TypeError: Object.entries requires that input parameter not
 * be null or undefined` and crash session startup with "Unexpected server
 * error". Tools live in their own subdirectories and are auto-discovered
 * directly (e.g. `./gemini`); consumers should import from those paths.
 *
 * If you need the env helpers, import them directly from "./env":
 *   import { loadEnvVariables, getApiKey } from "./env"
 */
export {}
