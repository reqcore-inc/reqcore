import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import * as schema from '../database/schema'

const processWithLoadEnv = process as NodeJS.Process & {
  loadEnvFile?: (path?: string) => void
}

if (!process.env.DATABASE_URL && typeof processWithLoadEnv.loadEnvFile === 'function') {
  try {
    processWithLoadEnv.loadEnvFile('.env')
  }
  catch {}
}

const DATABASE_URL = process.env.DATABASE_URL ?? ''
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required.')
  process.exit(1)
}

const client = postgres(DATABASE_URL, { max: 1 })
const db = drizzle(client, { schema })

async function main() {
  const org = await db.query.organization.findFirst({
    where: eq(schema.organization.slug, 'reqcore-demo'),
  })

  if (org) {
    // Manually delete tables that lack ON DELETE CASCADE in the live DB
    await db.delete(schema.scoringCriterion).where(eq(schema.scoringCriterion.organizationId, org.id))
    console.log('✅ Deleted scoring criteria')

    await db.delete(schema.organization).where(eq(schema.organization.id, org.id))
    console.log('✅ Deleted demo org and all cascaded data')
  }
  else {
    console.log('⚠️  No demo org found (slug: reqcore-demo)')
  }

  const user = await db.query.user.findFirst({
    where: eq(schema.user.email, 'demo@reqcore.com'),
  })

  if (user) {
    await db.delete(schema.user).where(eq(schema.user.id, user.id))
    console.log('✅ Deleted demo user (demo@reqcore.com)')
  }
  else {
    console.log('⚠️  No demo user found')
  }

  await client.end()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
