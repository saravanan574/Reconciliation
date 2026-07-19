// Standalone sanity check of the reconciliation logic against the sample CSVs,
// without touching MongoDB. Mirrors reconciliationEngine.js closely enough to
// validate the discrepancy counts before wiring up the full DB-backed flow.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseOrdersCsv, parsePaymentsCsv } from "../src/services/csvParser.js";
import { normId, toNumber, parseOrderDate, parsePaymentDate, round2 } from "../src/utils/normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleDir = path.join(__dirname, "..", "..", "sample-data");
const ordersBuf = fs.readFileSync(path.join(sampleDir, "orders.csv"));
const paymentsBuf = fs.readFileSync(path.join(sampleDir, "payments.csv"));

const orderRows = parseOrdersCsv(ordersBuf);
const paymentRows = parsePaymentsCsv(paymentsBuf);

const seen = new Set();
const rawOrders = [];
for (const row of orderRows) {
  const fp = JSON.stringify(row);
  if (seen.has(fp)) continue;
  seen.add(fp);
  rawOrders.push({
    orderId: row.order_id,
    orderIdNorm: normId(row.order_id),
    currency: (row.currency || "").toUpperCase(),
    netAmount: toNumber(row.net_amount),
    status: (row.status || "").toLowerCase(),
  });
}

const seenP = new Set();
const payments = [];
for (const row of paymentRows) {
  const fp = JSON.stringify(row);
  if (seenP.has(fp)) continue;
  seenP.add(fp);
  payments.push({
    transactionRef: row.transaction_ref,
    orderReference: row.order_reference,
    orderReferenceNorm: normId(row.order_reference),
    currency: (row.currency || "").toUpperCase(),
    amount: toNumber(row.amount),
    type: (row.type || "").toLowerCase(),
    status: (row.status || "").toLowerCase(),
  });
}

function tolerance(amount) { return Math.max(0.05, round2(Math.abs(amount || 0) * 0.005)); }
function sum(list) { return round2(list.reduce((a, x) => a + (x.amount || 0), 0)); }

const counts = {};
const flag = (t) => counts[t] = (counts[t] || 0) + 1;

// Group orders by normalized id - use one representative per id so payments
// are never matched twice against the "same" order (mirrors reconciliationEngine.js).
const byId = new Map();
for (const o of rawOrders) {
  if (!byId.has(o.orderIdNorm)) byId.set(o.orderIdNorm, []);
  byId.get(o.orderIdNorm).push(o);
}
const orders = [];
for (const group of byId.values()) {
  if (group.length > 1) flag("DUPLICATE_ORDER_RECORD");
  orders.push(group[0]);
}

const byRef = new Map();
for (const p of payments) {
  if (!byRef.has(p.orderReferenceNorm)) byRef.set(p.orderReferenceNorm, []);
  byRef.get(p.orderReferenceNorm).push(p);
}

const matchedIds = new Set(orders.map(o => o.orderIdNorm));

for (const order of orders) {
  const related = byRef.get(order.orderIdNorm) || [];
  const charges = related.filter(p => p.type === "charge" && p.status === "settled");
  const refunds = related.filter(p => p.type === "refund" && p.status === "settled");
  const unsettled = related.filter(p => p.type === "charge" && p.status !== "settled");
  const tol = tolerance(order.netAmount);

  if (order.status === "cancelled") {
    const net = round2(sum(charges) - sum(refunds));
    if (net > tol) flag("CANCELLED_BUT_CHARGED");
    continue;
  }
  if (order.status === "refunded") {
    const totalCharged = sum(charges), totalRefunded = sum(refunds);
    const net = round2(totalCharged - totalRefunded);
    if (charges.length === 0 && refunds.length === 0) flag("MISSING_PAYMENT");
    else if (net > tol) flag("REFUND_SHORTFALL");
    continue;
  }
  if (order.status === "completed") {
    if (charges.length === 0) {
      if (unsettled.length > 0) flag("PAYMENT_NOT_SETTLED");
      else flag("MISSING_PAYMENT");
      continue;
    }
    const amtCounts = new Map();
    for (const c of charges) amtCounts.set(c.amount, (amtCounts.get(c.amount) || 0) + 1);
    const dup = [...amtCounts.entries()].find(([, c]) => c > 1);
    const totalCharged = sum(charges), totalRefunded = sum(refunds);
    const net = round2(totalCharged - totalRefunded);
    const diff = round2(net - order.netAmount);

    if (dup && Math.abs(diff) > tol && diff > 0) flag("DUPLICATE_CHARGE");
    else if (Math.abs(diff) > tol) {
      if (diff > 0) flag("AMOUNT_MISMATCH");
      else if (refunds.length > 0) flag("REFUND_SHORTFALL");
      else flag("AMOUNT_MISMATCH");
    }
    const first = charges[0];
    if (first && first.currency !== order.currency && Math.abs(diff) <= tol) flag("CURRENCY_MISMATCH");
  }
}

const orphanByRef = new Map();
for (const p of payments) {
  if (p.status !== "settled" || (p.type !== "charge" && p.type !== "refund")) continue;
  if (matchedIds.has(p.orderReferenceNorm)) continue;
  if (!orphanByRef.has(p.orderReferenceNorm)) orphanByRef.set(p.orderReferenceNorm, []);
  orphanByRef.get(p.orderReferenceNorm).push(p);
}
counts["ORPHAN_PAYMENT"] = orphanByRef.size;

console.log("Orders parsed (after dedup):", orders.length, "of", orderRows.length, "raw rows");
console.log("Payments parsed (after dedup):", payments.length, "of", paymentRows.length, "raw rows");
console.log("Discrepancy counts:", counts);
console.log("Total discrepancies:", Object.values(counts).reduce((a,b)=>a+b,0));
