import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import passport from "../passport.js";
import { prisma } from "../db.js";
import { cfg } from "../config.js";

const r = Router();

// validation schemas
const registerSchema = z.object({
  email: z.string().email("enter a valid email"),
  password: z.string().min(8, "password needs at least 8 chars"),
  wallet: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("enter a valid email"),
  password: z.string().min(1, "password required"),
});

// helper to generate jwt
function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    cfg.jwtSecret,
    { expiresIn: cfg.jwtExpiresIn }
  );
}

// register new user
r.post("/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    // check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existing) {
      return res.status(400).json({ error: "email already registered" });
    }

    const passwordHash = await bcrypt.hash(data.password, cfg.bcryptRounds);

    // if wallet provided, try to find or create user
    let user;
    if (data.wallet) {
      user = await prisma.user.upsert({
        where: { wallet: data.wallet.toLowerCase() },
        update: {
          email: data.email.toLowerCase().trim(),
          passwordHash,
        },
        create: {
          wallet: data.wallet.toLowerCase(),
          email: data.email.toLowerCase().trim(),
          passwordHash,
        },
      });
    } else {
      // create user without wallet (they can connect later)
      const placeholderWallet = `email_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
      user = await prisma.user.create({
        data: {
          wallet: placeholderWallet,
          email: data.email.toLowerCase().trim(),
          passwordHash,
        },
      });
    }

    const token = signToken(user);

    console.log(`user registered: ${user.email}`);
    res.status(201).json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        wallet: user.wallet,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error("register error:", err);
    res.status(500).json({ error: "something went wrong" });
  }
});

// login
r.post("/login", (req, res, next) => {
  try {
    loginSchema.parse(req.body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
  }

  passport.authenticate("local", { session: false }, (err, user, info) => {
    if (err) {
      console.error("login error:", err);
      return res.status(500).json({ error: "something went wrong" });
    }

    if (!user) {
      return res
        .status(401)
        .json({ error: info?.message || "invalid credentials" });
    }

    const token = signToken(user);

    console.log(`user logged in: ${user.email}`);
    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        wallet: user.wallet,
      },
    });
  })(req, res, next);
});

// get current user
r.get("/me", passport.authenticate("jwt", { session: false }), (req, res) => {
  res.json({
    ok: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      wallet: req.user.wallet,
    },
  });
});

// logout (mostly for session based, but included for completeness)
r.post("/logout", (req, res) => {
  // with jwt there's not much to do server side
  // client should just delete the token
  res.json({ ok: true, message: "logged out" });
});

// link wallet to existing account
r.post(
  "/link-wallet",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const { wallet } = req.body;

      if (!wallet) {
        return res.status(400).json({ error: "wallet address required" });
      }

      // check if wallet is already linked to another account
      const existingWallet = await prisma.user.findUnique({
        where: { wallet: wallet.toLowerCase() },
      });

      if (existingWallet && existingWallet.id !== req.user.id) {
        return res
          .status(400)
          .json({ error: "wallet already linked to another account" });
      }

      // update user's wallet
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { wallet: wallet.toLowerCase() },
      });

      console.log(`wallet linked: ${user.email} -> ${wallet}`);
      res.json({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          wallet: user.wallet,
        },
      });
    } catch (err) {
      console.error("link wallet error:", err);
      res.status(500).json({ error: "something went wrong" });
    }
  }
);

export default r;
