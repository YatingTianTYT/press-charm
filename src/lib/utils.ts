export const SHIPPING_THRESHOLD = 5000 // cents ($50.00)
export const SHIPPING_RATE = 399 // cents ($3.99)

export function formatPrice(cents: number): string {
  const dollars = (cents / 100).toFixed(2)
  return `$${dollars}`
}

export function generateOrderNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `PC-${result}`
}

export function calculateShipping(subtotalCents: number): number {
  return subtotalCents >= SHIPPING_THRESHOLD ? 0 : SHIPPING_RATE
}

// Bulk discount: 2+ sets = $5 off each set
export const BULK_DISCOUNT_THRESHOLD = 2 // minimum sets to qualify
export const BULK_DISCOUNT_PER_SET = 500 // cents ($5.00)

export function calculateBulkDiscount(totalQuantity: number): number {
  if (totalQuantity >= BULK_DISCOUNT_THRESHOLD) {
    return totalQuantity * BULK_DISCOUNT_PER_SET
  }
  return 0
}
