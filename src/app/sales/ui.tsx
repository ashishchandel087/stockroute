"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ClipboardList, CloudOff, Package, RefreshCw, Search, Store, User } from "lucide-react";
import { cn, STATUS_TONE } from "@/components/ui";
import { STATUS_LABEL } from "@/lib/format";
import type { SyncState } from "./use-sales-store";

export type Tab = "shops" | "orders" | "products" | "account";

const TONE_CLS: Record<string, string> = {
  amber: "bg-amber-50 text-amber-800",
  blue: "bg-brand-50 text-brand-700",
  violet: "bg-violet-50 text-violet-700",
  cyan: "bg-cyan-50 text-cyan-800",
  green: "bg-emerald-50 text-emerald-700",
  gray: "bg-gray-100 text-gray-700",
  red: "bg-red-50 text-red-700",
};

export function Chip({ tone = "gray", children }: { tone?: keyof typeof TONE_CLS; children: ReactNode }) {
  return <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", TONE_CLS[tone])}>{children}</span>;
}

export function StatusChip({ status }: { status: string }) {
  return <Chip tone={STATUS_TONE[status] ?? "gray"}>{STATUS_LABEL[status] ?? status}</Chip>;
}

export function TopBar({
  title,
  sub,
  sync,
  pending,
  onSync,
  onBack,
  action,
}: {
  title: string;
  sub: string;
  sync: SyncState;
  pending: number;
  onSync: () => void;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 bg-brand-600 pt-[env(safe-area-inset-top)] text-white shadow">
      <div className="flex h-14 items-center gap-2 px-2">
        {onBack ? (
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/20" aria-label="Back">
            <ArrowLeft size={22} />
          </button>
        ) : (
          <div className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-xs font-bold">SR</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold leading-tight">{title}</div>
          <div className="truncate text-[11px] leading-tight text-white/75">{sub}</div>
        </div>
        {action}
        <button
          onClick={onSync}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
            !sync.online ? "bg-amber-400 text-amber-950" : pending ? "bg-white text-brand-700" : "bg-white/15",
          )}
        >
          {!sync.online ? <CloudOff size={14} /> : <RefreshCw size={14} className={cn(sync.syncing && "animate-spin")} />}
          {!sync.online ? (pending ? `Offline · ${pending}` : "Offline") : pending ? `${pending} to upload` : "Synced"}
        </button>
      </div>
    </header>
  );
}

export function BottomNav({ active, pending, onTab }: { active: Tab; pending: number; onTab: (t: Tab) => void }) {
  const items = [
    { t: "shops" as const, label: "Shops", Icon: Store },
    { t: "orders" as const, label: "Orders", Icon: ClipboardList, badge: pending },
    { t: "products" as const, label: "Products", Icon: Package },
    { t: "account" as const, label: "Account", Icon: User },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4">
        {items.map(({ t, label, Icon, badge }) => (
          <button
            key={t}
            onClick={() => onTab(t)}
            className={cn("relative flex flex-col items-center gap-0.5 py-2 text-xs", active === t ? "text-brand-700" : "text-gray-500")}
          >
            <Icon size={22} />
            {label}
            {!!badge && (
              <span className="absolute right-[22%] top-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{badge}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-base outline-none focus:border-brand-500"
        type="search"
      />
    </div>
  );
}

export function Chips({ items, value, onChange }: { items: { k: string; l: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
      {items.map((c) => (
        <button
          key={c.k || "all"}
          onClick={() => onChange(c.k)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm",
            value === c.k ? "border-brand-600 bg-brand-600 text-white" : "border-gray-200 bg-white text-gray-700",
          )}
        >
          {c.l}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
        {children}
      </div>
    </div>
  );
}

export function BigButton({
  children,
  onClick,
  variant = "primary",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "success" | "secondary" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-50",
        variant === "primary" && "bg-brand-600 text-white active:bg-brand-700",
        variant === "success" && "bg-emerald-600 text-white active:bg-emerald-700",
        variant === "secondary" && "border border-gray-300 bg-white text-gray-800 active:bg-gray-50",
        variant === "danger" && "border border-red-200 bg-white text-red-700 active:bg-red-50",
      )}
    >
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-xl border border-gray-200 bg-white", className)}>{children}</div>;
}

export function matchAll(hay: string, q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const h = hay.toLowerCase();
  return words.every((w) => h.includes(w));
}

export function getPosition(timeoutMs = 6000): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    const t = setTimeout(() => resolve(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(t);
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) });
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 120_000 },
    );
  });
}

/** Shrinks a camera photo to a small JPEG so it can be stored offline and uploaded on slow networks. */
export async function photoToDataUrl(file: File, maxSide = 900, quality = 0.6): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function ago(iso: string | null) {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function mapsUrl(lat: number, lng: number) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}
