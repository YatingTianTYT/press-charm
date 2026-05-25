import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'
import { uploadImage } from '@/lib/cloudinary'
import { generateImageFromReference as geminiGenerate, isGeminiAvailable } from '@/lib/gemini'
import {
  generateImageFromReference as openaiGenerate,
  isOpenAIAvailable,
} from '@/lib/openai-image'
import { getScenePrompt, type Scene } from '@/lib/scene-prompts'

/**
 * POST /api/admin/generate-scene-image
 *
 * Generate one product image in a specific scene (product flat-lay / hand
 * close-up / lifestyle) using either OpenAI gpt-image-1 (preferred — best
 * fidelity for "preserve nail design + change scene") or Gemini 2.5 Flash
 * Image (fallback / faster / cheaper).
 *
 * Body: {
 *   productId: string
 *   scene: 'product' | 'closeup' | 'lifestyle'
 *   provider?: 'openai' | 'gemini'   // auto-selects best available if omitted
 * }
 *
 * Returns: { url, imageId, scene, provider }
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifySession(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { productId?: string; scene?: string; provider?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { productId, scene } = body
  let { provider } = body

  if (!productId || !scene) {
    return NextResponse.json(
      { error: 'productId and scene are required' },
      { status: 400 },
    )
  }
  if (!['product', 'closeup', 'lifestyle'].includes(scene)) {
    return NextResponse.json({ error: `Invalid scene: ${scene}` }, { status: 400 })
  }

  // Auto-pick the provider: prefer Gemini (OpenAI gpt-image-1 was tested and
  // its image-edit mode regenerates the nails rather than preserving them,
  // so it's a worse fit even though the API surface looked promising).
  // Callers can still force `provider: 'openai'` to override.
  if (!provider) {
    provider = isGeminiAvailable() ? 'gemini' : isOpenAIAvailable() ? 'openai' : ''
  }
  if (provider === 'openai' && !isOpenAIAvailable()) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured (add it on Vercel and retry, or pass provider=gemini)' },
      { status: 400 },
    )
  }
  if (provider === 'gemini' && !isGeminiAvailable()) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 400 })
  }
  if (provider !== 'openai' && provider !== 'gemini') {
    return NextResponse.json(
      { error: 'No image-generation provider available. Add OPENAI_API_KEY or GEMINI_API_KEY.' },
      { status: 400 },
    )
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { images: { orderBy: { position: 'asc' } } },
  })
  if (!product || product.images.length === 0) {
    return NextResponse.json({ error: 'Product has no images' }, { status: 400 })
  }

  try {
    // Pull the main reference photo (position 0)
    const ref = product.images[0]
    const imageResponse = await fetch(ref.url)
    if (!imageResponse.ok) throw new Error(`Failed to fetch reference image (${imageResponse.status})`)
    const refBuffer = Buffer.from(await imageResponse.arrayBuffer())
    const refMime = imageResponse.headers.get('content-type') ?? 'image/jpeg'

    const scenePrompt = getScenePrompt(scene as Scene)

    // Run the chosen provider
    let generatedBuffer: Buffer
    if (provider === 'openai') {
      generatedBuffer = await openaiGenerate({
        prompt: scenePrompt.prompt,
        imageBuffer: refBuffer,
        imageMimeType: refMime,
      })
    } else {
      generatedBuffer = await geminiGenerate(
        refBuffer.toString('base64'),
        refMime,
        scenePrompt.prompt,
      )
    }

    // Upload to Cloudinary
    const url = await uploadImage(generatedBuffer, `press-charm/scenes/${scene}`)

    // Record as a new ProductImage at the next position
    const maxPos = product.images.reduce((m, img) => Math.max(m, img.position), -1)
    const image = await prisma.productImage.create({
      data: { url, position: maxPos + 1, productId },
    })

    return NextResponse.json({
      url,
      imageId: image.id,
      scene,
      provider,
    })
  } catch (err) {
    console.error('[POST /api/admin/generate-scene-image] failed:', err)
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to generate scene image',
        scene,
        provider,
      },
      { status: 500 },
    )
  }
}
