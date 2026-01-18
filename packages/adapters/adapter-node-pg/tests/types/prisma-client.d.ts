import type { PrismaClient } from '../prisma-app/prisma-client-shim';

/**
 * Declare the temporary Prisma client module so the compiler can resolve the
 * runtime-generated output without the actual file existing yet.
 */
declare module '../tmp/prisma/client' {
  export { PrismaClient };
}
