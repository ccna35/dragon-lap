import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user.type';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AdminListOrdersDto } from './dto/admin-list-orders.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller()
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Post('orders')
    @Roles(Role.CUSTOMER)
    createOrder(@CurrentUser() user: RequestUser, @Body() dto: CreateOrderDto) {
        return this.ordersService.createOrder(user.userId, dto);
    }

    @Get('orders/my')
    @Roles(Role.CUSTOMER)
    getMyOrders(@CurrentUser() user: RequestUser) {
        return this.ordersService.getMyOrders(user.userId);
    }

    @Get('orders/my/:id')
    @Roles(Role.CUSTOMER)
    getMyOrderById(@CurrentUser() user: RequestUser, @Param('id') id: string) {
        return this.ordersService.getMyOrderById(user.userId, id);
    }

    @Get('admin/orders')
    @Roles(Role.ADMIN)
    getAdminOrders(@Query() query: AdminListOrdersDto) {
        return this.ordersService.getAdminOrders(query);
    }

    @Get('admin/orders/:id')
    @Roles(Role.ADMIN)
    getAdminOrderById(@Param('id') id: string) {
        return this.ordersService.getAdminOrderById(id);
    }

    @Patch('admin/orders/:id/status')
    @Roles(Role.ADMIN)
    updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateOrderStatusDto,
    ) {
        return this.ordersService.updateOrderStatus(id, dto);
    }
}
