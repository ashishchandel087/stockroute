import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { NavLinkList, NavLinks, type NavItem } from "./nav-links";
import { MobileTabBar, TabBar } from "./mobile-tab-bar";

async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="text-right leading-tight">
        <div className="text-sm font-medium text-gray-900">{user.name}</div>
        <div className="text-xs capitalize text-gray-500">{user.role}</div>
      </div>
      <form action={logout}>
        <button
          type="submit"
          title="Log out"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <LogOut size={17} />
        </button>
      </form>
    </div>
  );
}

/**
 * Layout for staff areas. The nav is static; the signed-in user streams in behind Suspense.
 * Pages render inside their own Suspense boundary (loading.tsx) and re-check the role themselves.
 */
export function AppShell({ title, nav, children }: { title: string; nav: NavItem[]; children: ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex">
        <Link href="/" className="flex items-center gap-2 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            SR
          </span>
          <span className="font-semibold text-gray-900">
            StockRoute <span className="font-normal text-gray-400">· {title}</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          <Suspense fallback={<NavLinkList items={nav} variant="side" />}>
            <NavLinks items={nav} variant="side" />
          </Suspense>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-8">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                SR
              </span>
              <span className="font-semibold">{title}</span>
            </Link>
            <div className="hidden lg:block" />
            <Suspense fallback={<div className="h-9" />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 pb-24 pt-5 lg:px-8 lg:py-7">{children}</main>
      </div>
      {/* Phones: app-style bottom tabs */}
      <Suspense fallback={<TabBar items={nav} />}>
        <MobileTabBar items={nav} />
      </Suspense>
    </div>
  );
}
