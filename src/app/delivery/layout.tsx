import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";

const NAV: NavItem[] = [
  { href: "/delivery", label: "My deliveries", icon: "delivery", exact: true },
  { href: "/delivery/collections", label: "My collections", icon: "payments" },
];

export default function DeliveryLayout({ children }: LayoutProps<"/delivery">) {
  return (
    <AppShell title="Delivery" nav={NAV}>
      {children}
    </AppShell>
  );
}
