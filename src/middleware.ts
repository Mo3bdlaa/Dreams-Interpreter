import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Kept in sync with COOKIE_NAME in src/lib/auth.ts (that module is
// server-only and pulls node deps, so we don't import it into edge middleware).
const COOKIE_NAME = "dream_session";

const PROTECTED = ["/dashboard", "/dreams", "/calendar"];
const AUTH_PAGES = ["/login", "/register"];

async function isAuthed(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const authed = await isAuthed(token);

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.includes(pathname) && authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/dreams/:path*",
    "/calendar/:path*",
    "/login",
    "/register",
  ],
};
