import { PrismaClient } from '@prisma/client';

declare global {
  // Avoid multiple Prisma instances in development (hot reload)
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Returns a Prisma Client extension that automatically enforces Row-Level Security
 * by appending { userId } to queries for models that support it.
 */
export function getPrismaClient(userId?: string) {
  if (!userId) {
    return prisma;
  }

  // Define RLS extension. We'll apply this dynamically.
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Add models here that have a userId field
          const userModels = ['Monitor', 'Change', 'PaymentCustomer'];
          
          if (userModels.includes(model)) {
            if (operation === 'findUnique' || operation === 'findFirst' || operation === 'findMany' || operation === 'update' || operation === 'updateMany' || operation === 'delete' || operation === 'deleteMany' || operation === 'count') {
              if (args.where) {
                (args.where as any).userId = userId;
              } else {
                (args as any).where = { userId };
              }
            }
          }
          return query(args);
        },
      },
    },
  });
}

export default prisma;
