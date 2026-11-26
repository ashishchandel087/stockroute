import { requireRole } from "@/lib/auth";
import { listOrders } from "@/lib/order-queries";
import { OrderList } from "@/components/order-list";
import { PageHeader, Tabs } from "@/components/ui";

export default async function DeliveryHome({ searchParams }: PageProps<"/delivery">) {
  const user = await requireRole("admin", "delivery");
  const sp = await searchParams;
  const tab = sp.tab === "done" ? "done" : "pending";
  // Admins see every delivery; delivery staff only their own
  const mine = user.role === "admin" ? {} : { deliveryPersonId: user.id };
  const rows = await listOrders({
    ...mine,
    status: tab === "done" ? ["delivered", "partially_delivered"] : ["dispatched"],
    limit: tab === "done" ? 50 : 200,
  });
  return (
    <>
      <PageHeader title="Deliveries" sub="Tap an order to record delivery and payment" />
      <Tabs
        active={tab}
        items={[
          { key: "pending", label: "To deliver", href: "/delivery" },
          { key: "done", label: "Delivered", href: "/delivery?tab=done" },
        ]}
      />
      <OrderList rows={rows} hrefBase="/delivery/orders" empty={tab === "done" ? "Nothing delivered yet." : "No orders assigned to you right now."} />
    </>
  );
}
