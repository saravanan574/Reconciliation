// Trims + uppercases an order id / order reference so that "ORD-1801",
export function normId(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().toUpperCase();
}

export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

// Parse the order date
export function parseOrderDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, y, mo, d, h, mi, se] = m;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(se || 0)));
  }
  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function parsePaymentDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[ ](\d{2}):(\d{2})/);
  if (m) {
    const [, d, mo, y, h, mi] = m;  
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, 0));
  }
  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

// Rounds to cents to avoid float noise when comparing money values.
export function round2(n) {
  if (n === null || n === undefined) return null;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
