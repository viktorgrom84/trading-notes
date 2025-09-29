import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

// Create Prisma client with Accelerate extension
const prisma = new PrismaClient().$extends(withAccelerate());

export default prisma;
