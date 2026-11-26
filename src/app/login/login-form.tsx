"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/form-bits";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <label className="block">
        <span className="label">Mobile number</span>
        <input
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="username"
          placeholder="10-digit mobile"
          defaultValue={state.phone}
          required
          className="input h-12 text-lg tracking-wide"
        />
      </label>
      <label className="block">
        <span className="label">PIN</span>
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          pattern="\d{4,6}"
          maxLength={6}
          placeholder="••••"
          required
          className="input h-12 text-lg tracking-[0.4em]"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <SubmitButton size="lg" className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
      <p className="text-center text-xs text-gray-500">Forgot your PIN? Ask the admin to reset it.</p>
    </form>
  );
}
