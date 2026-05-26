import { Resend } from 'resend'

/**
 * Minimal email layer for Press Charm. Uses Resend (resend.com) — generous
 * free tier (~3000 emails/month) and zero-config DKIM if you verify your
 * sending domain.
 *
 * Setup:
 *   1. Sign up at resend.com (free)
 *   2. Verify a domain (or use "onboarding@resend.dev" for testing only)
 *   3. Get an API key → add to env as RESEND_API_KEY
 *   4. Set EMAIL_FROM to a verified address (e.g. "Press Charm <orders@presscharm.com>")
 *
 * If RESEND_API_KEY is unset, sends become silent no-ops — useful for local
 * dev / preview deployments.
 */

interface OrderForEmail {
  orderNumber: string
  customerName: string
  email: string
  subtotal: number
  shipping: number
  discount: number
  total: number
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  items: { name: string; size: string; quantity: number; price: number }[]
}

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

const FROM = process.env.EMAIL_FROM || 'Press Charm <orders@presscharm.com>'
const SHOP_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://press-charm.vercel.app'

export async function sendOrderConfirmation(order: OrderForEmail) {
  const client = getClient()
  if (!client) {
    console.warn('[email] RESEND_API_KEY not set — skipping order confirmation')
    return { skipped: true }
  }
  if (!order.email) {
    console.warn('[email] order has no email — skipping')
    return { skipped: true }
  }

  const itemRows = order.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:6px 0;color:#2C1810">${escapeHtml(i.name)} (${i.size}) × ${i.quantity}</td>
          <td style="padding:6px 0;color:#8B6F5E;text-align:right">${formatPrice(i.price * i.quantity)}</td>
        </tr>`,
    )
    .join('')

  const html = `
<!doctype html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2C1810;background:#FAF7F2;margin:0;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-weight:600;font-size:24px;margin:0 0 8px;">
      Thank you, ${escapeHtml(order.customerName || 'friend')}!
    </h1>
    <p style="color:#8B6F5E;margin:0 0 24px;font-size:14px;">
      Your Press Charm order <strong>${order.orderNumber}</strong> is confirmed. We hand-paint everything to order — your set will ship within 3-5 business days.
    </p>

    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#8B6F5E;border-bottom:1px solid #E8DDD4;padding-bottom:6px;margin:24px 0 12px;">Order details</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${itemRows}</table>

    <div style="margin-top:16px;padding-top:12px;border-top:1px solid #E8DDD4;font-size:14px;">
      <div style="display:flex;justify-content:space-between;color:#8B6F5E;">
        <span>Subtotal</span><span>${formatPrice(order.subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;color:#8B6F5E;">
        <span>Shipping</span><span>${order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}</span>
      </div>
      ${order.discount > 0 ? `<div style="display:flex;justify-content:space-between;color:#C4896F;"><span>Discount</span><span>-${formatPrice(order.discount)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;color:#2C1810;font-weight:600;margin-top:6px;">
        <span>Total</span><span>${formatPrice(order.total)}</span>
      </div>
    </div>

    <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#8B6F5E;border-bottom:1px solid #E8DDD4;padding-bottom:6px;margin:24px 0 12px;">Shipping to</h2>
    <p style="color:#2C1810;font-size:14px;margin:0;line-height:1.6;">
      ${escapeHtml(order.customerName)}<br>
      ${escapeHtml(order.addressLine1)}${order.addressLine2 ? `<br>${escapeHtml(order.addressLine2)}` : ''}<br>
      ${escapeHtml(order.city)}, ${escapeHtml(order.state)} ${escapeHtml(order.zipCode)}
    </p>

    <p style="margin-top:32px;color:#8B6F5E;font-size:13px;line-height:1.6;">
      Made with care by hand. Questions? Reply to this email.<br>
      <a href="${SHOP_URL}" style="color:#C4896F;text-decoration:none;">presscharm.com</a>
    </p>
  </div>
</body>
</html>`

  try {
    const result = await client.emails.send({
      from: FROM,
      to: order.email,
      subject: `Your Press Charm order ${order.orderNumber}`,
      html,
    })
    console.log(`[email] ✓ sent confirmation to ${order.email} (id=${result.data?.id})`)
    return { ok: true, id: result.data?.id }
  } catch (err) {
    console.error('[email] failed:', err)
    throw err
  }
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
