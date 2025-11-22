import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { cfg } from "../config.js";
import { prisma } from "../db.js";
const r = Router();
if (!fs.existsSync(cfg.uploadDir))
    fs.mkdirSync(cfg.uploadDir, { recursive: true });
const storage = multer.diskStorage({
    destination: cfg.uploadDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`)
});
const upload = multer({ storage });
/** Serve uploaded files */
r.get("/file/:filename", (req, res) => {
    try {
        const { filename } = req.params;
        // Handle both relative paths and just filenames
        let filePath;
        if (filename.includes("/") || filename.includes("\\")) {
            // Full path provided
            filePath = path.isAbsolute(filename) ? filename : path.join(process.cwd(), filename);
        }
        else {
            // Just filename, look in uploads directory
            filePath = path.join(cfg.uploadDir, filename);
        }
        const resolvedPath = path.resolve(filePath);
        // Security check: ensure file is within upload directory
        const uploadDirResolved = path.resolve(cfg.uploadDir);
        if (!resolvedPath.startsWith(uploadDirResolved) && !fs.existsSync(resolvedPath)) {
            // Try resolving from current working directory
            const altPath = path.resolve(process.cwd(), filename);
            if (fs.existsSync(altPath)) {
                filePath = altPath;
            }
            else {
                return res.status(404).json({ error: "File not found" });
            }
        }
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "File not found" });
        }
        // Determine content type based on file extension
        const ext = path.extname(filePath).toLowerCase();
        const contentType = ext === ".pdf" ? "application/pdf" :
            ext === ".png" ? "image/png" :
                [".jpg", ".jpeg"].includes(ext) ? "image/jpeg" :
                    "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", `inline; filename="${path.basename(filePath)}"`);
        res.sendFile(path.resolve(filePath));
    }
    catch (error) {
        console.error("Error serving file:", error);
        res.status(500).json({ error: error.message });
    }
});
r.post("/paystub", upload.single("file"), async (req, res) => {
    try {
        console.log("Paystub upload request received");
        console.log("Request body:", req.body);
        console.log("File:", req.file ? { filename: req.file.filename, size: req.file.size } : "No file");
        // Support both email and wallet for backwards compatibility
        const { email, wallet } = req.body;
        // Prefer wallet if provided (real wallet), otherwise use email to generate placeholder
        let userWallet;
        if (wallet) {
            // Real wallet provided - use it directly
            userWallet = wallet.toLowerCase();
            console.log("Using provided wallet address:", userWallet);
        }
        else if (email) {
            // Generate a consistent wallet address from email (using a simple hash)
            const emailHash = crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
            userWallet = `0x${emailHash.slice(0, 40)}`; // Use first 40 chars as wallet-like address
            console.log("Generated placeholder wallet from email:", userWallet);
        }
        else {
            console.error("Missing email or wallet in request");
            return res.status(400).json({ error: "email or wallet is required" });
        }
        if (!req.file) {
            console.error("No file uploaded");
            return res.status(400).json({ error: "no file uploaded" });
        }
        console.log("Creating/finding user with wallet:", userWallet, email ? `(email: ${email})` : "");
        // If wallet is provided (real wallet) and email is also provided, try to merge with existing placeholder user
        let user;
        if (wallet && email) {
            // Real wallet + email: check if placeholder user exists and merge
            const emailHash = crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
            const placeholderWallet = `0x${emailHash.slice(0, 40)}`;
            const existingPlaceholderUser = await prisma.user.findUnique({
                where: { wallet: placeholderWallet },
            });
            if (existingPlaceholderUser && existingPlaceholderUser.wallet !== userWallet) {
                // Placeholder user exists - update to use real wallet
                console.log(`Updating user from placeholder ${placeholderWallet} to real wallet ${userWallet}`);
                user = await prisma.user.update({
                    where: { id: existingPlaceholderUser.id },
                    data: { wallet: userWallet },
                });
            }
            else {
                // No placeholder user, create/upsert with real wallet
                user = await prisma.user.upsert({
                    where: { wallet: userWallet },
                    update: {},
                    create: { wallet: userWallet }
                });
            }
        }
        else {
            // No wallet or no email - just upsert with the wallet we have
            user = await prisma.user.upsert({
                where: { wallet: userWallet },
                update: {},
                create: { wallet: userWallet }
            });
        }
        console.log("User found/created:", user.id);
        // Store just the filename for easier file serving
        const filename = req.file.filename;
        console.log("Creating document record with filename:", filename);
        const doc = await prisma.document.create({
            data: { userId: user.id, path: filename, status: "pending" }
        });
        console.log("Document created:", doc.id);
        // Create pending application if one doesn't exist
        const existingPending = await prisma.application.findFirst({
            where: {
                userId: user.id,
                status: "pending",
            },
        });
        if (!existingPending) {
            console.log("Creating new pending application");
            await prisma.application.create({
                data: {
                    userId: user.id,
                    status: "pending",
                    method: "paystub",
                },
            });
        }
        else {
            console.log("Pending application already exists:", existingPending.id);
        }
        console.log("Paystub upload successful");
        res.json({ ok: true, documentId: doc.id, path: doc.path });
    }
    catch (error) {
        console.error("Error in paystub upload:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
});
export default r;
