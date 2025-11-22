#!/bin/bash

# EWA MVP Setup Verification Script
# Run this script to verify your development environment is properly configured

set -e

echo "🔍 EWA MVP Setup Verification"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Track overall status
ERRORS=0
WARNINGS=0

echo "Checking prerequisites..."
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    check_pass "Node.js installed: $NODE_VERSION"
    
    # Check if version is 18+
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        check_warn "Node.js version should be 18 or higher (current: $NODE_VERSION)"
        WARNINGS=$((WARNINGS+1))
    fi
else
    check_fail "Node.js not found"
    ERRORS=$((ERRORS+1))
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    check_pass "npm installed: $NPM_VERSION"
else
    check_fail "npm not found"
    ERRORS=$((ERRORS+1))
fi

echo ""
echo "Checking project structure..."
echo ""

# Check contracts directory
if [ -d "contracts" ]; then
    check_pass "contracts/ directory exists"
    
    # Check contracts files
    if [ -f "contracts/package.json" ]; then
        check_pass "contracts/package.json exists"
    else
        check_fail "contracts/package.json missing"
        ERRORS=$((ERRORS+1))
    fi
    
    if [ -f "contracts/contracts/EwaUsdPool.sol" ]; then
        check_pass "EwaUsdPool.sol exists"
    else
        check_fail "EwaUsdPool.sol missing"
        ERRORS=$((ERRORS+1))
    fi
    
    if [ -f "contracts/hardhat.config.ts" ]; then
        check_pass "hardhat.config.ts exists"
    else
        check_fail "hardhat.config.ts missing"
        ERRORS=$((ERRORS+1))
    fi
    
    # Check if contracts are compiled
    if [ -d "contracts/artifacts" ]; then
        check_pass "Contracts compiled (artifacts/ exists)"
    else
        check_warn "Contracts not compiled yet (run: cd contracts && npm run build)"
        WARNINGS=$((WARNINGS+1))
    fi
    
    # Check contracts node_modules
    if [ -d "contracts/node_modules" ]; then
        check_pass "contracts dependencies installed"
    else
        check_warn "contracts dependencies not installed (run: cd contracts && npm install)"
        WARNINGS=$((WARNINGS+1))
    fi
else
    check_fail "contracts/ directory missing"
    ERRORS=$((ERRORS+1))
fi

echo ""

# Check server directory
if [ -d "server" ]; then
    check_pass "server/ directory exists"
    
    # Check server files
    if [ -f "server/package.json" ]; then
        check_pass "server/package.json exists"
    else
        check_fail "server/package.json missing"
        ERRORS=$((ERRORS+1))
    fi
    
    if [ -f "server/src/index.ts" ]; then
        check_pass "server/src/index.ts exists"
    else
        check_fail "server/src/index.ts missing"
        ERRORS=$((ERRORS+1))
    fi
    
    if [ -f "server/prisma/schema.prisma" ]; then
        check_pass "Prisma schema exists"
    else
        check_fail "Prisma schema missing"
        ERRORS=$((ERRORS+1))
    fi
    
    if [ -f "server/src/routes/poolAbi.json" ]; then
        check_pass "poolAbi.json exists"
    else
        check_warn "poolAbi.json missing (run: cd contracts && npm run build, then regenerate ABI)"
        WARNINGS=$((WARNINGS+1))
    fi
    
    # Check server node_modules
    if [ -d "server/node_modules" ]; then
        check_pass "server dependencies installed"
    else
        check_warn "server dependencies not installed (run: cd server && npm install)"
        WARNINGS=$((WARNINGS+1))
    fi
    
    # Check Prisma client
    if [ -d "server/node_modules/.prisma" ]; then
        check_pass "Prisma client generated"
    else
        check_warn "Prisma client not generated (run: cd server && npx prisma generate)"
        WARNINGS=$((WARNINGS+1))
    fi
else
    check_fail "server/ directory missing"
    ERRORS=$((ERRORS+1))
fi

echo ""
echo "Checking environment configuration..."
echo ""

# Check contracts .env
if [ -f "contracts/.env" ]; then
    check_pass "contracts/.env exists"
    
    # Check for required variables
    if grep -q "RPC_URL=" contracts/.env; then
        check_pass "RPC_URL configured"
    else
        check_warn "RPC_URL not set in contracts/.env"
        WARNINGS=$((WARNINGS+1))
    fi
    
    if grep -q "PRIVATE_KEY=" contracts/.env; then
        check_pass "PRIVATE_KEY configured"
    else
        check_warn "PRIVATE_KEY not set in contracts/.env"
        WARNINGS=$((WARNINGS+1))
    fi
else
    check_warn "contracts/.env missing (copy from env.example)"
    WARNINGS=$((WARNINGS+1))
fi

# Check server .env
if [ -f "server/.env" ]; then
    check_pass "server/.env exists"
    
    # Check for required variables
    if grep -q "PORT=" server/.env; then
        check_pass "PORT configured"
    else
        check_warn "PORT not set in server/.env"
        WARNINGS=$((WARNINGS+1))
    fi
    
    if grep -q "DATABASE_URL=" server/.env; then
        check_pass "DATABASE_URL configured"
    else
        check_warn "DATABASE_URL not set in server/.env"
        WARNINGS=$((WARNINGS+1))
    fi
    
    if grep -q "PLAID_CLIENT_ID=" server/.env; then
        check_pass "PLAID_CLIENT_ID configured"
    else
        check_warn "PLAID_CLIENT_ID not set in server/.env"
        WARNINGS=$((WARNINGS+1))
    fi
else
    check_warn "server/.env missing (copy from env.example)"
    WARNINGS=$((WARNINGS+1))
fi

echo ""
echo "Checking documentation..."
echo ""

DOCS=("README.md" "QUICKSTART.md" "API.md" "DEPLOYMENT.md" "PROJECT_SUMMARY.md")
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        check_pass "$doc exists"
    else
        check_warn "$doc missing"
        WARNINGS=$((WARNINGS+1))
    fi
done

echo ""
echo "=============================="
echo "Verification Summary"
echo "=============================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Your EWA MVP environment is ready to go! 🎉"
    echo ""
    echo "Next steps:"
    echo "1. cd contracts && npm run build && npm run deploy"
    echo "2. cd server && npx prisma db push && npm run dev"
    echo "3. Check QUICKSTART.md for detailed setup instructions"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Setup complete with $WARNINGS warning(s)${NC}"
    echo ""
    echo "Your environment is mostly ready, but some optional items need attention."
    echo "Review the warnings above and address them if needed."
else
    echo -e "${RED}✗ Setup incomplete: $ERRORS error(s), $WARNINGS warning(s)${NC}"
    echo ""
    echo "Please fix the errors above before proceeding."
    echo "See README.md or QUICKSTART.md for setup instructions."
    exit 1
fi

echo ""

