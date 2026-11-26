"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { ICONS, type NavItem } from "./nav-links";
import { cn } from "./ui";

const isActive = (item: NavItem, pathname: string) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

/** App-style bottom tabs for staff screens on phones. The first 4 items are tabs; the rest go under "More". */
export function MobileTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return <TabBar items={items} pathname={pathname} />;
}

/** Same bar without reading the URL (Suspense fallback). */
export function TabBar({ items, pathname = "" }: { items: NavItem[]; pathname?: string }) {
  const [open, setOpen] = useState(false);
  const tabs = items.length > 5 ? items.slice(0, 4) : items;
  const more = items.length > 5 ? items.slice(4) : [];
  const moreActive = more.some((i) => isActive(i, pathname));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length + (more.length ? 1 : 0)}, minmax(0, 1fr))` }}>
          {tabs.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", isActive(item, pathname) ? "text-brand-700" : "text-gray-500")}
              >
                <Icon size={21} />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            );
          })}
          {more.length > 0 && (
            <button
              onClick={() => setOpen(true)}
              className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", moreActive ? "text-brand-700" : "text-gray-500")}
            >
              <MoreHorizontal size={21} />
              More
            </button>
          )}
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="w-full rounded-t-2xl bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
            <div className="grid grid-cols-3 gap-2">
              {more.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs font-medium",
                      isActive(item, pathname) ? "border-brand-200 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-700",
                    )}
                  >
                    <Icon size={22} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
