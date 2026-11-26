import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { batches, products, purchaseLines, purchases, suppliers, warehouses } from "@/lib/db/schema";
import { dateOnly, money, qtyLabel } from "@/lib/format";
import { Alert, Card, PageHeader, Table } from "@/components/ui";

export default async function PurchasePage({ params, searchParams }: PageProps<"/admin/purchases/[id]">) {
  await requireRole("admin");
  const { id } = await params;
  const sp = await searchParams;
  const [p] = await db
    .select({ p: purchases, supplier: suppliers.name, warehouse: warehouses.name })
    .from(purchases)
    .innerJoin(suppliers, eq(suppliers.id, purchases.supplierId))
    .innerJoin(warehouses, eq(warehouses.id, purchases.warehouseId))
    .where(eq(purchases.id, id));
  if (!p) notFound();
  const lines = await db
    .select({
      l: purchaseLines,
      name: products.name,
      unit: products.unit,
      caseSize: products.caseSize,
      batchNo: batches.batchNo,
      expiry: batches.expiry,
    })
    .from(purchaseLines)
    .innerJoin(products, eq(products.id, purchaseLines.productId))
    .innerJoin(batches, eq(batches.id, purchaseLines.batchId))
    .where(eq(purchaseLines.purchaseId, id))
    .orderBy(asc(products.name));
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={`Purchase #${p.p.purchaseNo}`}
        sub={`${p.supplier} · ${p.warehouse} · Invoice ${p.p.invoiceNo ?? "—"} · ${dateOnly(p.p.invoiceDate)}`}
      />
      {sp.saved && (
        <div className="mb-3">
          <Alert tone="green">Purchase saved and stock added.</Alert>
        </div>
      )}
      <Card>
        <Table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Batch</th>
              <th>Qty</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(({ l, name, unit, caseSize, batchNo, expiry }) => (
              <tr key={l.id}>
                <td className="font-medium">{name}</td>
                <td className="text-gray-600">
                  {batchNo}
                  {expiry && <div className="text-xs">exp {dateOnly(expiry)}</div>}
                </td>
                <td>{qtyLabel(l.qty, caseSize, unit)}</td>
                <td className="text-right tabular-nums">{money(l.rate)}</td>
                <td className="text-right tabular-nums">{money(l.rate * l.qty)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 font-semibold">
              <td className="px-4 py-2.5" colSpan={4}>
                Total
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{money(p.p.total)}</td>
            </tr>
          </tfoot>
        </Table>
      </Card>
    </div>
  );
}
