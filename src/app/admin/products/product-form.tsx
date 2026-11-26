import { ActionForm, SubmitButton } from "@/components/form-bits";
import { Card, CardHeader, Field } from "@/components/ui";
import { paiseToInput } from "@/lib/format";
import { saveProduct } from "../actions";

type Product = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string;
  caseSize: number;
  mrp: number;
  basePrice: number;
  active: boolean;
};

export function ProductForm({
  product,
  types,
  typePrices,
  categories,
}: {
  product?: Product;
  types: { id: string; name: string }[];
  typePrices: Record<string, number>;
  categories: string[];
}) {
  return (
    <ActionForm action={saveProduct} className="space-y-4">
      {product && <input type="hidden" name="id" value={product.id} />}
      <Card>
        <CardHeader title="Details" />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Product name *" className="sm:col-span-2">
            <input name="name" required defaultValue={product?.name} className="input" placeholder="e.g. Parle-G 80g" />
          </Field>
          <Field label="SKU / item code *">
            <input name="sku" required defaultValue={product?.sku} className="input uppercase" placeholder="SKU0001" />
          </Field>
          <Field label="Brand">
            <input name="brand" defaultValue={product?.brand ?? ""} className="input" />
          </Field>
          <Field label="Category">
            <input name="category" list="categories" defaultValue={product?.category ?? ""} className="input" />
            <datalist id="categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit name" hint="pc, pkt, btl, kg…">
              <input name="unit" defaultValue={product?.unit ?? "pc"} className="input" />
            </Field>
            <Field label="Pieces per case" hint="1 = no cases">
              <input name="caseSize" type="number" min={1} defaultValue={product?.caseSize ?? 1} className="input" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="active" defaultChecked={product?.active ?? true} className="h-4 w-4" />
            Active (salesmen can order it)
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Prices (per piece)" sub="Leave a type price blank to use the base price." />
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Field label="MRP (₹)">
            <input name="mrp" inputMode="decimal" defaultValue={paiseToInput(product?.mrp)} className="input" />
          </Field>
          <Field label="Base selling price (₹) *">
            <input name="basePrice" required inputMode="decimal" defaultValue={paiseToInput(product?.basePrice)} className="input" />
          </Field>
          {types.map((t) => (
            <Field key={t.id} label={`${t.name} price (₹)`}>
              <input name={`tp_${t.id}`} inputMode="decimal" defaultValue={paiseToInput(typePrices[t.id])} className="input" placeholder="= base" />
            </Field>
          ))}
        </div>
      </Card>
      <SubmitButton size="lg">{product ? "Save changes" : "Add product"}</SubmitButton>
    </ActionForm>
  );
}
