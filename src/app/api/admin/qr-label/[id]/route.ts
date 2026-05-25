import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

/**
 * GET /api/admin/qr-label/[id]
 *
 * Returns a printable single-page HTML label for the given product, containing:
 *   - product name + price
 *   - thumbnail
 *   - QR code that points at /admin/sell/[id]
 *
 * Browser users: open it and Cmd-P → "Save as PDF" or print directly to a
 * label printer. CLI users: scripts/generate-qr-label.sh wraps it in a
 * headless-Chrome PDF dump.
 *
 * QR code is generated client-side via a CDN script (qrcode.min.js) to keep
 * the API zero-dep. The body of the page renders itself.
 */
export async function GET(
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
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const origin = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
  const sellUrl = `${origin}/admin/sell/${product.id}`
  const thumb = product.images[0]?.url || ''
  const priceStr = `$${(product.price / 100).toFixed(2)}`
  const escapedName = product.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Generate the QR code server-side and inline it as SVG. We tried the
  // jsdelivr CDN version before but it didn't expose the QRCode global
  // reliably; this is bulletproof — no client JS, no network dependency.
  const qrSvg = await QRCode.toString(sellUrl, {
    type: 'svg',
    margin: 0,
    width: 200,
    color: { dark: '#2C1810', light: '#FAF7F2' },
    errorCorrectionLevel: 'M',
  })

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapedName} — QR label</title>
  <style>
    @page { size: 2.25in 3.5in; margin: 0.1in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #2C1810;
      background: #FAF7F2;
    }
    .label {
      width: 2.25in;
      height: 3.5in;
      padding: 0.15in;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      page-break-after: always;
    }
    .thumb {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: 6px;
      background: #F0E8DF;
      margin-bottom: 6px;
    }
    .name {
      font-weight: 600;
      font-size: 11pt;
      line-height: 1.2;
      margin: 2px 0;
    }
    .price {
      font-size: 14pt;
      font-weight: 700;
      color: #C4896F;
      margin: 2px 0 4px 0;
    }
    .qr { margin: 2px 0; }
    .qr svg { width: 1.2in; height: 1.2in; display: block; }
    .hint {
      font-size: 7pt;
      color: #8B6F5E;
      margin-top: 4px;
    }
    @media screen {
      body { padding: 24px; }
      .label { border: 1px dashed #E8DDD4; }
    }
  </style>
</head>
<body>
  <div class="label">
    ${thumb ? `<img class="thumb" src="${thumb}" alt="" />` : `<div class="thumb"></div>`}
    <div class="name">${escapedName}</div>
    <div class="price">${priceStr}</div>
    <div class="qr">${qrSvg}</div>
    <div class="hint">scan to sell</div>
  </div>
  <script>
    // (no-op, kept so any existing reference to /api/admin/qr-label still works the same way)
  </script>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
