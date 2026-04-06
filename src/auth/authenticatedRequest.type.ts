import { Request } from 'express';
import { User, UserRole } from '@prisma/client';

export type AuthenticatedRequest = { user: { userId: string; role: UserRole } };

export interface LocalAuthenticatedRequest extends Request {
  user: User;
}
