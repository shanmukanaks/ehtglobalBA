# EwaUsdPool V2 Migration Guide

## What's New in V2

EwaUsdPoolV2 introduces **multi-LP support** with minimal changes to the existing architecture:

### Key Changes
- ✅ **Multiple LPs**: Owner can add/remove LP addresses to an allowlist
- ✅ **Per-LP Balance Tracking**: Each LP's contributions are tracked separately
- ✅ **Independent Withdrawals**: LPs can only withdraw up to their contributed amount
- ✅ **Same Borrower Logic**: All MVP rules maintained (one active loan per user, free-liquidity checks)

### What Stayed the Same
- ✅ All borrower functions (`draw`, `repay`) unchanged
- ✅ Admin credit management unchanged
- ✅ Free liquidity checks still enforced
- ✅ One active loan per wallet rule maintained

---

## Smart Contract Changes

### New Features

#### 1. LP Role Management
```solidity
bytes32 public constant LP_ROLE = keccak256("LP_ROLE");

// Owner can add/remove LPs
function addLp(address lp) external onlyRole(DEFAULT_ADMIN_ROLE)
function removeLp(address lp) external onlyRole(DEFAULT_ADMIN_ROLE)
```

#### 2. Per-LP Balance Tracking
```solidity
mapping(address => uint256) public lpBalance;  // Individual LP balances
uint256 public totalLpBalance;                 // Sum of all LP balances
```

#### 3. Modified Access Control
- `deposit()`: Changed from `onlyOwner` to `onlyRole(LP_ROLE)`
- `withdraw()`: Changed from `onlyOwner` to `onlyRole(LP_ROLE)` + balance check

#### 4. New Events
```solidity
event LpAdded(address indexed lp);
event LpRemoved(address indexed lp);
event LpDeposited(address indexed lp, uint256 amount);
event LpWithdrawn(address indexed lp, uint256 amount);
```

---

## Deployment Steps

### Prerequisites

1. **Backup Current State**
   - Note current pool address: `0x2c2bbf3468C7D87bD8586899725020f207dD23c3`
   - Record current liquidity and active loans
   - Export any critical data

2. **Environment Check**
   ```bash
   cd contracts
   cat .env
   # Verify:
   # - RPC_URL=https://sepolia.base.org
   # - PRIVATE_KEY=0x...
   # - USDC_ADDRESS=0x261084cb1E6ac1900719634A19E56BB9c18B809A
   # - ADMIN_ADDRESS=0x3c1c12dBc91589699736a723B25062B44a612Aa0
   ```

### Step 1: Compile New Contract

```bash
cd contracts
npm run build
```

Expected output:
```
Compiled 1 Solidity file successfully (evm target: paris).
```

### Step 2: Deploy EwaUsdPoolV2

```bash
npm run deploy:v2
```

Expected output:
```
Deploying EwaUsdPoolV2...
USDC Address: 0x261084cb1E6ac1900719634A19E56BB9c18B809A
Admin Address: 0x3c1c12dBc91589699736a723B25062B44a612Aa0
✅ EwaUsdPoolV2 deployed at: 0xNEW_POOL_ADDRESS
Deployed by: 0xYourAddress

📝 Next steps:
1. Update server/.env with:
   POOL_CONTRACT_ADDRESS=0xNEW_POOL_ADDRESS
   
2. Add LPs to the allowlist:
   await pool.addLp("0xYourCofounderAddress");
   await pool.addLp("0xYourAddress");
   
3. Copy new ABI to server:
   npm run export-abi
   
4. Verify on BaseScan (optional):
   npx hardhat verify --network baseSepolia 0xNEW_POOL_ADDRESS 0x261084cb1E6ac1900719634A19E56BB9c18B809A 0x3c1c12dBc91589699736a723B25062B44a612Aa0
```

**Important**: Save the new pool address!

### Step 3: Add LPs to Allowlist

Add yourself as LP:
```bash
LP_ADDRESS=0xYourWalletAddress npm run add-lp
```

Add your cofounder:
```bash
LP_ADDRESS=0xCofounderWalletAddress npm run add-lp
```

Expected output for each:
```
Adding LP to pool...
Pool Address: 0xNEW_POOL_ADDRESS
LP Address: 0x...
✅ LP added successfully!
Transaction hash: 0x...
```

### Step 4: Export New ABI

```bash
npm run export-abi
```

This copies the V2 contract ABI to `server/src/routes/poolAbi.json`.

### Step 5: Update Backend Configuration

```bash
cd ../server
```

Edit `.env` and update:
```env
POOL_CONTRACT_ADDRESS=0xNEW_POOL_ADDRESS  # Replace with address from Step 2
```

### Step 6: Restart Backend

```bash
npm run build
npm run start
```

Or if using PM2:
```bash
pm2 restart ewa-server
```

### Step 7: Verify Deployment

Test the new endpoints:

#### Check pool liquidity
```bash
curl http://localhost:4000/api/credit/pool/free-liquidity
```

#### Check LP balance (yours)
```bash
curl http://localhost:4000/api/admin/lp/balance/0xYourAddress
```

#### Check total LP balance
```bash
curl http://localhost:4000/api/admin/lp/total-balance
```

### Step 8: Fund the New Pool

As an approved LP, you can now deposit:

First, approve USDC spending:
```bash
# Via frontend or etherscan:
# Call approve(newPoolAddress, amount) on USDC contract
```

Then deposit via API:
```bash
curl -X POST http://localhost:4000/api/admin/lp/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount": "1000000000"}'  # 1000 USDC
```

### Step 9: Verify LP Balances

```bash
# Check your balance
curl http://localhost:4000/api/admin/lp/balance/0xYourAddress

# Should show: {"address":"0x...","balance":"1000000000"}

# Check total
curl http://localhost:4000/api/admin/lp/total-balance

# Should show: {"totalLpBalance":"1000000000"}
```

---

## New Backend API Endpoints

### POST `/api/admin/lp/add`
Add an address to the LP allowlist.

**Request:**
```json
{
  "lpAddress": "0xCofounderAddress"
}
```

**Response:**
```json
{
  "ok": true,
  "lpAddress": "0xCofounderAddress",
  "txHash": "0x..."
}
```

### POST `/api/admin/lp/remove`
Remove an address from the LP allowlist.

**Request:**
```json
{
  "lpAddress": "0xFormerLpAddress"
}
```

**Response:**
```json
{
  "ok": true,
  "lpAddress": "0xFormerLpAddress",
  "txHash": "0x..."
}
```

### GET `/api/admin/lp/balance/:address`
Get an LP's contributed balance.

**Response:**
```json
{
  "address": "0x...",
  "balance": "1000000000"
}
```

### GET `/api/admin/lp/total-balance`
Get total LP contributions across all LPs.

**Response:**
```json
{
  "totalLpBalance": "5000000000"
}
```

---

## Migration Checklist

### Pre-Migration
- [ ] Backup current contract address and configuration
- [ ] Ensure no active loans or inform users of migration
- [ ] Document current pool liquidity
- [ ] Prepare list of LP addresses to add

### Deployment
- [ ] Compile V2 contract
- [ ] Deploy to Base Sepolia
- [ ] Save new contract address
- [ ] Verify contract on BaseScan (optional)
- [ ] Add LPs to allowlist

### Backend Update
- [ ] Export new ABI
- [ ] Update `POOL_CONTRACT_ADDRESS` in server/.env
- [ ] Rebuild backend
- [ ] Restart backend server
- [ ] Test all API endpoints

### Post-Migration
- [ ] Fund new pool with USDC
- [ ] Verify LP balances
- [ ] Test deposit/withdraw as different LPs
- [ ] Test borrower functions (draw/repay)
- [ ] Update frontend if needed
- [ ] Update documentation

---

## Testing the New Multi-LP System

### Test Scenario 1: Multiple LPs Deposit

**As LP 1 (You):**
```bash
# Approve USDC
# Then deposit
curl -X POST http://localhost:4000/api/admin/lp/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount": "1000000000"}'
  
# Check your balance
curl http://localhost:4000/api/admin/lp/balance/0xYourAddress
# Expected: {"address":"0x...","balance":"1000000000"}
```

**As LP 2 (Cofounder):**
```bash
# Cofounder approves USDC from their wallet
# Cofounder calls deposit from their wallet
# (They'll need to call the contract directly or via a frontend)

# Check their balance
curl http://localhost:4000/api/admin/lp/balance/0xCofounderAddress
# Expected: {"address":"0x...","balance":"500000000"}
```

**Check totals:**
```bash
curl http://localhost:4000/api/admin/lp/total-balance
# Expected: {"totalLpBalance":"1500000000"}

curl http://localhost:4000/api/credit/pool/free-liquidity
# Expected: {"freeLiquidity":"1500000000"}
```

### Test Scenario 2: Independent Withdrawals

**LP 1 withdraws part of their balance:**
```bash
curl -X POST http://localhost:4000/api/admin/lp/withdraw \
  -H "Content-Type: application/json" \
  -d '{"amount": "500000000"}'
  
# Check balance after
curl http://localhost:4000/api/admin/lp/balance/0xYourAddress
# Expected: {"address":"0x...","balance":"500000000"}
```

**LP 2's balance unchanged:**
```bash
curl http://localhost:4000/api/admin/lp/balance/0xCofounderAddress
# Expected: {"address":"0x...","balance":"500000000"}
```

### Test Scenario 3: Withdrawal Limits Enforced

**LP 1 tries to withdraw more than they contributed:**
```bash
curl -X POST http://localhost:4000/api/admin/lp/withdraw \
  -H "Content-Type: application/json" \
  -d '{"amount": "1000000000"}'
  
# Expected: Error "exceeds your LP balance"
```

---

## Rollback Plan

If issues arise, you can revert to V1:

1. Update `server/.env`:
   ```env
   POOL_CONTRACT_ADDRESS=0x2c2bbf3468C7D87bD8586899725020f207dD23c3  # V1 address
   ```

2. Replace `server/src/routes/poolAbi.json` with V1 ABI

3. Remove V2-specific routes from `server/src/routes/admin.ts` (lines 85-137)

4. Restart backend

---

## Troubleshooting

### "AccessControl: account is missing role"
- You're trying to deposit/withdraw but haven't been added as LP
- Solution: Run `npm run add-lp` with your address

### "exceeds your LP balance"
- You're trying to withdraw more than you've deposited
- Solution: Check your balance with `/api/admin/lp/balance/:address`

### "insufficient free liquidity"
- Pool doesn't have enough USDC (some is lent out)
- Solution: Wait for repayments or withdraw a smaller amount

### Backend can't connect to new contract
- Wrong contract address in `.env`
- Solution: Verify `POOL_CONTRACT_ADDRESS` matches deployed address

### ABI mismatch errors
- Old ABI still in use
- Solution: Run `npm run export-abi` and restart backend

---

## Contract Addresses

### V1 (Deprecated)
- **Pool**: `0x2c2bbf3468C7D87bD8586899725020f207dD23c3`
- **Status**: Deprecated, do not use for new deposits

### V2 (Current)
- **Pool**: `[TO BE FILLED AFTER DEPLOYMENT]`
- **USDC**: `0x261084cb1E6ac1900719634A19E56BB9c18B809A`
- **Admin**: `0x3c1c12dBc91589699736a723B25062B44a612Aa0`
- **Network**: Base Sepolia (Chain ID: 84532)

---

## Important Notes

1. **No Data Migration**: V1 and V2 are separate contracts. You cannot automatically migrate liquidity or loan data.

2. **Active Loans**: If there are active loans in V1, either:
   - Wait for them to be repaid before fully transitioning
   - Run both contracts in parallel temporarily

3. **Frontend Updates**: Your frontend may need updates to:
   - Show LP balances per user
   - Allow LPs to see their contribution
   - Display total pool vs. their share

4. **No Automatic Yield**: V2 tracks balances but doesn't distribute yield. For yield/fee accounting, you'll need ERC-4626 (future Path B).

---

## Support

If you encounter issues during migration:
1. Check this guide's troubleshooting section
2. Review contract code: `contracts/contracts/EwaUsdPoolV2.sol`
3. Check backend logs for errors
4. Verify all environment variables are correct

---

**Ready to deploy? Follow the steps above sequentially and test thoroughly at each stage!** 🚀

