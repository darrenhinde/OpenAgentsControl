import type { Plugin } from "@opencode-ai/plugin"
import { SimpleTelegramBot } from "./lib/telegram-bot"

// 🔧 CONFIGURATION: Set to true to enable this plugin
const ENABLED = false

export const TelegramNotify: Plugin = async ({ $ }) => {
  // Plugin disabled - set ENABLED = true to activate
  if (!ENABLED) return {}
  
  // Initialize Telegram bot
  const bot = new SimpleTelegramBot()
  let lastMessage = ""
  
  return {
    async event(input) {
      if (input.event.type === "session.idle") {
        // Send the last message content along with idle notification
        const message = lastMessage 
          ? `🟡 Session idle! Here's your last message:\n\n${lastMessage}`
          : "🟡 Hey! Your OpenCode session is idle - time to check your work!"
        bot.sendMessage(message)
      }
      
      if (input.event.type === "message.updated") {
        // Reset idle timer when user sends messages
        bot.resetActivity()
        
        const messageContent = (input.event as any).message?.content || 
                              (input.event as any).content || ""
        
        // Check if it's a command to send last message
        if (messageContent.includes("/send-last") || messageContent.includes("/last")) {
          if (lastMessage) {
            bot.sendMessage(`📱 Here's your last message:\n\n${lastMessage}`)
          } else {
            bot.sendMessage("📱 No previous message found.")
          }
          return
        }
        
        // Check if it's a command to send to phone
        if (messageContent.includes("/send-to-phone") || messageContent.includes("/phone")) {
          if (lastMessage) {
            bot.sendMessage(`📱 Sending to your phone:\n\n${lastMessage}`)
          } else {
            bot.sendMessage("📱 No message to send to phone.")
          }
          return
        }
        
        // Try to capture message content from the event
        try {
          // Access message content if available
          const messageContent = (input.event as any).message?.content || 
                                (input.event as any).content ||
                                "Message updated"
          
          if (messageContent && messageContent !== "Message updated") {
            lastMessage = messageContent
            
            // Send a preview of the message to Telegram
            const preview = lastMessage.length > 200 
              ? lastMessage.substring(0, 200) + "..."
              : lastMessage
            
            bot.sendMessage(`📱 Last message preview:\n\n${preview}`)
          }
        } catch (error) {
          // If we can't access the message content, just log it
          console.log("Message updated but couldn't capture content")
        }
      }
      
      if (input.event.type === "file.edited") {
        // Reset idle timer when user edits files
        bot.resetActivity()
      }
      
      // Also listen for message parts being updated
      if (input.event.type === "message.part.updated") {
        bot.resetActivity()
        
        try {
          const partContent = (input.event as any).part?.content || 
                             (input.event as any).content ||
                             "Message part updated"
          
          if (partContent && partContent !== "Message part updated") {
            lastMessage = partContent
            
            const preview = lastMessage.length > 200 
              ? lastMessage.substring(0, 200) + "..."
              : lastMessage
            
            bot.sendMessage(`📱 Message part preview:\n\n${preview}`)
          }
        } catch (error) {
          console.log("Message part updated but couldn't capture content")
        }
      }
    }
  }
}
