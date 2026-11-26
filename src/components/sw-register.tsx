"use client";

import { useEffect } from "react";

/** Registers the service worker (production only) so the installed app opens offline. */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}
