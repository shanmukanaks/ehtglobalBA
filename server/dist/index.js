import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import passport from "./passport.js";
import { cfg } from "./config.js";
import authRoutes from "./routes/auth.js";
import plaidRoutes from "./routes/plaid.js";
import uploadRoutes from "./routes/uploads.js";
import adminRoutes from "./routes/admin.js";
import creditRoutes from "./routes/credit.js";
import { isAuthenticated, requireRole } from "./middleware/auth.js";

const app = express();

// security headers
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
            },
        },
        crossOriginEmbedderPolicy: false, // needed for some wallet connections
    })
);

// rate limiters
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: { error: "too many requests, try again later" },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 auth attempts per window
    message: { error: "too many auth attempts, try again later" },
    standardHeaders: true,
    legacyHeaders: false,
});

// apply general rate limit to all routes
app.use(generalLimiter);

// middleware
app.use(cors({ origin: cfg.corsOrigin, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// session setup (needed for passport)
app.use(
    session({
        secret: cfg.sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        },
    })
);

// passport init
app.use(passport.initialize());
app.use(passport.session());

// routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/plaid", isAuthenticated, plaidRoutes);
app.use("/api/uploads", isAuthenticated, uploadRoutes);
// admin routes have mixed auth, some public some admin only
// auth is handled per route inside the router
app.use("/api/admin", adminRoutes);
app.use("/api/credit", creditRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(cfg.port, () => {
    console.log(`server listening on :${cfg.port}`);
});
