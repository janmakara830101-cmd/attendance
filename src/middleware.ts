import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED  = ['/dashboard', '/admin', '/employee']
const AUTH_PAGES = ['/login', '/register']

// Strip BOM and non-ASCII from env vars (same fix as client.ts)
function cleanEnv(value: string | undefined): string {
  return (value ?? '').replace(/[^\x20-\x7E]/g, '').trim()
}

export async function middleware(request: NextRequest) {
  try {
    let response = NextResponse.next({ request })

    const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
    const key  = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

    // If env vars missing, just pass through
    if (!url || !key) {
      return response
    }

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          )
        },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()
    const { pathname } = request.nextUrl

    const isProtected = PROTECTED.some(p => pathname.startsWith(p))
    const isAuthPage  = AUTH_PAGES.some(p => pathname.startsWith(p))

    if (isProtected && !user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (isAuthPage && user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return response
  } catch {
    // On any middleware error, pass through instead of crashing
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
