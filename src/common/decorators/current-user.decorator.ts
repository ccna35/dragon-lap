import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../types/request-user.type';

export const CurrentUser = createParamDecorator(
    (_: unknown, context: ExecutionContext): RequestUser => {
        const req = context.switchToHttp().getRequest();
        return req.user as RequestUser;
    },
);
