/** Shared formatting helpers (safe on server and client). */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 123450 (paise) → "₹1,234.50" */
export function money(paise: number | null | undefined): string {
  return inr.format((paise ?? 0) / 100);
}

/** "1,234.5" → 123450. Returns null for empty/invalid input. */
export function toPaise(input: FormDataEntryValue | string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).replace(/[₹,\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** 123450 → "1234.50" for form inputs */
export function paiseToInput(paise: number | null | undefined): string {
  if (paise == null) return "";
  return (paise / 100).toFixed(2);
}

/** Pieces → "2 cs + 5 pkt" (or "5 pkt" when caseSize is 1) */
export function qtyLabel(pieces: number, caseSize: number, unit = "pc"): string {
  if (caseSize <= 1) return `${pieces} ${unit}`;
  const cs = Math.floor(Math.abs(pieces) / caseSize) * Math.sign(pieces);
  const pc = pieces - cs * caseSize;
  if (cs === 0) return `${pc} ${unit}`;
  if (pc === 0) return `${cs} cs`;
  return `${cs} cs + ${pc} ${unit}`;
}

export function toPieces(cases: number, pieces: number, caseSize: number): number {
  return Math.max(0, Math.floor(cases) || 0) * Math.max(1, caseSize) + (Math.max(0, Math.floor(pieces)) || 0);
}

const dt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const d = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export function dateTime(v: Date | string | null | undefined): string {
  if (!v) return "—";
  return dt.format(typeof v === "string" ? new Date(v) : v);
}
export function dateOnly(v: Date | string | null | undefined): string {
  if (!v) return "—";
  return d.format(typeof v === "string" ? new Date(v) : v);
}

export function daysUntil(dateStr: string | null | undefined, now = new Date()): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

export const STATUS_LABEL: Record<string, string> = {
  booked: "Booked",
  approved: "Approved",
  packed: "Packed",
  dispatched: "Out for delivery",
  delivered: "Delivered",
  partially_delivered: "Part delivered",
  cancelled: "Cancelled",
};

export const MODE_LABEL: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  bank: "Bank transfer",
  cheque: "Cheque",
};
