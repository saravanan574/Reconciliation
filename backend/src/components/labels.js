export const TYPE_LABELS = {
  MISSING_PAYMENT: "Missing payment",
  ORPHAN_PAYMENT: "Orphan payment",
  AMOUNT_MISMATCH: "Amount mismatch",
  DUPLICATE_CHARGE: "Duplicate charge",
  REFUND_SHORTFALL: "Refund shortfall",
  PAYMENT_NOT_SETTLED: "Payment not settled",
  CANCELLED_BUT_CHARGED: "Cancelled but charged",
  CURRENCY_MISMATCH: "Currency mismatch",
  DUPLICATE_ORDER_RECORD: "Duplicate order record",
};

export function typeLabel(type) {
  return TYPE_LABELS[type] || type;
}

export const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

export function fmtMoney(n, currency = "USD") {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
