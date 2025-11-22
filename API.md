# EWA API Documentation

Base URL: `http://localhost:4000` (development) or `https://api.yourewa.com` (production)

## Table of Contents

- [Health Check](#health-check)
- [Plaid Routes](#plaid-routes)
- [Upload Routes](#upload-routes)
- [Credit Routes](#credit-routes)
- [Admin Routes](#admin-routes)

---

## Health Check

### GET /health

Check if the server is running.

**Response:**
```json
{
  "ok": true
}
```

---

## Plaid Routes

Base path: `/api/plaid`

### POST /api/plaid/create-link-token

Create a Plaid Link token for the frontend to initialize Plaid Link.

**Request Body:**
```json
{
  "client_user_id": "user-123"  // Optional, defaults to "sandbox-user"
}
```

**Response:**
```json
{
  "link_token": "link-sandbox-xxx",
  "expiration": "2024-01-01T12:00:00Z",
  "request_id": "xxx"
}
```

**Example:**
```bash
curl -X POST http://localhost:4000/api/plaid/create-link-token \
  -H "Content-Type: application/json" \
  -d '{"client_user_id":"user-123"}'
```

---

### POST /api/plaid/exchange-public-token

Exchange a Plaid public token for an access token and store it.

**Request Body:**
```json
{
  "public_token": "public-sandbox-xxx",
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**Response:**
```json
{
  "ok": true,
  "userId": "clxxx...",
  "item_id": "xxx"
}
```

**Example:**
```bash
curl -X POST http://localhost:4000/api/plaid/exchange-public-token \
  -H "Content-Type: application/json" \
  -d '{
    "public_token": "public-sandbox-xxx",
    "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }'
```

---

### GET /api/plaid/income-snapshot

Fetch mock income data and transactions for a user (Plaid Sandbox).

**Query Parameters:**
- `wallet` (required): User's wallet address

**Response:**
```json
{
  "balances": {
    "accounts": [
      {
        "account_id": "xxx",
        "balances": {
          "available": 100.00,
          "current": 110.00,
          "limit": null
        },
        "name": "Plaid Checking",
        "type": "depository",
        "subtype": "checking"
      }
    ]
  },
  "transactions": {
    "accounts": [...],
    "transactions": [
      {
        "transaction_id": "xxx",
        "amount": 500.00,
        "date": "2024-01-01",
        "name": "PAYROLL DEPOSIT",
        "category": ["Income", "Payroll"]
      }
    ]
  }
}
```

**Example:**
```bash
curl "http://localhost:4000/api/plaid/income-snapshot?wallet=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
```

---

## Upload Routes

Base path: `/api/uploads`

### POST /api/uploads/paystub

Upload a paystub document for manual verification.

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `file`: The paystub file (PDF, PNG, JPG)
  - `wallet`: User's wallet address

**Response:**
```json
{
  "ok": true,
  "documentId": "clxxx...",
  "path": "/absolute/path/to/uploaded/file"
}
```

**Example:**
```bash
curl -X POST http://localhost:4000/api/uploads/paystub \
  -F "file=@/path/to/paystub.pdf" \
  -F "wallet=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
```

---

## Credit Routes

Base path: `/api/credit`

### GET /api/credit/line/:wallet

Get the on-chain credit line for a wallet.

**Path Parameters:**
- `wallet`: User's wallet address

**Response:**
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "limit": "500000",      // 0.5 USDC (6 decimals)
  "debt": "0",            // Current outstanding debt
  "dueDate": 1735689600   // Unix timestamp
}
```

**Example:**
```bash
curl http://localhost:4000/api/credit/line/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

---

### GET /api/credit/pool/free-liquidity

Get the available liquidity in the pool.

**Response:**
```json
{
  "freeLiquidity": "1000000"  // 1 USDC (6 decimals)
}
```

**Example:**
```bash
curl http://localhost:4000/api/credit/pool/free-liquidity
```

---

## Admin Routes

Base path: `/api/admin`

⚠️ **Note:** These routes should be protected with authentication in production.

### POST /api/admin/applications/approve

Approve a credit application and set the on-chain credit line.

**Request Body:**
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "approvedLimit": 500000,    // 0.5 USDC (6 decimals)
  "dueDate": 1735689600       // Unix timestamp
}
```

**Response:**
```json
{
  "ok": true,
  "applicationId": "clxxx...",
  "txHash": "0xabc123..."
}
```

**Example:**
```bash
curl -X POST http://localhost:4000/api/admin/applications/approve \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "approvedLimit": 500000,
    "dueDate": 1735689600
  }'
```

---

### POST /api/admin/documents/:id/status

Update the verification status of an uploaded document.

**Path Parameters:**
- `id`: Document ID (from upload response)

**Request Body:**
```json
{
  "status": "verified",  // "verified" | "rejected" | "pending"
  "notes": "Looks good"  // Optional
}
```

**Response:**
```json
{
  "ok": true,
  "document": {
    "id": "clxxx...",
    "userId": "clyyy...",
    "path": "/path/to/file",
    "status": "verified",
    "notes": "Looks good",
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:4000/api/admin/documents/clxxx.../status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "verified",
    "notes": "Looks good"
  }'
```

---

### POST /api/admin/lp/deposit

LP deposits USDC into the pool.

**Request Body:**
```json
{
  "amount": "1000000"  // 1 USDC (6 decimals)
}
```

**Response:**
```json
{
  "ok": true,
  "txHash": "0xabc123..."
}
```

**Prerequisites:**
- LP must have approved the pool contract to spend USDC before calling this endpoint

**Example:**
```bash
curl -X POST http://localhost:4000/api/admin/lp/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount":"1000000"}'
```

---

### POST /api/admin/lp/withdraw

LP withdraws free liquidity from the pool.

**Request Body:**
```json
{
  "amount": "500000"  // 0.5 USDC (6 decimals)
}
```

**Response:**
```json
{
  "ok": true,
  "txHash": "0xabc123..."
}
```

**Note:** Can only withdraw free (unlent) liquidity.

**Example:**
```bash
curl -X POST http://localhost:4000/api/admin/lp/withdraw \
  -H "Content-Type: application/json" \
  -d '{"amount":"500000"}'
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400` - Bad Request (missing parameters, validation error)
- `500` - Internal Server Error (contract call failed, database error)

---

## USDC Decimal Conversion

USDC uses 6 decimals. Convert amounts as follows:

| Human Readable | Contract Amount (6 decimals) |
|---------------|------------------------------|
| 0.01 USDC     | 10000                        |
| 0.5 USDC      | 500000                       |
| 1 USDC        | 1000000                      |
| 10 USDC       | 10000000                     |
| 100 USDC      | 100000000                    |

**JavaScript conversion:**
```javascript
// Human to contract
const contractAmount = humanAmount * 1_000_000;

// Contract to human
const humanAmount = contractAmount / 1_000_000;
```

---

## Rate Limits

Currently no rate limits in development. Production should implement:
- General endpoints: 100 requests/minute per IP
- Admin endpoints: 20 requests/minute per IP
- Upload endpoints: 10 requests/minute per IP

---

## Authentication

**Development:** No authentication required.

**Production:** Implement one of:
1. JWT tokens with role-based access control
2. API keys for admin routes
3. OAuth2 for user routes
4. Wallet signature verification

Example with JWT (to be implemented):
```bash
curl -X POST http://localhost:4000/api/admin/applications/approve \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

## Webhooks (Future)

Planned webhook events:
- `credit.approved` - Credit line approved
- `loan.drawn` - User drew funds
- `loan.repaid` - User repaid loan
- `document.verified` - Document verified by admin
- `pool.low_liquidity` - Pool liquidity below threshold

---

## SDK / Client Libraries

Currently no official SDK. Use standard HTTP clients:

**JavaScript/TypeScript:**
```typescript
const response = await fetch('http://localhost:4000/api/credit/line/0x...', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
});
const data = await response.json();
```

**Python:**
```python
import requests
response = requests.get('http://localhost:4000/api/credit/line/0x...')
data = response.json()
```

---

## Support

For API issues or questions:
- Check server logs for error details
- Verify all environment variables are set
- Review contract transaction on block explorer
- Ensure wallet has sufficient gas and allowances

For more information, see [README.md](./README.md) and [QUICKSTART.md](./QUICKSTART.md).

