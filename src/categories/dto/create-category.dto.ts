import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
    @IsString()
    @MaxLength(120)
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(160)
    slug?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;
}
