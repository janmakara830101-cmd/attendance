import { createBrowserClient } from "@supabase/ssr";

// Strip BOM and any non-ASCII/non-printable chars from env vars
// Fixes: "String contains non ISO-8859-1 code point" browser fetch error
function cleanEnv(value: string | undefined): string {
  return (value ?? '').replace(/[^\x20-\x7E]/g, '').trim()
}

export function createClient() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  return createBrowserClient(url, key)
}
