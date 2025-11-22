# Engineer Handoff Guide: MVP → Production

## Current State
This is an **MVP/Prototype** built for rapid iteration and single-user testing. It uses:
- SQLite (local development database)
- Hardcoded contract addresses in frontend
- Local file storage (`./uploads`)
- localStorage for user sessions
- Single-user testing flows

## ✅ What's Already Production-Ready

1. **Backend Configuration** (`server/src/config.ts`)
   - Already uses environment variables
   - Well-structured config object
   - Ready for multiple environments

2. **Database Schema** (`server/prisma/schema.prisma`)
   - Properly designed models (User, Application, Document, Audit)
   - Relationships properly defined
   - Just needs provider change: `sqlite` → `postgresql`

3. **API Structure**
   - RESTful endpoints
   - Proper error handling
   - CORS configuration ready

## 🔧 Required Changes for Production

### 1. **Database Migration: SQLite → Supabase PostgreSQL**

**File: `server/prisma/schema.prisma`**
```prisma
// Change this:
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

// To this:
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  // Get from Supabase dashboard
}
```

**Then run:**
```bash
cd server
npx prisma migrate dev --name migrate_to_supabase
npx prisma generate
```

### 2. **Frontend: Move Hardcoded Values to Environment Variables**

**Files to update:**
- `app/dashboard/page.tsx`
- `app/admin-dashboard/page.tsx`
- `app/lp-dashboard/page.tsx`

**Current hardcoded values:**
```typescript
const POOL_CONTRACT_ADDRESS = "0x6a8E895a2ED39F240f016216e9ED76FafCB0F805";
const MUSDC_TOKEN_ADDRESS = "0x261084cb1E6ac1900719634A19E56BB9c18B809A";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
```

**Change to:**
```typescript
const POOL_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_POOL_CONTRACT_ADDRESS!;
const MUSDC_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_MUSDC_TOKEN_ADDRESS!;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;
```

**Create `.env.local` for Next.js:**
```env
NEXT_PUBLIC_POOL_CONTRACT_ADDRESS=0x6a8E895a2ED39F240f016216e9ED76FafCB0F805
NEXT_PUBLIC_MUSDC_TOKEN_ADDRESS=0x261084cb1E6ac1900719634A19E56BB9c18B809A
NEXT_PUBLIC_API_URL=https://your-api-domain.com
NEXT_PUBLIC_CHAIN_ID=84532
```

### 3. **File Storage: Local → Supabase Storage**

**Current:** Files stored in `server/uploads/`

**Change in `server/src/routes/uploads.ts`:**
- Remove local file system writes
- Use Supabase Storage client
- Store file paths/URLs in database

**Example migration:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Replace multer file handling with:
const { data, error } = await supabase.storage
  .from('paystubs')
  .upload(`${userId}/${filename}`, file.buffer, {
    contentType: file.mimetype
  });
```

### 4. **Authentication: localStorage → Supabase Auth**

**Current:** Email stored in `localStorage.getItem("user_email")`

**Replace with:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Replace localStorage checks with:
const { data: { user } } = await supabase.auth.getUser();
const userEmail = user?.email;
```

**Update all files that use:**
- `localStorage.getItem("user_email")` → Supabase Auth
- Wallet connection should link to Supabase user ID

### 5. **Multi-User Data Isolation**

**Current:** Some queries may not filter by user properly

**Add user filtering to all database queries:**

**Example in `server/src/routes/admin.ts`:**
```typescript
// Instead of:
const apps = await prisma.application.findMany();

// Use:
const apps = await prisma.application.findMany({
  where: {
    userId: currentUserId  // Always filter by authenticated user
  }
});
```

**Update all routes to:**
- Get user ID from Supabase Auth token
- Filter queries by `userId`
- Validate user owns resources before operations

### 6. **Environment Variables Setup**

**Backend `.env` (server/.env):**
```env
# Database
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key

# Blockchain
RPC_URL=https://sepolia.base.org
POOL_CONTRACT_ADDRESS=0x6a8E895a2ED39F240f016216e9ED76FafCB0F805
USDC_ADDRESS=0x261084cb1E6ac1900719634A19E56BB9c18B809A
POOL_ADMIN_PRIVATE_KEY=your-private-key
CHAIN_ID=84532

# Server
PORT=4000
CORS_ORIGIN=https://your-frontend-domain.com
UPLOAD_DIR=./uploads  # Or use Supabase Storage

# Plaid
PLAID_ENV=sandbox
PLAID_CLIENT_ID=your-client-id
PLAID_SECRET=your-secret
```

**Frontend `.env.local` (app/.env.local):**
```env
NEXT_PUBLIC_API_URL=https://your-api-domain.com
NEXT_PUBLIC_POOL_CONTRACT_ADDRESS=0x6a8E895a2ED39F240f016216e9ED76FafCB0F805
NEXT_PUBLIC_MUSDC_TOKEN_ADDRESS=0x261084cb1E6ac1900719634A19E56BB9c18B809A
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 7. **CORS Configuration**

**Update `server/src/config.ts`:**
```typescript
corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000"
// Remove "*" for production - use specific domain
```

### 8. **Error Handling & Logging**

**Add proper logging:**
- Use a logging library (Winston, Pino)
- Log errors to Supabase or external service
- Remove console.logs in production

**Improve error messages:**
- Don't expose internal errors to users
- Return generic messages for 500 errors
- Log detailed errors server-side

## 📋 Testing Checklist

After migration, test:
- [ ] User can sign up/login with Supabase Auth
- [ ] User can upload paystub (stored in Supabase Storage)
- [ ] User data is isolated (User A can't see User B's data)
- [ ] Admin can see all applications
- [ ] LP can deposit/withdraw
- [ ] User can advance funds
- [ ] User can repay
- [ ] Contract interactions work on Base Sepolia
- [ ] File downloads work from Supabase Storage

## 🚀 Deployment Steps

1. **Set up Supabase project**
   - Create PostgreSQL database
   - Set up Storage bucket for paystubs
   - Configure Auth (email/password)

2. **Run database migrations**
   ```bash
   cd server
   npx prisma migrate deploy
   ```

3. **Deploy backend**
   - Set environment variables
   - Deploy to hosting (Railway, Render, AWS, etc.)
   - Test API endpoints

4. **Deploy frontend**
   - Set environment variables
   - Deploy to Vercel/Netlify
   - Test wallet connections

5. **Configure domains**
   - Set up custom domain for API
   - Update CORS_ORIGIN
   - Update NEXT_PUBLIC_API_URL

## 📝 Notes

- Keep SQLite for local development (faster iteration)
- Use Supabase for staging/production
- Consider adding database backups
- Set up monitoring (Sentry, LogRocket, etc.)
- Add rate limiting for API endpoints
- Implement proper session management

## 🎯 Priority Order

1. **Critical (MVP → Production):**
   - Database migration (SQLite → Supabase)
   - Environment variables
   - File storage migration
   - Authentication migration

2. **Important (Security & Scale):**
   - Multi-user data isolation
   - Error handling improvements
   - CORS configuration
   - Logging setup

3. **Nice to Have:**
   - Rate limiting
   - Monitoring
   - Backup strategy
   - Performance optimization

