import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login"]
const AUTH_API_PREFIX = "/api/auth"
const PROFILE_PHOTO_CRON_PATH = "/api/cron/refresh-profile-photos"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith(AUTH_API_PREFIX)) {
    return NextResponse.next()
  }

  // Vercel Cron does not have a NextAuth browser session. The endpoint has
  // its own bearer-secret validation, so only a correctly signed cron request
  // may pass through the application authentication middleware.
  if (
    pathname === PROFILE_PHOTO_CRON_PATH
    && process.env.CRON_SECRET
    && request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  })

  if (token) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search)

  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
