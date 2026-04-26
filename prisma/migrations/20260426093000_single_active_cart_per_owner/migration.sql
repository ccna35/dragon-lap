-- Enforce at most one ACTIVE cart per authenticated user
CREATE UNIQUE INDEX "Cart_single_active_user_idx"
ON "Cart"("userId")
WHERE "status" = 'ACTIVE' AND "userId" IS NOT NULL;

-- Enforce at most one ACTIVE cart per guest session
CREATE UNIQUE INDEX "Cart_single_active_guest_idx"
ON "Cart"("guestSessionId")
WHERE "status" = 'ACTIVE' AND "guestSessionId" IS NOT NULL;
