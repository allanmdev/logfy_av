import { Prisma, RoutePlan as PrismaRoutePlan } from '@prisma/client';
import { prisma } from '../../../../shared/database/prisma';
import { repositoryError } from '../../../../shared/database/repository-error';
import { Pagination } from '../../../../shared/domain/pagination';
import { RoutePlan } from '../../domain/entities/route-plan.entity';
import {
  RoutePlanRepository,
  CreateRoutePlanData,
  UpdateRoutePlanData,
} from '../../domain/repositories/route-plan.repository';

export class PrismaRoutePlanRepository implements RoutePlanRepository {
  async create(
    accountId: string,
    data: CreateRoutePlanData,
  ): Promise<RoutePlan> {
    try {
      const record = await prisma.routePlan.create({
        data: { accountId, ...data },
      });
      return this.toDomain(record);
    } catch (error) {
      repositoryError(error);
    }
  }

  async update(
    accountId: string,
    id: string,
    data: UpdateRoutePlanData,
  ): Promise<RoutePlan> {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const record = await tx.routePlan.update({
            where: { id, accountId },
            data: { ...data, version: { increment: 1 }, status: 'DRAFT' },
          });
          await tx.routeOptimization.deleteMany({
            where: { routePlanId: id, accountId },
          });
          return this.toDomain(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      repositoryError(error);
    }
  }

  async delete(accountId: string, id: string): Promise<void> {
    try {
      await prisma.routePlan.delete({ where: { id, accountId } });
      return;
    } catch (error) {
      repositoryError(error);
    }
  }

  async findById(accountId: string, id: string): Promise<RoutePlan | null> {
    const record = await prisma.routePlan.findFirst({
      where: { id, accountId },
    });
    return record ? this.toDomain(record) : null;
  }

  async findMany(accountId: string, options: Pagination) {
    const [records, total] = await prisma.$transaction(
      [
        prisma.routePlan.findMany({
          where: { accountId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (options.page - 1) * options.limit,
          take: options.limit,
        }),
        prisma.routePlan.count({ where: { accountId } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { data: records.map((record) => this.toDomain(record)), total };
  }

  private toDomain(record: PrismaRoutePlan): RoutePlan {
    return {
      ...record,
      status: record.status === 'DRAFT' ? 'draft' : 'optimized',
    };
  }
}
