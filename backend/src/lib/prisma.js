import { PrismaClient } from '@prisma/client';

// One PrismaClient per process (it manages a connection pool).
export const prisma = new PrismaClient({
  log: process.env.PRISMA_LOG ? ['query', 'warn', 'error'] : ['warn', 'error'],
});
