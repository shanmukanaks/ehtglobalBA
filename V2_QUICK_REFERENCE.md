# EwaUsdPoolV2 - Quick Reference Card

## 🎯 Core Concept
Multiple LPs can deposit/withdraw independently. Each LP's withdrawal is capped by what they've contributed.

---

## 📋 Deployment Commands

```bash
# Compile
cd contracts && npm run build

# Deploy V2
npm run deploy:v2

# Add LPs
LP_ADDRESS=0xYourAddress npm run add-lp
LP_ADDRESS=0xCofounderAddress npm run add-lp

# Export ABI
npm run export-abi
```

---

## 🔑 Smart Contract Functions

### LP Management (Owner Only)
```solidity
addLp(address lp)        // Add LP to allowlist
removeLp(address lp)     // Remove LP from allowlist
```

### LP Operations (LP Role Required)
```solidity
deposit(uint256 amount)  // Deposit USDC (must have LP_ROLE)
withdraw(uint256 amount) // Withdraw up to lpBalance[msg.sender]
```

### View Functions
```solidity
lpBalance[address]       // Get LP's contributed balance
totalLpBalance()         // Get sum of all LP balances
freeLiquidity()          // Get available pool liquidity
```

---

## 🌐 Backend API Endpoints

### LP Management
```bash
# Add LP (Owner only)
POST /api/admin/lp/add
Body: {"lpAddress": "0x..."}

# Remove LP (Owner only)
POST /api/admin/lp/remove
Body: {"lpAddress": "0x..."}

# Get LP balance
GET /api/admin/lp/balance/0xAddress

# Get total LP balance
GET /api/admin/lp/total-balance
```

### LP Operations
```bash
# Deposit (must be approved LP)
POST /api/admin/lp/deposit
Body: {"amount": "1000000"}  # 6 decimals for USDC

# Withdraw (must be approved LP)
POST /api/admin/lp/withdraw
Body: {"amount": "500000"}
```

---

## 📊 Example Flow

### Add New LP (Owner)
```bash
curl -X POST http://localhost:4000/api/admin/lp/add \
  -H "Content-Type: application/json" \
  -d '{"lpAddress":"0xCofounderAddress"}'
```

### LP Deposits Funds
```bash
# 1. LP approves USDC spending (on-chain)
usdc.approve(poolAddress, 1000000000)

# 2. LP deposits
curl -X POST http://localhost:4000/api/admin/lp/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount":"1000000000"}'
```

### Check LP Balance
```bash
curl http://localhost:4000/api/admin/lp/balance/0xCofounderAddress
# Response: {"address":"0x...","balance":"1000000000"}
```

### LP Withdraws Funds
```bash
curl -X POST http://localhost:4000/api/admin/lp/withdraw \
  -H "Content-Type: application/json" \
  -d '{"amount":"500000000"}'
```

---

## 🔒 Access Control

| Function | Who Can Call | Requirements |
|----------|--------------|--------------|
| `addLp()` | Owner | DEFAULT_ADMIN_ROLE |
| `removeLp()` | Owner | DEFAULT_ADMIN_ROLE |
| `deposit()` | Approved LPs | LP_ROLE + USDC approval |
| `withdraw()` | Approved LPs | LP_ROLE + sufficient lpBalance |
| `setCredit()` | Admin/Owner | admin or owner |
| `draw()` | Borrowers | Valid credit line |
| `repay()` | Borrowers | Outstanding debt |
| `collect()` | Admin/Owner | Outstanding debt + USDC allowance |

---

## ⚠️ Important Rules

1. **LP Balance Cap**: LPs can only withdraw up to `lpBalance[lpAddress]`
2. **Free Liquidity Check**: Withdrawals limited by pool's USDC balance
3. **One Active Loan**: Borrowers can only have one active loan (MVP rule)
4. **Role Required**: Must be added as LP before depositing/withdrawing
5. **USDC Approval**: Must approve pool contract before deposit/repay

---

## 🐛 Common Errors

| Error | Meaning | Solution |
|-------|---------|----------|
| `AccessControl: account is missing role` | Not added as LP | Call `addLp()` first |
| `exceeds your LP balance` | Trying to withdraw more than contributed | Check balance with `lpBalance()` |
| `insufficient free liquidity` | Pool doesn't have enough USDC | Wait for repayments or withdraw less |
| `transferFrom fail` | USDC approval missing | Approve pool contract to spend USDC |

---

## 📈 Monitoring

### Check Pool Health
```bash
# Total liquidity
curl http://localhost:4000/api/credit/pool/free-liquidity

# Total LP contributions
curl http://localhost:4000/api/admin/lp/total-balance

# Individual LP balance
curl http://localhost:4000/api/admin/lp/balance/0xAddress
```

### Key Metrics
- `freeLiquidity()`: Available for new loans
- `totalLpBalance`: Sum of all LP contributions
- `lpBalance[addr]`: Individual LP's withdrawable amount

---

## 🔄 Migration from V1

1. Deploy V2 contract
2. Add LPs to allowlist
3. Update backend `.env` with new address
4. Export and update ABI
5. Fund new pool
6. Test thoroughly
7. Deprecate V1

See `V2_MIGRATION_GUIDE.md` for detailed steps.

---

## 📝 Contract Addresses (Base Sepolia)

- **USDC**: `0x261084cb1E6ac1900719634A19E56BB9c18B809A`
- **Admin**: `0x3c1c12dBc91589699736a723B25062B44a612Aa0`
- **V1 Pool** (deprecated): `0x2c2bbf3468C7D87bD8586899725020f207dD23c3`
- **V2 Pool**: `[Deploy to get address]`

---

## 🎓 Quick Tips

1. **Add yourself as LP first**: Test deposits/withdrawals before adding others
2. **Test with small amounts**: Verify everything works before large deposits
3. **Monitor balances**: Use the balance endpoints to track contributions
4. **Keep private keys safe**: LPs with LP_ROLE can deposit/withdraw anytime
5. **Check free liquidity**: Before large withdrawals, ensure pool has enough

---

## 📚 More Info

- Full migration guide: `V2_MIGRATION_GUIDE.md`
- Summary: `V2_SUMMARY.md`
- Contract code: `contracts/contracts/EwaUsdPoolV2.sol`
- Backend routes: `server/src/routes/admin.ts`

---

**Need help? Check the troubleshooting section in `V2_MIGRATION_GUIDE.md`** 🚀

