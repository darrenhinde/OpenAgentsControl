import type { Plugin } from "@opencode-ai/plugin";

/**
 * CoderAgent Assistant Plugin - Simplified Version
 * 
 * Actively helps CoderAgent by showing reminders and toasts
 */

export const CoderAgentAssistantPlugin: Plugin = async (ctx) => {
  const { client, toast } = ctx as any;

  await client.app.log({
    service: "coder-agent-assistant",
    level: "info",
    message: "CoderAgent Assistant Plugin initialized"
  });

  return {
    // Hook 1: Before CoderAgent starts
    "tool.execute.before": async (input: any, output: any) => {
      if (input.tool === "task" && input.args?.subagent_type === "CoderAgent") {
        console.log("\n🤖 CoderAgent Assistant: Monitoring started");
        
        // Show toast
        if (toast) {
          await toast.show({
            title: "🤖 CoderAgent Assistant",
            message: "Monitoring CoderAgent work - checks will be validated",
            type: "info",
            duration: 4000
          });
        }
      }
    },

    // Hook 2: After CoderAgent completes
    "tool.execute.after": async (input: any, output: any) => {
      if (input.tool === "task" && input.args?.subagent_type === "CoderAgent") {
        const result = output.result || "";
        
        // Check for self-review
        const hasSelfReview = 
          result.includes("Self-Review") || 
          result.includes("✅ Types clean");
        
        // Check for deliverables
        const hasDeliverables = 
          result.includes("Deliverables:") ||
          result.includes("created");
        
        console.log("\n🤖 CoderAgent Assistant: Validation");
        console.log(`   Self-Review: ${hasSelfReview ? '✅' : '⚠️'}`);
        console.log(`   Deliverables: ${hasDeliverables ? '✅' : '⚠️'}`);
        
        // Show toast
        if (toast) {
          if (hasSelfReview && hasDeliverables) {
            await toast.show({
              title: "✅ CoderAgent Checks Passed",
              message: "All validation checks completed successfully",
              type: "success",
              duration: 5000
            });
          } else {
            await toast.show({
              title: "⚠️ CoderAgent Validation",
              message: "Some checks need attention - see console",
              type: "warning",
              duration: 6000
            });
          }
        }
      }
    },

    // Hook 3: Session idle
    "session.idle": async () => {
      console.log("\n🤖 CoderAgent Assistant: Session complete");
      
      if (toast) {
        await toast.show({
          title: "🤖 Session Summary",
          message: "CoderAgent Assistant monitoring complete",
          type: "info",
          duration: 4000
        });
      }
    }
  };
};

export default CoderAgentAssistantPlugin;
