import { asc } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { saveUser } from "../actions";

const ROLES = [
  ["salesman", "Salesman", "Books orders and collects payments in the field (phone app)"],
  ["warehouse", "Warehouse", "Packs and dispatches approved orders"],
  ["delivery", "Delivery", "Delivers orders and collects payment"],
  ["admin", "Admin", "Full access"],
] as const;

function UserFields({ u }: { u?: { name: string; phone: string; role: string; active: boolean } }) {
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      <input name="name" required defaultValue={u?.name} placeholder="Name" className="input sm:col-span-2" />
      <input name="phone" required type="tel" defaultValue={u?.phone} placeholder="Mobile (login)" className="input" />
      <select name="role" defaultValue={u?.role ?? "salesman"} className="input">
        {ROLES.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <input
        name="pin"
        inputMode="numeric"
        maxLength={6}
        placeholder={u ? "New PIN (optional)" : "PIN (4–6 digits)"}
        required={!u}
        className="input"
      />
    </div>
  );
}

export default async function UsersPage() {
  const me = await requireRole("admin");
  const list = await db.select().from(users).orderBy(asc(users.role), asc(users.name));
  return (
    <div className="max-w-4xl">
      <PageHeader title="Staff" sub="Everyone logs in with their mobile number and PIN" />
      <Card className="mb-4">
        <CardHeader title="Add staff member" />
        <ActionForm action={saveUser} resetOnSuccess className="space-y-2 p-4">
          <UserFields />
          <input type="hidden" name="active" value="on" />
          <SubmitButton>Add</SubmitButton>
        </ActionForm>
      </Card>

      <Card>
        <ul className="divide-y divide-gray-100">
          {list.map((u) => (
            <li key={u.id} className="px-4 py-3">
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div>
                    <span className="font-medium">{u.name}</span>
                    {u.id === me.id && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                    <div className="text-sm text-gray-500">{u.phone}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!u.active && <Badge tone="gray">inactive</Badge>}
                    {u.lockedUntil && u.lockedUntil > new Date() && <Badge tone="red">locked</Badge>}
                    <Badge tone={u.role === "admin" ? "violet" : u.role === "salesman" ? "blue" : u.role === "warehouse" ? "amber" : "cyan"}>
                      {u.role}
                    </Badge>
                    <span className="text-sm text-brand-700">Edit</span>
                  </div>
                </summary>
                <ActionForm action={saveUser} className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
                  <input type="hidden" name="id" value={u.id} />
                  <UserFields u={u} />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="active" defaultChecked={u.active} className="h-4 w-4" /> Can log in
                  </label>
                  <SubmitButton size="sm">Save</SubmitButton>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      </Card>
      <div className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
        {ROLES.map(([v, l, d]) => (
          <div key={v}>
            <b className="text-gray-800">{l}:</b> {d}
          </div>
        ))}
      </div>
    </div>
  );
}
