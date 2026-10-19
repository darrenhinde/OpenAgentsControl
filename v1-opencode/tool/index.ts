/**
 * OpenCode tool barrel.
 *
 * OpenCode loads every export of a file in `.opencode/tool/` as a tool, so this file
 * re-exports tool definitions ONLY. Plain helpers (generateImage, loadEnvVariables,
 * getApiKey, ...) must not be re-exported here: OpenCode 1.14.49 and later fail on the
 * first prompt when a tool module exports something that is not a tool (PR #316).
 * Import helpers from `./gemini` or `./env` directly instead.
 */

// Gemini AI image tools
export {
  generate,           // Generate images from text prompts
  edit,              // Edit existing images with text instructions
  analyze,           // Analyze images and answer questions about them
  default as gemini  // Default export (edit tool)
} from "./gemini"
