import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsString,
    IsUrl,
    ValidateNested,
} from 'class-validator';

export class LaptopImageInputDto {
    @IsUrl()
    url: string;

    @IsString()
    publicId: string;
}

export class SetLaptopImagesDto {
    @ValidateNested()
    @Type(() => LaptopImageInputDto)
    featured: LaptopImageInputDto;

    @IsArray()
    @ArrayMaxSize(3)
    @ValidateNested({ each: true })
    @Type(() => LaptopImageInputDto)
    gallery: LaptopImageInputDto[];
}
