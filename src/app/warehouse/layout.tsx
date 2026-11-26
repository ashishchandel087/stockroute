import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";

const NAV: NavItem[] = [{ href: "/warehouse", label: "Orders", icon: "orders" }];

export default function WarehouseLayout({ children }: LayoutProps<"/warehouse">) {
  return (
    <AppShell title="Warehouse" nav={NAV}>
      {children}
    </AppShell>
  );
}
