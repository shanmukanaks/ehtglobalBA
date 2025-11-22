# Changelog - V2 Multi-LP Update

## Version 2.0.0 - Multi-LP Support

**Release Date**: November 2, 2025

### 🎉 Major Features

#### Multi-LP Support
- **Multiple Liquidity Providers**: Contract now supports multiple independent LPs
- **Per-LP Balance Tracking**: Each LP's contributions tracked separately
- **Independent Withdrawals**: LPs can only withdraw up to their contributed amount
- **Role-Based Access Control**: Uses OpenZeppelin's AccessControl for LP management

### 📝 Contract Changes

#### New Contract: `EwaUsdPoolV2.sol`

**Added Features:**
- `LP_ROLE`: New role for approved liquidity providers
- `lpBalance` mapping: Tracks individual LP contributions
- `totalLpBalance`: Sum of all LP balances
- `addLp(address)`: Owner can add addresses to LP allowlist
- `removeLp(address)`: Owner can remove addresses from LP allowlist

**Modified Functions:**
- `deposit()`: Changed from `onlyOwner` to `onlyRole(LP_ROLE)`
- `withdraw()`: Changed from `onlyOwner` to `onlyRole(LP_ROLE)` with balance cap

**New Events:**
- `LpAdded(address indexed lp)`
- `LpRemoved(address indexed lp)`
- `LpDeposited(address indexed lp, uint256 amount)`
- `LpWithdrawn(address indexed lp, uint256 amount)`

**Inherited Contracts:**
- `Ownable` (unchanged)
- `AccessControl` (new)

### 🔧 Backend Changes

#### New API Endpoints (`/api/admin/*`)

1. **POST `/api/admin/lp/add`**
   - Add address to LP allowlist
   - Owner only
   - Returns: `{ok, lpAddress, txHash}`

2. **POST `/api/admin/lp/remove`**
   - Remove address from LP allowlist
   - Owner only
   - Returns: `{ok, lpAddress, txHash}`

3. **GET `/api/admin/lp/balance/:address`**
   - Get LP's contributed balance
   - Public view
   - Returns: `{address, balance}`

4. **GET `/api/admin/lp/total-balance`**
   - Get total LP contributions
   - Public view
   - Returns: `{totalLpBalance}`

#### Modified Endpoints

- `POST /api/admin/lp/deposit`: Now callable by any approved LP (was owner-only)
- `POST /api/admin/lp/withdraw`: Now callable by any approved LP (was owner-only)

### 🛠️ Deployment Scripts

**New Scripts:**
- `contracts/scripts/deployV2.ts`: Deploy V2 contract
- `contracts/scripts/addLp.ts`: Helper to add LPs post-deployment

**New npm Commands:**
- `npm run deploy:v2`: Deploy to Base Sepolia
- `npm run add-lp`: Add LP to deployed contract
- `npm run export-abi`: Export ABI to server

### 📚 Documentation

**New Files:**
- `V2_MIGRATION_GUIDE.md`: Complete deployment and migration guide
- `V2_SUMMARY.md`: Quick overview of changes
- `V2_QUICK_REFERENCE.md`: Command reference card
- `CHANGELOG_V2.md`: This file

### ✅ What Stayed the Same

**No changes to:**
- Borrower functions (`draw`, `repay`)
- Admin credit management (`setCredit`, `collect`)
- One active loan per wallet rule
- Free liquidity checks
- USDC integration
- Database schema
- Frontend (no breaking changes)

### 🔄 Migration Path

For existing V1 deployments:
1. Deploy new V2 contract
2. Add LPs to allowlist
3. Update backend configuration
4. Export new ABI
5. Fund new pool
6. Deprecate V1

See `V2_MIGRATION_GUIDE.md` for detailed steps.

### 🐛 Bug Fixes

None - this is a feature addition, not a bug fix release.

### 🔐 Security Considerations

- **Access Control**: LP_ROLE properly restricts deposit/withdraw
- **Balance Caps**: LPs cannot withdraw more than they contributed
- **Liquidity Checks**: Free liquidity checks still enforced
- **Role Management**: Only owner can add/remove LPs
- **No Breaking Changes**: All existing security measures maintained

### ⚠️ Breaking Changes

**Contract Level:**
- New contract deployment required (cannot upgrade V1 in-place)
- Different contract address

**Backend Level:**
- New ABI required
- Environment variable update required
- New endpoints available (backward compatible)

**Frontend Level:**
- No breaking changes
- Optional: Add UI to show LP balances

### 📊 Performance Impact

- **Gas Costs**: Slightly higher due to AccessControl overhead (~5-10%)
- **Storage**: Additional storage for `lpBalance` mapping and `totalLpBalance`
- **View Calls**: New view functions available with no performance impact

### 🧪 Testing

**Test Coverage:**
- Basic compilation test in `EwaUsdPoolV2.t.ts`
- Manual testing recommended for:
  - Multi-LP deposits
  - Independent withdrawals
  - Balance cap enforcement
  - Role-based access control

### 🎯 Future Improvements

**Potential V3 Features:**
- ERC-4626 vault standard for yield accounting
- Automated yield distribution
- LP share tokens
- Time-locked deposits
- Minimum LP contribution requirements
- LP rewards/incentives

### 📞 Support

For questions or issues:
- Review `V2_MIGRATION_GUIDE.md` for deployment help
- Check `V2_QUICK_REFERENCE.md` for command reference
- See `V2_SUMMARY.md` for a quick overview

---

## Version 1.0.0 - Initial Release

**Release Date**: November 1, 2025

### Features
- Single-LP USDC pool contract
- Admin credit management
- Borrower draw/repay functions
- Plaid integration
- Manual paystub uploads
- Backend API with Express
- PostgreSQL database
- Base Sepolia deployment

See `PROJECT_SUMMARY.md` for full V1 feature list.

---

**Upgrade to V2 recommended for all new deployments to enable multi-LP support.**

