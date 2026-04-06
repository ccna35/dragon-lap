import { Role } from '../../common/enums/role.enum';

export class UserEntity {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
    role: Role;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;

    constructor(partial: Partial<UserEntity>) {
        Object.assign(this, partial);
    }
}
