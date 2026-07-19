import mongoose from "mongoose";

// It gives a summary of the log of each batch in the dashboard
const reconciliationRunSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    batchId: { type: String, required: true, unique: true },

    ordersFileName: String,
    paymentsFileName: String,

    totalOrders: Number,
    totalPayments: Number,

    totalOrderValue: Number, // sum of net_amount across completed orders
    totalPaymentValue: Number, // sum of settled charge amounts minus settled refunds

    totalReconciledValue: Number, // value of orders that matched cleanly
    totalAtRisk: Number, // sum of amountAtRisk across all open discrepancies

    discrepancyCounts: { type: mongoose.Schema.Types.Mixed, default: {} }, // { TYPE: count }

    dataQualityNotes: [{ type: String }], // e.g. "1 duplicate order row removed", "2 order IDs had whitespace"
  },
  { timestamps: true }
);

export default mongoose.model("ReconciliationRun", reconciliationRunSchema);
