/**
 * Signed session token (JWT in an httpOnly cookie).
 * Kept free of database imports so the proxy can use it for fast route checks.
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
export const SESSION_DAYS = 30;

export type Role = "admin" | "salesman" | "warehouse" | "delivery";
export type SessionClaims = { sub: string; role: Role; name: string };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set (32+ characters) in production");
    }
    return new TextEncoder().encode("dev-only-insecure-secret-change-me-please-0000");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role, name: claims.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.role !== "string") return null;
    return { sub: payload.sub, role: payload.role as Role, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}

/** Where each role lands after login, and which areas each role may open. */
export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  salesman: "/sales",
  warehouse: "/warehouse",
  delivery: "/delivery",
};

export const AREA_ROLES: Record<string, Role[]> = {
  "/admin": ["admin"],
  "/sales": ["admin", "salesman"],
  "/warehouse": ["admin", "warehouse"],
  "/delivery": ["admin", "delivery"],
};
