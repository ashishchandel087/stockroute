import { asc } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { retailerTypes, warehouses } from "@/lib/db/schema";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { saveRetailerType, saveWarehouse } from "../actions";

export default async function SettingsPage() {
  await requireRole("admin");
  const [whs, types] = await Promise.all([
    db.select().from(warehouses).orderBy(asc(warehouses.name)),
    db.select().from(retailerTypes).orderBy(asc(retailerTypes.name)),
  ]);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Warehouses / godowns" sub="Stock is kept separately for each" />
          <ul className="divide-y divide-gray-100">
            {whs.map((w) => (
              <li key={w.id} className="px-4 py-3">
                <details>
                  <summary className="flex cursor-pointer list-none items-center justify-between">
                    <span>
                      <span className="font-medium">{w.name}</span>
                      {!w.active && (
                        <Badge tone="gray" className="ml-2">
                          inactive
                        </Badge>
                      )}
                      <span className="block text-sm text-gray-500">{w.address}</span>
                    </span>
                    <span className="text-sm text-brand-700">Edit</span>
                  </summary>
                  <ActionForm action={saveWarehouse} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={w.id} />
                    <input name="name" defaultValue={w.name} className="input" />
                    <input name="address" defaultValue={w.address ?? ""} placeholder="Address" className="input" />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="active" defaultChecked={w.active} /> Active
                    </label>
                    <SubmitButton size="sm">Save</SubmitButton>
                  </ActionForm>
                </details>
              </li>
            ))}
          </ul>
          <ActionForm action={saveWarehouse} resetOnSuccess className="space-y-2 border-t border-gray-100 p-4">
            <input name="name" placeholder="New warehouse name" className="input" />
            <input name="address" placeholder="Address" className="input" />
            <SubmitButton size="sm">Add warehouse</SubmitButton>
          </ActionForm>
        </Card>

        <Card>
          <CardHeader title="Retailer types" sub="Each type can have its own price per product" />
          <ul className="divide-y divide-gray-100">
            {types.map((t) => (
              <li key={t.id} className="px-4 py-2">
                <ActionForm action={saveRetailerType} className="flex gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <input name="name" defaultValue={t.name} className="input h-9" />
                  <SubmitButton size="sm" variant="secondary">
                    Rename
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
          <ActionForm action={saveRetailerType} resetOnSuccess className="flex gap-2 border-t border-gray-100 p-4">
            <input name="name" placeholder="New type, e.g. Chemist" className="input" />
            <SubmitButton size="sm">Add</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
