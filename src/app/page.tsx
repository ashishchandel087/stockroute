import Link from "next/link";

// The proxy sends "/" to the right home for the signed-in role. This is only a fallback.
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Link href="/login" className="text-brand-700 underline">
        Go to login
      </Link>
    </main>
  );
}
