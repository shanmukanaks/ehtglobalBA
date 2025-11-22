# Quick Start Guide - EWA MVP

Get the EWA platform running in under 10 minutes.

## Prerequisites

- Node.js 18+ installed
- Base Sepolia testnet wallet with ETH for gas
- Plaid Sandbox account (free at https://plaid.com/docs/sandbox/)

## Step 1: Deploy Contracts (3 minutes)

```bash
cd contracts

# Setup environment
cp env.example .env

# Edit .env - add your values:
# RPC_URL=https://sepolia.base.org
# PRIVATE_KEY=0xYourPrivateKey
# USDC_ADDRESS=0xUSDCAddressOnBaseSepolia
# ADMIN_ADDRESS=0xYourBackendWalletAddress

# Install & deploy
npm install
npm run build
npm run deploy

# ✅ Copy the deployed pool address shown in console
```

## Step 2: Start Backend (3 minutes)

```bash
cd ../server

# Setup environment
cp env.example .env

# Edit .env - minimum required:
# PORT=4000
# PLAID_CLIENT_ID=your_plaid_client_id
# PLAID_SECRET=your_plaid_sandbox_secret
# RPC_URL=https://sepolia.base.org
# POOL_ADMIN_PRIVATE_KEY=0xYourAdminPrivateKey
# POOL_CONTRACT_ADDRESS=0xDeployedPoolAddressFromStep1
# USDC_ADDRESS=0xSameUSDCAddress
# DATABASE_URL=file:./dev.db

# Install & start
npm install
npx prisma db push
npm run dev

# ✅ Server running on http://localhost:4000
```

## Step 3: Test the API (2 minutes)

```bash
# Health check
curl http://localhost:4000/health
# Expected: {"ok":true}

# Check pool liquidity
curl http://localhost:4000/api/credit/pool/free-liquidity
# Expected: {"freeLiquidity":"0"}

# Check a credit line (replace with your wallet)
curl http://localhost:4000/api/credit/line/0xYourWalletAddress
# Expected: {"wallet":"0x...","limit":"0","debt":"0","dueDate":0}
```

## Step 4: Fund the Pool (2 minutes)

Before users can draw funds, the LP (owner) must deposit USDC:

```bash
# 1. Approve pool contract to spend your USDC (do this on-chain via frontend or etherscan)
# 2. Call deposit endpoint:

curl -X POST http://localhost:4000/api/admin/lp/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount":"1000000"}'
# Amount is in USDC smallest units (6 decimals)
# 1000000 = 1 USDC

# ✅ Check liquidity again:
curl http://localhost:4000/api/credit/pool/free-liquidity
# Expected: {"freeLiquidity":"1000000"}
```

## Step 5: Approve a User (1 minute)

```bash
# Approve a wallet for credit (replace with actual wallet address)
curl -X POST http://localhost:4000/api/admin/applications/approve \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0xUserWalletAddress",
    "approvedLimit": 500000,
    "dueDate": 1735689600
  }'
# approvedLimit: 500000 = 0.5 USDC (in 6 decimals)
# dueDate: Unix timestamp (e.g., Jan 1, 2025 = 1735689600)

# ✅ Verify credit line was set:
curl http://localhost:4000/api/credit/line/0xUserWalletAddress
# Expected: {"wallet":"0x...","limit":"500000","debt":"0","dueDate":1735689600}
```

## Step 6: User Draws Funds (Frontend Integration)

The user can now call the contract directly from your frontend:

```javascript
// Frontend example (using ethers.js or wagmi)
const pool = new ethers.Contract(poolAddress, poolAbi, signer);
await pool.draw(500000); // Draw 0.5 USDC
```

## Step 7: User Repays (Frontend Integration)

```javascript
// 1. Approve pool to spend USDC
const usdc = new ethers.Contract(usdcAddress, erc20Abi, signer);
await usdc.approve(poolAddress, 500000);

// 2. Repay the loan
await pool.repay(500000);
```

## Testing Plaid Integration

### Create Link Token

```bash
curl -X POST http://localhost:4000/api/plaid/create-link-token \
  -H "Content-Type: application/json" \
  -d '{"client_user_id":"test-user-1"}'

# Use the returned link_token in Plaid Link on frontend
```

### Exchange Public Token

After user completes Plaid Link flow:

```bash
curl -X POST http://localhost:4000/api/plaid/exchange-public-token \
  -H "Content-Type: application/json" \
  -d '{
    "public_token": "public-sandbox-xxx",
    "wallet": "0xUserWalletAddress"
  }'
```

### View Income Snapshot

```bash
curl "http://localhost:4000/api/plaid/income-snapshot?wallet=0xUserWalletAddress"
# Returns mock transactions and balances from Plaid Sandbox
```

## Testing Manual Paystub Upload

```bash
# Upload a paystub (replace with actual file path)
curl -X POST http://localhost:4000/api/uploads/paystub \
  -F "file=@/path/to/paystub.pdf" \
  -F "wallet=0xUserWalletAddress"

# Response includes documentId
# {"ok":true,"documentId":"clxxx...","path":"/full/path/to/file"}

# Admin marks as verified
curl -X POST http://localhost:4000/api/admin/documents/clxxx.../status \
  -H "Content-Type: application/json" \
  -d '{"status":"verified","notes":"Looks good"}'
```

## Common Issues

### "insufficient free liquidity"
- LP hasn't deposited USDC yet
- Solution: Run Step 4 to fund the pool

### "no credit"
- User hasn't been approved yet
- Solution: Run Step 5 to approve the user

### "transferFrom fail"
- User hasn't approved USDC allowance for pool
- Solution: User must call `usdc.approve(poolAddress, amount)` first

### "not admin"
- Wrong private key in `POOL_ADMIN_PRIVATE_KEY`
- Solution: Use the same address you set as `ADMIN_ADDRESS` in contracts

## Next Steps

1. **Frontend Integration**: Connect your existing frontend to these APIs
2. **Authentication**: Add auth middleware to admin routes
3. **Production**: Switch to mainnet and audit contracts
4. **Monitoring**: Add logging and error tracking

## API Reference

See [README.md](./README.md) for complete API documentation.

## Need Help?

- Check the main [README.md](./README.md) for detailed documentation
- Review contract code in `/contracts/contracts/EwaUsdPool.sol`
- Check server logs for error messages
- Verify all environment variables are set correctly

---

**🎉 You're ready to build!** The backend is running and ready for your frontend to integrate.

