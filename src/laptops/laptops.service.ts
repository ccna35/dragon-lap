import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LaptopImageKind, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';
import { CreateLaptopDto } from './dto/create-laptop.dto';
import { UpdateLaptopDto } from './dto/update-laptop.dto';
import { ListLaptopsDto } from './dto/list-laptops.dto';
import { SignLaptopImagesDto, LaptopUploadSlot } from './dto/sign-laptop-images.dto';
import { SetLaptopImagesDto } from './dto/set-laptop-images.dto';
import { LaptopEntity } from './entities/laptop.entity';

type LaptopWithImages = Prisma.LaptopGetPayload<{
    include: {
        images: true;
    };
}>;

@Injectable()
export class LaptopsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) { }

    private readonly allSlots: LaptopUploadSlot[] = [
        'featured',
        'gallery_1',
        'gallery_2',
        'gallery_3',
    ];

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

    private getCloudinaryConfig() {
        const cloudName = this.configService.get<string>('cloudinary.cloudName');
        const apiKey = this.configService.get<string>('cloudinary.apiKey');
        const apiSecret = this.configService.get<string>('cloudinary.apiSecret');
        const folder = this.configService.get<string>('cloudinary.folder') || 'dragon-lap/laptops';

        if (!cloudName || !apiKey || !apiSecret) {
            throw new BadRequestException('Cloudinary is not configured');
        }

        return {
            cloudName,
            apiKey,
            apiSecret,
            folder,
        };
    }

    private signCloudinaryParams(
        params: Record<string, string | number>,
        apiSecret: string,
    ): string {
        const toSign = Object.keys(params)
            .sort()
            .map((key) => `${key}=${params[key]}`)
            .join('&');

        return createHash('sha1')
            .update(`${toSign}${apiSecret}`)
            .digest('hex');
    }

    private assertCloudinaryImage(url: string, cloudName: string) {
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            throw new BadRequestException('Invalid image URL');
        }

        if (parsed.hostname !== 'res.cloudinary.com') {
            throw new BadRequestException('Image URL must be hosted on Cloudinary');
        }

        if (!parsed.pathname.startsWith(`/${cloudName}/image/upload/`)) {
            throw new BadRequestException('Image URL does not belong to configured Cloudinary cloud');
        }
    }

    private mapLaptop(laptop: LaptopWithImages): LaptopEntity {
        const orderedImages = [...laptop.images].sort((a, b) => a.position - b.position);
        const featuredImage = orderedImages.find((image) => image.kind === 'FEATURED') || null;
        const galleryImages = orderedImages.filter((image) => image.kind === 'GALLERY');

        return {
            id: laptop.id,
            title: laptop.title,
            slug: laptop.slug,
            brand: laptop.brand,
            model: laptop.model,
            price: laptop.price.toString(),
            stock: laptop.stock,
            shortDescription: laptop.shortDescription,
            description: laptop.description,
            cpu: laptop.cpu,
            ram: laptop.ram,
            storage: laptop.storage,
            gpu: laptop.gpu,
            screenSize: laptop.screenSize,
            os: laptop.os,
            featuredImage,
            galleryImages,
            isPublished: laptop.isPublished,
            createdAt: laptop.createdAt,
            updatedAt: laptop.updatedAt,
        };
    }

    async listPublic(query: ListLaptopsDto) {
        const laptops = await this.prisma.laptop.findMany({
            where: this.buildPublicWhere(query),
            orderBy: this.getOrderBy(query.sort),
            include: {
                images: true,
            },
        });

        return laptops.map((laptop) => this.mapLaptop(laptop));
    }

    async getPublicById(id: string) {
        const laptop = await this.prisma.laptop.findFirst({
            where: {
                id,
                isPublished: true,
            },
            include: {
                images: true,
            },
        });

        if (!laptop) {
            throw new NotFoundException('Laptop not found');
        }

        return this.mapLaptop(laptop);
    }

    async getPublicBySlug(slug: string) {
        const laptop = await this.prisma.laptop.findFirst({
            where: {
                slug,
                isPublished: true,
            },
            include: {
                images: true,
            },
        });

        if (!laptop) {
            throw new NotFoundException('Laptop not found');
        }

        return this.mapLaptop(laptop);
    }

    async listAdmin(query: ListLaptopsDto) {
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

        const laptops = await this.prisma.laptop.findMany({
            where,
            orderBy: this.getOrderBy(query.sort),
            include: {
                images: true,
            },
        });

        return laptops.map((laptop) => this.mapLaptop(laptop));
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

        const created = await this.prisma.laptop.create({
            data: {
                ...dto,
                slug,
                price: new Prisma.Decimal(dto.price),
            },
            include: {
                images: true,
            },
        });

        return this.mapLaptop(created);
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

        const updated = await this.prisma.laptop.update({
            where: { id },
            data,
            include: {
                images: true,
            },
        });

        return this.mapLaptop(updated);
    }

    async signImageUploads(id: string, dto: SignLaptopImagesDto) {
        const found = await this.prisma.laptop.findUnique({ where: { id } });
        if (!found) {
            throw new NotFoundException('Laptop not found');
        }

        const { cloudName, apiKey, apiSecret, folder } = this.getCloudinaryConfig();
        const slots = dto.slots?.length ? dto.slots : this.allSlots;
        const timestamp = Math.floor(Date.now() / 1000);
        const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

        const signatures = slots.map((slot) => {
            const publicId = `${folder}/${id}/${slot}`;
            const paramsToSign = {
                folder,
                public_id: publicId,
                timestamp,
            };

            return {
                slot,
                uploadUrl,
                cloudName,
                apiKey,
                folder,
                publicId,
                timestamp,
                signature: this.signCloudinaryParams(paramsToSign, apiSecret),
            };
        });

        return {
            laptopId: id,
            signatures,
        };
    }

    async setImages(id: string, dto: SetLaptopImagesDto) {
        const found = await this.prisma.laptop.findUnique({ where: { id } });
        if (!found) {
            throw new NotFoundException('Laptop not found');
        }

        if (!dto.gallery) {
            dto.gallery = [];
        }

        const { cloudName } = this.getCloudinaryConfig();

        this.assertCloudinaryImage(dto.featured.url, cloudName);
        for (const image of dto.gallery) {
            this.assertCloudinaryImage(image.url, cloudName);
        }

        const imageRecords: Array<{
            kind: LaptopImageKind;
            url: string;
            publicId: string;
            position: number;
        }> = [
                {
                    kind: LaptopImageKind.FEATURED,
                    url: dto.featured.url,
                    publicId: dto.featured.publicId,
                    position: 0,
                },
                ...dto.gallery.map((image, index) => ({
                    kind: LaptopImageKind.GALLERY,
                    url: image.url,
                    publicId: image.publicId,
                    position: index + 1,
                })),
            ];

        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.laptopImage.deleteMany({ where: { laptopId: id } });

            await tx.laptopImage.createMany({
                data: imageRecords.map((record) => ({
                    laptopId: id,
                    ...record,
                })),
            });

            return tx.laptop.findUnique({
                where: { id },
                include: {
                    images: true,
                },
            });
        });

        if (!updated) {
            throw new NotFoundException('Laptop not found');
        }

        return this.mapLaptop(updated);
    }

    async softDelete(id: string) {
        const found = await this.prisma.laptop.findUnique({ where: { id } });
        if (!found) {
            throw new NotFoundException('Laptop not found');
        }

        const updated = await this.prisma.laptop.update({
            where: { id },
            data: {
                isPublished: false,
            },
            include: {
                images: true,
            },
        });

        return this.mapLaptop(updated);
    }
}
