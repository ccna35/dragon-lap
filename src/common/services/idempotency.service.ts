import {
    BadRequestException,
    ConflictException,
    Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { IdempotencyKeyStatus } from '@prisma/client';

@Injectable()
export class IdempotencyService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Check if a request with this idempotency key has already been processed
     * Returns cached response if found and successful
     * Throws ConflictException if currently processing
     */
    async checkAndRetrieve(key: string) {
        const existing = await this.prisma.paymentIdempotencyKey.findUnique({
            where: { key },
        });

        if (!existing) {
            return null;
        }

        if (existing.status === IdempotencyKeyStatus.PENDING) {
            throw new ConflictException(
                'Payment is still being processed. Please retry in a moment.',
            );
        }

        if (existing.status === IdempotencyKeyStatus.SUCCESS) {
            return {
                cached: true,
                data: existing.response,
                orderId: existing.orderId,
            };
        }

        if (existing.status === IdempotencyKeyStatus.FAILED) {
            const response = existing.response as Record<string, string> | null;
            throw new BadRequestException(
                response?.error || 'Previous payment attempt failed',
            );
        }

        return null;
    }

    /**
     * Create a new idempotency key record in PENDING state
     */
    async createPendingKey(key: string) {
        return this.prisma.paymentIdempotencyKey.create({
            data: {
                key,
                status: IdempotencyKeyStatus.PENDING,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            },
        });
    }

    /**
     * Mark a key as successfully processed and cache the response
     */
    async markSuccess(
        key: string,
        orderId: string,
        responseData?: Record<string, any>,
    ) {
        return this.prisma.paymentIdempotencyKey.update({
            where: { key },
            data: {
                status: IdempotencyKeyStatus.SUCCESS,
                orderId,
                response: responseData ?? Prisma.JsonNull,
            },
        });
    }

    /**
     * Mark a key as failed and cache the error
     */
    async markFailed(key: string, error: string) {
        return this.prisma.paymentIdempotencyKey.update({
            where: { key },
            data: {
                status: IdempotencyKeyStatus.FAILED,
                response: { error },
            },
        });
    }

    /**
     * Clean up expired idempotency keys (call periodically via scheduler)
     */
    async cleanupExpired() {
        const result = await this.prisma.paymentIdempotencyKey.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date(),
                },
            },
        });

        return result.count;
    }
}
