import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Discrepancy from "../models/Discrepancy.js";
import ReconciliationRun from "../models/ReconciliationRun.js";
import { round2 } from "../utils/normalize.js";

/**
 * Tolerance: money differences smaller than the tolerance are treated as
 * rounding/float noise and are NOT reported as discrepancies. We use the
 * larger of 5 cents or 0.5% of the order value, since a flat cent tolerance
 * would be too tight on large orders and too loose on tiny ones.
 */
function toleranceFor(amount) {
  const base = Math.abs(amount || 0);
  return Math.max(0.05, round2(base * 0.005));
}

function sum(list, field) {
  return round2(list.reduce((acc, x) => acc + (x[field] || 0), 0));
}

export async function runReconciliation({
  userId,
  batchId,
  ordersFileName,
  paymentsFileName,
  dataQualityNotes = [],
}) {
  const orders = await Order.find({ user: userId, batchId }).lean();
  const payments = await Payment.find({ user: userId, batchId }).lean();

  // Index payments by normalized order reference for O(1) lookups.
  const paymentsByRef = new Map();
  for (const p of payments) {
    const key = p.orderReferenceNorm;
    if (!paymentsByRef.has(key)) paymentsByRef.set(key, []);
    paymentsByRef.get(key).push(p);
  }

  const matchedOrderIds = new Set(orders.map((o) => o.orderIdNorm));
  const discrepancies = [];

  let totalOrderValue = 0;
  let totalReconciledValue = 0;

  // --- Group orders by normalized id first. Exact duplicate rows are alread dropped at ingest time
  const ordersById = new Map();
  for (const o of orders) {
    if (!ordersById.has(o.orderIdNorm)) ordersById.set(o.orderIdNorm, []);
    ordersById.get(o.orderIdNorm).push(o);
  }

  const ordersToProcess = [];
  for (const [orderIdNorm, group] of ordersById.entries()) {
    if (group.length === 1) {
      ordersToProcess.push(group[0]);
      continue;
    }

    const sorted = [...group].sort((a, b) => {
      const at = a.orderDate ? new Date(a.orderDate).getTime() : Infinity;
      const bt = b.orderDate ? new Date(b.orderDate).getTime() : Infinity;
      return at - bt;
    });
    const representative = sorted[0];
    const amounts = new Set(group.map((o) => round2(o.netAmount)));
    const amountsDiffer = amounts.size > 1;

    discrepancies.push({
      user: userId,
      batchId,
      type: "DUPLICATE_ORDER_RECORD",
      severity: amountsDiffer ? "high" : "medium",
      orderRef: orderIdNorm,
      orders: group.map((o) => o._id),
      payments: [],
      amountAtRisk: amountsDiffer ? round2(Math.max(...amounts) - Math.min(...amounts)) : 0,
      currency: representative.currency || "USD",
      summary: amountsDiffer
        ? `Order ${representative.orderId} appears ${group.length} times in orders.csv with different amounts (${[...amounts].map((a) => a.toFixed(2)).join(" vs ")}). Only the earliest record was used for matching; the rest need manual review.`
        : `Order ${representative.orderId} appears ${group.length} times in orders.csv with matching amounts. Only one record was used for matching to avoid double-counting its payment.`,
      details: { recordCount: group.length, amounts: [...amounts] },
    });

    ordersToProcess.push(representative);
  }

  for (const order of ordersToProcess) {
    const related = paymentsByRef.get(order.orderIdNorm) || [];
    const settledCharges = related.filter((p) => p.type === "charge" && p.status === "settled");
    const settledRefunds = related.filter((p) => p.type === "refund" && p.status === "settled");
    const unsettledCharges = related.filter((p) => p.type === "charge" && p.status !== "settled");

    const orderValue = order.netAmount || 0;
    if (order.status === "completed") totalOrderValue += orderValue;

    const tolerance = toleranceFor(orderValue);
    let flaggedThisOrder = false;

    const pushDiscrepancy = (type, severity, amountAtRisk, summaryText, details) => {
      flaggedThisOrder = true;
      discrepancies.push({
        user: userId,
        batchId,
        type,
        severity,
        orderRef: order.orderIdNorm,
        orders: [order._id],
        payments: related.map((p) => p._id),
        amountAtRisk: round2(Math.max(0, amountAtRisk)),
        currency: order.currency || "USD",
        summary: summaryText,
        details,
      });
    };

    // --- Cancelled orders should never have net money collected against them ---
    if (order.status === "cancelled") {
      const netCharged = round2(sum(settledCharges, "amount") - sum(settledRefunds, "amount"));
      if (netCharged > tolerance) {
        pushDiscrepancy(
          "CANCELLED_BUT_CHARGED",
          "high",
          netCharged,
          `Order ${order.orderId} was cancelled but ${order.currency || "USD"} ${netCharged.toFixed(2)} was still collected and not refunded.`,
          { netCharged, chargeCount: settledCharges.length, refundCount: settledRefunds.length }
        );
      }
      continue;
    }

    // --- Refunded orders should net to zero collected ---
    if (order.status === "refunded") {
      const totalCharged = sum(settledCharges, "amount");
      const totalRefunded = sum(settledRefunds, "amount");
      const netSettled = round2(totalCharged - totalRefunded);

      if (settledCharges.length === 0 && settledRefunds.length === 0) {
        pushDiscrepancy(
          "MISSING_PAYMENT",
          "medium",
          0,
          `Order ${order.orderId} is marked refunded but no payment or refund record exists for it at all.`,
          { totalCharged, totalRefunded }
        );
      } else if (netSettled > tolerance) {
        pushDiscrepancy(
          "REFUND_SHORTFALL",
          "high",
          netSettled,
          `Order ${order.orderId} is marked refunded, but only ${order.currency || "USD"} ${totalRefunded.toFixed(2)} of ${totalCharged.toFixed(2)} charged was refunded, leaving ${netSettled.toFixed(2)} still collected.`,
          { totalCharged, totalRefunded, netSettled }
        );
      }
      continue;
    }

    // --- Completed orders: this is the common path ---
    if (order.status === "completed") {
      if (settledCharges.length === 0) {
        if (unsettledCharges.length > 0) {
          const worst = unsettledCharges.some((p) => p.status === "failed") ? "failed" : "pending";
          pushDiscrepancy(
            "PAYMENT_NOT_SETTLED",
            worst === "failed" ? "high" : "medium",
            orderValue,
            `Order ${order.orderId} is marked completed but its payment is "${worst}", not settled. ${order.currency || "USD"} ${orderValue.toFixed(2)} has not actually been collected.`,
            { paymentStatus: worst, orderValue }
          );
        } else {
          pushDiscrepancy(
            "MISSING_PAYMENT",
            "high",
            orderValue,
            `Order ${order.orderId} is marked completed but no matching payment was found in payments.csv. ${order.currency || "USD"} ${orderValue.toFixed(2)} was never collected.`,
            { orderValue }
          );
        }
        continue;
      }

      // Same-amount duplicate settled charges: the classic double-charge bug.
      const amountCounts = new Map();
      for (const c of settledCharges) {
        amountCounts.set(c.amount, (amountCounts.get(c.amount) || 0) + 1);
      }
      const duplicateAmount = [...amountCounts.entries()].find(([, count]) => count > 1);

      const totalCharged = sum(settledCharges, "amount");
      const totalRefunded = sum(settledRefunds, "amount");
      const netSettled = round2(totalCharged - totalRefunded);
      const diff = round2(netSettled - orderValue);

      if (duplicateAmount && Math.abs(diff) > tolerance && diff > 0) {
        const [amt, count] = duplicateAmount;
        pushDiscrepancy(
          "DUPLICATE_CHARGE",
          "high",
          diff,
          `Order ${order.orderId} was charged ${count} times at ${order.currency || "USD"} ${amt.toFixed(2)} each. The customer was overcharged by ${diff.toFixed(2)}.`,
          { chargeCount: settledCharges.length, duplicateAmount: amt, totalCharged, totalRefunded }
        );
      } else if (Math.abs(diff) > tolerance) {
        if (diff > 0) {
          pushDiscrepancy(
            "AMOUNT_MISMATCH",
            "high",
            diff,
            `Order ${order.orderId} shows ${order.currency || "USD"} ${orderValue.toFixed(2)} in orders.csv but ${netSettled.toFixed(2)} was actually settled — overcharged by ${diff.toFixed(2)}.`,
            { orderValue, netSettled, chargeCount: settledCharges.length, refundCount: settledRefunds.length }
          );
        } else if (settledRefunds.length > 0) {
          pushDiscrepancy(
            "REFUND_SHORTFALL",
            "high",
            Math.abs(diff),
            `Order ${order.orderId} is marked completed (expected ${orderValue.toFixed(2)}) but after a partial refund only ${netSettled.toFixed(2)} remains collected — a shortfall of ${Math.abs(diff).toFixed(2)}.`,
            { orderValue, netSettled, totalRefunded }
          );
        } else {
          pushDiscrepancy(
            "AMOUNT_MISMATCH",
            "medium",
            Math.abs(diff),
            `Order ${order.orderId} shows ${order.currency || "USD"} ${orderValue.toFixed(2)} in orders.csv but only ${netSettled.toFixed(2)} was settled — undercharged by ${Math.abs(diff).toFixed(2)}.`,
            { orderValue, netSettled }
          );
        }
      }

      // Currency label mismatch: informational, only when the amount itself lines up
      // (otherwise it's already covered by AMOUNT_MISMATCH above).
      const firstCharge = settledCharges[0];
      if (
        firstCharge &&
        firstCharge.currency &&
        order.currency &&
        firstCharge.currency !== order.currency &&
        Math.abs(diff) <= tolerance
      ) {
        pushDiscrepancy(
          "CURRENCY_MISMATCH",
          "low",
          0,
          `Order ${order.orderId} is recorded as ${order.currency} in orders.csv but the matching payment is recorded as ${firstCharge.currency}. Amounts match, so this looks like a data-entry error rather than a real FX charge.`,
          { orderCurrency: order.currency, paymentCurrency: firstCharge.currency }
        );
      }
    }

    if (!flaggedThisOrder && order.status === "completed") {
      totalReconciledValue += orderValue;
    }
  }

  //Orphan payments
  const orphanByRef = new Map();
  for (const p of payments) {
    if (p.status !== "settled" || (p.type !== "charge" && p.type !== "refund")) continue;
    if (matchedOrderIds.has(p.orderReferenceNorm)) continue;
    if (!orphanByRef.has(p.orderReferenceNorm)) orphanByRef.set(p.orderReferenceNorm, []);
    orphanByRef.get(p.orderReferenceNorm).push(p);
  }

  for (const [ref, group] of orphanByRef.entries()) {
    const charges = group.filter((p) => p.type === "charge");
    const refunds = group.filter((p) => p.type === "refund");
    const netAmount = round2(sum(charges, "amount") - sum(refunds, "amount"));
    const currency = group[0].currency || "USD";
    const refText = group[0].orderReference;

    let severity = "medium";
    let summary;
    if (refunds.length > 0 && charges.length === 0) {
      severity = "high"; // money went OUT against an order that doesn't exist
      summary = `A refund of ${currency} ${sum(refunds, "amount").toFixed(2)} was issued against order reference ${refText}, which does not exist in orders.csv.`;
    } else if (charges.length > 0 && refunds.length > 0) {
      summary = `${charges.length} charge(s) and ${refunds.length} refund(s) totalling ${currency} ${netAmount.toFixed(2)} net reference order ${refText}, which does not exist in orders.csv.`;
    } else {
      summary = `${charges.length} payment(s) totalling ${currency} ${netAmount.toFixed(2)} reference order ${refText}, which does not exist in orders.csv.`;
    }

    discrepancies.push({
      user: userId,
      batchId,
      type: "ORPHAN_PAYMENT",
      severity,
      orderRef: ref,
      orders: [],
      payments: group.map((p) => p._id),
      amountAtRisk: round2(Math.abs(netAmount)),
      currency,
      summary,
      details: { transactionRefs: group.map((p) => p.transactionRef), orderReference: refText, chargeCount: charges.length, refundCount: refunds.length },
    });
  }

  await Discrepancy.insertMany(discrepancies);

  const totalPaymentValue = round2(
    sum(
      payments.filter((p) => p.status === "settled" && p.type === "charge"),
      "amount"
    ) -
      sum(
        payments.filter((p) => p.status === "settled" && p.type === "refund"),
        "amount"
      )
  );

  const totalAtRisk = round2(discrepancies.reduce((acc, d) => acc + (d.amountAtRisk || 0), 0));

  const discrepancyCounts = {};
  for (const d of discrepancies) {
    discrepancyCounts[d.type] = (discrepancyCounts[d.type] || 0) + 1;
  }

  const run = await ReconciliationRun.create({
    user: userId,
    batchId,
    ordersFileName,
    paymentsFileName,
    totalOrders: orders.length,
    totalPayments: payments.length,
    totalOrderValue: round2(totalOrderValue),
    totalPaymentValue,
    totalReconciledValue: round2(totalReconciledValue),
    totalAtRisk,
    discrepancyCounts,
    dataQualityNotes,
  });

  return run;
}
