import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { parseOrdersCsv, parsePaymentsCsv } from "../services/csvParser.js";
import { normId, toNumber, parseOrderDate, parsePaymentDate } from "../utils/normalize.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import ReconciliationRun from "../models/ReconciliationRun.js";
import { runReconciliation } from "../services/reconciliationEngine.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && !/csv|text|excel|octet-stream/.test(file.mimetype)) {
      return cb(new HttpError(400, `${file.fieldname} must be a CSV file.`));
    }
    cb(null, true);
  },
});

function buildOrders(rows, userId, batchId, notes) {
  const seenExact = new Set();
  const docs = [];
  let missingEmail = 0;
  let missingDiscount = 0;
  let duplicateRows = 0;

  for (const row of rows) {
    const fingerprint = JSON.stringify(row);
    if (seenExact.has(fingerprint)) {
      duplicateRows++;
      continue; // drop exact duplicate rows from the source file
    }
    seenExact.add(fingerprint);

    const rowIssues = [];
    if (!row.customer_email) {
      missingEmail++;
      rowIssues.push("missing customer_email");
    }
    const discount = toNumber(row.discount);
    if (row.discount === undefined || row.discount === "") missingDiscount++;

    docs.push({
      user: userId,
      batchId,
      orderId: row.order_id,
      orderIdNorm: normId(row.order_id),
      orderDate: parseOrderDate(row.order_date),
      customerEmail: row.customer_email || null,
      currency: (row.currency || "").trim().toUpperCase() || null,
      grossAmount: toNumber(row.gross_amount),
      discount: discount ?? 0,
      netAmount: toNumber(row.net_amount),
      status: (row.status || "").trim().toLowerCase() || null,
      rowIssues,
    });
  }

  if (duplicateRows > 0) notes.push(`Removed ${duplicateRows} exact duplicate row(s) from orders.csv.`);
  if (missingEmail > 0) notes.push(`${missingEmail} order row(s) had a missing customer_email.`);
  if (missingDiscount > 0) notes.push(`${missingDiscount} order row(s) had a missing discount value (treated as 0).`);

  return docs;
}

function buildPayments(rows, userId, batchId, notes) {
  const seenExact = new Set();
  const docs = [];
  let missingTimestamp = 0;
  let normalizedRefs = 0;
  let duplicateRows = 0;

  for (const row of rows) {
    const fingerprint = JSON.stringify(row);
    if (seenExact.has(fingerprint)) {
      duplicateRows++;
      continue; // drop exact duplicate rows from the source file
    }
    seenExact.add(fingerprint);

    const rowIssues = [];
    if (!row.processed_at) {
      missingTimestamp++;
      rowIssues.push("missing processed_at");
    }
    const raw = row.order_reference || "";
    const norm = normId(raw);
    if (raw.trim().toUpperCase() !== raw || raw !== raw.trim()) {
      normalizedRefs++;
    }

    docs.push({
      user: userId,
      batchId,
      transactionRef: row.transaction_ref,
      processedAt: parsePaymentDate(row.processed_at),
      orderReference: raw,
      orderReferenceNorm: norm,
      currency: (row.currency || "").trim().toUpperCase() || null,
      amount: toNumber(row.amount),
      fee: toNumber(row.fee) ?? 0,
      netSettled: toNumber(row.net_settled),
      type: (row.type || "").trim().toLowerCase() || null,
      status: (row.status || "").trim().toLowerCase() || null,
      rowIssues,
    });
  }

  const refCounts = new Map();
  for (const d of docs) refCounts.set(d.transactionRef, (refCounts.get(d.transactionRef) || 0) + 1);
  const nonExactDupeRefs = [...refCounts.values()].filter((c) => c > 1).length;

  if (duplicateRows > 0) notes.push(`Removed ${duplicateRows} exact duplicate row(s) from payments.csv.`);
  if (nonExactDupeRefs > 0)
    notes.push(
      `${nonExactDupeRefs} transaction_ref value(s) appear more than once in payments.csv with differing data. All instances were kept and matched (not silently dropped) since it wasn't safe to assume which row was correct.`
    );
  if (missingTimestamp > 0) notes.push(`${missingTimestamp} payment row(s) had a missing processed_at timestamp.`);
  if (normalizedRefs > 0)
    notes.push(
      `${normalizedRefs} payment row(s) had an order_reference with inconsistent case or extra whitespace (normalized before matching).`
    );

  return docs;
}

router.post(
  "/upload",
  requireAuth,
  upload.fields([
    { name: "orders", maxCount: 1 },
    { name: "payments", maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const ordersFile = req.files?.orders?.[0];
    const paymentsFile = req.files?.payments?.[0];
    if (!ordersFile || !paymentsFile) {
      throw new HttpError(400, "Both an orders CSV and a payments CSV are required.");
    }

    const orderRows = parseOrdersCsv(ordersFile.buffer);
    const paymentRows = parsePaymentsCsv(paymentsFile.buffer);

    const batchId = crypto.randomUUID();
    const notes = [];

    const orderDocs = buildOrders(orderRows, req.user.id, batchId, notes);
    const paymentDocs = buildPayments(paymentRows, req.user.id, batchId, notes);

    const savedOrders = await Order.insertMany(orderDocs);
    await Payment.insertMany(paymentDocs);

    // Give the reconciliation engine access to the saved order ids (it re-queries by batch).
    void savedOrders;

    const run = await runReconciliation({
      userId: req.user.id,
      batchId,
      ordersFileName: ordersFile.originalname,
      paymentsFileName: paymentsFile.originalname,
      dataQualityNotes: notes,
    });

    res.status(201).json({ run });
  })
);

router.get(
  "/batches",
  requireAuth,
  asyncHandler(async (req, res) => {
    const runs = await ReconciliationRun.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json({ runs });
  })
);

export default router;
