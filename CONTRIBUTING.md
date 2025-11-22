# Contributing to EWA MVP

Thank you for your interest in contributing to the EWA platform! This guide will help you get started.

## Development Setup

### Prerequisites
- Node.js 18+
- Git
- Base Sepolia testnet wallet with ETH
- Plaid Sandbox account (free)

### Initial Setup

1. **Clone and Install**
```bash
git clone <repository-url>
cd ewa-mvp

# Install contracts dependencies
cd contracts
npm install

# Install server dependencies
cd ../server
npm install
```

2. **Configure Environment**
```bash
# Contracts
cd contracts
cp env.example .env
# Edit .env with your values

# Server
cd ../server
cp env.example .env
# Edit .env with your values
```

3. **Initialize Database**
```bash
cd server
npx prisma db push
```

4. **Compile Contracts**
```bash
cd contracts
npm run build
```

5. **Start Development Server**
```bash
cd server
npm run dev
```

## Project Structure

```
/contracts          # Smart contracts (Solidity + Hardhat)
/server            # Backend API (Express + TypeScript)
/app               # Frontend (DO NOT MODIFY - in another branch)
```

## Development Workflow

### Making Changes

1. **Create a Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Make Your Changes**
   - Follow existing code style
   - Add comments for complex logic
   - Update tests if applicable

3. **Test Your Changes**
```bash
# Contracts
cd contracts
npm test

# Server (manual testing for now)
cd server
npm run dev
# Test endpoints with curl or Postman
```

4. **Commit Your Changes**
```bash
git add .
git commit -m "feat: add your feature description"
```

5. **Push and Create PR**
```bash
git push origin feature/your-feature-name
# Create pull request on GitHub
```

## Code Style

### TypeScript
- Use TypeScript strict mode
- Prefer `const` over `let`
- Use async/await over promises
- Add JSDoc comments for public functions
- Use meaningful variable names

**Example:**
```typescript
/**
 * Approves a credit application and sets on-chain credit limit
 * @param wallet - User's wallet address
 * @param approvedLimit - Credit limit in USDC smallest units (6 decimals)
 * @param dueDate - Due date as Unix timestamp
 * @returns Transaction hash and application ID
 */
async function approveApplication(
  wallet: string,
  approvedLimit: number,
  dueDate: number
): Promise<{ txHash: string; applicationId: string }> {
  // Implementation
}
```

### Solidity
- Use Solidity 0.8.24
- Follow OpenZeppelin patterns
- Add NatSpec comments
- Use explicit visibility modifiers
- Emit events for state changes

**Example:**
```solidity
/// @notice Borrower draws USDC from their credit line
/// @param amount Amount to draw in USDC smallest units
function draw(uint256 amount) external {
    // Implementation
    emit Drawn(msg.sender, amount);
}
```

### Naming Conventions
- **Variables**: camelCase (`userWallet`, `creditLimit`)
- **Functions**: camelCase (`approveCredit`, `getUserLine`)
- **Classes**: PascalCase (`EwaUsdPool`, `CreditService`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_CREDIT_LIMIT`)
- **Files**: kebab-case (`credit-service.ts`, `ewa-usd-pool.sol`)

## Adding New Features

### Adding a New API Endpoint

1. **Create or Update Route File**
```typescript
// server/src/routes/my-feature.ts
import { Router } from "express";

const r = Router();

r.post("/my-endpoint", async (req, res) => {
  try {
    // Implementation
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default r;
```

2. **Register Route in Main Server**
```typescript
// server/src/index.ts
import myFeatureRoutes from "./routes/my-feature.js";

app.use("/api/my-feature", myFeatureRoutes);
```

3. **Update API Documentation**
```markdown
<!-- API.md -->
### POST /api/my-feature/my-endpoint
Description of endpoint...
```

### Adding a New Smart Contract Function

1. **Add Function to Contract**
```solidity
// contracts/contracts/EwaUsdPool.sol
function myNewFunction(uint256 param) external {
    // Implementation
    emit MyNewEvent(param);
}
```

2. **Recompile Contract**
```bash
cd contracts
npm run build
```

3. **Update ABI in Server**
```bash
cd contracts
cat artifacts/contracts/EwaUsdPool.sol/EwaUsdPool.json | jq '.abi' > ../server/src/routes/poolAbi.json
```

4. **Update Backend to Use New Function**
```typescript
// server/src/routes/admin.ts
const tx = await pool.myNewFunction(param);
```

### Adding a New Database Model

1. **Update Prisma Schema**
```prisma
// server/prisma/schema.prisma
model MyNewModel {
  id        String   @id @default(cuid())
  field1    String
  field2    Int
  createdAt DateTime @default(now())
}
```

2. **Push Schema Changes**
```bash
cd server
npx prisma db push
```

3. **Use in Code**
```typescript
import { prisma } from "./db.js";

const record = await prisma.myNewModel.create({
  data: { field1: "value", field2: 123 }
});
```

## Testing

### Contract Testing

```bash
cd contracts
npm test
```

Add tests in `/contracts/test/`:
```typescript
// contracts/test/EwaUsdPool.t.ts
describe("EwaUsdPool", function () {
  it("Should allow draw when credit is set", async function () {
    // Test implementation
  });
});
```

### API Testing

Manual testing with curl:
```bash
# Test endpoint
curl -X POST http://localhost:4000/api/my-endpoint \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

### Integration Testing

(To be implemented)
```bash
cd server
npm run test:integration
```

## Common Tasks

### Update Dependencies

```bash
# Contracts
cd contracts
npm update
npm audit fix

# Server
cd server
npm update
npm audit fix
```

### Database Migrations

```bash
cd server

# Create migration
npx prisma migrate dev --name my_migration

# Apply to production
npx prisma migrate deploy
```

### Regenerate Prisma Client

```bash
cd server
npx prisma generate
```

### View Database

```bash
cd server
npx prisma studio
# Opens at http://localhost:5555
```

## Debugging

### Contract Debugging

1. **Use Hardhat Console**
```bash
cd contracts
npx hardhat console --network local
```

2. **Add Console Logs**
```solidity
import "hardhat/console.sol";

function myFunction() {
    console.log("Debug value:", someValue);
}
```

### Server Debugging

1. **Check Logs**
```bash
# Development logs show in terminal
npm run dev
```

2. **Use VS Code Debugger**
```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Server",
  "program": "${workspaceFolder}/server/src/index.ts",
  "runtimeExecutable": "tsx",
  "runtimeArgs": ["--inspect"]
}
```

## Pull Request Guidelines

### Before Submitting

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] No linter errors
- [ ] Documentation updated
- [ ] Commit messages are clear
- [ ] No sensitive data (keys, secrets) committed

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## Issue Reporting

### Bug Reports

Include:
1. Description of the bug
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Environment (OS, Node version, etc.)
6. Logs/error messages

### Feature Requests

Include:
1. Description of feature
2. Use case / motivation
3. Proposed implementation (optional)
4. Alternatives considered

## Security

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

Email security concerns to: [SECURITY_EMAIL]

### Security Best Practices

- Never commit private keys or secrets
- Use environment variables for sensitive data
- Validate all user inputs
- Use parameterized queries (Prisma handles this)
- Keep dependencies updated
- Follow principle of least privilege

## Resources

### Documentation
- [README.md](./README.md) - Main documentation
- [QUICKSTART.md](./QUICKSTART.md) - Quick setup
- [API.md](./API.md) - API reference
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide

### External Resources
- [Hardhat Docs](https://hardhat.org/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Prisma Docs](https://www.prisma.io/docs)
- [Plaid API Docs](https://plaid.com/docs/)
- [ethers.js Docs](https://docs.ethers.org/v6/)

## Community

### Getting Help

1. Check existing documentation
2. Search closed issues
3. Ask in discussions (if enabled)
4. Open a new issue

### Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others when possible
- Follow project guidelines

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT).

---

Thank you for contributing to EWA! 🎉

