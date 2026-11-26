"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Store,
  Boxes,
  Truck,
  Wallet,
  Users,
  Settings,
  PackageCheck,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { cn } from "./ui";

export const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  products: Package,
  retailers: Store,
  stock: Boxes,
  purchases: PackageCheck,
  payments: Wallet,
  users: Users,
  settings: Settings,
  delivery: Truck,
  sales: Smartphone,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean };

/** Highlights the current page. Reads the URL, so render it inside <Suspense>. */
export function NavLinks({ items, variant }: { items: NavItem[]; variant: "side" | "top" }) {
  const pathname = usePathname();
  return <NavLinkList items={items} variant={variant} pathname={pathname} />;
}

/** Plain links (no URL access) — also used as the Suspense fallback. */
export function NavLinkList({ items, variant, pathname = "" }: { items: NavItem[]; variant: "side" | "top"; pathname?: string }) {
  return (
    <>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              variant === "side"
                ? "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium"
                : "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
              active ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
            )}
          >
            <Icon size={variant === "side" ? 18 : 15} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
