import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import Discrepancy from "../models/Discrepancy.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { batchId, type, severity, status, search, page = 1, pageSize = 25 } = req.query;

    const query = { user: req.user.id };
    if (batchId) query.batchId = batchId;
    if (type) query.type = type;
    if (severity) query.severity = severity;
    if (status) query.status = status;
    if (search) {
      const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ orderRef: re }, { summary: re }];
    }

    const limit = Math.min(Number(pageSize) || 25, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const [items, total] = await Promise.all([
      Discrepancy.find(query).sort({ severity: 1, amountAtRisk: -1 }).skip(skip).limit(limit),
      Discrepancy.countDocuments(query),
    ]);

    res.json({ items, total, page: Number(page), pageSize: limit });
  })
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const item = await Discrepancy.findOne({ _id: req.params.id, user: req.user.id })
      .populate("orders")
      .populate("payments");
    if (!item) throw new HttpError(404, "Discrepancy not found.");
    res.json({ item });
  })
);

router.patch(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!["open", "resolved", "ignored"].includes(status)) {
      throw new HttpError(400, "status must be one of open, resolved, ignored.");
    }
    const item = await Discrepancy.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { status },
      { new: true }
    );
    if (!item) throw new HttpError(404, "Discrepancy not found.");
    res.json({ item });
  })
);

export default router;
