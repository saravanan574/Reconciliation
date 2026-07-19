import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import ReconciliationRun from "../models/ReconciliationRun.js";
import Discrepancy from "../models/Discrepancy.js";

const router = Router();

async function resolveRun(userId, batchId) {
  if (batchId) {
    const run = await ReconciliationRun.findOne({ user: userId, batchId });
    if (!run) throw new HttpError(404, "Reconciliation run not found.");
    return run;
  }
  const latest = await ReconciliationRun.findOne({ user: userId }).sort({ createdAt: -1 });
  return latest;
}

router.get(
  "/summary",
  requireAuth,
  asyncHandler(async (req, res) => {
    const run = await resolveRun(req.user.id, req.query.batchId);
    if (!run) return res.json({ run: null });

    const bySeverity = await Discrepancy.aggregate([
      { $match: { user: run.user, batchId: run.batchId } },
      { $group: { _id: "$severity", count: { $sum: 1 }, amount: { $sum: "$amountAtRisk" } } },
    ]);

    const byType = await Discrepancy.aggregate([
      { $match: { user: run.user, batchId: run.batchId } },
      { $group: { _id: "$type", count: { $sum: 1 }, amount: { $sum: "$amountAtRisk" } } },
      { $sort: { amount: -1 } },
    ]);

    res.json({
      run,
      bySeverity: bySeverity.map((s) => ({ severity: s._id, count: s.count, amount: s.amount })),
      byType: byType.map((t) => ({ type: t._id, count: t.count, amount: t.amount })),
    });
  })
);

export default router;
