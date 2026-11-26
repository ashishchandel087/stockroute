import type { Metadata } from "next";
import { CloudOff } from "lucide-react";

export const metadata: Metadata = { title: "Offline" };

/** Shown by the service worker when an office screen is opened without internet. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <CloudOff size={30} />
      </div>
      <h1 className="text-xl font-semibold">You are offline</h1>
      <p className="max-w-sm text-sm text-gray-600">
        This screen needs internet. Salesmen can keep booking orders in the sales app, which works offline.
      </p>
      <div className="flex gap-2">
        <a href="/sales" className="rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white">
          Open sales app
        </a>
        <a href="" className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-800">
          Try again
        </a>
      </div>
    </main>
  );
}
