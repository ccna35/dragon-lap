import { IsEnum } from 'class-validator';
import { OrderStatusEnum } from '../../common/enums/order-status.enum';

export class UpdateOrderStatusDto {
    @IsEnum(OrderStatusEnum)
    status: OrderStatusEnum;
}
