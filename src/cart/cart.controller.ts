import {
    Body,
    Controller,
    Delete,
    Get,
    Req,
    Res,
    Param,
    Patch,
    Post,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CartService } from './cart.service';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/request-user.type';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Public } from 'src/auth/decorators/public.decorator';
import { ensureGuestSessionId } from 'src/common/utils/guest-session.util';

@Controller('cart')
export class CartController {
    constructor(
        private readonly cartService: CartService,
        private readonly config: ConfigService,
    ) { }

    @Get()
    @Roles(Role.CUSTOMER)
    getCart(@CurrentUser() user: RequestUser) {
        return this.cartService.getCart(user.userId);
    }

    @Post('items')
    @Roles(Role.CUSTOMER)
    addItem(@CurrentUser() user: RequestUser, @Body() dto: AddCartItemDto) {
        return this.cartService.addItem(user.userId, dto);
    }

    @Patch('items/:id')
    @Roles(Role.CUSTOMER)
    updateItem(
        @CurrentUser() user: RequestUser,
        @Param('id') id: string,
        @Body() dto: UpdateCartItemDto,
    ) {
        return this.cartService.updateItem(user.userId, id, dto);
    }

    @Delete('items/:id')
    @Roles(Role.CUSTOMER)
    removeItem(@CurrentUser() user: RequestUser, @Param('id') id: string) {
        return this.cartService.removeItem(user.userId, id);
    }

    @Public()
    @Get('guest')
    getGuestCart(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ) {
        const guestSessionId = ensureGuestSessionId(request, response, this.config);
        return this.cartService.getGuestCart(guestSessionId);
    }

    @Public()
    @Post('guest/items')
    addGuestItem(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
        @Body() dto: AddCartItemDto,
    ) {
        const guestSessionId = ensureGuestSessionId(request, response, this.config);
        return this.cartService.addGuestItem(guestSessionId, dto);
    }

    @Public()
    @Patch('guest/items/:id')
    updateGuestItem(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
        @Param('id') id: string,
        @Body() dto: UpdateCartItemDto,
    ) {
        const guestSessionId = ensureGuestSessionId(request, response, this.config);
        return this.cartService.updateGuestItem(guestSessionId, id, dto);
    }

    @Public()
    @Delete('guest/items/:id')
    removeGuestItem(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
        @Param('id') id: string,
    ) {
        const guestSessionId = ensureGuestSessionId(request, response, this.config);
        return this.cartService.removeGuestItem(guestSessionId, id);
    }
}
