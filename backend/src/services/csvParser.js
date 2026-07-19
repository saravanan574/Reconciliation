import { parse } from "csv-parse/sync";
import { HttpError } from "../middleware/errorHandler.js";

const ORDERS_REQUIRED = [
  "order_id",
  "order_date",
  "customer_email",
  "currency",
  "gross_amount",
  "discount",
  "net_amount",
  "status",
];

const PAYMENTS_REQUIRED = [
  "transaction_ref",
  "processed_at",
  "order_reference",
  "currency",
  "amount",
  "fee",
  "net_settled",
  "type",
  "status",
];

function parseCsvBuffer(buffer, requiredColumns, label) {
  let rows;
  try {
    rows = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (err) {
    throw new HttpError(400, `Could not parse ${label}: ${err.message}`);
  }

  if (rows.length === 0) {
    throw new HttpError(400, `${label} appears to be empty.`);
  }

  const columns = Object.keys(rows[0]);
  const missing = requiredColumns.filter((c) => !columns.includes(c));
  if (missing.length > 0) {
    throw new HttpError(
      400,
      `${label} is missing required column(s): ${missing.join(", ")}. Found: ${columns.join(", ")}`
    );
  }

  return rows;
}

export function parseOrdersCsv(buffer) {
  return parseCsvBuffer(buffer, ORDERS_REQUIRED, "orders.csv");
}

export function parsePaymentsCsv(buffer) {
  return parseCsvBuffer(buffer, PAYMENTS_REQUIRED, "payments.csv");
}
