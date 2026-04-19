import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    OrderStatus,
    PaymentMethod,
    Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AdminListOrdersDto } from './dto/admin-list-orders.dto';

const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
    OUT_FOR_DELIVERY: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
};

@Injectable()
export class OrdersService {
    constructor(private readonly prisma: PrismaService) { }

    private toNumber(value: Prisma.Decimal): number {
        return Number(value.toString());
    }

    async createOrder(userId: string, dto: CreateOrderDto) {
        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const cartItems = await tx.cartItem.findMany({
                where: { userId },
                include: { laptop: true },
            });

            if (cartItems.length === 0) {
                throw new BadRequestException('Cart is empty');
            }

            for (const item of cartItems) {
                if (!item.laptop.isPublished) {
                    throw new BadRequestException(
                        `Laptop '${item.laptop.title}' is not available anymore`,
                    );
                }

                if (item.quantity < 1) {
                    throw new BadRequestException('Invalid cart quantity');
                }

                if (item.quantity > item.laptop.stock) {
                    throw new BadRequestException(
                        `Not enough stock for '${item.laptop.title}'`,
                    );
                }
            }

            let subtotalValue = 0;
            for (const item of cartItems) {
                subtotalValue += this.toNumber(item.laptop.price) * item.quantity;
            }

            const shippingFeeValue = 0;
            const totalValue = subtotalValue + shippingFeeValue;

            const order = await tx.order.create({
                data: {
                    userId,
                    status: OrderStatus.PENDING,
                    paymentMethod: PaymentMethod.COD,
                    fullName: dto.fullName,
                    phone: dto.phone,
                    alternatePhone: dto.alternatePhone || null,
                    city: dto.city,
                    area: dto.area,
                    streetAddress: dto.streetAddress,
                    notes: dto.notes || null,
                    subtotal: new Prisma.Decimal(subtotalValue),
                    shippingFee: new Prisma.Decimal(shippingFeeValue),
                    total: new Prisma.Decimal(totalValue),
                    placedAt: new Date(),
                },
            });

            for (const item of cartItems) {
                const unitPrice = this.toNumber(item.laptop.price);
                const lineTotal = unitPrice * item.quantity;

                await tx.orderItem.create({
                    data: {
                        orderId: order.id,
                        laptopId: item.laptopId,
                        laptopTitleSnapshot: item.laptop.title,
                        unitPriceSnapshot: new Prisma.Decimal(unitPrice),
                        quantity: item.quantity,
                        lineTotal: new Prisma.Decimal(lineTotal),
                    },
                });

                await tx.laptop.update({
                    where: { id: item.laptopId },
                    data: {
                        stock: {
                            decrement: item.quantity,
                        },
                    },
                });
            }

            await tx.cartItem.deleteMany({ where: { userId } });

            return tx.order.findUnique({
                where: { id: order.id },
                include: { items: true },
            });
        });
    }

    getMyOrders(userId: string) {
        return this.prisma.order.findMany({
            where: { userId },
            include: {
                items: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getMyOrderById(userId: string, orderId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.userId !== userId) {
            throw new ForbiddenException('Not your order');
        }

        return order;
    }

    getAdminOrders(query: AdminListOrdersDto) {
        return this.prisma.order.findMany({
            where: {
                ...(query.status ? { status: query.status as OrderStatus } : {}),
            },
            include: {
                items: true,
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getAdminOrderById(orderId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: true,
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        return order;
    }

    async updateOrderStatus(orderId: string, dto: UpdateOrderStatusDto) {
        const nextStatus = dto.status as OrderStatus;

        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: { items: true },
            });

            if (!order) {
                throw new NotFoundException('Order not found');
            }

            const allowedNext = ALLOWED_STATUS_TRANSITIONS[order.status];
            if (!allowedNext.includes(nextStatus)) {
                throw new BadRequestException(
                    `Invalid transition from ${order.status} to ${nextStatus}`,
                );
            }

            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: { status: nextStatus },
            });

            if (nextStatus === OrderStatus.CANCELLED) {
                for (const item of order.items) {
                    if (!item.laptopId) {
                        continue;
                    }

                    await tx.laptop.updateMany({
                        where: { id: item.laptopId },
                        data: {
                            stock: {
                                increment: item.quantity,
                            },
                        },
                    });
                }
            }

            return updatedOrder;
        });
    }

    async getAdminStats() {
        const LOW_STOCK_THRESHOLD = 5;
        const RECENT_ORDERS_LIMIT = 5;
        const SALES_HISTORY_DAYS = 30;

        const [totalRevenueResult, ordersCount, customersCount, lowStockCount, recentOrders] =
            await Promise.all([
                this.prisma.order.aggregate({
                    where: { status: OrderStatus.DELIVERED },
                    _sum: { total: true },
                }),
                this.prisma.order.count(),
                this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
                this.prisma.laptop.count({
                    where: { isPublished: true, stock: { lte: LOW_STOCK_THRESHOLD } },
                }),
                this.prisma.order.findMany({
                    take: RECENT_ORDERS_LIMIT,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        items: true,
                        user: {
                            select: { id: true, fullName: true, email: true, phone: true },
                        },
                    },
                }),
            ]);

        const since = new Date();
        since.setDate(since.getDate() - SALES_HISTORY_DAYS);

        const deliveredOrders = await this.prisma.order.findMany({
            where: { status: OrderStatus.DELIVERED, placedAt: { gte: since } },
            select: { placedAt: true, total: true },
            orderBy: { placedAt: 'asc' },
        });

        const salesByDate = new Map<string, number>();
        for (const order of deliveredOrders) {
            const date = order.placedAt.toISOString().split('T')[0];
            salesByDate.set(date, (salesByDate.get(date) ?? 0) + this.toNumber(order.total));
        }

        const salesHistory = Array.from(salesByDate.entries()).map(([date, amount]) => ({
            date,
            amount: amount.toFixed(2),
        }));

        return {
            totalRevenue: (totalRevenueResult._sum.total ?? 0).toString(),
            ordersCount,
            customersCount,
            lowStockCount,
            salesHistory,
            recentOrders,
        };
    }
}
