import Link from "next/link";
import { sql } from "drizzle-orm";
import { CheckCircle2, Circle } from "lucide-react";
import { db } from "@/lib/db/client";
import { Card, CardHeader } from "@/components/ui";

/** Checklist for a fresh installation. Disappears once every step is done. */
export async function GettingStarted() {
  const res = await db.execute<{ types: number; products: number; stock: number; shops: number; staff: number }>(sql`
    select
      (select count(*)::int from retailer_types) as types,
      (select count(*)::int from products) as products,
      (select count(*)::int from batches where qty > 0) as stock,
      (select count(*)::int from retailers) as shops,
      (select count(*)::int from users where role <> 'admin') as staff
  `);
  const c = res.rows[0];
  const steps = [
    { done: c.types > 0, label: "Add retailer types (e.g. Retail, Wholesale) for type-wise prices", href: "/admin/settings" },
    { done: c.products > 0, label: "Add your products with case size and prices", href: "/admin/products/new" },
    { done: c.stock > 0, label: "Enter opening stock as a purchase (batch & expiry)", href: "/admin/purchases/new" },
    { done: c.shops > 0, label: "Add retailers (salesmen can also add them from the app)", href: "/admin/retailers/new" },
    { done: c.staff > 0, label: "Add salesmen, warehouse and delivery staff", href: "/admin/users" },
  ];
  if (steps.every((s) => s.done)) return null;
  return (
    <Card className="mb-5 border-brand-200">
      <CardHeader title="Getting started" sub={`${steps.filter((s) => s.done).length} of ${steps.length} done`} />
      <ul className="divide-y divide-gray-100">
        {steps.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50">
              {s.done ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" /> : <Circle size={18} className="shrink-0 text-gray-300" />}
              <span className={s.done ? "text-gray-400 line-through" : "text-gray-800"}>{s.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
