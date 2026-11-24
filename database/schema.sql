CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

CREATE TYPE "RoutePlanStatus" AS ENUM ('DRAFT', 'OPTIMIZED');

CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "route_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "depotLatitude" DOUBLE PRECISION NOT NULL,
    "depotLongitude" DOUBLE PRECISION NOT NULL,
    "status" "RoutePlanStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    "routePlanId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "demand" INTEGER NOT NULL,
    "serviceDurationSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "route_optimizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    "routePlanId" UUID NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_optimizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounts_slug_key" ON "accounts"("slug");

CREATE INDEX "accounts_status_idx" ON "accounts"("status");

CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

CREATE INDEX "api_keys_accountId_idx" ON "api_keys"("accountId");

CREATE INDEX "api_keys_prefix_idx" ON "api_keys"("prefix");

CREATE INDEX "api_keys_revokedAt_idx" ON "api_keys"("revokedAt");

CREATE INDEX "route_plans_accountId_createdAt_idx" ON "route_plans"("accountId", "createdAt");

CREATE UNIQUE INDEX "route_plans_id_accountId_key" ON "route_plans"("id", "accountId");

CREATE INDEX "deliveries_accountId_routePlanId_idx" ON "deliveries"("accountId", "routePlanId");

CREATE UNIQUE INDEX "deliveries_routePlanId_reference_key" ON "deliveries"("routePlanId", "reference");

CREATE INDEX "vehicles_accountId_active_idx" ON "vehicles"("accountId", "active");

CREATE UNIQUE INDEX "route_optimizations_routePlanId_key" ON "route_optimizations"("routePlanId");

CREATE INDEX "route_optimizations_accountId_idx" ON "route_optimizations"("accountId");

CREATE UNIQUE INDEX "route_optimizations_routePlanId_accountId_key" ON "route_optimizations"("routePlanId", "accountId");

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "route_plans" ADD CONSTRAINT "route_plans_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_routePlanId_accountId_fkey" FOREIGN KEY ("routePlanId", "accountId") REFERENCES "route_plans"("id", "accountId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "route_optimizations" ADD CONSTRAINT "route_optimizations_routePlanId_accountId_fkey" FOREIGN KEY ("routePlanId", "accountId") REFERENCES "route_plans"("id", "accountId") ON DELETE CASCADE ON UPDATE CASCADE;

