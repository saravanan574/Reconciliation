import mongoose from "mongoose";

// One row of orders.csv, scoped to the user who uploaded it.
const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    batchId: { type: String, required: true, index: true },

    orderId: { type: String, required: true }, // as it appeared in the file
    orderIdNorm: { type: String, required: true, index: true }, // trimmed + uppercased, used for matching

    orderDate: { type: Date },
    customerEmail: { type: String },
    currency: { type: String },
    grossAmount: { type: Number },
    discount: { type: Number, default: 0 },
    netAmount: { type: Number },
    status: { type: String }, // completed | cancelled | refunded | ...

    // it show if the row has any issue 
    rowIssues: [{ type: String }],
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, orderIdNorm: 1 });

export default mongoose.model("Order", orderSchema);
