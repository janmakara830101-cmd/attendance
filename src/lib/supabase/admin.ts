import { createClient } from '@supabase/supabase-js'

// Strip BOM and non-ASCII from env vars
function cleanEnv(value: string | undefined): string {
  return (value ?? '').replace(/[^\x20-\x7E]/g, '').trim()
}

/** Service-role client — server-side only, bypasses RLS */
export function createAdminClient() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!url || !key || key === 'placeholder_add_real_key') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
