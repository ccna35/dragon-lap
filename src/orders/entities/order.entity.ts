import { OrderStatusEnum } from '../../common/enums/order-status.enum';
import { PaymentMethodEnum } from '../../common/enums/payment-method.enum';

export class OrderEntity {
    id: string;
    userId: string;
    status: OrderStatusEnum;
    paymentMethod: PaymentMethodEnum;
    fullName: string;
    phone: string;
    alternatePhone?: string | null;
    city: string;
    area: string;
    streetAddress: string;
    notes?: string | null;
    subtotal: string;
    shippingFee: string;
    total: string;
    placedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
