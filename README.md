# EWA MVP - On-Chain Earned Wage Access Platform

This repository contains the backend infrastructure for an on-chain Earned Wage Access (EWA) platform built on Base Sepolia testnet. The system enables small, short-term wage advances disbursed and repaid entirely on-chain using USDC stablecoins.

## Project Structure

```
/contracts          # Hardhat Solidity contracts
  /contracts
    EwaUsdPool.sol  # Main USDC pool contract
  /scripts
    deploy.ts       # Deployment script
  /test
    EwaUsdPool.t.ts # Contract tests

/server            # Express TypeScript backend
  /prisma
    schema.prisma  # Database schema (SQLite/Postgres)
  /src
    /routes
      admin.ts     # Admin approval & LP management
      plaid.ts     # Plaid Sandbox integration
      uploads.ts   # Paystub file uploads
      credit.ts    # On-chain credit line queries
      poolAbi.json # Contract ABI (auto-generated)
    index.ts       # Express server entry
    config.ts      # Environment configuration
    db.ts          # Prisma client
    plaid.ts       # Plaid API client
```

## Core Features

### Two Verification Paths

1. **Plaid Sandbox** - Mock bank account linking for income verification
2. **Manual Paystub** - Upload PDF/image for admin review (no OCR)

### Smart Contract (`EwaUsdPool.sol`)

- **Admin functions**: Set credit limits and due dates per borrower
- **Borrower functions**: `draw()` to receive USDC, `repay()` to pay back
- **LP functions**: `deposit()` to fund pool, `withdraw()` to pull unused funds
- **Admin collection**: `collect()` to pull repayment if allowance pre-granted
- **Events**: `CreditSet`, `Drawn`, `Repaid`, `Collected`, `Deposited`, `Withdrawn`

### Backend API

- **Plaid routes** (`/api/plaid`):
  - `POST /create-link-token` - Generate Plaid Link token
  - `POST /exchange-public-token` - Exchange public token for access token
  - `GET /income-snapshot` - Fetch mock transactions/balances

- **Upload routes** (`/api/uploads`):
  - `POST /paystub` - Upload paystub document

- **Admin routes** (`/api/admin`):
  - `POST /applications/approve` - Approve credit & set on-chain limit
  - `POST /documents/:id/status` - Mark document verified/rejected
  - `POST /lp/deposit` - LP deposits USDC to pool
  - `POST /lp/withdraw` - LP withdraws free liquidity

- **Credit routes** (`/api/credit`):
  - `GET /line/:wallet` - Query on-chain credit line
  - `GET /pool/free-liquidity` - Check available pool liquidity

## Setup Instructions

### Prerequisites

- Node.js 18+ (recommended)
- npm or yarn
- Wallet with Base Sepolia ETH for gas
- USDC on Base Sepolia (or deploy mock ERC20)
- Plaid Sandbox account ([sign up free](https://plaid.com/docs/sandbox/))

### 1. Contracts Setup

```bash
cd contracts

# Copy and configure environment
cp env.example .env
# Edit .env with your values:
# - RPC_URL: https://sepolia.base.org
# - PRIVATE_KEY: Your deployer private key (with 0x prefix)
# - USDC_ADDRESS: USDC contract address on Base Sepolia
# - ADMIN_ADDRESS: Backend wallet address for admin operations

# Install dependencies
npm install

# Compile contracts
npm run build

# Deploy to Base Sepolia
npm run deploy

# Copy the deployed pool address for server .env
```

### 2. Server Setup

```bash
cd ../server

# Copy and configure environment
cp env.example .env
# Edit .env with your values:
# - PORT: 4000 (or your preferred port)
# - CORS_ORIGIN: http://localhost:3000 (your frontend URL)
# - PLAID_CLIENT_ID: From Plaid Dashboard
# - PLAID_SECRET: Sandbox secret from Plaid Dashboard
# - RPC_URL: https://sepolia.base.org
# - POOL_ADMIN_PRIVATE_KEY: Admin wallet private key (with 0x prefix)
# - POOL_CONTRACT_ADDRESS: Deployed EwaUsdPool address from step 1
# - USDC_ADDRESS: Same USDC address from contracts
# - DATABASE_URL: file:./dev.db (SQLite) or postgres://... (Postgres)

# Install dependencies
npm install

# Initialize database
npx prisma db push

# Start development server
npm run dev

# Server will be running on http://localhost:4000
```

### 3. Testing with Plaid Sandbox

1. Use Plaid Link in your frontend with sandbox environment
2. Test credentials:
   - Institution: First Platypus Bank
   - Username: `user_good`
   - Password: `pass_good`
3. After linking, call `/api/plaid/exchange-public-token` to persist tokens
4. Query `/api/plaid/income-snapshot?wallet=0x...` to view mock data

## Workflow

### Plaid Verification Path

1. User connects bank via Plaid Link (frontend)
2. Frontend calls `POST /api/plaid/exchange-public-token` with `public_token` and `wallet`
3. Backend stores access token in database
4. Admin reviews income via `GET /api/plaid/income-snapshot?wallet=0x...`
5. Admin approves via `POST /api/admin/applications/approve` with `{ wallet, approvedLimit, dueDate }`
6. Backend calls `pool.setCredit()` on-chain
7. User can now call `draw()` from frontend to receive USDC

### Manual Paystub Path

1. User uploads paystub via `POST /api/uploads/paystub` (multipart form with `file` and `wallet`)
2. Backend stores file path in database with `pending` status
3. Admin reviews document offline
4. Admin marks status via `POST /api/admin/documents/:id/status` with `{ status: "verified" }`
5. Admin approves via `POST /api/admin/applications/approve` (same as Plaid path)
6. Backend calls `pool.setCredit()` on-chain
7. User can now call `draw()` from frontend

### Borrowing & Repayment

1. User checks credit line: `GET /api/credit/line/:wallet`
2. User draws funds: Frontend calls `pool.draw(amount)` directly (on-chain)
3. User repays: Frontend calls `pool.repay(amount)` after approving USDC allowance
4. Alternative: Admin can call `pool.collect(user)` if user pre-approved allowance

### LP Management

1. LP (owner) deposits: `POST /api/admin/lp/deposit` with `{ amount: "1000000" }` (6 decimals for USDC)
   - LP must first approve pool contract to spend USDC
2. LP withdraws: `POST /api/admin/lp/withdraw` with `{ amount: "500000" }`
   - Only free (unlent) liquidity can be withdrawn

## Security Notes

- **Never commit** `.env` files or private keys
- All secrets must be in `.env.local` / `.env`
- LP withdraw only allows free liquidity (debt already sent out)
- Contract enforces one active loan per wallet in MVP
- Borrowers must approve pool contract for `repay()` or `collect()`
- Admin routes should be protected with authentication in production

## Database Schema

- **User**: Wallet address, Plaid tokens, relations to applications/documents
- **Application**: Credit application status, method (plaid/paystub), limits, due date
- **Document**: Uploaded paystub files, verification status
- **Audit**: Audit trail for compliance (extensible)

## Environment Variables

### Contracts (`/contracts/.env`)

```env
RPC_URL=https://sepolia.base.org
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
USDC_ADDRESS=0xYourUSDCOrMockAddress
ADMIN_ADDRESS=0xBackendBotOrOwner
```

### Server (`/server/.env`)

```env
PORT=4000
CORS_ORIGIN=http://localhost:3000

# Plaid Sandbox
PLAID_ENV=sandbox
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_PRODUCTS=transactions,income
PLAID_COUNTRY_CODES=US,CA

# Chain & Contract
RPC_URL=https://sepolia.base.org
POOL_ADMIN_PRIVATE_KEY=0xYourAdminKey
POOL_CONTRACT_ADDRESS=0xDeployedPoolAddress
USDC_ADDRESS=0xYourUSDCOrMockAddress
CHAIN_ID=84532

# Database
DATABASE_URL=file:./dev.db

# Uploads
UPLOAD_DIR=./uploads
```

## Production Considerations

- [ ] Add authentication/authorization to admin routes
- [ ] Implement rate limiting
- [ ] Add request validation middleware
- [ ] Use S3 or similar for document storage
- [ ] Switch to Postgres for production database
- [ ] Add comprehensive error logging (Sentry, etc.)
- [ ] Implement webhook handlers for Plaid events
- [ ] Add OCR for automated paystub parsing
- [ ] Implement partial repayments (currently MVP requires full repayment)
- [ ] Add interest/fee calculations
- [ ] Deploy contracts to mainnet with audited code

## Testing

### Contract Tests

```bash
cd contracts
npm test
```

### Manual API Testing

Use curl or Postman to test endpoints:

```bash
# Health check
curl http://localhost:4000/health

# Check pool liquidity
curl http://localhost:4000/api/credit/pool/free-liquidity

# Check credit line
curl http://localhost:4000/api/credit/line/0xYourWalletAddress
```

## Troubleshooting

- **Contract deployment fails**: Ensure you have Base Sepolia ETH for gas
- **Server won't start**: Check all required env vars are set in `.env`
- **Plaid errors**: Verify `PLAID_CLIENT_ID` and `PLAID_SECRET` are correct
- **Transaction reverts**: Check USDC allowances and pool liquidity
- **Database errors**: Run `npx prisma db push` to sync schema

## License

MIT

## Support

For issues or questions, please open a GitHub issue or contact the development team.

