import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'
import { uploadImage } from '@/lib/cloudinary'

// Raised from 3 → 6 so a product can hold: main raw photo + multiple AI
// hand-model variants + 1-2 supplementary angles. The PWA upload page lets
// the user prune down to the favorites before publishing.
const MAX_IMAGES_PER_PRODUCT = 6
const MAX_FILE_BYTES = 10 * 1024 * 1024

/**
 * POST /api/admin/products/[id]/image
 *
 * Append a supplementary photo to a draft (or any) product. Used by the PWA
 * quick-upload page when the user shoots an extra angle after the main
 * Claude-Vision photo. Cap is enforced at MAX_IMAGES_PER_PRODUCT (3) to keep
 * Cloudinary usage predictable.
 *
 * Body: multipart/form-data { file: File }
 * Returns: { image: { id, url, position }, totalImages }
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
    include: { images: { orderBy: { position: 'asc' } } },
  })
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  if (product.images.length >= MAX_IMAGES_PER_PRODUCT) {
    return NextResponse.json(
      {
        error: `Already at the ${MAX_IMAGES_PER_PRODUCT}-image limit for this product. Delete one first.`,
      },
      { status: 409 },
    )
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const imageUrl = await uploadImage(buffer, 'press-charm/products')
    const nextPosition = product.images.length // 0 was main, this becomes 1 or 2

    const image = await prisma.productImage.create({
      data: { url: imageUrl, position: nextPosition, productId: id },
    })

    return NextResponse.json({
      image,
      totalImages: product.images.length + 1,
    })
  } catch (err) {
    console.error('[POST /api/admin/products/[id]/image] failed:', err)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/products/[id]/image?imageId=xxx
 *
 * Remove one image from a product. Used by the PWA when the user retakes a
 * shot.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifySession(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const imageId = request.nextUrl.searchParams.get('imageId')
  if (!imageId) {
    return NextResponse.json({ error: 'imageId is required' }, { status: 400 })
  }

  // sanity-check the image actually belongs to this product
  const image = await prisma.productImage.findUnique({ where: { id: imageId } })
  if (!image || image.productId !== id) {
    return NextResponse.json({ error: 'Image not found on this product' }, { status: 404 })
  }

  await prisma.productImage.delete({ where: { id: imageId } })
  return NextResponse.json({ ok: true })
}
