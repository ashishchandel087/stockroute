import { ActionForm, SubmitButton } from "@/components/form-bits";
import { Field } from "@/components/ui";
import { paiseToInput } from "@/lib/format";
import { saveRetailer } from "../actions";

type Retailer = {
  id: string;
  name: string;
  ownerName: string | null;
  phone: string | null;
  address: string | null;
  area: string | null;
  gstin: string | null;
  typeId: string | null;
  defaultWarehouseId: string | null;
  creditLimit: number | null;
  creditDays: number;
  openingBalance: number;
  status: "active" | "pending" | "inactive";
};

export function RetailerForm({
  retailer,
  types,
  warehouses,
  areas,
}: {
  retailer?: Retailer;
  types: { id: string; name: string }[];
  warehouses: { id: string; name: string }[];
  areas: string[];
}) {
  return (
    <ActionForm action={saveRetailer}>
      {retailer && <input type="hidden" name="id" value={retailer.id} />}
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <Field label="Shop name *" className="sm:col-span-2">
          <input name="name" required defaultValue={retailer?.name} className="input" />
        </Field>
        <Field label="Owner name">
          <input name="ownerName" defaultValue={retailer?.ownerName ?? ""} className="input" />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" defaultValue={retailer?.phone ?? ""} className="input" />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <input name="address" defaultValue={retailer?.address ?? ""} className="input" />
        </Field>
        <Field label="Area / locality">
          <input name="area" list="areas" defaultValue={retailer?.area ?? ""} className="input" />
          <datalist id="areas">
            {areas.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>
        <Field label="GSTIN">
          <input name="gstin" defaultValue={retailer?.gstin ?? ""} className="input uppercase" />
        </Field>
        <Field label="Retailer type" hint="Decides which price list applies">
          <select name="typeId" defaultValue={retailer?.typeId ?? ""} className="input">
            <option value="">— None (base price) —</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Supply from warehouse">
          <select name="defaultWarehouseId" defaultValue={retailer?.defaultWarehouseId ?? warehouses[0]?.id} className="input">
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Credit limit (₹)" hint="Blank = no limit. Orders above it need your approval.">
          <input name="creditLimit" inputMode="decimal" defaultValue={paiseToInput(retailer?.creditLimit)} className="input" />
        </Field>
        <Field label="Credit days" hint="Bills older than this are overdue">
          <input name="creditDays" type="number" min={0} defaultValue={retailer?.creditDays ?? 15} className="input" />
        </Field>
        <Field label="Opening balance (₹)" hint="Dues from before using this app">
          <input name="openingBalance" inputMode="decimal" defaultValue={paiseToInput(retailer?.openingBalance ?? 0)} className="input" />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={retailer?.status ?? "active"} className="input">
            <option value="active">Active</option>
            <option value="pending">Pending approval</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
      </div>
      <div className="border-t border-gray-100 px-4 py-3">
        <SubmitButton>{retailer ? "Save changes" : "Add retailer"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
