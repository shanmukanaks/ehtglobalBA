import { Router } from "express";
import { cfg } from "../config.js";
import { ethers } from "ethers";
import poolAbi from "./poolAbi.js";
const r = Router();

// lazy init blockchain connections, only create when env vars are present
let pool = null;

function getPool() {
    if (!pool && cfg.rpcUrl && cfg.poolAddress) {
        const provider = new ethers.JsonRpcProvider(cfg.rpcUrl, cfg.chainId);
        pool = new ethers.Contract(cfg.poolAddress, poolAbi, provider);
    }
    return pool;
}
/** Public: read on-chain line for a wallet */
r.get("/line/:wallet", async (req, res) => {
    try {
        const w = req.params.wallet;
        const [limit, debt, dueDate] = await getPool().lineOf(w);
        res.json({ wallet: w, limit: limit.toString(), debt: debt.toString(), dueDate: Number(dueDate) });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/** Public: free liquidity */
r.get("/pool/free-liquidity", async (_req, res) => {
    try {
        const amt = await getPool().freeLiquidity();
        res.json({ freeLiquidity: amt.toString() });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
export default r;
