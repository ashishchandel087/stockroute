import { requireRole } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { RetailerForm } from "../retailer-form";
import { retailerFormOptions } from "../form-data";

export default async function NewRetailerPage() {
  await requireRole("admin");
  const opts = await retailerFormOptions();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add retailer" />
      <Card>
        <RetailerForm {...opts} />
      </Card>
    </div>
  );
}
