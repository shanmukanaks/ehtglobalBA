import { Router } from "express";
import { cfg } from "../config.js";
import { ethers } from "ethers";
import poolAbi from "./poolAbi.js";
const r = Router();
const provider = new ethers.JsonRpcProvider(cfg.rpcUrl, cfg.chainId);
const pool = new ethers.Contract(cfg.poolAddress, poolAbi, provider);
/** Public: read on-chain line for a wallet */
r.get("/line/:wallet", async (req, res) => {
    try {
        const w = req.params.wallet;
        const [limit, debt, dueDate] = await pool.lineOf(w);
        res.json({ wallet: w, limit: limit.toString(), debt: debt.toString(), dueDate: Number(dueDate) });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/** Public: free liquidity */
r.get("/pool/free-liquidity", async (_req, res) => {
    try {
        const amt = await pool.freeLiquidity();
        res.json({ freeLiquidity: amt.toString() });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
export default r;
