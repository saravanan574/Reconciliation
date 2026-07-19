import mongoose from "mongoose";

// One row of payments.csv, scoped to the user who uploaded it.
const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    batchId: { type: String, required: true, index: true },

    transactionRef: { type: String, required: true },
    processedAt: { type: Date },

    orderReference: { type: String, required: true }, // as it appeared in the file
    orderReferenceNorm: { type: String, required: true, index: true }, // trimmed + uppercased

    currency: { type: String },
    amount: { type: Number },
    fee: { type: Number, default: 0 },
    netSettled: { type: Number },
    type: { type: String }, // charge | refund
    status: { type: String }, // settled | pending | failed

    rowIssues: [{ type: String }],
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, orderReferenceNorm: 1 });

export default mongoose.model("Payment", paymentSchema);
