#!/usr/bin/env node

/**
 * Simple Telegram Bot for OpenCode
 * Sends notifications when session becomes idle
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class SimpleTelegramBot {
  private botToken: string | undefined
  private chatId: string | undefined
  private botUsername: string
  private idleTimeout: number
  private checkInterval: number
  private lastActivity: number
  private idleTimer: NodeJS.Timeout | null
  private checkTimer: NodeJS.Timeout | null
  private isIdle: boolean

  constructor() {
    this.loadEnvFile();
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.botUsername = process.env.TELEGRAM_BOT_USERNAME || '@OpenCode';
    this.idleTimeout = parseInt(process.env.TELEGRAM_IDLE_TIMEOUT || '300000'); // 5 minutes default
    this.checkInterval = parseInt(process.env.TELEGRAM_CHECK_INTERVAL || '30000'); // 30 seconds default
    
    this.lastActivity = Date.now();
    this.idleTimer = null;
    this.checkTimer = null;
    this.isIdle = false;
    
    this.validateConfig();
  }

  /**
   * Load environment variables from .env file
   */
  private loadEnvFile(): void {
    const envPath = path.join(__dirname, '..', '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            process.env[key] = valueParts.join('=');
          }
        }
      });
    }
  }

  /**
   * Validate configuration
   */
  private validateConfig(): boolean {
    if (!this.botToken) {
      console.warn('⚠️  TELEGRAM_BOT_TOKEN not set');
      return false;
    }
    if (!this.chatId) {
      console.warn('⚠️  TELEGRAM_CHAT_ID not set');
      return false;
    }
    return true;
  }

  /**
   * Initialize the bot
   */
  init(): void {
    if (!this.validateConfig()) {
      // Removed: console.log('❌ Telegram bot disabled - missing configuration');
      return;
    }

    // Removed: console.log('📱 Telegram bot initialized');
    this.sendMessage('🚀 OpenCode session started');
    this.startIdleMonitoring();
  }

  /**
   * Start monitoring for idle sessions
   */
  private startIdleMonitoring(): void {
    this.resetActivity();
    
    // Check for idle state periodically
    this.checkTimer = setInterval(() => {
      const timeSinceLastActivity = Date.now() - this.lastActivity;
      if (timeSinceLastActivity > this.idleTimeout && !this.isIdle) {
        this.handleIdle();
      }
    }, this.checkInterval);
  }

  /**
   * Reset activity timer
   */
  resetActivity(): void {
    this.lastActivity = Date.now();
    
    if (this.isIdle) {
      this.isIdle = false;
      this.sendMessage('🟢 Session resumed - User is active again');
    }
  }

  /**
   * Handle idle state
   */
  private handleIdle(): void {
    this.isIdle = true;
    const minutes = Math.floor(this.idleTimeout / 60000);
    this.sendMessage(`🟡 Session idle - User has been inactive for ${minutes} minutes`);
  }

  /**
   * Send message to Telegram
   */
  async sendMessage(message: string): Promise<any> {
    if (!this.validateConfig()) {
      // Removed: console.log('Cannot send message - missing configuration');
      return;
    }

    if (!message || message.trim() === '') {
      // Removed: console.log('Cannot send empty message:', JSON.stringify(message));
      return;
    }

    const data = JSON.stringify({
      chat_id: this.chatId,
      text: message.trim()
    });

    const dataBuffer = Buffer.from(data, 'utf8');

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${this.botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': dataBuffer.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(responseData);
            if (response.ok) {
              //console.log('📱 Message sent:', message);
              resolve(response);
            } else {
              //console.error('❌ Failed to send message:', response.description);
              reject(new Error(response.description));
            }
          } catch (error) {
            //console.error('❌ Error parsing response:', error);
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        //console.error('❌ Error sending message:', error);
        reject(error);
      });

      req.write(dataBuffer);
      req.end();
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(sendEndMessage: boolean = true): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }
    if (sendEndMessage) {
      this.sendMessage('🏁 OpenCode session ended');
    }
    // Removed: console.log('📱 Telegram bot cleaned up');
  }
}

// Export for use as module
export { SimpleTelegramBot }
export default SimpleTelegramBot

// Auto-initialize if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const bot = new SimpleTelegramBot();
  bot.init();
  
  // Handle cleanup on exit
  process.on('SIGINT', () => {
    bot.cleanup();
    setTimeout(() => process.exit(0), 1000);
  });
  
  process.on('SIGTERM', () => {
    bot.cleanup();
    setTimeout(() => process.exit(0), 1000);
  });

  // Demo: Simulate user activity every 2 minutes to prevent idle
  // Uncomment the next line for testing
  // setInterval(() => bot.resetActivity(), 120000);
  
  // Removed: console.log('📱 Telegram bot running... Press Ctrl+C to stop');

}
