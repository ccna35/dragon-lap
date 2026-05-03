import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { IdempotencyService } from '../common/services/idempotency.service';

@Module({
    controllers: [OrdersController],
    providers: [OrdersService, IdempotencyService],
    exports: [OrdersService],
})
export class OrdersModule { }
