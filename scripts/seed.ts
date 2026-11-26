/**
 * Demo data so the app is usable right after setup.
 *
 * Demo logins (mobile / PIN) — change or deactivate these before real use:
 *   Admin      9000000001 / 1234
 *   Salesman   9000000002 / 1111
 *   Salesman   9000000005 / 1111
 *   Warehouse  9000000003 / 2222
 *   Delivery   9000000004 / 3333
 */
import bcrypt from "bcryptjs";
import type { DB } from "../src/lib/db/client";
import * as s from "../src/lib/db/schema";

const rs = (rupees: number) => Math.round(rupees * 100);

export async function seed(db: DB) {
  const hash = (pin: string) => bcrypt.hashSync(pin, 10);

  const [admin] = await db
    .insert(s.users)
    .values([
      { name: "Owner", phone: "9000000001", pinHash: hash("1234"), role: "admin" },
      { name: "Ravi (Sales)", phone: "9000000002", pinHash: hash("1111"), role: "salesman" },
      { name: "Aman (Sales)", phone: "9000000005", pinHash: hash("1111"), role: "salesman" },
      { name: "Suresh (Godown)", phone: "9000000003", pinHash: hash("2222"), role: "warehouse" },
      { name: "Pappu (Delivery)", phone: "9000000004", pinHash: hash("3333"), role: "delivery" },
    ])
    .returning();

  const [main, city] = await db
    .insert(s.warehouses)
    .values([
      { name: "Main Godown", address: "Industrial Area, Plot 12" },
      { name: "City Branch", address: "Station Road" },
    ])
    .returning();

  const [retail, wholesale, modern] = await db
    .insert(s.retailerTypes)
    .values([{ name: "Retail" }, { name: "Wholesale" }, { name: "Modern Trade" }])
    .returning();

  // name, brand, category, unit, caseSize, mrp, basePrice (₹ per piece)
  const productRows: [string, string, string, string, number, number, number][] = [
    ["Parle-G 80g", "Parle", "Biscuits", "pkt", 48, 10, 8.6],
    ["Good Day Cashew 100g", "Britannia", "Biscuits", "pkt", 36, 30, 25.5],
    ["Marie Gold 250g", "Britannia", "Biscuits", "pkt", 24, 40, 34],
    ["Hide & Seek 120g", "Parle", "Biscuits", "pkt", 30, 35, 29.8],
    ["Maggi Noodles 70g", "Nestle", "Noodles", "pkt", 96, 14, 12.1],
    ["Maggi Noodles 280g (4-pack)", "Nestle", "Noodles", "pkt", 24, 56, 48.5],
    ["Yippee Noodles 70g", "Sunfeast", "Noodles", "pkt", 96, 14, 11.9],
    ["Tata Salt 1kg", "Tata", "Staples", "pkt", 20, 28, 24.5],
    ["Aashirvaad Atta 5kg", "ITC", "Staples", "bag", 4, 290, 262],
    ["Fortune Sunflower Oil 1L", "Fortune", "Oil", "pouch", 12, 165, 148],
    ["Saffola Gold 1L", "Saffola", "Oil", "btl", 12, 210, 189],
    ["Surf Excel Easy Wash 1kg", "HUL", "Detergent", "pkt", 12, 140, 124],
    ["Rin Bar 250g", "HUL", "Detergent", "pc", 40, 25, 21.5],
    ["Vim Bar 155g", "HUL", "Detergent", "pc", 60, 10, 8.7],
    ["Colgate Strong Teeth 100g", "Colgate", "Personal Care", "pc", 48, 58, 50.5],
    ["Lifebuoy Soap 125g", "HUL", "Personal Care", "pc", 72, 38, 33],
    ["Dettol Soap 125g", "Reckitt", "Personal Care", "pc", 72, 52, 45.5],
    ["Clinic Plus Shampoo Sachet", "HUL", "Personal Care", "sachet", 960, 1, 0.85],
    ["Coca-Cola 750ml", "Coca-Cola", "Beverages", "btl", 24, 40, 33.5],
    ["Frooti 160ml", "Parle Agro", "Beverages", "pc", 40, 10, 8.4],
    ["Lay's Classic 52g", "PepsiCo", "Snacks", "pkt", 48, 20, 17],
    ["Kurkure Masala Munch 90g", "PepsiCo", "Snacks", "pkt", 36, 20, 16.9],
    ["Haldiram Aloo Bhujia 200g", "Haldiram", "Snacks", "pkt", 30, 55, 47],
    ["Red Label Tea 250g", "Brooke Bond", "Tea & Coffee", "pkt", 36, 140, 124],
    ["Nescafe Classic 50g", "Nestle", "Tea & Coffee", "jar", 24, 175, 155],
  ];
  const prods = await db
    .insert(s.products)
    .values(
      productRows.map(([name, brand, category, unit, caseSize, mrp, base], i) => ({
        sku: `SKU${String(i + 1).padStart(4, "0")}`,
        name,
        brand,
        category,
        unit,
        caseSize,
        mrp: rs(mrp),
        basePrice: rs(base),
      })),
    )
    .returning();

  // Wholesale gets 3% off, Modern Trade 1.5% off
  await db.insert(s.typePrices).values([
    ...prods.map((p) => ({ productId: p.id, typeId: wholesale.id, price: Math.round(p.basePrice * 0.97) })),
    ...prods.map((p) => ({ productId: p.id, typeId: modern.id, price: Math.round(p.basePrice * 0.985) })),
  ]);

  const areas = ["Gandhi Nagar", "Station Road", "Civil Lines", "Old Market", "Shastri Colony"];
  const retailerNames = [
    "Sharma General Store",
    "Gupta Kirana",
    "Jai Mata Di Stores",
    "Balaji Traders",
    "New Bharat Provision",
    "Agarwal Super Mart",
    "Krishna Wholesale",
    "Laxmi Stores",
    "Patel Brothers",
    "Shree Ganesh Kirana",
    "City Fresh Mart",
    "Om Sai Provision",
  ];
  const rets = await db
    .insert(s.retailers)
    .values(
      retailerNames.map((name, i) => {
        const isWholesale = name.includes("Wholesale") || name.includes("Traders");
        const isModern = name.includes("Mart");
        return {
          name,
          ownerName: ["Ramesh", "Suresh", "Mahesh", "Dinesh", "Rajesh", "Mukesh"][i % 6] + " ji",
          phone: `98${String(10000000 + i * 7919).slice(0, 8)}`,
          area: areas[i % areas.length],
          address: `${10 + i}, ${areas[i % areas.length]}`,
          typeId: isWholesale ? wholesale.id : isModern ? modern.id : retail.id,
          defaultWarehouseId: i % 4 === 3 ? city.id : main.id,
          creditLimit: isWholesale ? rs(100000) : rs(25000),
          creditDays: isWholesale ? 21 : 15,
          openingBalance: [0, rs(4200), 0, rs(18500), 0, 0, rs(96000), 0, rs(1200), 0, 0, rs(27500)][i],
        };
      }),
    )
    .returning();

  // A negotiated special price for one retailer
  await db.insert(s.retailerPrices).values([
    { productId: prods[0].id, retailerId: rets[0].id, price: rs(8.4) },
    { productId: prods[4].id, retailerId: rets[0].id, price: rs(11.8) },
  ]);

  // Opening stock through a purchase entry, so stock movements are consistent
  const [supplier] = await db
    .insert(s.suppliers)
    .values({ name: "Opening Stock", phone: null })
    .returning();

  for (const wh of [main, city]) {
    const [purchase] = await db
      .insert(s.purchases)
      .values({
        supplierId: supplier.id,
        warehouseId: wh.id,
        invoiceNo: "OPENING",
        invoiceDate: new Date().toISOString().slice(0, 10),
        notes: "Opening stock",
        createdBy: admin.id,
      })
      .returning();
    let total = 0;
    for (const [i, p] of prods.entries()) {
      // Leave a couple of products out of stock to show shortages
      if (wh === main && (i === 6 || i === 17)) continue;
      const cases = wh === main ? 5 + (i % 7) * 3 : 2 + (i % 3);
      // Two batches for some items to demonstrate earliest-expiry-first picking
      const parts = i % 3 === 0 ? [Math.ceil(cases / 2), Math.floor(cases / 2)] : [cases];
      for (const [bi, c] of parts.entries()) {
        if (c <= 0) continue;
        const qty = c * p.caseSize;
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + (bi === 0 ? 20 + i * 3 : 180 + i * 5));
        const [batch] = await db
          .insert(s.batches)
          .values({
            productId: p.id,
            warehouseId: wh.id,
            batchNo: `B${String(i + 1).padStart(2, "0")}${bi === 0 ? "A" : "B"}`,
            expiry: expiry.toISOString().slice(0, 10),
            qty,
          })
          .returning();
        const rate = Math.round(p.basePrice * 0.9);
        total += rate * qty;
        await db.insert(s.purchaseLines).values({ purchaseId: purchase.id, productId: p.id, batchId: batch.id, qty, rate });
        await db.insert(s.stockMovements).values({
          productId: p.id,
          warehouseId: wh.id,
          batchId: batch.id,
          qty,
          kind: "purchase",
          refId: purchase.id,
          note: "Opening stock",
          createdBy: admin.id,
        });
      }
    }
    await db.update(s.purchases).set({ total }).where((await import("drizzle-orm")).eq(s.purchases.id, purchase.id));
  }
}
