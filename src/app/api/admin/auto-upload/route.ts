import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'
import { analyzeNailImage } from '@/lib/claude'
import { uploadImage } from '@/lib/cloudinary'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_session')?.value
    if (!token || !verifySession(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to Cloudinary
    const imageUrl = await uploadImage(buffer, 'press-charm/products')

    // Get base64 for Claude Vision
    const imageBase64 = buffer.toString('base64')
    const mimeType = file.type || 'image/jpeg'

    // Call Claude Vision
    const aiResponse = await analyzeNailImage(imageBase64, mimeType)

    // Optional caller-supplied overrides (PWA quick-upload sends these).
    // The legacy V3 watcher doesn't, so we fall back to safe zeros.
    const stockXS = Number(formData.get('stockXS') ?? 0) || 0
    const stockS = Number(formData.get('stockS') ?? 0) || 0
    const stockM = Number(formData.get('stockM') ?? 0) || 0
    const stockL = Number(formData.get('stockL') ?? 0) || 0

    // Create draft product. Default stock is all 0 — the operator is expected
    // to dial real counts in /admin/quick-upload before publishing (or via
    // the regular admin edit page). This is safer than the old S=1/M=1
    // defaults, which created phantom inventory for sizes you hadn't made.
    const product = await prisma.product.create({
      data: {
        name: aiResponse.title,
        description: aiResponse.description,
        price: aiResponse.price,
        tags: aiResponse.tags.join(', '),
        status: 'draft',
        features: JSON.stringify(aiResponse.features),
        careInstructions: aiResponse.careInstructions,
        stockXS,
        stockS,
        stockM,
        stockL,
        images: {
          create: [{ url: imageUrl, position: 0 }],
        },
      },
      include: {
        images: {
          orderBy: { position: 'asc' },
        },
      },
    })

    return NextResponse.json({ product, aiResponse }, { status: 201 })
  } catch (error) {
    console.error('Error in auto-upload:', error)
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 })
  }
}
