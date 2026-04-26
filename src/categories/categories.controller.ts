import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Public } from 'src/auth/decorators/public.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller()
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    @Public()
    @Get('categories')
    listPublic() {
        return this.categoriesService.listPublic();
    }

    @Get('admin/categories')
    @Roles(Role.ADMIN)
    listAdmin() {
        return this.categoriesService.listAdmin();
    }

    @Get('admin/categories/:id')
    @Roles(Role.ADMIN)
    getAdminById(@Param('id') id: string) {
        return this.categoriesService.getAdminById(id);
    }

    @Post('admin/categories')
    @Roles(Role.ADMIN)
    create(@Body() dto: CreateCategoryDto) {
        return this.categoriesService.create(dto);
    }

    @Patch('admin/categories/:id')
    @Roles(Role.ADMIN)
    update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
        return this.categoriesService.update(id, dto);
    }

    @Delete('admin/categories/:id')
    @Roles(Role.ADMIN)
    remove(@Param('id') id: string) {
        return this.categoriesService.remove(id);
    }
}
