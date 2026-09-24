import { Prisma, Vehicle as PrismaVehicle } from '@prisma/client';
import { prisma } from '../../../../shared/database/prisma';
import { repositoryError } from '../../../../shared/database/repository-error';
import { Pagination } from '../../../../shared/domain/pagination';
import { Vehicle } from '../../domain/entities/vehicle.entity';
import {
  VehicleRepository,
  CreateVehicleData,
  UpdateVehicleData,
} from '../../domain/repositories/vehicle.repository';

export class PrismaVehicleRepository implements VehicleRepository {
  async create(accountId: string, data: CreateVehicleData): Promise<Vehicle> {
    try {
      const record = await prisma.vehicle.create({
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
    data: UpdateVehicleData,
  ): Promise<Vehicle> {
    try {
      const record = await prisma.vehicle.update({
        where: { id, accountId },
        data: { ...data },
      });
      return this.toDomain(record);
    } catch (error) {
      repositoryError(error);
    }
  }

  async delete(accountId: string, id: string): Promise<void> {
    try {
      await prisma.vehicle.delete({ where: { id, accountId } });
      return;
    } catch (error) {
      repositoryError(error);
    }
  }

  async findById(accountId: string, id: string): Promise<Vehicle | null> {
    const record = await prisma.vehicle.findFirst({ where: { id, accountId } });
    return record ? this.toDomain(record) : null;
  }

  async findMany(accountId: string, options: Pagination) {
    const [records, total] = await prisma.$transaction(
      [
        prisma.vehicle.findMany({
          where: { accountId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (options.page - 1) * options.limit,
          take: options.limit,
        }),
        prisma.vehicle.count({ where: { accountId } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { data: records.map((record) => this.toDomain(record)), total };
  }

  private toDomain(record: PrismaVehicle): Vehicle {
    return record;
  }
}
