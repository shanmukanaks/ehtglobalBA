# Installation Guide

This project consists of three separate applications, each requiring their own dependencies to be installed.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn package manager

## Installation Steps

### 1. Root Directory (Frontend - Next.js)

Navigate to the root directory and install dependencies:

```bash
cd /Users/aaron/Desktop/mvp
npm install
```

This installs:
- Next.js framework
- React and React DOM
- Wagmi and RainbowKit for Web3 wallet connections
- Viem for Ethereum interactions
- Plaid integration for financial data
- Recharts (v3.3.0) for chart visualization - used for LineChart components in admin dashboard
- Tailwind CSS for styling
- TypeScript and type definitions

### 2. Server Directory (Backend - Express)

Navigate to the server directory and install dependencies:

```bash
cd /Users/aaron/Desktop/mvp/server
npm install
```

This installs:
- Express web framework
- Prisma ORM and Prisma Client
- Ethers.js for blockchain interactions
- Plaid SDK for financial services
- CORS middleware
- Multer for file uploads
- Zod for schema validation
- TypeScript and development tools

After installation, set up the database:

```bash
npm run db:push
```

### 3. Contracts Directory (Smart Contracts - Hardhat)

Navigate to the contracts directory and install dependencies:

```bash
cd /Users/aaron/Desktop/mvp/contracts
npm install
```

This installs:
- Hardhat development environment
- OpenZeppelin contracts library
- Ethers.js for contract interactions
- Chai for testing
- TypeScript and Hardhat plugins

## Quick Install All

To install all dependencies at once, run:

```bash
cd /Users/aaron/Desktop/mvp && npm install
cd server && npm install
cd ../contracts && npm install
```

## Environment Variables

After installing dependencies, make sure to set up environment variables:

- Copy `server/env.example` to `server/.env` and fill in your values
- Copy `contracts/env.example` to `contracts/.env` and fill in your values
- Create a `.env.local` file in the root directory for Next.js environment variables

