CREATE FUNCTION "logfy_text_to_uuid"(value TEXT) RETURNS UUID AS $$
  SELECT CASE
    WHEN value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN value::uuid
    ELSE md5(value)::uuid
  END
$$ LANGUAGE SQL IMMUTABLE STRICT;

ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_accountId_fkey";
ALTER TABLE "deliveries" DROP CONSTRAINT "deliveries_routePlanId_accountId_fkey";
ALTER TABLE "route_optimizations" DROP CONSTRAINT "route_optimizations_routePlanId_accountId_fkey";
ALTER TABLE "route_plans" DROP CONSTRAINT "route_plans_accountId_fkey";
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_accountId_fkey";

ALTER TABLE "accounts"
  ALTER COLUMN "id" TYPE UUID USING "logfy_text_to_uuid"("id"),
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "api_keys"
  ALTER COLUMN "id" TYPE UUID USING "logfy_text_to_uuid"("id"),
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "accountId" TYPE UUID USING "logfy_text_to_uuid"("accountId");

ALTER TABLE "route_plans"
  ALTER COLUMN "id" TYPE UUID USING "logfy_text_to_uuid"("id"),
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "accountId" TYPE UUID USING "logfy_text_to_uuid"("accountId");

ALTER TABLE "deliveries"
  ALTER COLUMN "id" TYPE UUID USING "logfy_text_to_uuid"("id"),
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "accountId" TYPE UUID USING "logfy_text_to_uuid"("accountId"),
  ALTER COLUMN "routePlanId" TYPE UUID USING "logfy_text_to_uuid"("routePlanId");

ALTER TABLE "vehicles"
  ALTER COLUMN "id" TYPE UUID USING "logfy_text_to_uuid"("id"),
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "accountId" TYPE UUID USING "logfy_text_to_uuid"("accountId");

ALTER TABLE "route_optimizations"
  ALTER COLUMN "id" TYPE UUID USING "logfy_text_to_uuid"("id"),
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "accountId" TYPE UUID USING "logfy_text_to_uuid"("accountId"),
  ALTER COLUMN "routePlanId" TYPE UUID USING "logfy_text_to_uuid"("routePlanId");

DROP FUNCTION "logfy_text_to_uuid"(TEXT);

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "route_plans" ADD CONSTRAINT "route_plans_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_routePlanId_accountId_fkey" FOREIGN KEY ("routePlanId", "accountId") REFERENCES "route_plans"("id", "accountId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "route_optimizations" ADD CONSTRAINT "route_optimizations_routePlanId_accountId_fkey" FOREIGN KEY ("routePlanId", "accountId") REFERENCES "route_plans"("id", "accountId") ON DELETE CASCADE ON UPDATE CASCADE;
