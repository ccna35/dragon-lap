import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateLaptopDto } from './dto/create-laptop.dto';
import { UpdateLaptopDto } from './dto/update-laptop.dto';
import { ListLaptopsDto } from './dto/list-laptops.dto';

@Injectable()
export class LaptopsService {
    constructor(private readonly prisma: PrismaService) { }

    private slugify(input: string): string {
        return input
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    private buildPublicWhere(query: ListLaptopsDto): Prisma.LaptopWhereInput {
        return {
            isPublished: true,
            ...(query.search
                ? {
                    OR: [
                        { title: { contains: query.search, mode: 'insensitive' } },
                        { brand: { contains: query.search, mode: 'insensitive' } },
                        { model: { contains: query.search, mode: 'insensitive' } },
                    ],
                }
                : {}),
            ...(query.brand
                ? { brand: { equals: query.brand, mode: 'insensitive' } }
                : {}),
            ...(query.minPrice !== undefined || query.maxPrice !== undefined
                ? {
                    price: {
                        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
                        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
                    },
                }
                : {}),
        };
    }

    private getOrderBy(sort?: ListLaptopsDto['sort']): Prisma.LaptopOrderByWithRelationInput {
        if (sort === 'price_asc') return { price: 'asc' };
        if (sort === 'price_desc') return { price: 'desc' };
        return { createdAt: 'desc' };
    }

    listPublic(query: ListLaptopsDto) {
        return this.prisma.laptop.findMany({
            where: this.buildPublicWhere(query),
            orderBy: this.getOrderBy(query.sort),
        });
    }

    async getPublicById(id: string) {
        const laptop = await this.prisma.laptop.findFirst({
            where: {
                id,
                isPublished: true,
            },
        });

        if (!laptop) {
            throw new NotFoundException('Laptop not found');
        }

        return laptop;
    }

    listAdmin(query: ListLaptopsDto) {
        const where: Prisma.LaptopWhereInput = {
            ...(query.search
                ? {
                    OR: [
                        { title: { contains: query.search, mode: 'insensitive' } },
                        { brand: { contains: query.search, mode: 'insensitive' } },
                        { model: { contains: query.search, mode: 'insensitive' } },
                    ],
                }
                : {}),
            ...(query.brand
                ? { brand: { equals: query.brand, mode: 'insensitive' } }
                : {}),
        };

        return this.prisma.laptop.findMany({
            where,
            orderBy: this.getOrderBy(query.sort),
        });
    }

    async create(dto: CreateLaptopDto) {
        const slug = this.slugify(dto.slug || dto.title);
        if (!slug) {
            throw new BadRequestException('Invalid slug/title');
        }

        const existing = await this.prisma.laptop.findUnique({ where: { slug } });
        if (existing) {
            throw new BadRequestException('Laptop slug already exists');
        }

        return this.prisma.laptop.create({
            data: {
                ...dto,
                slug,
                price: new Prisma.Decimal(dto.price),
            },
        });
    }

    async update(id: string, dto: UpdateLaptopDto) {
        const found = await this.prisma.laptop.findUnique({ where: { id } });
        if (!found) {
            throw new NotFoundException('Laptop not found');
        }

        const data: Prisma.LaptopUpdateInput = {
            ...dto,
            ...(dto.price !== undefined
                ? { price: new Prisma.Decimal(dto.price) }
                : {}),
        };

        if (dto.slug || dto.title) {
            const nextSlug = this.slugify(dto.slug || dto.title || found.title);
            const dup = await this.prisma.laptop.findUnique({ where: { slug: nextSlug } });
            if (dup && dup.id !== id) {
                throw new BadRequestException('Laptop slug already exists');
            }
            data.slug = nextSlug;
        }

        return this.prisma.laptop.update({
            where: { id },
            data,
        });
    }

    async softDelete(id: string) {
        const found = await this.prisma.laptop.findUnique({ where: { id } });
        if (!found) {
            throw new NotFoundException('Laptop not found');
        }

        return this.prisma.laptop.update({
            where: { id },
            data: {
                isPublished: false,
            },
        });
    }
}
