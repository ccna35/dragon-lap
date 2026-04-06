import { Role } from '../enums/role.enum';

export type RequestUser = {
    userId: string;
    email: string;
    role: Role;
};
