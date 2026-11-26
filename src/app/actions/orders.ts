"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { approveOrder, cancelOrder, deliverOrder, dispatchOrder, DomainError, packOrder } from "@/lib/orders";
import { toPaise } from "@/lib/format";
import type { PaymentMode } from "@/lib/db/schema";
import type { ActionResult } from "@/components/form-bits";

function fail(e: unknown): ActionResult {
  if (e instanceof DomainError) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}

/** Reads fields like `qty_<lineId>` into [{ lineId, qty }] */
function lineQtys(form: FormData, prefix: string) {
  const out: { lineId: string; qty: number }[] = [];
  for (const [k, v] of form.entries()) {
    if (k.startsWith(prefix)) out.push({ lineId: k.slice(prefix.length), qty: Number(v) });
  }
  return out;
}

export async function approveAction(_p: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireRole("admin");
  try {
    await approveOrder({
      orderId: String(form.get("orderId")),
      warehouseId: String(form.get("warehouseId")),
      lines: lineQtys(form, "qty_").map((l) => ({ lineId: l.lineId, approvedQty: l.qty })),
      userId: user.id,
    });
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Order approved. Stock reserved." };
}

export async function packAction(_p: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireRole("admin", "warehouse");
  try {
    await packOrder({ orderId: String(form.get("orderId")), userId: user.id });
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Marked as packed." };
}

export async function dispatchAction(_p: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireRole("admin", "warehouse");
  const deliveryPersonId = String(form.get("deliveryPersonId") ?? "");
  if (!deliveryPersonId) return { error: "Choose who will deliver." };
  try {
    await dispatchOrder({ orderId: String(form.get("orderId")), deliveryPersonId, userId: user.id });
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Dispatched. Stock deducted." };
}

export async function deliverAction(_p: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireRole("admin", "delivery");
  const amount = toPaise(form.get("amount")) ?? 0;
  if (amount < 0) return { error: "Amount can't be negative." };
  const mode = String(form.get("mode") || "cash") as PaymentMode;
  if (!["cash", "upi", "bank", "cheque"].includes(mode)) return { error: "Choose a payment mode." };
  try {
    await deliverOrder({
      orderId: String(form.get("orderId")),
      lines: lineQtys(form, "qty_").map((l) => ({ lineId: l.lineId, deliveredQty: l.qty })),
      payment: amount > 0 ? { amount, mode, reference: String(form.get("reference") ?? "").trim() } : undefined,
      userId: user.id,
      isAdmin: user.role === "admin",
    });
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Delivery recorded." };
}

export async function cancelAction(_p: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireRole("admin");
  const reason = String(form.get("reason") ?? "").trim();
  if (!reason) return { error: "Please give a reason for cancelling." };
  try {
    await cancelOrder({ orderId: String(form.get("orderId")), reason, userId: user.id });
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Order cancelled." };
}
