/**
 * Layered price resolution — used on the phone (offline) and re-checked on the server.
 * Most specific wins:  retailer special price  →  retailer-type price  →  product base price.
 * (Schemes/discounts are applied on top in Phase 2.)
 */
export type PriceSource = "retailer" | "type" | "base";

export type PriceTables = {
  /** key `${productId}:${typeId}` → paise */
  typePrices: Map<string, number>;
  /** key `${productId}:${retailerId}` → paise */
  retailerPrices: Map<string, number>;
};

export function buildPriceTables(
  typeRows: { productId: string; typeId: string; price: number }[],
  retailerRows: { productId: string; retailerId: string; price: number }[],
): PriceTables {
  return {
    typePrices: new Map(typeRows.map((r) => [`${r.productId}:${r.typeId}`, r.price])),
    retailerPrices: new Map(retailerRows.map((r) => [`${r.productId}:${r.retailerId}`, r.price])),
  };
}

export function resolvePrice(
  product: { id: string; basePrice: number },
  retailer: { id: string; typeId: string | null },
  tables: PriceTables,
): { price: number; source: PriceSource } {
  const special = tables.retailerPrices.get(`${product.id}:${retailer.id}`);
  if (special != null) return { price: special, source: "retailer" };
  if (retailer.typeId) {
    const typed = tables.typePrices.get(`${product.id}:${retailer.typeId}`);
    if (typed != null) return { price: typed, source: "type" };
  }
  return { price: product.basePrice, source: "base" };
}
