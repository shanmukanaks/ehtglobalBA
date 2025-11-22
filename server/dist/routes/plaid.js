import { Router } from "express";
import { plaid } from "../plaid.js";
import { prisma } from "../db.js";
import { Products, CountryCode } from "plaid";
const r = Router();
/** Optional: create link token if the frontend needs it */
r.post("/create-link-token", async (req, res) => {
    try {
        const user = { client_user_id: req.body.client_user_id || "sandbox-user" };
        const response = await plaid.linkTokenCreate({
            user,
            client_name: "EWA MVP",
            products: [Products.Transactions],
            language: "en",
            country_codes: [CountryCode.Us]
        });
        res.json(response.data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/** Exchange public_token -> access_token */
r.post("/exchange-public-token", async (req, res) => {
    try {
        const { public_token, wallet } = req.body;
        const exch = await plaid.itemPublicTokenExchange({ public_token });
        const access_token = exch.data.access_token;
        const item_id = exch.data.item_id;
        // upsert user & store tokens (sandbox)
        const user = await prisma.user.upsert({
            where: { wallet },
            update: { plaidItemId: item_id, plaidAccessToken: access_token },
            create: { wallet, plaidItemId: item_id, plaidAccessToken: access_token }
        });
        // Create pending application if one doesn't exist
        const existingPending = await prisma.application.findFirst({
            where: {
                userId: user.id,
                status: "pending",
            },
        });
        if (!existingPending) {
            await prisma.application.create({
                data: {
                    userId: user.id,
                    status: "pending",
                    method: "plaid",
                },
            });
        }
        res.json({ ok: true, userId: user.id, item_id });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/** Pull simple income-ish signal via transactions (sandbox mock) */
r.get("/income-snapshot", async (req, res) => {
    try {
        const { wallet } = req.query;
        const user = await prisma.user.findUnique({ where: { wallet } });
        if (!user?.plaidAccessToken)
            return res.status(400).json({ error: "no plaid access" });
        // Minimal: fetch recent transactions & balances
        const start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
        const end = new Date().toISOString().slice(0, 10);
        const tx = await plaid.transactionsGet({ access_token: user.plaidAccessToken, start_date: start, end_date: end });
        const bal = await plaid.accountsBalanceGet({ access_token: user.plaidAccessToken });
        res.json({ balances: bal.data, transactions: tx.data });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
export default r;
