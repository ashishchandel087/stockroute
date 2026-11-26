import { requireRole } from "@/lib/auth";
import { listOrders } from "@/lib/order-queries";
import { OrderList } from "@/components/order-list";
import { PageHeader, Tabs } from "@/components/ui";

export default async function WarehouseHome({ searchParams }: PageProps<"/warehouse">) {
  await requireRole("admin", "warehouse");
  const sp = await searchParams;
  const tab = sp.tab === "packed" ? "packed" : "approved";
  const [toPack, toDispatch] = await Promise.all([
    listOrders({ status: ["approved"] }),
    listOrders({ status: ["packed"] }),
  ]);
  const rows = tab === "packed" ? toDispatch : toPack;
  return (
    <>
      <PageHeader title="Warehouse" sub="Pack approved orders, then hand them to delivery" />
      <Tabs
        active={tab}
        items={[
          { key: "approved", label: `To pack (${toPack.length})`, href: "/warehouse" },
          { key: "packed", label: `To dispatch (${toDispatch.length})`, href: "/warehouse?tab=packed" },
        ]}
      />
      <OrderList
        rows={rows}
        hrefBase="/warehouse/orders"
        empty={tab === "packed" ? "Nothing waiting for dispatch." : "No approved orders waiting to be packed."}
      />
    </>
  );
}
