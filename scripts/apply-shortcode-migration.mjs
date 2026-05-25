// Apply the add_shortcode_and_archived migration to Neon. Same trick as
// apply-sale-migration.mjs — bypasses Prisma CLI which won't run on
// Node 20.9.
import 'dotenv/config'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'

const MIGRATION_NAME = '20260525150000_add_shortcode_and_archived'
const MIGRATION_PATH = `prisma/migrations/${MIGRATION_NAME}/migration.sql`

async function main() {
  const sql = readFileSync(MIGRATION_PATH, 'utf8')
  const checksum = createHash('sha256').update(sql).digest('hex')

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const existing = await client.query(
      `SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE migration_name = $1`,
      [MIGRATION_NAME],
    )
    if (existing.rows[0]?.finished_at) {
      console.log(`✓ ${MIGRATION_NAME} already applied`)
      return
    }

    // Detect partial application
    const colCheck = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='Product' AND column_name='shortCode'`,
    )
    const alreadyApplied = colCheck.rows.length > 0

    if (alreadyApplied) {
      console.log(`! shortCode column already exists, skipping DDL`)
    } else {
      console.log(`Applying ${MIGRATION_NAME}…`)
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('COMMIT')
      console.log(`✓ DDL applied`)
    }

    await client.query(
      `INSERT INTO "_prisma_migrations"
         (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)
       ON CONFLICT (id) DO NOTHING`,
      [randomUUID(), checksum, MIGRATION_NAME],
    )

    const verify = await client.query(`
      SELECT id, name, "shortCode", "archived",
        "stockXS"+"stockS"+"stockM"+"stockL" AS total_stock
      FROM "Product"
      ORDER BY "shortCode" NULLS LAST
    `)
    console.log('\nProducts after backfill:')
    for (const r of verify.rows) {
      const code = r.shortCode == null ? 'null' : String(r.shortCode).padStart(3, '0')
      console.log(`  #${code}  ${r.name.padEnd(30)}  stock=${r.total_stock}  archived=${r.archived}`)
    }
    console.log('\n✅ Done.')
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('✗ Failed:', e.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
