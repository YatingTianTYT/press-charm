import { createHash } from 'crypto'

const SESSION_SECRET = process.env.SESSION_SECRET || 'press-charm-secret-key'

export function verifyPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return false
  return password === adminPassword
}

export function createSession(): string {
  const adminPassword = process.env.ADMIN_PASSWORD || ''
  const token = createHash('sha256')
    .update(adminPassword + SESSION_SECRET)
    .digest('hex')
  return token
}

export function verifySession(token: string): boolean {
  const expectedToken = createSession()
  return token === expectedToken
}
