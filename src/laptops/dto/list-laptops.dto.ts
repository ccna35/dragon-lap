import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ListLaptopsDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    brand?: string;

    @IsOptional()
    @IsUUID()
    categoryId?: string;

    @IsOptional()
    @Transform(({ value }) => Number(value))
    @IsNumber()
    @Min(0)
    minPrice?: number;

    @IsOptional()
    @Transform(({ value }) => Number(value))
    @IsNumber()
    @Min(0)
    maxPrice?: number;

    @IsOptional()
    @IsIn(['price_asc', 'price_desc', 'newest', 'oldest'])
    sort?: 'price_asc' | 'price_desc' | 'newest' | 'oldest';
}
