import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns true when Supabase environment variables are present and the app
 * should talk to Supabase instead of the local SQLite sandbox.
 */
export function isSupabaseEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )
}

let adminClient: SupabaseClient | null = null

/**
 * Server-only Supabase client using the service role key.
 * Use this in API routes for privileged operations (login, audit save, etc).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!isSupabaseEnabled()) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
  }
  return adminClient
}
