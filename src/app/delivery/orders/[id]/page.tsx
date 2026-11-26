import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getOrderDetail } from "@/lib/order-queries";
import { OrderDetailView } from "@/components/order-detail";

export default async function DeliveryOrderPage({ params }: PageProps<"/delivery/orders/[id]">) {
  const user = await requireRole("admin", "delivery");
  const { id } = await params;
  const d = await getOrderDetail(id);
  if (!d) notFound();
  if (user.role !== "admin" && d.order.deliveryPersonId !== user.id) notFound();
  return <OrderDetailView d={d} role={user.role === "admin" ? "admin" : "delivery"} userId={user.id} backHref="/delivery" />;
}
