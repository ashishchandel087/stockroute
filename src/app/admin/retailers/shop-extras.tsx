import { ActionForm, SubmitButton } from "@/components/form-bits";
import { Card, CardHeader, Field } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { approveShop, rejectShop } from "../actions";

type Shop = {
  id: string;
  name: string;
  typeId: string | null;
  defaultWarehouseId: string | null;
  creditDays: number;
  photo: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: Date;
  updatedAt: Date | null;
};

/** Shown on a shop added by a salesman: set terms and approve, or reject. */
export function ApproveShopCard({
  shop,
  addedBy,
  waitingOrders,
  types,
  warehouses,
}: {
  shop: Shop;
  addedBy: string | null;
  waitingOrders: number;
  types: { id: string; name: string }[];
  warehouses: { id: string; name: string }[];
}) {
  return (
    <Card className="mb-4 border-amber-300">
      <CardHeader
        title="New shop waiting for approval"
        sub={`Added by ${addedBy ?? "field staff"} on ${dateTime(shop.createdAt)}${waitingOrders ? ` · ${waitingOrders} order(s) waiting` : ""}`}
      />
      <ActionForm action={approveShop} className="grid gap-3 p-4 sm:grid-cols-4">
        <input type="hidden" name="id" value={shop.id} />
        <Field label="Retailer type">
          <select name="typeId" defaultValue={shop.typeId ?? ""} className="input">
            <option value="">— None (base price) —</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Supply from">
          <select name="defaultWarehouseId" defaultValue={shop.defaultWarehouseId ?? warehouses[0]?.id} className="input">
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Credit limit (₹)" hint="Blank = no limit, 0 = cash only">
          <input name="creditLimit" inputMode="decimal" defaultValue="0" className="input" />
        </Field>
        <Field label="Credit days">
          <input name="creditDays" type="number" min={0} defaultValue={shop.creditDays} className="input" />
        </Field>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-4">
          <SubmitButton variant="success" pendingText="Approving…">
            Approve shop
          </SubmitButton>
          <button
            formAction={rejectShop}
            formNoValidate
            className="h-10 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Reject{waitingOrders ? " & cancel its orders" : ""}
          </button>
        </div>
      </ActionForm>
    </Card>
  );
}

export function ShopPhotoCard({ shop }: { shop: Shop }) {
  if (!shop.photo && shop.lat == null) return null;
  return (
    <Card className="overflow-hidden">
      {shop.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shop.photo} alt={`${shop.name} shop front`} className="h-48 w-full object-cover" />
      )}
      <div className="flex items-center justify-between px-4 py-2 text-sm">
        {shop.lat != null && shop.lng != null ? (
          <a href={`https://maps.google.com/?q=${shop.lat},${shop.lng}`} target="_blank" rel="noreferrer" className="font-medium text-brand-700">
            Open location in Maps
          </a>
        ) : (
          <span className="text-gray-500">No location captured</span>
        )}
        {shop.updatedAt && <span className="text-xs text-gray-400">Updated {dateTime(shop.updatedAt)}</span>}
      </div>
    </Card>
  );
}
