import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";

const PROTECTED_PATHS = ["/app/dashboard"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  const sessionCookie = request.cookies.get("app_session");
  let isAuthed = false;

  if (sessionCookie) {
    const sessionResult = await sql`
      SELECT token
      FROM sessions
      WHERE token = ${sessionCookie.value}
        AND expires_at > NOW()
      LIMIT 1;
    `;
    isAuthed = (sessionResult?.rowCount ?? 0) > 0;
  }

  if (isProtected && !isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isAuthed && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/register"],
};
