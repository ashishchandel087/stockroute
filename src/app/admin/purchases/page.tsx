import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { purchases, suppliers, warehouses } from "@/lib/db/schema";
import { dateOnly, money } from "@/lib/format";
import { Card, Empty, LinkButton, PageHeader, Table } from "@/components/ui";

export default async function PurchasesPage() {
  await requireRole("admin");
  const rows = await db
    .select({
      id: purchases.id,
      no: purchases.purchaseNo,
      invoiceNo: purchases.invoiceNo,
      invoiceDate: purchases.invoiceDate,
      total: purchases.total,
      supplier: suppliers.name,
      warehouse: warehouses.name,
      items: sql<number>`(select count(*)::int from purchase_lines l where l.purchase_id = ${purchases.id})`,
    })
    .from(purchases)
    .innerJoin(suppliers, eq(suppliers.id, purchases.supplierId))
    .innerJoin(warehouses, eq(warehouses.id, purchases.warehouseId))
    .orderBy(desc(purchases.purchaseNo))
    .limit(200);
  return (
    <>
      <PageHeader
        title="Purchases"
        sub="Stock received from suppliers"
        actions={
          <LinkButton href="/admin/purchases/new">
            <Plus size={16} /> New purchase
          </LinkButton>
        }
      />
      <Card>
        {rows.length === 0 ? (
          <Empty>No purchases yet.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>#</th>
                <th>Supplier</th>
                <th className="hidden sm:table-cell">Invoice</th>
                <th className="hidden md:table-cell">Warehouse</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td>
                    <Link href={`/admin/purchases/${r.id}`} className="font-medium text-brand-700">
                      {r.no}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/admin/purchases/${r.id}`}>{r.supplier}</Link>
                    <div className="text-xs text-gray-500">{r.items} items</div>
                  </td>
                  <td className="hidden sm:table-cell text-gray-600">
                    {r.invoiceNo ?? "—"} · {dateOnly(r.invoiceDate)}
                  </td>
                  <td className="hidden md:table-cell text-gray-600">{r.warehouse}</td>
                  <td className="text-right tabular-nums">{money(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
