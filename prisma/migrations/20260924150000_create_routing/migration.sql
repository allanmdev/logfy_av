CREATE TYPE "RoutePlanStatus" AS ENUM ('DRAFT', 'OPTIMIZED');

CREATE TABLE "route_plans" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
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
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "routePlanId" TEXT NOT NULL,
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
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "route_optimizations" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "routePlanId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_optimizations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "route_plans_accountId_createdAt_idx" ON "route_plans"("accountId", "createdAt");

CREATE UNIQUE INDEX "route_plans_id_accountId_key" ON "route_plans"("id", "accountId");

CREATE INDEX "deliveries_accountId_routePlanId_idx" ON "deliveries"("accountId", "routePlanId");

CREATE UNIQUE INDEX "deliveries_routePlanId_reference_key" ON "deliveries"("routePlanId", "reference");

CREATE INDEX "vehicles_accountId_active_idx" ON "vehicles"("accountId", "active");

CREATE UNIQUE INDEX "route_optimizations_routePlanId_key" ON "route_optimizations"("routePlanId");

CREATE INDEX "route_optimizations_accountId_idx" ON "route_optimizations"("accountId");

CREATE UNIQUE INDEX "route_optimizations_routePlanId_accountId_key" ON "route_optimizations"("routePlanId", "accountId");

ALTER TABLE "route_plans" ADD CONSTRAINT "route_plans_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_routePlanId_accountId_fkey" FOREIGN KEY ("routePlanId", "accountId") REFERENCES "route_plans"("id", "accountId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "route_optimizations" ADD CONSTRAINT "route_optimizations_routePlanId_accountId_fkey" FOREIGN KEY ("routePlanId", "accountId") REFERENCES "route_plans"("id", "accountId") ON DELETE CASCADE ON UPDATE CASCADE;
