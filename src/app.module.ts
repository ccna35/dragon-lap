import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from './config/database.config';
import cloudinaryConfig from './config/cloudinary.config';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LaptopsModule } from './laptops/laptops.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [databaseConfig, cloudinaryConfig],
            envFilePath: '.env',
        }),
        PrismaModule,
        AuthModule,
        UsersModule,
        LaptopsModule,
        CartModule,
        OrdersModule,
    ],
})
export class AppModule { }
