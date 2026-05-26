import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'
import { analyzeNailImage } from '@/lib/claude'

// Claude Vision can take 5-10s; give it headroom past Vercel's 10s default.
export const maxDuration = 60

/**
 * POST /api/admin/products/[id]/regenerate-listing
 *
 * Re-run Claude Vision on the product's main image (position=0) and overwrite
 * the AI-generated fields: name, description, price, tags, features,
 * careInstructions.
 *
 * Used by the PWA quick-upload page's "regenerate" button when the AI's first
 * attempt feels off. Does NOT touch stock, status, or images.
 *
 * Returns: { product, aiResponse }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifySession(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: { orderBy: { position: 'asc' }, take: 1 } },
  })
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }
  const mainImage = product.images[0]
  if (!mainImage) {
    return NextResponse.json({ error: 'Product has no images to analyze' }, { status: 400 })
  }

  try {
    // Pull the image bytes back from Cloudinary and re-feed Claude. This
    // keeps the existing analyzeNailImage signature (base64-in) so we don't
    // have to refactor the client.
    const resp = await fetch(mainImage.url)
    if (!resp.ok) {
      throw new Error(`Failed to fetch image: HTTP ${resp.status}`)
    }
    const mimeType = resp.headers.get('content-type') ?? 'image/jpeg'
    const buffer = Buffer.from(await resp.arrayBuffer())
    const imageBase64 = buffer.toString('base64')

    const aiResponse = await analyzeNailImage(imageBase64, mimeType)

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: aiResponse.title,
        description: aiResponse.description,
        price: aiResponse.price,
        tags: aiResponse.tags.join(', '),
        features: JSON.stringify(aiResponse.features),
        careInstructions: aiResponse.careInstructions,
      },
      include: { images: { orderBy: { position: 'asc' } } },
    })

    return NextResponse.json({ product: updated, aiResponse })
  } catch (err) {
    console.error('[POST regenerate-listing] failed:', err)
    return NextResponse.json({ error: 'Failed to regenerate listing' }, { status: 500 })
  }
}
