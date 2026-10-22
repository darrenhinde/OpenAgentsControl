/** Tests for MiniMax image request construction and response parsing. */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { generateImage } from "./index"

const originalFetch = globalThis.fetch

beforeEach(() => {
  process.env.MINIMAX_API_KEY = "test-api-key"
})

afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.MINIMAX_API_KEY
})

describe("generateImage", () => {
  test("uses the global endpoint and parses URL images", async () => {
    let requestUrl = ""
    let requestInit: RequestInit | undefined
    globalThis.fetch = (async (input, init) => {
      requestUrl = String(input)
      requestInit = init
      return Response.json({
        data: { image_urls: ["https://images.example.test/generated.png"] },
        metadata: { success_count: 1, failed_count: 0 },
        base_resp: { status_code: 0 },
      })
    }) as typeof fetch

    const result = await generateImage("A paper-cut city skyline", {
      aspectRatio: "16:9",
      responseFormat: "url",
      seed: 42,
      n: 1,
      promptOptimizer: true,
    })

    expect(requestUrl).toBe("https://api.minimax.io/v1/image_generation")
    expect(requestInit?.headers).toEqual({
      Authorization: "Bearer test-api-key",
      "Content-Type": "application/json",
    })
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      model: "image-01",
      prompt: "A paper-cut city skyline",
      aspect_ratio: "16:9",
      response_format: "url",
      seed: 42,
      n: 1,
      prompt_optimizer: true,
    })
    expect(result).toEqual({
      images: ["https://images.example.test/generated.png"],
      responseFormat: "url",
      successCount: 1,
      failedCount: 0,
    })
  })

  test("uses the China endpoint and parses base64 images", async () => {
    let requestUrl = ""
    globalThis.fetch = (async (input) => {
      requestUrl = String(input)
      return Response.json({
        data: { image_base64: ["aW1hZ2U="] },
        metadata: { success_count: 1, failed_count: 0 },
        base_resp: { status_code: 0 },
      })
    }) as typeof fetch

    const result = await generateImage("A geometric fox", {
      region: "china",
      responseFormat: "base64",
      width: 1024,
      height: 1024,
    })

    expect(requestUrl).toBe("https://api.minimaxi.com/v1/image_generation")
    expect(result.images).toEqual(["aW1hZ2U="])
    expect(result.responseFormat).toBe("base64")
  })

  test("reports API response failures", async () => {
    globalThis.fetch = (async () =>
      Response.json({
        base_resp: { status_code: 2013, status_msg: "Invalid input parameters" },
      })) as typeof fetch

    await expect(generateImage("A geometric fox")).rejects.toThrow("Invalid input parameters")
  })
})
