# Changelog

All notable changes to the EWA MVP project are documented in this file.

## [0.1.0] - 2025-11-01

### 🎉 Initial MVP Release

This is the initial release of the on-chain Earned Wage Access (EWA) platform backend.

### ✨ Added - Smart Contracts

**EwaUsdPool.sol** - Main USDC lending pool contract
- Admin functions to set credit limits and due dates
- Borrower functions to draw and repay USDC
- LP functions to deposit and withdraw liquidity
- One active loan per wallet constraint (MVP)
- Full event logging for transparency
- OpenZeppelin Ownable for access control

**Deployment Infrastructure**
- Hardhat configuration for Base Sepolia
- Deployment script with environment variable support
- Test stub for future test development
- TypeScript configuration
- Contract compilation and ABI generation

### ✨ Added - Backend Server

**API Routes**
- `/api/plaid` - Plaid Sandbox integration
  - Create link tokens
  - Exchange public tokens
  - Fetch income snapshots
- `/api/uploads` - Document upload handling
  - Paystub upload with multer
  - Local file storage (S3-ready)
- `/api/admin` - Admin operations
  - Approve applications and set on-chain credit
  - Update document verification status
  - LP deposit and withdraw functions
- `/api/credit` - Credit line queries
  - Read on-chain credit lines
  - Check pool liquidity

**Database**
- Prisma ORM with SQLite (Postgres-ready)
- User model with Plaid token storage
- Application model for credit requests
- Document model for paystub tracking
- Audit model for compliance trail

**Infrastructure**
- Express.js server with TypeScript
- CORS support for frontend integration
- Morgan logging middleware
- Multer for file uploads
- Ethers.js v6 for blockchain interaction
- Plaid SDK v24 for bank integration
- Zod for request validation
- Environment-based configuration

### ✨ Added - DevOps

**Docker Support**
- Dockerfile for production deployment
- docker-compose.yml for local development
- .dockerignore for optimized builds
- Health check endpoint

**Development Tools**
- verify-setup.sh - Setup verification script
- .gitignore - Protect secrets and build artifacts
- Environment templates (env.example files)

### ✨ Added - Documentation

**Core Documentation**
- README.md - Comprehensive project documentation
- QUICKSTART.md - 10-minute setup guide
- API.md - Complete API reference with examples
- DEPLOYMENT.md - Production deployment checklist
- PROJECT_SUMMARY.md - Project overview and deliverables
- CONTRIBUTING.md - Development workflow and guidelines
- INDEX.md - Documentation navigation
- CHANGELOG.md - This file

### 🔒 Security

- Environment-based secrets management
- No hardcoded private keys or API credentials
- Contract access control with admin roles
- Allowance-based repayment system
- Liquidity checks to prevent over-withdrawal

### 📋 Features

**Verification Paths**
- Plaid Sandbox integration for mock income verification
- Manual paystub upload with admin review
- Both paths converge to on-chain credit approval

**Lending Flow**
- Admin sets credit limit and due date on-chain
- User draws USDC from pool (frontend integration)
- User repays via allowance (frontend integration)
- Admin can collect if allowance pre-granted

**LP Management**
- Single LP (founder) can deposit USDC
- LP can withdraw unused funds at any time
- Free liquidity tracking

### 🎯 Technical Stack

**Smart Contracts**
- Solidity 0.8.24
- Hardhat 2.22.5
- OpenZeppelin Contracts 5.0.2
- ethers.js 6.12.1

**Backend**
- Node.js 18+ (recommended)
- TypeScript 5.6.3
- Express 4.19.2
- Prisma 5.18.0
- Plaid SDK 24.0.0
- ethers.js 6.12.1

**Infrastructure**
- Docker
- SQLite (default) / PostgreSQL
- Base Sepolia testnet

### 📦 Deliverables

**Contracts** (`/contracts`)
- ✅ EwaUsdPool.sol - Fully functional lending pool
- ✅ Deploy script for Base Sepolia
- ✅ Hardhat configuration
- ✅ Test stub
- ✅ ABI generation

**Server** (`/server`)
- ✅ Express API with all routes
- ✅ Prisma database schema
- ✅ Plaid integration
- ✅ File upload handling
- ✅ Contract interaction
- ✅ Docker support

**Documentation**
- ✅ 7 comprehensive documentation files
- ✅ API examples and curl commands
- ✅ Setup verification script
- ✅ Environment templates

### ⚠️ Known Limitations (MVP Scope)

- No frontend modifications (as requested)
- No OCR for paystub parsing (manual review only)
- Full repayment required (no partial repayments)
- No interest or fee calculations
- No authentication on admin routes (add in production)
- No rate limiting (add in production)
- Single LP only (multi-LP in future)
- One active loan per wallet

### 🚀 Deployment Targets

- Base Sepolia (testnet) - Ready
- Base Mainnet - Requires audit and production setup

### 📊 Testing Status

- ✅ Contracts compile successfully
- ✅ Contracts deploy to testnet
- ✅ Server starts and responds to health checks
- ✅ API routes functional
- ✅ Database schema validated
- ⚠️ Full test suite to be implemented

### 🔮 Future Enhancements

**Planned for v0.2.0**
- Authentication and authorization
- Rate limiting
- Comprehensive test suite
- Partial repayment support
- Interest calculations
- OCR for paystubs
- Multi-LP support
- Automated collections
- Event monitoring and webhooks

**Production Readiness**
- Smart contract security audit
- Penetration testing
- S3 integration for uploads
- Monitoring and alerting
- CI/CD pipeline
- KYC/AML compliance
- Legal review

### 📝 Notes

- This is an MVP release focused on core functionality
- Frontend integration points are ready but frontend code is in another branch
- All secrets must be configured via environment variables
- Plaid is configured for Sandbox mode (use production credentials for mainnet)
- Contract should be audited before mainnet deployment

### 🙏 Acknowledgments

Built with:
- OpenZeppelin for secure contract patterns
- Hardhat for development tooling
- Plaid for bank integration
- Prisma for database management
- Express.js for API framework

---

## Version History

- **0.1.0** (2025-11-01) - Initial MVP release

---

For detailed information about any feature, see the relevant documentation file in the project root.

