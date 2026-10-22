/**
 * OpenCode Gemini Tool - Main entry point
 * 
 * This module provides image generation, editing, and analysis capabilities
 * using Google's Gemini AI models, along with environment variable utilities.
 */

// Gemini AI image tools
export {
  generate,           // Generate images from text prompts
  edit,              // Edit existing images with text instructions
  analyze,           // Analyze images and answer questions about them
  generateImage,     // Core image generation function
  editImage,         // Core image editing function
  analyzeImage,      // Core image analysis function
  default as gemini  // Default export (edit tool)
} from "./gemini"

// MiniMax image generation tool
export {
  generate as minimaxGenerate,
  generateImage as generateMiniMaxImage,
  type MiniMaxImageModel,
  type MiniMaxImageOptions,
  type MiniMaxImageRegion,
  type MiniMaxImageResponseFormat,
  type MiniMaxImageResult,
} from "./minimax"

// Environment variable utilities
export {
  loadEnvVariables,
  getEnvVariable,
  getRequiredEnvVariable,
  getRequiredEnvVariables,
  getApiKey,
  type EnvLoaderConfig
} from "./env"
