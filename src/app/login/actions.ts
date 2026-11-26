"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { ROLE_HOME, SESSION_COOKIE, SESSION_DAYS, signSession } from "@/lib/session-token";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export type LoginState = { error?: string; phone?: string };

function normalizePhone(v: unknown): string {
  const digits = String(v ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const phone = normalizePhone(form.get("phone"));
  const pin = String(form.get("pin") ?? "").trim();
  if (phone.length !== 10 || !/^\d{4,6}$/.test(pin)) {
    return { error: "Enter your 10-digit mobile number and 4–6 digit PIN.", phone };
  }

  const [user] = await db.select().from(users).where(eq(users.phone, phone));
  if (!user || !user.active) return { error: "Mobile number or PIN is wrong.", phone };

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Too many wrong PINs. Try again in ${mins} min or ask the admin to reset it.`, phone };
  }

  const ok = await bcrypt.compare(pin, user.pinHash);
  if (!ok) {
    const attempts = user.failedAttempts + 1;
    await db
      .update(users)
      .set({
        failedAttempts: attempts >= MAX_ATTEMPTS ? 0 : attempts,
        lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
      })
      .where(eq(users.id, user.id));
    const left = MAX_ATTEMPTS - attempts;
    return {
      error: left > 0 ? `Mobile number or PIN is wrong. ${left} tries left.` : `Locked for ${LOCK_MINUTES} minutes.`,
      phone,
    };
  }

  await db.update(users).set({ failedAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id));

  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  redirect(ROLE_HOME[user.role]);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
