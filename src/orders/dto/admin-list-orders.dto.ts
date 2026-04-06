import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatusEnum } from '../../common/enums/order-status.enum';

export class AdminListOrdersDto {
    @IsOptional()
    @IsEnum(OrderStatusEnum)
    status?: OrderStatusEnum;
}
