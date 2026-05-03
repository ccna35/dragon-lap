import {
    BadRequestException,
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interceptor to handle idempotency key extraction and injection
 * Accepts idempotency key from either:
 * 1. Request header: Idempotency-Key
 * 2. Request body: idempotencyKey
 *
 * If neither is provided, generates a new UUID
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest<Request>();

        // Get key from header (standard practice)
        let idempotencyKey = request.headers['idempotency-key'] as string;

        // Fallback to body if not in header
        if (!idempotencyKey && request.body?.idempotencyKey) {
            idempotencyKey = request.body.idempotencyKey;
        }

        // Generate if missing
        if (!idempotencyKey) {
            idempotencyKey = uuidv4();
        }

        // Validate UUID format
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(idempotencyKey)) {
            throw new BadRequestException(
                'Idempotency-Key must be a valid UUID',
            );
        }

        // Inject into body for consumption by controllers
        if (request.body) {
            request.body.idempotencyKey = idempotencyKey;
        }

        // Also attach to request object for easy access
        (request as any).idempotencyKey = idempotencyKey;

        return next.handle();
    }
}
