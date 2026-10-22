/**
 * MiniMax Image Tool
 *
 * Generates images from text with the regional MiniMax image API.
 */

import { tool } from "@opencode-ai/plugin/tool"
import { getApiKey } from "../env"

export type MiniMaxImageRegion = "global" | "china"
export type MiniMaxImageModel = "image-01"
export type MiniMaxImageResponseFormat = "url" | "base64"

export interface MiniMaxImageOptions {
  region?: MiniMaxImageRegion
  model?: MiniMaxImageModel
  aspectRatio?: "1:1" | "16:9" | "4:3" | "3:2" | "2:3" | "3:4" | "9:16" | "21:9"
  width?: number
  height?: number
  responseFormat?: MiniMaxImageResponseFormat
  seed?: number
  n?: number
  promptOptimizer?: boolean
}

export interface MiniMaxImageResult {
  images: string[]
  responseFormat: MiniMaxImageResponseFormat
  successCount: number
  failedCount: number
}

interface MiniMaxImageResponse {
  data?: {
    image_urls?: string[]
    image_base64?: string[]
  }
  metadata?: {
    success_count?: number
    failed_count?: number
  }
  base_resp?: {
    status_code?: number
    status_msg?: string
  }
}

const ENDPOINTS: Record<MiniMaxImageRegion, string> = {
  global: "https://api.minimax.io/v1/image_generation",
  china: "https://api.minimaxi.com/v1/image_generation",
}

function compactRequest(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))
}

export async function generateImage(
  prompt: string,
  options: MiniMaxImageOptions = {},
): Promise<MiniMaxImageResult> {
  if ((options.width === undefined) !== (options.height === undefined)) {
    throw new Error("MiniMax image width and height must be provided together")
  }

  const apiKey = await getApiKey("MINIMAX_API_KEY")
  const region = options.region ?? "global"
  const responseFormat = options.responseFormat ?? "url"
  const request = compactRequest({
    model: options.model ?? "image-01",
    prompt,
    aspect_ratio: options.aspectRatio,
    width: options.width,
    height: options.height,
    response_format: responseFormat,
    seed: options.seed,
    n: options.n,
    prompt_optimizer: options.promptOptimizer,
  })

  const response = await fetch(ENDPOINTS[region], {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`MiniMax image API request failed with HTTP ${response.status}`)
  }

  const body = (await response.json()) as MiniMaxImageResponse
  if (body.base_resp?.status_code !== 0) {
    throw new Error(body.base_resp?.status_msg || "MiniMax image generation failed")
  }

  const images = responseFormat === "base64" ? body.data?.image_base64 : body.data?.image_urls
  if (!images?.length) {
    throw new Error("MiniMax image generation returned no images")
  }

  return {
    images,
    responseFormat,
    successCount: body.metadata?.success_count ?? images.length,
    failedCount: body.metadata?.failed_count ?? 0,
  }
}

export const generate = tool({
  description: "Generate images from a text prompt with MiniMax",
  args: {
    prompt: tool.schema.string().describe("Text description of the image to generate"),
    region: tool.schema.enum(["global", "china"]).optional().describe("API region (default: global)"),
    model: tool.schema.enum(["image-01"]).optional().describe("Image model (default: image-01)"),
    aspect_ratio: tool.schema
      .enum(["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"])
      .optional()
      .describe("Generated image aspect ratio"),
    width: tool.schema.number().int().optional().describe("Image width in pixels; provide with height"),
    height: tool.schema.number().int().optional().describe("Image height in pixels; provide with width"),
    response_format: tool.schema.enum(["url", "base64"]).optional().describe("Image response format"),
    seed: tool.schema.number().int().optional().describe("Seed for reproducible generation"),
    n: tool.schema.number().int().min(1).max(9).optional().describe("Number of images to generate"),
    prompt_optimizer: tool.schema.boolean().optional().describe("Enable prompt optimization"),
  },
  async execute(args) {
    try {
      const result = await generateImage(args.prompt, {
        region: args.region,
        model: args.model,
        aspectRatio: args.aspect_ratio,
        width: args.width,
        height: args.height,
        responseFormat: args.response_format,
        seed: args.seed,
        n: args.n,
        promptOptimizer: args.prompt_optimizer,
      })
      return JSON.stringify(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `Error: ${message}`
    }
  },
})

export default generate
