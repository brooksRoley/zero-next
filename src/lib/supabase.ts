import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// On the server (API routes), use the service-role key when it is configured,
// so tables can be closed to the public anon key and written only through the
// API (supabase/migrations/0009_api_only_tables.sql). The variable has no
// NEXT_PUBLIC_ prefix, so Next never inlines it into the browser bundle; in the
// browser this is always the anon key. Until the key is set, the server falls
// back to the anon key and behaves exactly as before.
const serviceRoleKey =
  typeof window === 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY || '' : ''

// Null when env vars aren't configured (e.g. preview branches, CI). Every
// consumer MUST guard against this — see the hooks in src/hooks/* for the
// pattern: `if (!supabase) return` before any `.from()` / `.channel()` call.
export const supabase: SupabaseClient | null = supabaseUrl
  ? createClient(
      supabaseUrl,
      serviceRoleKey || supabaseAnonKey,
      serviceRoleKey ? { auth: { persistSession: false, autoRefreshToken: false } } : undefined,
    )
  : null
