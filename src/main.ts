import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api');

    app.enableCors({
        // origin: process.env.CORS_ORIGIN || '*',
        origin: ['http://localhost:3001', 'http://192.168.10.181:3001'],
        credentials: true,
    });

    app.use(cookieParser());

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    const port = Number(process.env.PORT || 3000);
    await app.listen(port);
}

bootstrap();
