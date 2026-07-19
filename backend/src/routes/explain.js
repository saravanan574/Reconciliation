import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import Discrepancy from "../models/Discrepancy.js";
import { explainDiscrepancies } from "../services/llmService.js";

const router = Router();

// LLM calls cost money and take longer; keep this endpoint from being hammered.
const explainLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20 });

router.post(
  "/",
  requireAuth,
  explainLimiter,
  asyncHandler(async (req, res) => {
    const { discrepancyIds } = req.body;
    if (!Array.isArray(discrepancyIds) || discrepancyIds.length === 0) {
      throw new HttpError(400, "discrepancyIds must be a non-empty array.");
    }
    if (discrepancyIds.length > 25) {
      throw new HttpError(400, "Please request an explanation for 25 discrepancies or fewer at a time.");
    }

    // Scoped to req.user.id so a user can only ever ask the LLM to explain their own data.
    const items = await Discrepancy.find({ _id: { $in: discrepancyIds }, user: req.user.id });
    if (items.length === 0) throw new HttpError(404, "No matching discrepancies found.");

    const result = await explainDiscrepancies(items);
    res.json(result);
  })
);

export default router;
