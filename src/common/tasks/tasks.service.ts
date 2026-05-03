import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdempotencyService } from '../common/services/idempotency.service';

/**
 * Scheduled tasks for cleanup and maintenance
 */
@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(private readonly idempotency: IdempotencyService) { }

    /**
     * Clean up expired idempotency keys every hour
     */
    @Cron(CronExpression.EVERY_HOUR)
    async cleanupExpiredIdempotencyKeys() {
        try {
            const count = await this.idempotency.cleanupExpired();
            this.logger.log(
                `Cleaned up ${count} expired idempotency keys`,
            );
        } catch (error) {
            this.logger.error(
                'Error during idempotency cleanup',
                error instanceof Error ? error.message : 'Unknown error',
            );
        }
    }
}
