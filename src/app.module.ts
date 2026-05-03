import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import databaseConfig from './config/database.config';
import cloudinaryConfig from './config/cloudinary.config';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LaptopsModule } from './laptops/laptops.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { CategoriesModule } from './categories/categories.module';
import { TasksModule } from './common/tasks/tasks.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [databaseConfig, cloudinaryConfig],
            envFilePath: '.env',
        }),
        ScheduleModule.forRoot(),
        PrismaModule,
        AuthModule,
        UsersModule,
        LaptopsModule,
        CategoriesModule,
        CartModule,
        OrdersModule,
        TasksModule,
    ],
})
export class AppModule { }
