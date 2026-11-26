import Link from "next/link";
import { and, asc, eq, ilike, or, type SQL } from "drizzle-orm";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { retailers, retailerTypes } from "@/lib/db/schema";
import { getBalances } from "@/lib/ledger";
import { money } from "@/lib/format";
import { Badge, Card, Empty, LinkButton, PageHeader, Table, cn } from "@/components/ui";

export default async function RetailersPage({ searchParams }: PageProps<"/admin/retailers">) {
  await requireRole("admin");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const sort = typeof sp.sort === "string" ? sp.sort : "name";
  const status = typeof sp.status === "string" ? sp.status : "";

  const where: SQL[] = [];
  if (q) where.push(or(ilike(retailers.name, `%${q}%`), ilike(retailers.area, `%${q}%`), ilike(retailers.phone, `%${q}%`), ilike(retailers.ownerName, `%${q}%`))!);
  if (status === "active" || status === "pending" || status === "inactive") where.push(eq(retailers.status, status));

  const [rows, balances] = await Promise.all([
    db
      .select({ r: retailers, type: retailerTypes.name })
      .from(retailers)
      .leftJoin(retailerTypes, eq(retailerTypes.id, retailers.typeId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(retailers.name))
      .limit(1000),
    getBalances(),
  ]);
  const list = rows.map((x) => ({ ...x, bal: balances.get(x.r.id) }));
  if (sort === "outstanding") list.sort((a, b) => (b.bal?.outstanding ?? 0) - (a.bal?.outstanding ?? 0));
  if (sort === "overdue") list.sort((a, b) => (b.bal?.overdue ?? 0) - (a.bal?.overdue ?? 0));

  return (
    <>
      <PageHeader
        title="Retailers"
        sub={`${rows.length} shops`}
        actions={
          <LinkButton href="/admin/retailers/new">
            <Plus size={16} /> Add retailer
          </LinkButton>
        }
      />
      <form className="mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search shop, owner, area, phone" className="input h-10 max-w-xs" />
        <select name="sort" defaultValue={sort} className="input h-10 w-44">
          <option value="name">Sort: Name</option>
          <option value="outstanding">Sort: Outstanding</option>
          <option value="overdue">Sort: Overdue</option>
        </select>
        <select name="status" defaultValue={status} className="input h-10 w-36">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="input h-10 w-auto bg-gray-50 px-4 font-medium">Apply</button>
      </form>
      <Card>
        {list.length === 0 ? (
          <Empty>No retailers found.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Shop</th>
                <th className="hidden md:table-cell">Type</th>
                <th className="text-right">Outstanding</th>
                <th className="text-right hidden sm:table-cell">Overdue</th>
                <th className="text-right hidden lg:table-cell">Credit limit</th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ r, type, bal }) => {
                const over = r.creditLimit != null && (bal?.outstanding ?? 0) > r.creditLimit;
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td>
                      <Link href={`/admin/retailers/${r.id}`} className="font-medium text-gray-900 hover:text-brand-700">
                        {r.name}
                      </Link>
                      {r.status !== "active" && (
                        <Badge tone={r.status === "pending" ? "amber" : "gray"} className="ml-1.5">
                          {r.status}
                        </Badge>
                      )}
                      <div className="text-xs text-gray-500">
                        {[r.ownerName, r.area, r.phone].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="hidden md:table-cell text-gray-600">{type ?? "—"}</td>
                    <td className={cn("text-right tabular-nums", over && "font-semibold text-red-700")}>{money(bal?.outstanding)}</td>
                    <td className={cn("text-right tabular-nums hidden sm:table-cell", (bal?.overdue ?? 0) > 0 && "text-red-700")}>
                      {money(bal?.overdue)}
                    </td>
                    <td className="text-right tabular-nums hidden lg:table-cell text-gray-600">
                      {r.creditLimit == null ? "—" : money(r.creditLimit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
