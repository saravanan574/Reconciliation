import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Slow down credential stuffing / brute force attempts against auth endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !isValidEmail(email)) throw new HttpError(400, "Please provide a valid email address.");
    if (!password || password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) throw new HttpError(409, "An account with that email already exists.");

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email: email.toLowerCase().trim(), passwordHash });

    const token = signToken(user);
    res.status(201).json({ token, user: { id: user._id, email: user.email } });
  })
);

router.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) throw new HttpError(400, "Email and password are required.");

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) throw new HttpError(401, "Invalid email or password.");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new HttpError(401, "Invalid email or password.");

    const token = signToken(user);
    res.json({ token, user: { id: user._id, email: user.email } });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select("email createdAt");
    if (!user) throw new HttpError(404, "User not found.");
    res.json({ user: { id: user._id, email: user.email, createdAt: user.createdAt } });
  })
);

export default router;
