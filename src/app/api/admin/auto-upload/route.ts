import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'
import { analyzeNailImage } from '@/lib/claude'
import { uploadImage } from '@/lib/cloudinary'
import { allocateNextShortCode } from '@/lib/shortcode'

// Claude Vision + Cloudinary upload can take 10-20s combined. Override
// Vercel's default 10s timeout so the call doesn't get killed mid-analysis.
export const maxDuration = 60

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

    // ?skipClaude=1 means the client (PWA Quick Upload) will run Claude
    // Vision via /api/admin/products/[id]/regenerate-listing IN PARALLEL
    // with Gemini scene generation. This route just creates a stub product
    // with placeholder fields, so it returns in ~3s instead of ~8s.
    //
    // Default (no query) preserves the old behavior so the legacy V3 watcher
    // and the GUI Upload page (if anyone still uses it) keep working.
    const skipClaude = request.nextUrl.searchParams.get('skipClaude') === '1'

    let aiFields: {
      title: string
      description: string
      price: number
      tags: string[]
      features: string[]
      careInstructions: string
    }
    if (skipClaude) {
      // Placeholder — the parallel regenerate-listing call will overwrite
      // these almost immediately.
      aiFields = {
        title: 'New product',
        description: '',
        price: 2800, // $28.00 default; user will edit
        tags: [],
        features: [],
        careInstructions: '',
      }
    } else {
      const imageBase64 = buffer.toString('base64')
      const mimeType = file.type || 'image/jpeg'
      aiFields = await analyzeNailImage(imageBase64, mimeType)
    }

    // Optional caller-supplied overrides (PWA quick-upload sends these).
    // The legacy V3 watcher doesn't, so we fall back to safe zeros.
    const stockXS = Number(formData.get('stockXS') ?? 0) || 0
    const stockS = Number(formData.get('stockS') ?? 0) || 0
    const stockM = Number(formData.get('stockM') ?? 0) || 0
    const stockL = Number(formData.get('stockL') ?? 0) || 0

    // Allocate the next available shortCode (e.g. 42) for this product.
    // Returns null only if every 1-999 slot is in use by active products.
    const shortCode = await allocateNextShortCode()

    // Create draft product. Default stock is all 0 — the operator is expected
    // to dial real counts in /admin/quick-upload before publishing (or via
    // the regular admin edit page). This is safer than the old S=1/M=1
    // defaults, which created phantom inventory for sizes you hadn't made.
    const product = await prisma.product.create({
      data: {
        name: aiFields.title,
        description: aiFields.description,
        price: aiFields.price,
        tags: aiFields.tags.join(', '),
        status: 'draft',
        features: JSON.stringify(aiFields.features),
        careInstructions: aiFields.careInstructions,
        shortCode,
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

    return NextResponse.json(
      { product, aiResponse: aiFields, skippedClaude: skipClaude },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error in auto-upload:', error)
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 })
  }
}
