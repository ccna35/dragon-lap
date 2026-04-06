export class OrderItemEntity {
    id: string;
    orderId: string;
    laptopId?: string | null;
    laptopTitleSnapshot: string;
    unitPriceSnapshot: string;
    quantity: number;
    lineTotal: string;
    createdAt: Date;
}
