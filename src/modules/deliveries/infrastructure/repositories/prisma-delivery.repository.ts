import { Prisma, Delivery as PrismaDelivery } from '@prisma/client';
import { prisma } from '../../../../shared/database/prisma';
import { repositoryError } from '../../../../shared/database/repository-error';
import { Pagination } from '../../../../shared/domain/pagination';
import { Delivery } from '../../domain/entities/delivery.entity';
import {
  DeliveryRepository,
  CreateDeliveryData,
  UpdateDeliveryData,
} from '../../domain/repositories/delivery.repository';
import { AppError } from '../../../../shared/errors/app-error';

export class PrismaDeliveryRepository implements DeliveryRepository {
  async create(
    accountId: string,
    routePlanId: string,
    data: CreateDeliveryData,
  ): Promise<Delivery> {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.routePlan.update({
            where: { id: routePlanId, accountId },
            data: { version: { increment: 1 }, status: 'DRAFT' },
          });
          await tx.routeOptimization.deleteMany({
            where: { routePlanId, accountId },
          });
          const record = await tx.delivery.create({
            data: { accountId, routePlanId, ...data },
          });
          return this.toDomain(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      repositoryError(error);
    }
  }

  async update(
    accountId: string,
    routePlanId: string,
    id: string,
    data: UpdateDeliveryData,
  ): Promise<Delivery> {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.routePlan.update({
            where: { id: routePlanId, accountId },
            data: { version: { increment: 1 }, status: 'DRAFT' },
          });
          await tx.routeOptimization.deleteMany({
            where: { routePlanId, accountId },
          });
          const record = await tx.delivery.update({
            where: { id, accountId, routePlanId },
            data: { ...data },
          });
          return this.toDomain(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      repositoryError(error);
    }
  }

  async delete(
    accountId: string,
    routePlanId: string,
    id: string,
  ): Promise<void> {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.routePlan.update({
            where: { id: routePlanId, accountId },
            data: { version: { increment: 1 }, status: 'DRAFT' },
          });
          await tx.routeOptimization.deleteMany({
            where: { routePlanId, accountId },
          });
          await tx.delivery.delete({ where: { id, accountId, routePlanId } });
          return;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      repositoryError(error);
    }
  }

  async findById(
    accountId: string,
    routePlanId: string,
    id: string,
  ): Promise<Delivery | null> {
    const record = await prisma.delivery.findFirst({
      where: { id, accountId, routePlanId },
    });
    return record ? this.toDomain(record) : null;
  }

  async findMany(accountId: string, routePlanId: string, options: Pagination) {
    const parent = await prisma.routePlan.findFirst({
      where: { id: routePlanId, accountId },
      select: { id: true },
    });
    if (!parent) {
      throw new AppError('ROUTE_PLAN_NOT_FOUND', 404, 'Route plan not found.');
    }
    const [records, total] = await prisma.$transaction(
      [
        prisma.delivery.findMany({
          where: { accountId, routePlanId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (options.page - 1) * options.limit,
          take: options.limit,
        }),
        prisma.delivery.count({ where: { accountId, routePlanId } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { data: records.map((record) => this.toDomain(record)), total };
  }

  private toDomain(record: PrismaDelivery): Delivery {
    return record;
  }
}
