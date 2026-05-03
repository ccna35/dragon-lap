-- CreateEnum
CREATE TYPE "IdempotencyKeyStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "PaymentIdempotencyKey" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "status" "IdempotencyKeyStatus" NOT NULL DEFAULT 'PENDING',
    "orderId" UUID,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIdempotencyKey_key_key" ON "PaymentIdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "PaymentIdempotencyKey_key_idx" ON "PaymentIdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "PaymentIdempotencyKey_expiresAt_idx" ON "PaymentIdempotencyKey"("expiresAt");

-- AddForeignKey
ALTER TABLE "PaymentIdempotencyKey" ADD CONSTRAINT "PaymentIdempotencyKey_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
