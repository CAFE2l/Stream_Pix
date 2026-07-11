import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('[DB] DATABASE_URL is not set in .env')
  process.exit(1)
}

const sql = neon(databaseUrl)

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[]
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  try {
    const result = await sql(text, params ?? [])
    return { rows: result as T[] }
  } catch (error) {
    console.error('[DB] Query error:', error)
    throw error
  }
}

export default sql
