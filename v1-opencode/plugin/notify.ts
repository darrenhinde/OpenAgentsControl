import type { Plugin } from "@opencode-ai/plugin"

// 🔧 CONFIGURATION: Set to true to enable this plugin
const ENABLED = false

export const Notify: Plugin = async ({ $ }) => {
  // Plugin disabled - set ENABLED = true to activate
  if (!ENABLED) return {}
  
  return {
    async event(input) {
      if (input.event.type === "session.idle") {
        await $`say "Your code is done!"`
      }
    },
  }
}
