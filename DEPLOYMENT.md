# Deployment Checklist

Use this checklist when deploying the EWA platform to production.

## Pre-Deployment

### Security Audit
- [ ] Smart contract security audit completed
- [ ] Backend API security review completed
- [ ] Penetration testing performed
- [ ] All dependencies updated and vulnerability-free

### Environment Setup
- [ ] Production RPC endpoint configured (e.g., Alchemy, Infura)
- [ ] Production database (Postgres) provisioned
- [ ] S3 bucket or equivalent for document storage
- [ ] Plaid production credentials obtained
- [ ] SSL certificates for API domain
- [ ] Monitoring and logging service configured (e.g., Sentry, DataDog)

### Smart Contracts
- [ ] Contracts deployed to mainnet (Base or Ethereum)
- [ ] Contract ownership verified
- [ ] Admin address set correctly
- [ ] USDC address verified (mainnet USDC)
- [ ] Initial LP funding deposited
- [ ] Contract verified on block explorer (Etherscan/Basescan)

### Backend Configuration
- [ ] All environment variables set in production
- [ ] Database migrations applied
- [ ] CORS origins restricted to production frontend
- [ ] Rate limiting configured
- [ ] Authentication middleware enabled on admin routes
- [ ] File upload size limits set
- [ ] Request validation enabled

## Deployment Steps

### 1. Deploy Smart Contracts

```bash
cd contracts

# Ensure .env has mainnet configuration
# RPC_URL=https://mainnet.base.org
# PRIVATE_KEY=0xYourProductionDeployerKey
# USDC_ADDRESS=0xUSDCMainnetAddress
# ADMIN_ADDRESS=0xProductionBackendWallet

npm run build
npm run deploy -- --network mainnet

# Verify contract on block explorer
npx hardhat verify --network mainnet <DEPLOYED_ADDRESS> <USDC_ADDRESS> <ADMIN_ADDRESS>
```

### 2. Setup Production Database

```bash
# Update DATABASE_URL in server/.env to Postgres
# DATABASE_URL=postgresql://user:password@host:5432/ewa_prod

cd server
npx prisma migrate deploy
```

### 3. Deploy Backend

#### Option A: Docker (Recommended)

```bash
cd server

# Build image
docker build -t ewa-server:latest .

# Run container
docker run -d \
  --name ewa-server \
  -p 4000:4000 \
  --env-file .env.production \
  ewa-server:latest
```

#### Option B: PM2

```bash
cd server

npm run build

# Start with PM2
pm2 start dist/index.js --name ewa-server

# Save PM2 config
pm2 save
pm2 startup
```

#### Option C: Cloud Platform (Heroku, Railway, Render)

Follow platform-specific deployment guides. Ensure all environment variables are set in the platform's dashboard.

### 4. Configure Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name api.yourewa.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 5. Enable SSL

```bash
# Using Certbot
sudo certbot --nginx -d api.yourewa.com
```

## Post-Deployment

### Verification
- [ ] Health check endpoint responding: `curl https://api.yourewa.com/health`
- [ ] Contract functions callable from backend
- [ ] Plaid integration working in production mode
- [ ] File uploads working with S3
- [ ] Database connections stable
- [ ] Logs being captured correctly

### Monitoring Setup
- [ ] Uptime monitoring configured
- [ ] Error tracking enabled (Sentry)
- [ ] Performance monitoring active (New Relic, DataDog)
- [ ] Database performance monitoring
- [ ] Smart contract event monitoring
- [ ] Alert rules configured for critical errors

### Security Hardening
- [ ] Admin routes protected with authentication
- [ ] API rate limiting active
- [ ] CORS restricted to production domains only
- [ ] Private keys stored in secure vault (AWS Secrets Manager, etc.)
- [ ] Database backups automated
- [ ] DDoS protection enabled (Cloudflare, AWS Shield)

### Documentation
- [ ] API documentation published (Swagger/OpenAPI)
- [ ] Admin user guide created
- [ ] Incident response plan documented
- [ ] Backup and recovery procedures documented

## Production Environment Variables

### Contracts
```env
RPC_URL=https://mainnet.base.org
PRIVATE_KEY=<FROM_SECURE_VAULT>
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  # Base mainnet USDC
ADMIN_ADDRESS=<PRODUCTION_BACKEND_WALLET>
```

### Server
```env
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://yourewa.com

# Plaid Production
PLAID_ENV=production
PLAID_CLIENT_ID=<PRODUCTION_CLIENT_ID>
PLAID_SECRET=<PRODUCTION_SECRET>
PLAID_PRODUCTS=transactions,income
PLAID_COUNTRY_CODES=US,CA

# Chain & Contract
RPC_URL=https://mainnet.base.org
POOL_ADMIN_PRIVATE_KEY=<FROM_SECURE_VAULT>
POOL_CONTRACT_ADDRESS=<DEPLOYED_POOL_ADDRESS>
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
CHAIN_ID=8453

# Database
DATABASE_URL=postgresql://user:password@host:5432/ewa_prod

# Storage
UPLOAD_DIR=/var/ewa/uploads
AWS_S3_BUCKET=ewa-documents-prod
AWS_REGION=us-east-1

# Monitoring
SENTRY_DSN=<YOUR_SENTRY_DSN>
LOG_LEVEL=info
```

## Rollback Plan

If issues arise post-deployment:

1. **Backend Rollback**
   ```bash
   # PM2
   pm2 restart ewa-server --update-env
   
   # Docker
   docker stop ewa-server
   docker run -d --name ewa-server <PREVIOUS_IMAGE>
   ```

2. **Database Rollback**
   ```bash
   # Restore from backup
   psql ewa_prod < backup_YYYYMMDD.sql
   ```

3. **Contract Issues**
   - Cannot rollback deployed contracts
   - Deploy new version if critical bug found
   - Pause operations via admin functions if available

## Maintenance

### Regular Tasks
- [ ] Weekly: Review error logs and metrics
- [ ] Weekly: Check pool liquidity levels
- [ ] Monthly: Update dependencies and security patches
- [ ] Monthly: Review and rotate API keys
- [ ] Quarterly: Full security audit
- [ ] Quarterly: Database optimization and cleanup

### Backup Schedule
- [ ] Database: Daily automated backups, 30-day retention
- [ ] Documents: Continuous S3 versioning
- [ ] Logs: 90-day retention
- [ ] Configuration: Version controlled in private repo

## Incident Response

### Critical Issues
1. **Contract Exploit**
   - Pause contract operations immediately (if pause function exists)
   - Notify all users
   - Engage security team
   - Prepare post-mortem

2. **Backend Compromise**
   - Rotate all API keys and secrets immediately
   - Review access logs
   - Restore from clean backup
   - Notify affected users

3. **Database Breach**
   - Isolate database
   - Assess data exposure
   - Notify users per compliance requirements
   - Restore from backup if corrupted

### Contact Information
- On-call engineer: [PHONE/EMAIL]
- Security team: [EMAIL]
- Infrastructure team: [EMAIL]
- Legal team: [EMAIL]

## Compliance

### Data Privacy
- [ ] GDPR compliance verified (if serving EU users)
- [ ] Privacy policy published
- [ ] User data retention policy implemented
- [ ] Data deletion procedures in place

### Financial Regulations
- [ ] Legal review completed for target jurisdictions
- [ ] KYC/AML requirements assessed
- [ ] Licensing requirements met
- [ ] Terms of service published

## Performance Benchmarks

Target metrics for production:

- API response time: < 200ms (p95)
- Database query time: < 50ms (p95)
- Contract transaction confirmation: < 30s
- Uptime: 99.9%
- Error rate: < 0.1%

## Cost Estimates

Monthly operational costs:

- RPC provider: $50-200 (depending on volume)
- Database (Postgres): $25-100
- Server hosting: $20-100
- S3 storage: $5-20
- Monitoring tools: $50-200
- Total: ~$150-620/month (excluding gas costs)

---

**Note**: This checklist is a starting point. Customize based on your specific requirements, scale, and regulatory environment.

