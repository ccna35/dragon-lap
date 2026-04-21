import {
    IsBoolean,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';

export class CreateLaptopDto {
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    slug?: string;

    @IsString()
    brand: string;

    @IsString()
    model: string;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    price: number;

    @IsNumber()
    @Min(0)
    stock: number;

    @IsOptional()
    @IsString()
    shortDescription?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    cpu?: string;

    @IsOptional()
    @IsString()
    ram?: string;

    @IsOptional()
    @IsString()
    storage?: string;

    @IsOptional()
    @IsString()
    gpu?: string;

    @IsOptional()
    @IsString()
    screenSize?: string;

    @IsOptional()
    @IsString()
    os?: string;

    @IsOptional()
    @IsBoolean()
    isPublished?: boolean;
}
