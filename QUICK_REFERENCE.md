# Quick Reference - Base Sepolia Testnet

## 🚀 Deployed Addresses

| Component | Address |
|-----------|---------|
| **EwaUsdPool Contract** | `0x2c2bbf3468C7D87bD8586899725020f207dD23c3` |
| **Mock USDC Token** | `0x261084cb1E6ac1900719634A19E56BB9c18B809A` |
| **Admin Wallet** | `0x3c1c12dBc91589699736a723B25062B44a612Aa0` |
| **Network** | Base Sepolia (Chain ID: 84532) |
| **RPC URL** | https://sepolia.base.org |

## 📋 Quick Commands

### Start Backend Server
```bash
cd server
npm run dev      # Development mode
# OR
npm run build && npm run start   # Production mode
```

### Test API Endpoints
```bash
# Check pool liquidity
curl http://localhost:4000/api/credit/pool/free-liquidity

# Check wallet credit line
curl http://localhost:4000/api/credit/line/0xWALLET_ADDRESS
```

### Verify Contract on BaseScan (Optional)
```bash
# First, add your API key to contracts/.env:
# BASESCAN_API_KEY=your_api_key_from_basescan.org

cd contracts
npx hardhat verify --network baseSepolia \
  0x2c2bbf3468C7D87bD8586899725020f207dD23c3 \
  0x261084cb1E6ac1900719634A19E56BB9c18B809A \
  0x3c1c12dBc91589699736a723B25062B44a612Aa0
```

Get API key: https://basescan.org/myapikey

### Database Commands
```bash
cd server

# Generate Prisma client
npx prisma generate

# Push schema changes
npx prisma db push

# Open Prisma Studio (GUI)
npx prisma studio
```

## 🔗 Useful Links

- **Your Contract on BaseScan:** https://sepolia.basescan.org/address/0x2c2bbf3468C7D87bD8586899725020f207dD23c3
- **Mock USDC on BaseScan:** https://sepolia.basescan.org/address/0x261084cb1E6ac1900719634A19E56BB9c18B809A
- **Base Sepolia Faucet:** https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- **Plaid Dashboard:** https://dashboard.plaid.com/

## 📝 Common Tasks

### Fund the Liquidity Pool
1. Get testnet ETH from faucet (for gas)
2. Mint mock USDC to your admin wallet
3. Approve pool to spend USDC
4. Deposit via API:
```bash
curl -X POST http://localhost:4000/api/admin/lp/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount": "1000000000"}'
```

### Approve Credit for a User
```bash
curl -X POST http://localhost:4000/api/admin/applications/approve \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0xUSER_WALLET",
    "approvedLimit": 100000000,
    "dueDate": 1735689600
  }'
```

## 🆘 Troubleshooting

**Backend won't connect to contract?**
- Check `POOL_CONTRACT_ADDRESS` in server/.env
- Verify `RPC_URL` is correct
- Ensure admin wallet has ETH for gas

**Database errors?**
```bash
cd server
npx prisma generate
npx prisma db push
```

**Can't deploy/verify contract?**
- Check contracts/.env has correct values
- Ensure admin wallet has testnet ETH
- Verify network is set to baseSepolia

## 📄 Configuration Files

- `contracts/.env` - Contract deployment config
- `server/.env` - Backend API config  
- `contracts/hardhat.config.ts` - Hardhat network settings
- `server/prisma/schema.prisma` - Database schema

## ✅ Deployment Status

- ✅ EwaUsdPool contract deployed
- ✅ Backend configured and tested
- ✅ Database initialized (Supabase)
- ✅ API endpoints working
- ✅ Contract verification setup ready

**Full deployment details:** See `TESTNET_DEPLOYMENT.md`

