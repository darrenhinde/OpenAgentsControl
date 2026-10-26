import { tool } from "@opencode-ai/plugin/tool"

// Example tool implementation
export async function exampleFunction(input: string): Promise<string> {
  // Your tool logic here
  return `Processed: ${input}`
}

// Tool definition for OpenCode agent system
export const exampleTool = tool({
  description: "Example tool description",
  args: {
    input: tool.schema.string().describe("Input parameter description"),
  },
  async execute(args, context) {
    try {
      return await exampleFunction(args.input)
    } catch (error) {
      return `Error: ${error.message}`
    }
  },
})

// Default export
export default exampleTool