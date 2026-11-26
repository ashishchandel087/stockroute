import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/admin/orders", label: "Orders", icon: "orders" },
  { href: "/admin/retailers", label: "Retailers", icon: "retailers" },
  { href: "/admin/products", label: "Products & prices", icon: "products" },
  { href: "/admin/stock", label: "Stock", icon: "stock" },
  { href: "/admin/purchases", label: "Purchases", icon: "purchases" },
  { href: "/admin/payments", label: "Payments", icon: "payments" },
  { href: "/admin/users", label: "Staff", icon: "users" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
  { href: "/sales", label: "Sales app", icon: "sales" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppShell title="Admin" nav={NAV}>
      {children}
    </AppShell>
  );
}
