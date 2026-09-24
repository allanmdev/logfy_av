import {
  Prisma,
  RouteOptimization as PrismaRouteOptimization,
} from '@prisma/client';
import { prisma } from '../../../../shared/database/prisma';
import { repositoryError } from '../../../../shared/database/repository-error';
import { AppError } from '../../../../shared/errors/app-error';
import { OptimizationRepository } from '../../domain/repositories/optimization.repository';
import {
  OptimizationSnapshot,
  OptimizationResult,
  RouteOptimization,
} from '../../domain/entities/optimization.entity';

export class PrismaOptimizationRepository implements OptimizationRepository {
  async loadSnapshot(
    accountId: string,
    routePlanId: string,
    vehicleIds: string[],
    maxDeliveries: number,
  ): Promise<OptimizationSnapshot> {
    return prisma.$transaction(
      async (tx) => {
        const plan = await tx.routePlan.findFirst({
          where: { id: routePlanId, accountId },
        });
        if (!plan) {
          throw new AppError(
            'ROUTE_PLAN_NOT_FOUND',
            404,
            'Route plan not found.',
          );
        }
        const deliveries = await tx.delivery.findMany({
          where: { accountId, routePlanId },
          orderBy: { id: 'asc' },
          take: maxDeliveries + 1,
        });
        const vehicles = await tx.vehicle.findMany({
          where: { accountId, id: { in: vehicleIds }, active: true },
          orderBy: { id: 'asc' },
        });
        if (vehicles.length !== vehicleIds.length) {
          throw new AppError(
            'VEHICLES_NOT_FOUND',
            404,
            'One or more selected vehicles are unavailable.',
          );
        }
        return {
          plan: {
            ...plan,
            status: plan.status === 'DRAFT' ? 'draft' : 'optimized',
          },
          deliveries,
          vehicles,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async save(
    snapshot: OptimizationSnapshot,
    result: OptimizationResult,
  ): Promise<RouteOptimization> {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const { plan } = snapshot;
          const changed = () =>
            new AppError(
              'CONCURRENT_MODIFICATION',
              409,
              'The plan or selected vehicles changed. Retry optimization.',
            );
          const vehicles = await tx.vehicle.findMany({
            where: {
              accountId: plan.accountId,
              id: { in: snapshot.vehicles.map((vehicle) => vehicle.id) },
              active: true,
            },
          });
          if (
            vehicles.length !== snapshot.vehicles.length ||
            snapshot.vehicles.some((vehicle) => {
              const current = vehicles.find((item) => item.id === vehicle.id);
              return (
                !current ||
                current.capacity !== vehicle.capacity ||
                current.name !== vehicle.name ||
                current.updatedAt.getTime() !== vehicle.updatedAt.getTime()
              );
            })
          ) {
            throw changed();
          }
          const updated = await tx.routePlan.updateMany({
            where: {
              id: plan.id,
              accountId: plan.accountId,
              version: plan.version,
            },
            data: { status: 'OPTIMIZED', version: { increment: 1 } },
          });
          if (!updated.count) {
            throw changed();
          }
          await tx.routeOptimization.deleteMany({
            where: { routePlanId: plan.id, accountId: plan.accountId },
          });
          const record = await tx.routeOptimization.create({
            data: {
              routePlanId: plan.id,
              accountId: plan.accountId,
              result: result as unknown as Prisma.InputJsonValue,
            },
          });
          return this.toDomain(record);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      repositoryError(error);
    }
  }

  async findByRoutePlanId(
    accountId: string,
    routePlanId: string,
  ): Promise<RouteOptimization | null> {
    const record = await prisma.routeOptimization.findFirst({
      where: { accountId, routePlanId },
    });
    return record ? this.toDomain(record) : null;
  }

  private toDomain(record: PrismaRouteOptimization): RouteOptimization {
    return {
      ...record,
      result: record.result as unknown as OptimizationResult,
    };
  }
}
