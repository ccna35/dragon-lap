import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateOrderDto {
    @IsString()
    fullName: string;

    @IsString()
    phone: string;

    @IsOptional()
    @IsString()
    alternatePhone?: string;

    @IsString()
    city: string;

    @IsString()
    area: string;

    @IsString()
    streetAddress: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsUUID()
    idempotencyKey: string;
}
