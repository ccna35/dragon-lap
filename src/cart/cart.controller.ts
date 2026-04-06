import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user.type';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('cart')
@Roles(Role.CUSTOMER)
export class CartController {
    constructor(private readonly cartService: CartService) { }

    @Get()
    getCart(@CurrentUser() user: RequestUser) {
        return this.cartService.getCart(user.userId);
    }

    @Post('items')
    addItem(@CurrentUser() user: RequestUser, @Body() dto: AddCartItemDto) {
        return this.cartService.addItem(user.userId, dto);
    }

    @Patch('items/:id')
    updateItem(
        @CurrentUser() user: RequestUser,
        @Param('id') id: string,
        @Body() dto: UpdateCartItemDto,
    ) {
        return this.cartService.updateItem(user.userId, id, dto);
    }

    @Delete('items/:id')
    removeItem(@CurrentUser() user: RequestUser, @Param('id') id: string) {
        return this.cartService.removeItem(user.userId, id);
    }
}
