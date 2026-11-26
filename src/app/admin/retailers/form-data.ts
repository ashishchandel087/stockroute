import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { retailers, retailerTypes, warehouses } from "@/lib/db/schema";

export async function retailerFormOptions() {
  const [types, whs, areas] = await Promise.all([
    db.select({ id: retailerTypes.id, name: retailerTypes.name }).from(retailerTypes).orderBy(asc(retailerTypes.name)),
    db.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).where(eq(warehouses.active, true)).orderBy(asc(warehouses.name)),
    db.selectDistinct({ a: retailers.area }).from(retailers).orderBy(asc(retailers.area)),
  ]);
  return { types, warehouses: whs, areas: areas.map((a) => a.a).filter(Boolean) as string[] };
}
