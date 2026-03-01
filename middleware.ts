import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const publicPaths = ['/login', '/auth', '/api/auth', '/api/intake', '/api/webhooks']

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl

  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  if (pathname === '/' || pathname === '/_next') {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next()
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get: (name) => request.cookies.get(name)?.value
      }
    })

    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const response = NextResponse.next()
    response.headers.set('x-org-id', session.user.id)
    
    return response
  } catch (err) {
    console.error('Auth middleware error:', err)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)'
  ]
}
