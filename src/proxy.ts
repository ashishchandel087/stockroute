import { NextResponse, type NextRequest } from "next/server";
import { AREA_ROLES, ROLE_HOME, SESSION_COOKIE, verifySession } from "@/lib/session-token";

/**
 * Optimistic route guard: sends people to login, or to their own area.
 * Every page, action and API route still re-checks the user against the database.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session ? ROLE_HOME[session.role] : "/login", req.url));
  }

  if (pathname === "/login") {
    if (req.nextUrl.searchParams.has("expired")) {
      // Server rejected this session (user removed/deactivated): clear it and show login
      const res = NextResponse.next();
      res.cookies.delete(SESSION_COOKIE);
      return res;
    }
    return session ? NextResponse.redirect(new URL(ROLE_HOME[session.role], req.url)) : NextResponse.next();
  }

  const area = Object.keys(AREA_ROLES).find((a) => pathname === a || pathname.startsWith(a + "/"));
  if (area) {
    if (!session) return NextResponse.redirect(new URL("/login", req.url));
    if (!AREA_ROLES[area].includes(session.role)) {
      return NextResponse.redirect(new URL(ROLE_HOME[session.role], req.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/sales/:path*", "/warehouse/:path*", "/delivery/:path*"],
};
