/** Small, dependency-free UI kit (server-safe: no hooks). */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { STATUS_LABEL } from "@/lib/format";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";
type Size = "sm" | "md" | "lg";

export function btn(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none",
    size === "sm" && "h-8 px-3 text-sm",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-12 px-5 text-base",
    variant === "primary" && "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-900",
    variant === "success" && "bg-emerald-600 text-white hover:bg-emerald-700",
    variant === "secondary" && "bg-white text-gray-800 border border-gray-300 hover:bg-gray-50",
    variant === "danger" && "bg-white text-red-700 border border-red-200 hover:bg-red-50",
    variant === "ghost" && "text-gray-700 hover:bg-gray-100",
    extra,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={btn(variant, size, className)} />;
}

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={btn(variant, size, className)} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("rounded-xl border border-gray-200 bg-white", className)} />;
}

export function CardHeader({ title, action, sub }: { title: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
      <div>
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {sub && <p className="text-sm text-gray-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-gray-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "gray" | "blue" | "amber" | "green" | "red" | "violet" | "cyan";
const TONES: Record<Tone, string> = {
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-brand-50 text-brand-700",
  amber: "bg-amber-50 text-amber-800",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
  cyan: "bg-cyan-50 text-cyan-800",
};

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", TONES[tone], className)}>
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<string, Tone> = {
  booked: "amber",
  approved: "blue",
  packed: "violet",
  dispatched: "cyan",
  delivered: "green",
  partially_delivered: "green",
  cancelled: "gray",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function Stat({
  label,
  value,
  href,
  tone,
  sub,
}: {
  label: string;
  value: ReactNode;
  href?: string;
  tone?: "default" | "warn" | "bad";
  sub?: ReactNode;
}) {
  const inner = (
    <>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-700" : "text-gray-900",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </>
  );
  const cls = "block rounded-xl border border-gray-200 bg-white p-4";
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-brand-200 hover:bg-brand-50/30")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm [&_td]:px-4 [&_td]:py-2.5 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-gray-500 [&_thead]:bg-gray-50 [&_tbody_tr]:border-t [&_tbody_tr]:border-gray-100">
        {children}
      </table>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-gray-500">{children}</div>;
}

export function Alert({ tone = "amber", children }: { tone?: "amber" | "red" | "green" | "blue"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "amber" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "red" && "border-red-200 bg-red-50 text-red-800",
        tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "blue" && "border-brand-200 bg-brand-50 text-brand-900",
      )}
    >
      {children}
    </div>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: ReactNode; key: string }[]; active: string }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
            t.key === active ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
      {label}
    </div>
  );
}
