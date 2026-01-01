import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db.js";
import { cfg } from "../config.js";
import { ethers } from "ethers";
import poolAbi from "./poolAbi.js";
import { requireRole } from "../middleware/auth.js";

const r = Router();

// middleware for admin routes
const adminOnly = requireRole("admin");

// lazy init blockchain connections, only create when env vars are present
let provider = null;
let wallet = null;
let pool = null;

function getPool() {
    if (!pool && cfg.rpcUrl && cfg.poolAdminPK && cfg.poolAddress) {
        provider = new ethers.JsonRpcProvider(cfg.rpcUrl, cfg.chainId);
        wallet = new ethers.Wallet(cfg.poolAdminPK, provider);
        pool = new ethers.Contract(cfg.poolAddress, poolAbi, wallet);
    }
    return pool;
}

function getProvider() {
    if (!provider && cfg.rpcUrl) {
        provider = new ethers.JsonRpcProvider(cfg.rpcUrl, cfg.chainId);
    }
    return provider;
}
/** User: create application (called when user connects wallet) */
r.post("/applications/create", async (req, res) => {
    try {
        const { wallet, email, method = "manual" } = req.body;
        if (!wallet)
            return res.status(400).json({ error: "wallet required" });
        console.log("Creating application for wallet:", wallet, "email:", email);
        // If email is provided, try to find existing user by email (placeholder wallet)
        // and update them to use the real wallet
        let user;
        if (email) {
            const emailHash = crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
            const placeholderWallet = `0x${emailHash.slice(0, 40)}`;
            // Try to find user by placeholder wallet
            const existingUser = await prisma.user.findUnique({
                where: { wallet: placeholderWallet },
            });
            if (existingUser) {
                // Check if real wallet already exists (might be a different user)
                const walletUser = await prisma.user.findUnique({
                    where: { wallet: wallet.toLowerCase() },
                });
                if (walletUser && walletUser.id !== existingUser.id) {
                    // Real wallet belongs to different user - merge: transfer applications/documents
                    console.log("Merging users: transferring data from placeholder to real wallet user");
                    await prisma.application.updateMany({
                        where: { userId: existingUser.id },
                        data: { userId: walletUser.id },
                    });
                    await prisma.document.updateMany({
                        where: { userId: existingUser.id },
                        data: { userId: walletUser.id },
                    });
                    // Delete placeholder user
                    await prisma.user.delete({ where: { id: existingUser.id } });
                    user = walletUser;
                }
                else {
                    // Update existing user to use real wallet
                    console.log("Updating user from placeholder wallet to real wallet:", placeholderWallet, "->", wallet);
                    user = await prisma.user.update({
                        where: { id: existingUser.id },
                        data: { wallet: wallet.toLowerCase() },
                    });
                }
            }
            else {
                // Create new user with real wallet
                user = await prisma.user.upsert({
                    where: { wallet: wallet.toLowerCase() },
                    update: {},
                    create: { wallet: wallet.toLowerCase() },
                });
            }
        }
        else {
            // No email provided, just use wallet
            user = await prisma.user.upsert({
                where: { wallet: wallet.toLowerCase() },
                update: {},
                create: { wallet: wallet.toLowerCase() },
            });
        }
        console.log("User found/created:", user.id, "wallet:", user.wallet);
        // Check if user already has a pending application
        const existingPending = await prisma.application.findFirst({
            where: {
                userId: user.id,
                status: "pending",
            },
        });
        if (existingPending) {
            console.log("Pending application already exists:", existingPending.id);
            // If method is "manual" but existing is "paystub", keep the paystub method (more complete)
            // If existing is "manual" and new is "paystub", update to paystub
            if (method === "paystub" && existingPending.method === "manual") {
                await prisma.application.update({
                    where: { id: existingPending.id },
                    data: { method: "paystub" },
                });
                console.log("Updated application method from manual to paystub");
            }
            return res.json({ ok: true, applicationId: existingPending.id, alreadyExists: true });
        }
        // Create new pending application
        const app = await prisma.application.create({
            data: {
                userId: user.id,
                status: "pending",
                method: method || "manual",
            },
        });
        console.log("Application created:", app.id);
        res.json({ ok: true, applicationId: app.id });
    }
    catch (error) {
        console.error("Error creating application:", error);
        res.status(500).json({ error: error.message });
    }
});
/** Admin: get all applications */
r.get("/applications", adminOnly, async (_req, res) => {
    try {
        const applications = await prisma.application.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        wallet: true,
                        documents: {
                            where: {
                                status: "pending",
                            },
                            orderBy: {
                                createdAt: "desc",
                            },
                            take: 1, // Get the most recent pending document
                        },
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        // Helper function to detect placeholder wallets (generated from email hash)
        // Placeholder wallets are always exactly 42 chars (0x + 40 hex chars) and don't follow checksum
        const isPlaceholderWallet = (wallet) => {
            if (!wallet || wallet.length !== 42 || !wallet.startsWith("0x")) {
                return false;
            }
            // Placeholder wallets are always lowercase (generated from email hash)
            // Real wallets might have checksum casing, but placeholder wallets are always lowercase
            // Also, we can check if it looks like a hash (all lowercase, no mixed case)
            const after0x = wallet.slice(2);
            // If it's all lowercase and exactly 40 chars, it's likely a placeholder
            // But this isn't perfect - let's use a different approach:
            // We'll filter out applications where the user's wallet is a placeholder
            // by checking if there are multiple applications for the same user with different wallets
            return false; // Don't filter by this alone - use deduplication instead
        };
        // Flatten the structure for easier frontend access
        const flattened = applications.map(app => ({
            ...app,
            documents: app.user?.documents || [],
        }));
        // Deduplicate: If a user has multiple pending applications, keep only one
        // Group by user ID (when wallet is updated, both apps will have same user ID)
        const userIdAppMap = new Map();
        flattened.forEach(app => {
            const userId = app.user?.id || "";
            if (!userId) {
                // If no user ID, still include it (shouldn't happen, but be safe)
                return;
            }
            if (!userIdAppMap.has(userId)) {
                userIdAppMap.set(userId, []);
            }
            userIdAppMap.get(userId).push(app);
        });
        const deduplicated = [];
        // For each user, keep only one application
        userIdAppMap.forEach((apps, userId) => {
            if (apps.length === 1) {
                deduplicated.push(apps[0]);
            }
            else {
                // Multiple applications for same user - deduplicate
                // Prefer: 1) paystub method (more complete), 2) most recent
                const sorted = apps.sort((a, b) => {
                    // First, prefer paystub over manual
                    if (a.method === "paystub" && b.method !== "paystub")
                        return -1;
                    if (b.method === "paystub" && a.method !== "paystub")
                        return 1;
                    // Then prefer most recent
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
                deduplicated.push(sorted[0]);
            }
        });
        console.log(`Returning ${deduplicated.length} applications (filtered from ${applications.length} total)`);
        res.json({ applications: deduplicated });
    }
    catch (error) {
        console.error("Error fetching applications:", error);
        res.status(500).json({ error: error.message });
    }
});
/** Admin: approve application and set on-chain credit */
r.post("/applications/approve", adminOnly, async (req, res) => {
    try {
        const body = z.object({
            wallet: z.string(),
            applicationId: z.string().optional(), // Optional: if provided, update existing application
            approvedLimit: z.number().int().positive(), // in smallest units (USDC 6dp)
            dueDate: z.number().int().positive() // unix seconds
        }).parse(req.body);
        // DB application record: update existing or create new
        const user = await prisma.user.upsert({
            where: { wallet: body.wallet },
            update: {},
            create: { wallet: body.wallet }
        });
        let app;
        if (body.applicationId) {
            // Update existing application
            app = await prisma.application.update({
                where: { id: body.applicationId },
                data: {
                    status: "approved",
                    approvedLimit: body.approvedLimit,
                    dueDate: new Date(body.dueDate * 1000)
                }
            });
        }
        else {
            // Create new approved application
            app = await prisma.application.create({
                data: {
                    userId: user.id,
                    status: "approved",
                    method: "manual",
                    approvedLimit: body.approvedLimit,
                    dueDate: new Date(body.dueDate * 1000)
                }
            });
        }
        // on-chain call - normalize wallet address
        const normalizedWallet = body.wallet.toLowerCase();
        console.log(`Setting credit limit for wallet: ${normalizedWallet}, limit: ${body.approvedLimit}, dueDate: ${body.dueDate}`);
        const tx = await getPool().setCredit(normalizedWallet, body.approvedLimit, body.dueDate);
        const receipt = await tx.wait();
        console.log(`Successfully set credit limit. Tx: ${receipt?.hash}`);
        res.json({ ok: true, applicationId: app.id, txHash: receipt?.hash });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/** Admin: reject application */
r.post("/applications/:id/reject", adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        // Get application with user info
        const app = await prisma.application.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!app) {
            return res.status(404).json({ error: "Application not found" });
        }
        // Update application status
        const updatedApp = await prisma.application.update({
            where: { id },
            data: { status: "rejected" },
        });
        // Reset on-chain credit limit to 0 so user sees "Pending Review"
        const userWallet = app.user.wallet.toLowerCase();
        try {
            const futureDate = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
            console.log(`Attempting to reset credit limit for wallet: ${userWallet}`);
            const tx = await getPool().setCredit(userWallet, 0, futureDate);
            const receipt = await tx.wait();
            console.log(`Successfully reset credit limit to 0 for wallet ${userWallet} after rejection. Tx: ${receipt.hash}`);
        }
        catch (onChainError) {
            console.error("Error resetting on-chain credit limit:", onChainError?.message || onChainError);
            // Continue anyway - DB update succeeded
        }
        res.json({ ok: true, applicationId: updatedApp.id });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/** Admin: delete application */
r.delete("/applications/:id", adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        // Get the application first to get the userId and wallet
        const app = await prisma.application.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!app) {
            return res.status(404).json({ error: "Application not found" });
        }
        const userWallet = app.user.wallet.toLowerCase();
        console.log(`Deleting application ${id} for user wallet: ${userWallet}`);
        // First, mark the application as rejected (if not already rejected)
        // This ensures it goes through the reject state before deletion
        if (app.status !== "rejected") {
            await prisma.application.update({
                where: { id },
                data: { status: "rejected" },
            });
            console.log(`Marked application ${id} as rejected before deletion`);
        }
        // Reset on-chain credit limit to 0 (same as reject does)
        try {
            const futureDate = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
            console.log(`Attempting to reset credit limit for wallet: ${userWallet}`);
            const tx = await getPool().setCredit(userWallet, 0, futureDate);
            const receipt = await tx.wait();
            console.log(`Successfully reset credit limit to 0 for wallet ${userWallet} after deletion. Tx: ${receipt.hash}`);
        }
        catch (onChainError) {
            console.error("Error resetting on-chain credit limit:", onChainError?.message || onChainError);
            // Continue anyway - DB update succeeded
        }
        // Delete associated documents
        await prisma.document.deleteMany({
            where: {
                userId: app.userId,
            },
        });
        // Delete the application
        await prisma.application.delete({
            where: { id },
        });
        console.log(`Deleted application ${id} and associated documents (after marking as rejected)`);
        res.json({ ok: true });
    }
    catch (error) {
        console.error("Error deleting application:", error);
        res.status(500).json({ error: error.message });
    }
});
/** Admin: mark document verified/rejected */
r.post("/documents/:id/status", adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const doc = await prisma.document.update({ where: { id }, data: { status, notes } });
        res.json({ ok: true, document: doc });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/** Track advancement fee */
r.post("/advancement-fee", async (req, res) => {
    try {
        console.log("Received advancement-fee request:", req.body);
        const { wallet, amount, principal, txHash } = req.body;
        if (!wallet || !amount || !txHash) {
            console.error("Missing required fields in advancement-fee request:", { wallet: !!wallet, amount: !!amount, txHash: !!txHash });
            return res.status(400).json({ error: "wallet, amount, and txHash are required" });
        }
        // Store fee in audit log, including principal if provided
        const auditRecord = await prisma.audit.create({
            data: {
                kind: "advancement_fee",
                details: JSON.stringify({
                    wallet,
                    amount, // fee amount
                    principal: principal || null, // principal advanced amount
                    totalAmount: principal ? principal + amount : null, // total amount (principal + fee)
                    txHash,
                    timestamp: new Date().toISOString()
                }),
            },
        });
        console.log(`Tracked advancement fee: $${amount} for wallet ${wallet}, principal: ${principal || 'N/A'}, tx: ${txHash}, audit ID: ${auditRecord.id}`);
        res.json({ ok: true });
    }
    catch (error) {
        console.error("Error tracking advancement fee:", error);
        res.status(500).json({ error: error.message });
    }
});
/** Track repayment */
r.post("/repayment", async (req, res) => {
    try {
        console.log("Received repayment request:", req.body);
        const { wallet, principal, fee, txHash } = req.body;
        if (!wallet || principal === undefined || fee === undefined || !txHash) {
            console.error("Missing required fields in repayment request:", { wallet: !!wallet, principal: principal !== undefined, fee: fee !== undefined, txHash: !!txHash });
            return res.status(400).json({ error: "wallet, principal, fee, and txHash are required" });
        }
        // Store repayment in audit log
        const auditRecord = await prisma.audit.create({
            data: {
                kind: "repayment",
                details: JSON.stringify({
                    wallet,
                    principal,
                    fee,
                    totalAmount: principal + fee, // total repayment amount
                    txHash,
                    timestamp: new Date().toISOString()
                }),
            },
        });
        console.log(`Tracked repayment: principal $${principal} + fee $${fee} = $${principal + fee} for wallet ${wallet}, tx: ${txHash}, audit ID: ${auditRecord.id}`);
        res.json({ ok: true });
    }
    catch (error) {
        console.error("Error tracking repayment:", error);
        res.status(500).json({ error: error.message });
    }
});
/** Get transaction history (advancements, repayments, LP deposits/withdrawals) */
r.get("/transaction-history", adminOnly, async (_req, res) => {
    try {
        console.log("Fetching transaction history...");
        // Get all transaction types
        const transactions = await prisma.audit.findMany({
            where: {
                kind: {
                    in: ["advancement_fee", "repayment", "lp_deposit", "lp_withdraw"],
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        console.log(`Found ${transactions.length} transaction records in database`);
        console.log("Transaction kinds:", transactions.map(tx => tx.kind));
        // Format transactions and fetch missing principal from blockchain if needed
        const historyPromises = transactions.map(async (tx) => {
            try {
                const details = JSON.parse(tx.details);
                if (tx.kind === "advancement_fee") {
                    // Handle old records that might not have principal
                    const fee = details.amount || 0;
                    let principal = details.principal || null;
                    // If principal is missing but we have a txHash, try to fetch it from the blockchain
                    if (principal === null && details.txHash) {
                        try {
                            const receipt = await getProvider().getTransactionReceipt(details.txHash);
                            if (receipt) {
                                // Parse the Drawn event to get the amount
                                const drawnEvent = receipt.logs.find((log) => {
                                    try {
                                        const parsed = getPool().interface.parseLog(log);
                                        return parsed?.name === "Drawn";
                                    }
                                    catch {
                                        return false;
                                    }
                                });
                                if (drawnEvent) {
                                    const parsed = getPool().interface.parseLog(drawnEvent);
                                    if (parsed && parsed.args && parsed.args.length > 1) {
                                        // Drawn event: Drawn(address indexed user, uint256 amount)
                                        const amountWei = parsed.args[1]; // amount is the second argument
                                        principal = parseFloat(ethers.formatUnits(amountWei, 6)); // USDC has 6 decimals
                                    }
                                }
                            }
                        }
                        catch (blockchainError) {
                            console.error(`Error fetching principal from tx ${details.txHash}:`, blockchainError);
                            // Continue with principal as null
                        }
                    }
                    const totalAmount = details.totalAmount || (principal !== null ? principal + fee : fee);
                    return {
                        type: "advancement",
                        wallet: details.wallet,
                        principal: principal,
                        fee: fee,
                        totalAmount: totalAmount,
                        txHash: details.txHash,
                        timestamp: details.timestamp || tx.createdAt.toISOString(),
                        createdAt: tx.createdAt,
                    };
                }
                else if (tx.kind === "repayment") {
                    return {
                        type: "repayment",
                        wallet: details.wallet,
                        principal: details.principal,
                        fee: details.fee,
                        totalAmount: details.totalAmount || details.principal + details.fee,
                        txHash: details.txHash,
                        timestamp: details.timestamp || tx.createdAt.toISOString(),
                        createdAt: tx.createdAt,
                    };
                }
                else if (tx.kind === "lp_deposit") {
                    return {
                        type: "lp_deposit",
                        wallet: details.wallet,
                        amount: details.amount,
                        txHash: details.txHash,
                        timestamp: details.timestamp || tx.createdAt.toISOString(),
                        createdAt: tx.createdAt,
                    };
                }
                else if (tx.kind === "lp_withdraw") {
                    return {
                        type: "lp_withdraw",
                        wallet: details.wallet,
                        amount: details.amount,
                        txHash: details.txHash,
                        timestamp: details.timestamp || tx.createdAt.toISOString(),
                        createdAt: tx.createdAt,
                    };
                }
                return null;
            }
            catch {
                return null;
            }
        });
        const history = (await Promise.all(historyPromises)).filter(tx => tx !== null);
        console.log(`Returning ${history.length} formatted transactions`);
        console.log("Transaction types:", history.map(tx => tx.type));
        res.json({ transactions: history });
    }
    catch (error) {
        console.error("Error fetching transaction history:", error);
        res.status(500).json({ error: error.message });
    }
});
/** Clear transaction history */
r.delete("/transaction-history", adminOnly, async (_req, res) => {
    try {
        // Delete all transaction-related audit records
        await prisma.audit.deleteMany({
            where: {
                kind: {
                    in: ["advancement_fee", "repayment", "lp_deposit", "lp_withdraw"],
                },
            },
        });
        console.log("Transaction history cleared");
        res.json({ ok: true });
    }
    catch (error) {
        console.error("Error clearing transaction history:", error);
        res.status(500).json({ error: error.message });
    }
});
/** Get total advancement fees - only count fees from repayments (fees are paid when user repays, not when they advance) */
r.get("/advancement-fees", adminOnly, async (_req, res) => {
    try {
        // Get repayments (fees are only paid on repayment, not advancement)
        const repayments = await prisma.audit.findMany({
            where: {
                kind: "repayment",
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        const totalFees = repayments.reduce((sum, repayment) => {
            try {
                const details = JSON.parse(repayment.details);
                return sum + (details.fee || 0);
            }
            catch {
                return sum;
            }
        }, 0);
        // Count unique users (wallets) from the repayments
        const uniqueWallets = new Set();
        repayments.forEach(repayment => {
            try {
                const details = JSON.parse(repayment.details);
                if (details.wallet) {
                    uniqueWallets.add(details.wallet.toLowerCase());
                }
            }
            catch {
                // Skip invalid entries
            }
        });
        res.json({
            totalFees,
            advancementCount: repayments.length, // Number of repayments (which include fees)
            uniqueUserCount: uniqueWallets.size
        });
    }
    catch (error) {
        console.error("Error fetching advancement fees:", error);
        res.status(500).json({ error: error.message });
    }
});
/** Get LP earnings and APY data for last 7 days */
r.get("/lp/earnings", async (_req, res) => {
    try {
        // Get repayments from last 7 days (fees are only paid on repayment, not advancement)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const repayments = await prisma.audit.findMany({
            where: {
                kind: "repayment",
                createdAt: {
                    gte: sevenDaysAgo,
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        let totalFees = 0;
        let totalPrincipal = 0;
        // Process repayments to extract fees and principal
        for (const repayment of repayments) {
            try {
                const details = JSON.parse(repayment.details);
                const feeAmount = details.fee || 0;
                const principal = details.principal || 0;
                totalFees += feeAmount;
                totalPrincipal += principal;
            }
            catch {
                // Skip invalid entries
            }
        }
        // Calculate APY: (Total fees / Total principal) * (365 / 7) * 100
        // APY = annualized return based on 7-day performance
        let apy = 0;
        if (totalPrincipal > 0) {
            apy = (totalFees / totalPrincipal) * (365 / 7) * 100;
        }
        res.json({
            earnings7D: totalFees,
            totalPrincipal,
            apy,
            repaymentCount: repayments.length,
        });
    }
    catch (error) {
        console.error("Error fetching LP earnings:", error);
        res.status(500).json({ error: error.message });
    }
});
/** LP: deposit & withdraw free liquidity */
r.post("/lp/deposit", async (req, res) => {
    try {
        const { amount, wallet, txHash } = req.body; // "1000000" USDC 6dp, txHash optional for tracking
        // If txHash is provided, this is just tracking (transaction already completed on-chain)
        // Otherwise, execute the deposit transaction
        let finalTxHash = txHash;
        if (!txHash) {
            // Owner must approve the pool to spend before calling deposit; we assume already done.
            const tx = await getPool().deposit(amount);
            const rc = await tx.wait();
            finalTxHash = rc.hash;
        }
        // Track LP deposit in audit log
        if (wallet && finalTxHash) {
            const amountInUsd = parseFloat(amount) / 1000000; // Convert from 6dp to USD
            await prisma.audit.create({
                data: {
                    kind: "lp_deposit",
                    details: JSON.stringify({
                        wallet: wallet.toLowerCase(),
                        amount: amountInUsd,
                        txHash: finalTxHash,
                        timestamp: new Date().toISOString()
                    }),
                },
            });
        }
        res.json({ ok: true, txHash: finalTxHash });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
r.post("/lp/withdraw", async (req, res) => {
    try {
        const { amount, wallet, txHash } = req.body;
        // If txHash is provided, this is just tracking (transaction already completed on-chain)
        // Otherwise, execute the withdraw transaction
        let finalTxHash = txHash;
        if (!txHash) {
            const tx = await getPool().withdraw(amount);
            const rc = await tx.wait();
            finalTxHash = rc.hash;
        }
        // Track LP withdrawal in audit log
        if (wallet && finalTxHash) {
            const amountInUsd = parseFloat(amount) / 1000000; // Convert from 6dp to USD
            await prisma.audit.create({
                data: {
                    kind: "lp_withdraw",
                    details: JSON.stringify({
                        wallet: wallet.toLowerCase(),
                        amount: amountInUsd,
                        txHash: finalTxHash,
                        timestamp: new Date().toISOString()
                    }),
                },
            });
        }
        res.json({ ok: true, txHash: finalTxHash });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/** Admin: add LP to allowlist (V2 only) */
r.post("/lp/add", adminOnly, async (req, res) => {
    try {
        const { lpAddress } = req.body;
        if (!ethers.isAddress(lpAddress)) {
            return res.status(400).json({ error: "Invalid address" });
        }
        const tx = await getPool().addLp(lpAddress);
        const rc = await tx.wait();
        res.json({ ok: true, lpAddress, txHash: rc?.hash });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/** Admin: remove LP from allowlist (V2 only) */
r.post("/lp/remove", adminOnly, async (req, res) => {
    try {
        const { lpAddress } = req.body;
        if (!ethers.isAddress(lpAddress)) {
            return res.status(400).json({ error: "Invalid address" });
        }
        const tx = await getPool().removeLp(lpAddress);
        const rc = await tx.wait();
        res.json({ ok: true, lpAddress, txHash: rc?.hash });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/** View: get LP balance (V2 only) */
r.get("/lp/balance/:address", async (req, res) => {
    try {
        const { address } = req.params;
        if (!ethers.isAddress(address)) {
            return res.status(400).json({ error: "Invalid address" });
        }
        const balance = await getPool().lpBalance(address);
        res.json({ address, balance: balance.toString() });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/** View: get total LP balance (V2 only) */
r.get("/lp/total-balance", async (req, res) => {
    try {
        const totalBalance = await getPool().totalLpBalance();
        res.json({ totalLpBalance: totalBalance.toString() });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/** View: get total amount currently lent out (sum of all user debts) */
r.get("/total-debt", adminOnly, async (req, res) => {
    try {
        // Get all approved applications with wallets
        const approvedApps = await prisma.application.findMany({
            where: { status: "approved" },
            include: { user: true },
        });
        // Sum up all debts from the contract
        let totalDebt = BigInt(0);
        const seenWallets = new Set();
        for (const app of approvedApps) {
            const wallet = app.user?.wallet?.toLowerCase();
            if (!wallet || seenWallets.has(wallet))
                continue;
            seenWallets.add(wallet);
            try {
                const line = await getPool().lineOf(wallet);
                const debt = line[1]; // debt is the second element
                if (debt && debt > 0) {
                    totalDebt += BigInt(debt.toString());
                }
            }
            catch (err) {
                console.error(`Error fetching debt for wallet ${wallet}:`, err);
                // Continue with other wallets
            }
        }
        // Convert to string (in smallest units, 6 decimals for USDC)
        res.json({ totalDebt: totalDebt.toString() });
    }
    catch (error) {
        console.error("Error calculating total debt:", error);
        res.status(500).json({ error: error.message });
    }
});
export default r;
