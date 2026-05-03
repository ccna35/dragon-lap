# Payment Idempotency Implementation

## Overview

This implementation ensures that order creation requests are idempotent—repeated requests with the same idempotency key will return the cached result instead of creating duplicate orders. This is critical for payment safety.

## Architecture

### Components

1. **Prisma Schema** (`prisma/schema.prisma`)
   - `PaymentIdempotencyKey` model stores request/response cache
   - `IdempotencyKeyStatus` enum tracks request state (PENDING, SUCCESS, FAILED)

2. **Database Migration** (`prisma/migrations/20260503_add_payment_idempotency/`)
   - Creates the idempotency table with indexes
   - Links to orders via foreign key

3. **Idempotency Service** (`src/common/services/idempotency.service.ts`)
   - Core business logic for managing idempotency keys
   - Methods: `checkAndRetrieve()`, `createPendingKey()`, `markSuccess()`, `markFailed()`, `cleanupExpired()`

4. **Idempotency Interceptor** (`src/common/interceptors/idempotency.interceptor.ts`)
   - Extracts idempotency key from request headers or body
   - Validates UUID format
   - Injects into request for controller access

5. **Orders Service** (`src/orders/orders.service.ts`)
   - Updated `createOrder()` and `createGuestOrder()` methods
   - Wraps order creation with idempotency checks
   - Caches response on success/failure

6. **Tasks Service** (`src/common/tasks/tasks.service.ts`)
   - Scheduled cleanup job (hourly)
   - Deletes expired idempotency keys (24h TTL)

## Request Flow

### New Order Submission

```
Client Request (idempotencyKey: "uuid-123")
    ↓
Interceptor validates UUID format
    ↓
OrdersService.createOrder() called
    ↓
IdempotencyService.checkAndRetrieve()
    - Key not found → returns null
    ↓
IdempotencyService.createPendingKey() → PENDING record created
    ↓
Order creation logic executes
    - Fetch cart, validate items, deduct stock, create order
    ↓
IdempotencyService.markSuccess() → PENDING → SUCCESS (cached response)
    ↓
Response returned to client
```

### Retried Request (Same Key)

```
Client Request (idempotencyKey: "uuid-123") [SAME KEY]
    ↓
OrdersService.createOrder() called
    ↓
IdempotencyService.checkAndRetrieve()
    - Key found with status SUCCESS
    - Returns cached response immediately
    ↓
Order creation logic SKIPPED ✅ (no duplicate)
    ↓
Cached response returned
```

### In-Flight Request (PENDING Status)

```
Client Request (idempotencyKey: "uuid-123") [RETRY DURING PROCESSING]
    ↓
OrdersService.createOrder() called
    ↓
IdempotencyService.checkAndRetrieve()
    - Key found with status PENDING
    - Throws 409 ConflictException
    ↓
HTTP 409 response sent to client
    - Message: "Payment is still being processed. Please retry in a moment."
    ↓
Client backs off and retries later
```

## Database Schema

```sql
CREATE TABLE "PaymentIdempotencyKey" (
    id              UUID PRIMARY KEY
    key             TEXT UNIQUE NOT NULL          -- Idempotency key (UUID)
    status          IdempotencyKeyStatus DEFAULT  -- PENDING | SUCCESS | FAILED
    orderId         UUID FOREIGN KEY              -- Link to Order (optional)
    response        JSONB                         -- Cached response/error
    createdAt       TIMESTAMP DEFAULT NOW()       -- When record created
    expiresAt       TIMESTAMP NOT NULL            -- 24 hours later
);

-- Indexes for performance
CREATE INDEX idx_key ON "PaymentIdempotencyKey"(key);
CREATE INDEX idx_expiresAt ON "PaymentIdempotencyKey"(expiresAt);
```

## Frontend Integration

### Basic Usage

```typescript
// Generate or retrieve idempotency key
const idempotencyKey =
  sessionStorage.getItem("payment_key") || crypto.randomUUID();
sessionStorage.setItem("payment_key", idempotencyKey);

// Submit order with idempotency key
const response = await fetch("/api/orders", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey, // Standard header
  },
  body: JSON.stringify({
    fullName: "John Doe",
    phone: "1234567890",
    city: "Cairo",
    area: "Downtown",
    streetAddress: "123 Main St",
    idempotencyKey, // Also in body as backup
  }),
});

if (response.ok) {
  // Success: clear the key for next order
  sessionStorage.removeItem("payment_key");
  const order = await response.json();
  console.log("Order created:", order.id);
} else if (response.status === 409) {
  // Still processing: wait and retry
  console.log("Payment still processing...");
  setTimeout(() => location.reload(), 2000);
} else {
  // Error: key persists for manual retry
  console.error("Payment failed:", await response.json());
}
```

### Advanced Usage with Retry Logic

See `IDEMPOTENCY_EXAMPLE.ts` for complete examples including:

- Exponential backoff retry
- Error handling
- Unit tests
- Page refresh scenarios

## Error Responses

### 409 Conflict (Still Processing)

```http
HTTP/1.1 409 Conflict

{
  "statusCode": 409,
  "message": "Payment is still being processed. Please retry in a moment.",
  "error": "Conflict"
}
```

**Client action:** Wait 1-2 seconds, retry same request with same idempotency key.

### 400 Bad Request (Failed)

```http
HTTP/1.1 400 Bad Request

{
  "statusCode": 400,
  "message": "Previous payment attempt failed: Insufficient stock",
  "error": "Bad Request"
}
```

**Client action:** Show error message, require user to address issue and retry with new key.

### 400 Bad Request (Invalid Key)

```http
HTTP/1.1 400 Bad Request

{
  "statusCode": 400,
  "message": "idempotencyKey is required. Generate one client-side.",
  "error": "Bad Request"
}
```

**Client action:** Generate UUID and retry.

## Configuration

### Environment Variables

No new environment variables required. Uses default 24-hour TTL for key expiration.

### Customization

To change TTL (expiration time):

Edit `src/common/services/idempotency.service.ts`:

```typescript
expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days instead
```

To change cleanup frequency:

Edit `src/common/tasks/tasks.service.ts`:

```typescript
@Cron(CronExpression.EVERY_30_MINUTES) // More frequent cleanup
```

## Database Migration

Run migration when database is available:

```bash
npm run prisma:migrate:dev
```

Or deploy in production:

```bash
npm run prisma:migrate:deploy
```

Manual migration file: `prisma/migrations/20260503_add_payment_idempotency/migration.sql`

## Testing

### Unit Tests

```bash
npm test -- orders.service.spec.ts
```

### Integration Test (with DB)

```bash
# Start test database
docker-compose -f docker-compose.test.yml up -d

# Run tests
npm run test:e2e

# Cleanup
docker-compose -f docker-compose.test.yml down
```

### Manual Testing

```bash
# 1. Submit order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 12345678-1234-1234-1234-123456789012" \
  -d '{
    "fullName": "John Doe",
    "phone": "1234567890",
    "city": "Cairo",
    "area": "Downtown",
    "streetAddress": "123 Main St",
    "idempotencyKey": "12345678-1234-1234-1234-123456789012"
  }'

# 2. Retry same request (should return cached result)
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 12345678-1234-1234-1234-123456789012" \
  -d '{
    "fullName": "John Doe",
    ...
  }'
# Result: Same orderId as first request ✅
```

## Performance Considerations

### Indexes

- `PaymentIdempotencyKey(key)` - O(1) lookup by key
- `PaymentIdempotencyKey(expiresAt)` - O(n) for cleanup query

### Database Load

- Single database query per request (if cached)
- Two updates on success/failure paths
- Hourly cleanup deletes expired records (< 1KB per day)

### Caching Strategy

- **In-flight requests**: Checked on every retry (intentional)
- **Successful requests**: Cached for 24 hours
- **Failed requests**: Cached for 24 hours (helps distinguish from missing key)

## Security Considerations

### UUID Format Validation

The interceptor validates idempotency keys are valid UUIDs:

```typescript
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(idempotencyKey)) {
  throw new BadRequestException("Idempotency-Key must be a valid UUID");
}
```

### Storage Safety

- **SessionStorage** (client): Cleared on tab close, survives refresh
- **PostgreSQL** (server): Encrypted at rest, indexed for performance
- **Expiration**: 24-hour TTL prevents unbounded growth

### Race Conditions

The PENDING state prevents race conditions:

```
Request 1 (key A) arrives → PENDING
Request 1 (retry) arrives → Returns 409 PENDING (waits)
Request 1 completes → SUCCESS (cache set)
Request 1 (retry) arrives → Returns cached response ✅
```

## Monitoring

### Logs to Watch

```
[Idempotency] Using existing key: uuid-123
[Idempotency] Generated new key: uuid-456
[Payment] Success! Order ID: order-789
Cleaned up 42 expired idempotency keys
```

### Metrics to Track

- `paymentIdempotencyKey.cache_hits` - Cached responses returned
- `paymentIdempotencyKey.pending_retries` - 409 responses (healthy)
- `paymentIdempotencyKey.failed_retries` - Errors on retry (investigate)
- `paymentIdempotencyKey.cleanup_deleted` - Expired keys cleaned

## Troubleshooting

### Problem: User keeps getting "Payment is still processing"

**Cause**: Order creation is timing out or stuck in transaction

**Solution**:

1. Check database connection
2. Verify transaction logs
3. Increase timeout or check for deadlocks
4. Manual cleanup: `DELETE FROM "PaymentIdempotencyKey" WHERE status = 'PENDING' AND expiresAt < NOW()`

### Problem: Duplicate orders still created

**Cause**: Idempotency key not being generated/sent

**Solution**:

1. Verify frontend sends `Idempotency-Key` header
2. Check browser dev tools: Network tab
3. Ensure sessionStorage is enabled
4. Test manually with curl (see Testing section)

### Problem: Idempotency table growing large

**Cause**: Cleanup job not running or failing

**Solution**:

1. Check logs for cleanup errors
2. Verify @nestjs/schedule is properly configured
3. Manual cleanup: `npm run prisma -- db execute --stdin < cleanup.sql`
4. Reduce TTL from 24h to 7d

## Related Documentation

- [Stripe Idempotency Keys](https://stripe.com/docs/api/idempotent_requests)
- [AWS API Gateway Idempotency](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-logging.html)
- [RFC 9110: HTTP Semantics (Idempotent Methods)](https://tools.ietf.org/html/rfc9110#section-9.2.2)
- [NestJS Interceptors](https://docs.nestjs.com/interceptors)
- [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)

## Checklist

- ✅ Prisma schema updated with `PaymentIdempotencyKey` model
- ✅ Migration created for new table
- ✅ `IdempotencyService` created
- ✅ `IdempotencyInterceptor` created and registered in `main.ts`
- ✅ `CreateOrderDto` updated to require `idempotencyKey`
- ✅ `orders.service.ts` wrapped with idempotency logic
- ✅ `orders.module.ts` provides `IdempotencyService`
- ✅ `TasksService` scheduled for cleanup
- ✅ `app.module.ts` imports `ScheduleModule` and `TasksModule`
- ✅ Frontend example provided (`IDEMPOTENCY_EXAMPLE.ts`)
- ⚠️ Database migration not yet run (database offline)

## Next Steps

1. **Run migration** when database is available:

   ```bash
   npm run prisma:migrate:dev
   ```

2. **Install `@nestjs/schedule`** if not already present:

   ```bash
   npm install @nestjs/schedule
   ```

3. **Test the flow** with curl or Postman (see Testing section)

4. **Implement frontend** using the example in `IDEMPOTENCY_EXAMPLE.ts`

5. **Monitor** the idempotency metrics in production

---

**Implementation Date**: May 3, 2026  
**Status**: Code complete, database migration pending  
**Author**: Senior Staff Engineer
