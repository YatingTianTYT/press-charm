import { prisma } from '@/lib/prisma'

/**
 * Allocate the next available shortCode for a new product.
 *
 * Strategy:
 *   1. If there are fewer than 999 ACTIVE (non-archived) products, pick the
 *      smallest positive integer not currently used by an active product.
 *      Archived products' codes stay reserved while active count < 999.
 *   2. Once the active pool hits 999, start recycling: pick the smallest
 *      shortCode held by an archived product that isn't already taken by
 *      an active product (i.e. truly free).
 *
 * Returns null only if EVERY code 1-999 is held by an active product, which
 * means the user has more than 999 unsold styles concurrently — not our
 * problem for now, but explicit so callers handle gracefully.
 */
export async function allocateNextShortCode(): Promise<number | null> {
  // All shortCodes used by ACTIVE products
  const activeRows = await prisma.product.findMany({
    where: { archived: false, shortCode: { not: null } },
    select: { shortCode: true },
  })
  const usedByActive = new Set<number>(activeRows.map((r) => r.shortCode as number))

  if (usedByActive.size >= 999) {
    return null // every slot full of active products
  }

  // Walk from 1 upward looking for a free slot.
  // If active count < 999, we still skip codes held by archived products.
  if (usedByActive.size < 999) {
    const archivedRows = await prisma.product.findMany({
      where: { archived: true, shortCode: { not: null } },
      select: { shortCode: true },
    })
    const usedByArchived = new Set<number>(
      archivedRows.map((r) => r.shortCode as number),
    )

    // Until active pool fills up, prefer fresh numbers over recycling.
    if (usedByActive.size + usedByArchived.size < 999) {
      for (let i = 1; i <= 999; i++) {
        if (!usedByActive.has(i) && !usedByArchived.has(i)) return i
      }
    }

    // Active pool < 999 but combined with archived hits 999 → recycle the
    // oldest archived. Pick the smallest archived code not held by active.
    for (let i = 1; i <= 999; i++) {
      if (!usedByActive.has(i)) return i
    }
  }

  return null
}

/**
 * Parse a user-typed shortCode lookup. Accepts:
 *   "42"     → { code: 42 }
 *   "042"    → { code: 42 }
 *   "s-042"  → { code: 42, size: 'S' }
 *   "S-42"   → { code: 42, size: 'S' }
 *   "xs-001" → { code: 1, size: 'XS' }
 *   "M-23"   → { code: 23, size: 'M' }
 *   "#042"   → { code: 42 } (tolerates a leading hash)
 */
export function parseShortCodeInput(raw: string): { code: number; size?: 'XS' | 'S' | 'M' | 'L' } | null {
  if (!raw) return null
  const trimmed = raw.trim().toUpperCase().replace(/^#/, '')

  // Match optional size prefix + digits
  const match = trimmed.match(/^(XS|S|M|L)?[-\s]?(\d{1,3})$/)
  if (!match) return null

  const size = match[1] as 'XS' | 'S' | 'M' | 'L' | undefined
  const code = parseInt(match[2], 10)
  if (!isFinite(code) || code < 1 || code > 999) return null
  return size ? { code, size } : { code }
}
