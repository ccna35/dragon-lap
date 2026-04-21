import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional } from 'class-validator';

const ALLOWED_UPLOAD_SLOTS = ['featured', 'gallery_1', 'gallery_2', 'gallery_3'] as const;

export type LaptopUploadSlot = (typeof ALLOWED_UPLOAD_SLOTS)[number];

export class SignLaptopImagesDto {
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(4)
    @IsIn(ALLOWED_UPLOAD_SLOTS, { each: true })
    slots?: LaptopUploadSlot[];
}
