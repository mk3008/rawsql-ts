import type { PrismaClient, Prisma } from '@prisma/client';

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createUser(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data,
    });
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async updateActive(id: number, active: boolean) {
    return this.prisma.user.updateMany({
      where: { id },
      data: { active },
    });
  }

  async deleteById(id: number) {
    return this.prisma.user.deleteMany({
      where: { id },
    });
  }
}
