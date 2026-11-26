import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { SESSION_COOKIE, verifySession, type Role } from "@/lib/session-token";

export type CurrentUser = { id: string; name: string; role: Role; phone: string };

/** Reads the session cookie and confirms the user still exists and is active. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);
  if (!claims) return null;
  const [u] = await db
    .select({ id: users.id, name: users.name, role: users.role, phone: users.phone, active: users.active })
    .from(users)
    .where(eq(users.id, claims.sub));
  if (!u || !u.active) return null;
  return { id: u.id, name: u.name, role: u.role, phone: u.phone };
}

/** For pages and Server Actions: returns the user or redirects to login. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  // `expired` makes the proxy drop the stale cookie (deactivated or deleted user),
  // otherwise /login would bounce a still-signed token straight back here.
  if (!user) redirect("/login?expired=1");
  if (roles.length && !roles.includes(user.role)) redirect("/login?expired=1");
  return user;
}

/** For Route Handlers: returns the user, or null if not allowed. */
export async function apiUser(...roles: Role[]): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (roles.length && !roles.includes(user.role)) return null;
  return user;
}
