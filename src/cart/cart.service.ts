import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
    constructor(private readonly prisma: PrismaService) { }

    getCart(userId: string) {
        return this.prisma.cartItem.findMany({
            where: { userId },
            include: {
                laptop: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async addItem(userId: string, dto: AddCartItemDto) {
        const laptop = await this.prisma.laptop.findUnique({
            where: { id: dto.laptopId },
        });

        if (!laptop || !laptop.isPublished) {
            throw new NotFoundException('Laptop not found');
        }

        if (laptop.stock < 1) {
            throw new BadRequestException('Laptop is out of stock');
        }

        if (dto.quantity > laptop.stock) {
            throw new BadRequestException('Requested quantity exceeds stock');
        }

        const existing = await this.prisma.cartItem.findUnique({
            where: {
                userId_laptopId: {
                    userId,
                    laptopId: dto.laptopId,
                },
            },
        });

        if (existing) {
            const nextQuantity = existing.quantity + dto.quantity;
            if (nextQuantity > laptop.stock) {
                throw new BadRequestException('Requested quantity exceeds stock');
            }

            return this.prisma.cartItem.update({
                where: { id: existing.id },
                data: { quantity: nextQuantity },
                include: { laptop: true },
            });
        }

        return this.prisma.cartItem.create({
            data: {
                userId,
                laptopId: dto.laptopId,
                quantity: dto.quantity,
            },
            include: { laptop: true },
        });
    }

    async updateItem(userId: string, cartItemId: string, dto: UpdateCartItemDto) {
        const cartItem = await this.prisma.cartItem.findUnique({
            where: { id: cartItemId },
            include: { laptop: true },
        });

        if (!cartItem) {
            throw new NotFoundException('Cart item not found');
        }

        if (cartItem.userId !== userId) {
            throw new ForbiddenException('Not your cart item');
        }

        if (dto.quantity > cartItem.laptop.stock) {
            throw new BadRequestException('Requested quantity exceeds stock');
        }

        return this.prisma.cartItem.update({
            where: { id: cartItemId },
            data: { quantity: dto.quantity },
            include: { laptop: true },
        });
    }

    async removeItem(userId: string, cartItemId: string) {
        const cartItem = await this.prisma.cartItem.findUnique({ where: { id: cartItemId } });

        if (!cartItem) {
            throw new NotFoundException('Cart item not found');
        }

        if (cartItem.userId !== userId) {
            throw new ForbiddenException('Not your cart item');
        }

        await this.prisma.cartItem.delete({ where: { id: cartItemId } });

        return {
            message: 'Item removed from cart',
        };
    }
}
