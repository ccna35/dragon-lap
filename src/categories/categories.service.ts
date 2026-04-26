import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
    constructor(private readonly prisma: PrismaService) { }

    private slugify(input: string): string {
        return input
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    private async ensureUnique(name: string, slug: string, excludeId?: string) {
        const conflicts = await this.prisma.category.findMany({
            where: {
                OR: [
                    { slug },
                    { name: { equals: name, mode: 'insensitive' } },
                ],
                ...(excludeId
                    ? {
                        NOT: {
                            id: excludeId,
                        },
                    }
                    : {}),
            },
            select: {
                id: true,
                name: true,
                slug: true,
            },
        });

        if (conflicts.some((item) => item.slug === slug)) {
            throw new BadRequestException('Category slug already exists');
        }

        if (conflicts.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
            throw new BadRequestException('Category name already exists');
        }
    }

    listPublic() {
        return this.prisma.category.findMany({
            orderBy: {
                name: 'asc',
            },
        });
    }

    listAdmin() {
        return this.prisma.category.findMany({
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async getAdminById(id: string) {
        const category = await this.prisma.category.findUnique({ where: { id } });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        return category;
    }

    async create(dto: CreateCategoryDto) {
        const name = dto.name.trim();
        const slug = this.slugify(dto.slug || name);

        if (!slug) {
            throw new BadRequestException('Invalid category name/slug');
        }

        await this.ensureUnique(name, slug);

        return this.prisma.category.create({
            data: {
                name,
                slug,
                description: dto.description,
            },
        });
    }

    async update(id: string, dto: UpdateCategoryDto) {
        const existing = await this.prisma.category.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException('Category not found');
        }

        const name = (dto.name ?? existing.name).trim();
        const slug = this.slugify(dto.slug || dto.name || existing.slug);

        if (!slug) {
            throw new BadRequestException('Invalid category name/slug');
        }

        await this.ensureUnique(name, slug, id);

        return this.prisma.category.update({
            where: { id },
            data: {
                name,
                slug,
                ...(dto.description !== undefined
                    ? {
                        description: dto.description,
                    }
                    : {}),
            },
        });
    }

    async remove(id: string) {
        const existing = await this.prisma.category.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException('Category not found');
        }

        await this.prisma.category.delete({ where: { id } });
        return {
            message: 'Category deleted successfully',
        };
    }
}
