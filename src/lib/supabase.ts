import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Null when env vars aren't configured (e.g. preview branches, CI). Every
// consumer MUST guard against this — see the hooks in src/hooks/* for the
// pattern: `if (!supabase) return` before any `.from()` / `.channel()` call.
export const supabase: SupabaseClient | null = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
