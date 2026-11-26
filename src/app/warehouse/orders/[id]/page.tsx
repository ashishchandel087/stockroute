import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getOrderDetail } from "@/lib/order-queries";
import { OrderDetailView } from "@/components/order-detail";

export default async function WarehouseOrderPage({ params }: PageProps<"/warehouse/orders/[id]">) {
  const user = await requireRole("admin", "warehouse");
  const { id } = await params;
  const d = await getOrderDetail(id);
  if (!d) notFound();
  return (
    <OrderDetailView
      d={d}
      role="warehouse"
      userId={user.id}
      backHref={d.order.status === "packed" ? "/warehouse?tab=packed" : "/warehouse"}
    />
  );
}
