import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { batches, products, warehouses } from "@/lib/db/schema";
import { stockLevels } from "@/lib/stock";
import { dateOnly, qtyLabel } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { Card, CardHeader, Empty, Field, PageHeader, Table } from "@/components/ui";
import { adjustStock } from "../../actions";

export default async function AdjustStockPage({ searchParams }: PageProps<"/admin/stock/adjust">) {
  await requireRole("admin");
  const sp = await searchParams;
  const productId = typeof sp.productId === "string" ? sp.productId : "";
  const [p] = productId ? await db.select().from(products).where(eq(products.id, productId)) : [];
  if (!p) notFound();
  const whs = await db.select().from(warehouses).where(eq(warehouses.active, true)).orderBy(asc(warehouses.name));
  const wh = typeof sp.wh === "string" && whs.some((w) => w.id === sp.wh) ? sp.wh : whs[0]?.id;
  const rows = await db
    .select({ b: batches, warehouse: warehouses.name })
    .from(batches)
    .innerJoin(warehouses, eq(warehouses.id, batches.warehouseId))
    .where(eq(batches.productId, p.id))
    .orderBy(asc(warehouses.name), asc(batches.expiry));
  const levels = await Promise.all(whs.map(async (w) => [w, (await stockLevels(w.id, [p.id])).get(p.id)] as const));

  return (
    <div className="max-w-4xl">
      <PageHeader title={p.name} sub={`${p.sku} · ${p.caseSize > 1 ? `${p.caseSize} ${p.unit} per case` : p.unit}`} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {levels.map(([w, l]) => (
          <Card key={w.id} className="p-4">
            <div className="text-sm font-medium text-gray-500">{w.name}</div>
            <div className="mt-1 text-sm">
              On hand <b>{qtyLabel(l?.onHand ?? 0, p.caseSize, p.unit)}</b> · Reserved {qtyLabel(l?.reserved ?? 0, p.caseSize, p.unit)} ·
              Available <b>{qtyLabel(l?.available ?? 0, p.caseSize, p.unit)}</b>
            </div>
          </Card>
        ))}
      </div>
      <Card className="mb-4">
        <CardHeader title="Batches" />
        {rows.length === 0 ? (
          <Empty>No stock received yet.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th className="text-right">On hand</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ b, warehouse }) => (
                <tr key={b.id}>
                  <td>{warehouse}</td>
                  <td className="font-medium">{b.batchNo}</td>
                  <td>{dateOnly(b.expiry)}</td>
                  <td className="text-right">{qtyLabel(b.qty, p.caseSize, p.unit)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card>
        <CardHeader title="Adjust stock" sub="For damage, expiry write-off, or correcting a physical count. Every change is logged." />
        <ActionForm action={adjustStock} resetOnSuccess className="grid gap-3 p-4 sm:grid-cols-3">
          <input type="hidden" name="productId" value={p.id} />
          <Field label="Warehouse">
            <select name="warehouseId" defaultValue={wh} className="input">
              {whs.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Batch">
            <input name="batchNo" list="batches" required className="input uppercase" placeholder="Pick or type new" />
            <datalist id="batches">
              {[...new Set(rows.map((r) => r.b.batchNo))].map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Field>
          <Field label="Expiry (new batch only)">
            <input name="expiry" type="date" className="input" />
          </Field>
          <Field label="Add or remove">
            <select name="direction" className="input" defaultValue="remove">
              <option value="remove">Remove (−)</option>
              <option value="add">Add (+)</option>
            </select>
          </Field>
          <Field label={`Quantity (${p.unit})`}>
            <input name="qty" type="number" min={1} required className="input" />
          </Field>
          <Field label="Reason">
            <input name="reason" required placeholder="Damaged, expired, count…" className="input" />
          </Field>
          <div className="sm:col-span-3">
            <SubmitButton>Save adjustment</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
