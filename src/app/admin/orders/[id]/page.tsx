import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getOrderDetail } from "@/lib/order-queries";
import { OrderDetailView } from "@/components/order-detail";

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const user = await requireRole("admin");
  const { id } = await params;
  const d = await getOrderDetail(id);
  if (!d) notFound();
  return <OrderDetailView d={d} role="admin" userId={user.id} backHref="/admin/orders" />;
}
