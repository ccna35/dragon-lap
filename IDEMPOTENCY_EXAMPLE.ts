/**
 * Frontend example: Payment order submission with idempotency
 * 
 * This demonstrates how to implement idempotency on the client side
 * to ensure payment safety across network retries.
 */

export class CheckoutService {
    private readonly IDEMPOTENCY_KEY_STORAGE = 'payment_idempotency_key';

    /**
     * Get or create an idempotency key for payment
     * Persists across page refreshes using sessionStorage
     */
    private getOrCreateIdempotencyKey(): string {
        // Try to retrieve existing key from storage
        const existingKey = sessionStorage.getItem(
            this.IDEMPOTENCY_KEY_STORAGE,
        );

        if (existingKey) {
            console.log('[Idempotency] Using existing key:', existingKey);
            return existingKey;
        }

        // Generate new key only on first load
        const newKey = crypto.randomUUID();
        sessionStorage.setItem(this.IDEMPOTENCY_KEY_STORAGE, newKey);
        console.log('[Idempotency] Generated new key:', newKey);

        return newKey;
    }

    /**
     * Clear idempotency key after successful payment
     */
    private clearIdempotencyKey(): void {
        sessionStorage.removeItem(this.IDEMPOTENCY_KEY_STORAGE);
        console.log('[Idempotency] Cleared key after success');
    }

    /**
     * Submit order with automatic idempotency handling
     * 
     * Features:
     * - Generates UUID on first submission
     * - Reuses UUID on retry (after page refresh or network error)
     * - Server returns cached result if already processed
     * - Clears UUID only on successful completion
     * 
     * @param orderData Order details
     * @returns Order response
     * 
     * @example
     * try {
     *   const order = await checkoutService.submitOrder(orderData);
     *   console.log('Order created:', order.id);
     * } catch (error) {
     *   if (error.status === 409) {
     *     console.log('Payment still processing, please wait...');
     *   } else {
     *     console.error('Payment failed:', error.message);
     *   }
     * }
     */
    async submitOrder(orderData: {
        fullName: string;
        phone: string;
        alternatePhone?: string;
        city: string;
        area: string;
        streetAddress: string;
        notes?: string;
    }) {
        const idempotencyKey = this.getOrCreateIdempotencyKey();

        try {
            console.log('[Payment] Submitting order with key:', idempotencyKey);

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Send idempotency key via header (standard practice)
                    'Idempotency-Key': idempotencyKey,
                },
                body: JSON.stringify({
                    ...orderData,
                    // Also include in body as backup
                    idempotencyKey,
                }),
            });

            if (!response.ok) {
                const error = await response.json();

                // 409 = Payment is still processing
                if (response.status === 409) {
                    throw new Error(
                        'Payment is still being processed. Please wait and try again.',
                    );
                }

                // 400 = Previous attempt failed or validation error
                if (response.status === 400) {
                    throw new Error(error.message || 'Payment failed');
                }

                throw new Error(`Request failed: ${response.statusText}`);
            }

            const order = await response.json();

            // SUCCESS: Clear the key so a new payment can be made
            this.clearIdempotencyKey();

            console.log('[Payment] Success! Order ID:', order.id);
            return order;
        } catch (error) {
            // On error, the key stays in sessionStorage for retry
            console.error('[Payment] Error:', error);

            if (error instanceof Error) {
                throw error;
            }

            throw new Error('Unknown error during payment');
        }
    }

    /**
     * Handle page refresh during payment
     * SessionStorage ensures the same key is reused
     */
    async handlePageRefresh(orderData: any) {
        // User clicked "Retry" or page auto-refreshed during payment
        return this.submitOrder(orderData);
        // → Gets the same idempotency key from sessionStorage
        // → Server recognizes it and either:
        //   - Returns cached success (order already created)
        //   - Returns 409 PENDING (still processing)
        //   - Returns cached failure
    }

    /**
     * Manual retry with exponential backoff
     * Useful for handling 409 PENDING responses
     */
    async retryWithBackoff(
        orderData: any,
        maxRetries: number = 3,
        baseDelayMs: number = 1000,
    ): Promise<any> {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await this.submitOrder(orderData);
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message.includes('still being processed')
                ) {
                    const delay = baseDelayMs * Math.pow(2, attempt);
                    console.log(
                        `[Payment] Attempt ${attempt + 1}/${maxRetries}: Waiting ${delay}ms before retry...`,
                    );
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                }

                // Non-retriable error
                throw error;
            }
        }

        throw new Error(
            'Payment verification timed out. Please contact support.',
        );
    }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

const checkout = new CheckoutService();

// Scenario 1: Normal flow
// ============================================================================
// User submits order on checkout page
const order = await checkout.submitOrder({
    fullName: 'John Doe',
    phone: '1234567890',
    city: 'Cairo',
    area: 'Downtown',
    streetAddress: '123 Main St',
});
// Result: Order created, idempotency key cleared from storage
// → User can place another order

// Scenario 2: Page refresh during payment
// ============================================================================
// Browser tab A: POST /orders → payment processing → page crashes
// Browser tab A: User reopens browser (or refreshes page manually)
// → sessionStorage still contains the idempotency key
// → Call submitOrder again
const retryOrder = await checkout.submitOrder({
    fullName: 'John Doe',
    phone: '1234567890',
    city: 'Cairo',
    area: 'Downtown',
    streetAddress: '123 Main St',
});
// Result: Server returns cached response (same order ID)
// → No duplicate charge ✅

// Scenario 3: Server returning 409 PENDING
// ============================================================================
// User gets 409 response (still processing), needs to wait and retry
await checkout.retryWithBackoff(
    {
        fullName: 'John Doe',
        phone: '1234567890',
        city: 'Cairo',
        area: 'Downtown',
        streetAddress: '123 Main St',
    },
    3, // max retries
    1000, // initial delay
);
// Result: Retries up to 3 times with exponential backoff
// → Eventually succeeds or fails with clear error

// ============================================================================
// UNIT TEST EXAMPLE
// ============================================================================

describe('CheckoutService - Idempotency', () => {
    let service: CheckoutService;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        service = new CheckoutService();
        sessionStorage.clear();
        fetchMock = jest.fn();
        global.fetch = fetchMock;
    });

    test('should generate UUID on first order', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 'order-123' }),
        });

        const orderData = {
            fullName: 'John',
            phone: '123',
            city: 'Cairo',
            area: 'Downtown',
            streetAddress: '123 St',
        };

        await service.submitOrder(orderData);

        const headers = fetchMock.mock.calls[0][1].headers;
        expect(headers['Idempotency-Key']).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
    });

    test('should reuse UUID on retry', async () => {
        const mockUUID = '12345678-1234-1234-1234-123456789012';
        sessionStorage.setItem('payment_idempotency_key', mockUUID);

        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 'order-123' }),
        });

        const orderData = {
            fullName: 'John',
            phone: '123',
            city: 'Cairo',
            area: 'Downtown',
            streetAddress: '123 St',
        };

        await service.submitOrder(orderData);

        const headers = fetchMock.mock.calls[0][1].headers;
        expect(headers['Idempotency-Key']).toBe(mockUUID);
    });

    test('should handle 409 PENDING response', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 409,
            json: async () => ({ message: 'Payment is still processing' }),
        });

        const orderData = {
            fullName: 'John',
            phone: '123',
            city: 'Cairo',
            area: 'Downtown',
            streetAddress: '123 St',
        };

        await expect(service.submitOrder(orderData)).rejects.toThrow(
            /still being processed/,
        );

        // Key should NOT be cleared on error
        expect(sessionStorage.getItem('payment_idempotency_key')).toBeTruthy();
    });

    test('should clear key on success', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 'order-123' }),
        });

        const orderData = {
            fullName: 'John',
            phone: '123',
            city: 'Cairo',
            area: 'Downtown',
            streetAddress: '123 St',
        };

        await service.submitOrder(orderData);

        // Key should be cleared after success
        expect(
            sessionStorage.getItem('payment_idempotency_key'),
        ).toBeNull();
    });
});
