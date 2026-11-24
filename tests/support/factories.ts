import { vi } from 'vitest';
import { Vehicle } from '../../src/modules/vehicles/domain/entities/vehicle.entity';
import { RoutePlan } from '../../src/modules/route-plans/domain/entities/route-plan.entity';
import { Delivery } from '../../src/modules/deliveries/domain/entities/delivery.entity';
import { Account, AccountStatus } from '../../src/modules/accounts/domain/entities/account.entity';
import { VehicleRepository } from '../../src/modules/vehicles/domain/repositories/vehicle.repository';
import { RoutePlanRepository } from '../../src/modules/route-plans/domain/repositories/route-plan.repository';
import { DeliveryRepository } from '../../src/modules/deliveries/domain/repositories/delivery.repository';
import { AccountRepository } from '../../src/modules/accounts/domain/repositories/account.repository';
import { ApiKeyRepository } from '../../src/modules/api-keys/domain/repositories/api-key.repository';

export const ACCOUNT_ID = '0b9c8f5e-1d2a-4b3c-8d4e-5f6a7b8c9d0e';
export const now = new Date('2026-11-24T12:00:00.000Z');

export function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    accountId: ACCOUNT_ID,
    name: 'Van 01',
    capacity: 100,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeRoutePlan(overrides: Partial<RoutePlan> = {}): RoutePlan {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    accountId: ACCOUNT_ID,
    name: 'Rota da manhã',
    depotLatitude: -26.3044,
    depotLongitude: -48.8487,
    status: 'draft',
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    accountId: ACCOUNT_ID,
    routePlanId: '22222222-2222-4222-8222-222222222222',
    reference: 'PEDIDO-001',
    latitude: -26.2951,
    longitude: -48.8458,
    demand: 10,
    serviceDurationSeconds: 300,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: ACCOUNT_ID,
    name: 'Transportadora',
    slug: 'transportadora',
    status: AccountStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

export function vehicleRepositoryMock() {
  return {
    create: vi.fn<VehicleRepository['create']>(),
    findById: vi.fn<VehicleRepository['findById']>(),
    findByName: vi.fn<VehicleRepository['findByName']>(),
    findMany: vi.fn<VehicleRepository['findMany']>(),
    update: vi.fn<VehicleRepository['update']>(),
    delete: vi.fn<VehicleRepository['delete']>(),
  } satisfies VehicleRepository;
}

export function routePlanRepositoryMock() {
  return {
    create: vi.fn<RoutePlanRepository['create']>(),
    findById: vi.fn<RoutePlanRepository['findById']>(),
    findMany: vi.fn<RoutePlanRepository['findMany']>(),
    update: vi.fn<RoutePlanRepository['update']>(),
    delete: vi.fn<RoutePlanRepository['delete']>(),
  } satisfies RoutePlanRepository;
}

export function deliveryRepositoryMock() {
  return {
    create: vi.fn<DeliveryRepository['create']>(),
    findById: vi.fn<DeliveryRepository['findById']>(),
    findByReference: vi.fn<DeliveryRepository['findByReference']>(),
    countByRoutePlan: vi.fn<DeliveryRepository['countByRoutePlan']>(),
    findMany: vi.fn<DeliveryRepository['findMany']>(),
    update: vi.fn<DeliveryRepository['update']>(),
    delete: vi.fn<DeliveryRepository['delete']>(),
  } satisfies DeliveryRepository;
}

export function accountRepositoryMock() {
  return {
    create: vi.fn<AccountRepository['create']>(),
    findById: vi.fn<AccountRepository['findById']>(),
    findBySlug: vi.fn<AccountRepository['findBySlug']>(),
    findMany: vi.fn<AccountRepository['findMany']>(),
    update: vi.fn<AccountRepository['update']>(),
    softDelete: vi.fn<AccountRepository['softDelete']>(),
  } satisfies AccountRepository;
}

export function apiKeyRepositoryMock() {
  return {
    create: vi.fn<ApiKeyRepository['create']>(),
    findManyByAccountId: vi.fn<ApiKeyRepository['findManyByAccountId']>(),
    findForAuthentication: vi.fn<ApiKeyRepository['findForAuthentication']>(),
    revoke: vi.fn<ApiKeyRepository['revoke']>(),
    updateLastUsedAt: vi.fn<ApiKeyRepository['updateLastUsedAt']>(),
  } satisfies ApiKeyRepository;
}
