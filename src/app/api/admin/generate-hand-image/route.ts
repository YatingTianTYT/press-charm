import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'
import { isGeminiAvailable, generateHandModelImage } from '@/lib/gemini'
import { uploadImage } from '@/lib/cloudinary'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_session')?.value
    if (!token || !verifySession(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isGeminiAvailable()) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 400 })
    }

    const body = await request.json()
    const { productId } = body

    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: { orderBy: { position: 'asc' } } },
    })

    if (!product || product.images.length === 0) {
      return NextResponse.json({ error: 'Product has no images' }, { status: 400 })
    }

    // Fetch the first image from its URL (now Cloudinary URL)
    const imageResponse = await fetch(product.images[0].url)
    const imageArrayBuffer = await imageResponse.arrayBuffer()
    const imageBuffer = Buffer.from(imageArrayBuffer)
    const imageBase64 = imageBuffer.toString('base64')

    const urlLower = product.images[0].url.toLowerCase()
    const mimeType = urlLower.includes('.png') ? 'image/png' : 'image/jpeg'

    // Generate hand model image
    const generatedBuffer = await generateHandModelImage(imageBase64, mimeType)

    // Upload to Cloudinary
    const url = await uploadImage(generatedBuffer, 'press-charm/hand-models')

    // Get max position for this product
    const maxPos = product.images.reduce((max, img) => Math.max(max, img.position), 0)

    // Create ProductImage record
    const image = await prisma.productImage.create({
      data: {
        url,
        position: maxPos + 1,
        productId,
      },
    })

    return NextResponse.json({ url, imageId: image.id })
  } catch (error) {
    console.error('Error generating hand model image:', error)
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
  }
}
