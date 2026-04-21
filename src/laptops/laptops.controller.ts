import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { LaptopsService } from './laptops.service';
import { ListLaptopsDto } from './dto/list-laptops.dto';
import { Role } from '../common/enums/role.enum';
import { CreateLaptopDto } from './dto/create-laptop.dto';
import { UpdateLaptopDto } from './dto/update-laptop.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Public } from 'src/auth/decorators/public.decorator';
import { SignLaptopImagesDto } from './dto/sign-laptop-images.dto';
import { SetLaptopImagesDto } from './dto/set-laptop-images.dto';

@Controller()
export class LaptopsController {
    constructor(private readonly laptopsService: LaptopsService) { }

    @Public()
    @Get('laptops')
    listPublic(@Query() query: ListLaptopsDto) {
        return this.laptopsService.listPublic(query);
    }

    @Public()
    @Get('laptops/:id')
    getPublicById(@Param('id') id: string) {
        return this.laptopsService.getPublicById(id);
    }

    @Get('admin/laptops')
    @Roles(Role.ADMIN)
    listAdmin(@Query() query: ListLaptopsDto) {
        return this.laptopsService.listAdmin(query);
    }

    @Post('admin/laptops')
    @Roles(Role.ADMIN)
    create(@Body() dto: CreateLaptopDto) {
        return this.laptopsService.create(dto);
    }

    @Patch('admin/laptops/:id')
    @Roles(Role.ADMIN)
    update(@Param('id') id: string, @Body() dto: UpdateLaptopDto) {
        return this.laptopsService.update(id, dto);
    }

    @Post('admin/laptops/:id/images/sign')
    @Roles(Role.ADMIN)
    signImageUploads(
        @Param('id') id: string,
        @Body() dto: SignLaptopImagesDto,
    ) {
        return this.laptopsService.signImageUploads(id, dto);
    }

    @Patch('admin/laptops/:id/images')
    @Roles(Role.ADMIN)
    setImages(@Param('id') id: string, @Body() dto: SetLaptopImagesDto) {
        return this.laptopsService.setImages(id, dto);
    }

    @Delete('admin/laptops/:id')
    @Roles(Role.ADMIN)
    softDelete(@Param('id') id: string) {
        return this.laptopsService.softDelete(id);
    }
}
