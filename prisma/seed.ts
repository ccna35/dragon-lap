import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in env');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
        data: {
            fullName: process.env.ADMIN_FULL_NAME || 'Store Admin',
            email,
            passwordHash,
            phone: process.env.ADMIN_PHONE || null,
            role: UserRole.ADMIN,
            isActive: true,
        },
    });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (error) => {
        console.error(error);
        await prisma.$disconnect();
        process.exit(1);
    });
