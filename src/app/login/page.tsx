import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-[#f5f6f8] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white">
            SR
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">StockRoute</h1>
          <p className="text-sm text-gray-500">Sign in with your mobile number and PIN</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
