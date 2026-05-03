import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { IdempotencyService } from '../services/idempotency.service';

@Module({
    providers: [TasksService, IdempotencyService],
})
export class TasksModule { }
