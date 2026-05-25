import OpenAI from 'openai'
import { toFile } from 'openai'

/**
 * OpenAI gpt-image-1 wrapper for image-to-image generation.
 *
 * Why this is separate from the Gemini lib: gpt-image-1's `images.edit` API
 * is specifically designed for "preserve subject, change scene" tasks via a
 * reference image, which is exactly our use case. In side-by-side testing it
 * holds onto nail designs much more faithfully than Gemini 2.5 Flash Image.
 *
 * Quality vs cost (approx, per Apr 2025 docs):
 *   - 'low'    → ~$0.011 / image, 1024x1024
 *   - 'medium' → ~$0.042 / image, 1024x1024
 *   - 'high'   → ~$0.167 / image, 1024x1024
 * We default to 'medium' — it's the sweet spot for product photography.
 */

export function isOpenAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY
}

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export interface GenerateOpts {
  prompt: string
  imageBuffer: Buffer
  imageMimeType: string
  quality?: 'low' | 'medium' | 'high'
  size?: '1024x1024' | '1024x1536' | '1536x1024'
}

/**
 * Edit/transform a reference image using a prompt. Returns the raw PNG bytes
 * of the generated image. Throws on failure (caller handles).
 */
export async function generateImageFromReference(opts: GenerateOpts): Promise<Buffer> {
  const client = getClient()

  // The Images Edit API expects the reference image as a File. Wrap our
  // buffer using OpenAI's `toFile` helper, which sets the correct multipart
  // metadata regardless of the buffer's origin.
  const ext = opts.imageMimeType.includes('png') ? 'png' : 'jpg'
  const file = await toFile(opts.imageBuffer, `nail-source.${ext}`, {
    type: opts.imageMimeType,
  })

  const response = await client.images.edit({
    model: 'gpt-image-1',
    image: file,
    prompt: opts.prompt,
    n: 1,
    size: opts.size ?? '1024x1024',
    quality: opts.quality ?? 'medium',
  })

  // The edit endpoint returns b64_json (no public URL is created server-side)
  const datum = response.data?.[0]
  if (!datum?.b64_json) {
    throw new Error('OpenAI returned no image data')
  }
  return Buffer.from(datum.b64_json, 'base64')
}
