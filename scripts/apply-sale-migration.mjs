// One-shot migration applier that bypasses the Prisma CLI (which currently
// won't load on Node 20.9 due to an ESM/CJS issue in @prisma/dev).
//
// What it does:
//   1. Reads prisma/migrations/20260525120000_add_sale_table/migration.sql
//   2. Applies it to the DATABASE_URL Postgres in a transaction
//   3. Records a row in `_prisma_migrations` so future `prisma migrate deploy`
//      sees this as already-applied and doesn't try to re-run it
//
// Run with: node scripts/apply-sale-migration.mjs

import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { randomUUID } from 'node:crypto'

const MIGRATION_NAME = '20260525120000_add_sale_table'
const MIGRATION_PATH = `prisma/migrations/${MIGRATION_NAME}/migration.sql`

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('✗ DATABASE_URL not set. Aborting.')
    process.exit(1)
  }

  const sql = readFileSync(MIGRATION_PATH, 'utf8')
  const checksum = createHash('sha256').update(sql).digest('hex')

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  try {
    // Sanity: confirm we're talking to the right DB
    const db = await client.query('SELECT current_database() AS db')
    console.log(`Connected to: ${db.rows[0].db}`)

    // Has this migration already been applied?
    const existing = await client.query(
      `SELECT migration_name, finished_at FROM "_prisma_migrations"
       WHERE migration_name = $1`,
      [MIGRATION_NAME],
    )
    if (existing.rows[0]?.finished_at) {
      console.log(`✓ ${MIGRATION_NAME} is already marked applied — skipping.`)
      await client.end()
      return
    }

    // Has the Sale table already been created (e.g. by a prior partial run)?
    const tableCheck = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema='public' AND table_name='Sale'`,
    )
    const alreadyHasTable = tableCheck.rows.length > 0
    if (alreadyHasTable) {
      console.log(`! "Sale" table already exists — skipping DDL, just recording the migration row.`)
    } else {
      console.log(`Applying ${MIGRATION_NAME}…`)
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('COMMIT')
      console.log(`✓ DDL applied`)
    }

    // Record (or finalize) the migration row so prisma stays in sync
    await client.query(
      `INSERT INTO "_prisma_migrations"
         (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)
       ON CONFLICT (id) DO NOTHING`,
      [randomUUID(), checksum, MIGRATION_NAME],
    )
    console.log(`✓ recorded in _prisma_migrations`)

    // Smoke check: count Sale rows (should be 0)
    const count = await client.query('SELECT COUNT(*)::int AS n FROM "Sale"')
    console.log(`Sale row count: ${count.rows[0].n}`)

    console.log('\n✅ Done.')
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {}
    console.error('✗ Failed:', e.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
