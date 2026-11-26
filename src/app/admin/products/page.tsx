import Link from "next/link";
import { and, asc, eq, ilike, or, type SQL } from "drizzle-orm";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { money } from "@/lib/format";
import { Alert, Badge, Card, Empty, LinkButton, PageHeader, Table } from "@/components/ui";

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireRole("admin");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const cat = typeof sp.category === "string" ? sp.category : "";

  const where: SQL[] = [];
  if (q) where.push(or(ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`), ilike(products.brand, `%${q}%`))!);
  if (cat) where.push(eq(products.category, cat));

  const [rows, cats] = await Promise.all([
    db.select().from(products).where(where.length ? and(...where) : undefined).orderBy(asc(products.name)).limit(500),
    db.selectDistinct({ c: products.category }).from(products).orderBy(asc(products.category)),
  ]);

  return (
    <>
      <PageHeader
        title="Products & prices"
        sub="Base price applies to everyone. Set retailer-type prices inside each product, and special prices on the retailer."
        actions={
          <LinkButton href="/admin/products/new">
            <Plus size={16} /> Add product
          </LinkButton>
        }
      />
      {sp.saved && <div className="mb-3"><Alert tone="green">Product saved.</Alert></div>}
      <form className="mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, SKU or brand" className="input h-10 max-w-xs" />
        <select name="category" defaultValue={cat} className="input h-10 w-48">
          <option value="">All categories</option>
          {cats.filter((c) => c.c).map((c) => (
            <option key={c.c} value={c.c!}>
              {c.c}
            </option>
          ))}
        </select>
        <button className="input h-10 w-auto bg-gray-50 px-4 font-medium">Filter</button>
      </form>
      <Card>
        {rows.length === 0 ? (
          <Empty>No products found.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="hidden md:table-cell">Category</th>
                <th className="hidden sm:table-cell">Case</th>
                <th className="text-right">MRP</th>
                <th className="text-right">Base price</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td>
                    <Link href={`/admin/products/${p.id}`} className="font-medium text-gray-900 hover:text-brand-700">
                      {p.name}
                    </Link>
                    <div className="text-xs text-gray-500">
                      {p.sku}
                      {p.brand && ` · ${p.brand}`}
                      {!p.active && (
                        <Badge tone="gray" className="ml-1.5">
                          inactive
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="hidden md:table-cell text-gray-600">{p.category ?? "—"}</td>
                  <td className="hidden sm:table-cell text-gray-600">
                    {p.caseSize > 1 ? `${p.caseSize} ${p.unit}` : `per ${p.unit}`}
                  </td>
                  <td className="text-right tabular-nums text-gray-600">{money(p.mrp)}</td>
                  <td className="text-right font-medium tabular-nums">{money(p.basePrice)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
