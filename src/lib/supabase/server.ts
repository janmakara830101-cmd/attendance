import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

function cleanEnv(value: string | undefined): string {
  return (value ?? '').replace(/[^\x20-\x7E]/g, '').trim()
}

export async function createClient() {
  const cookieStore = await cookies();
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          );
        } catch {}
      },
    },
  });
}
