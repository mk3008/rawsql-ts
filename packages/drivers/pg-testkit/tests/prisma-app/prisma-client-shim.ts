// Minimal Prisma client contraction for this test bundle, mirroring the schema-generated shapes.
// Runtime code loads the concrete client from temporarily generated output, so this module only
// needs to satisfy the TypeScript compiler.
export interface Prisma {
  User: {
    id: number;
    email: string;
    active: boolean;
  };
  UserCreateInput: {
    email: string;
    active?: boolean;
  };
  UserWhereUniqueInput: { id?: number };
  BatchPayload: { count: number };
}

export class PrismaClient {
  // Runtime-generated client populates this helper so tests can assume it exists.
  public readonly user!: {
    create(args: { data: Prisma['UserCreateInput'] }): Promise<Prisma['User']>;
    findUnique(args: { where: Prisma['UserWhereUniqueInput'] }): Promise<Prisma['User'] | null>;
    updateMany(args: {
      where: Prisma['UserWhereUniqueInput'];
      data: { active: boolean };
    }): Promise<Prisma['BatchPayload']>;
    deleteMany(args: { where: Prisma['UserWhereUniqueInput'] }): Promise<Prisma['BatchPayload']>;
  };
}

export type PrismaClientType = PrismaClient;
export type PrismaType = Prisma;
