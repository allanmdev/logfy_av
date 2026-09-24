import { PrismaRoutePlanRepository } from '../../modules/route-plans/infrastructure/repositories/prisma-route-plan.repository';
import { RoutePlanController } from '../../modules/route-plans/presentation/http/route-plan.controller';
import { CreateRoutePlanUseCase } from '../../modules/route-plans/application/use-cases/create-route-plan.use-case';
import { GetRoutePlanUseCase } from '../../modules/route-plans/application/use-cases/get-route-plan.use-case';
import { ListRoutePlansUseCase } from '../../modules/route-plans/application/use-cases/list-route-plans.use-case';
import { UpdateRoutePlanUseCase } from '../../modules/route-plans/application/use-cases/update-route-plan.use-case';
import { DeleteRoutePlanUseCase } from '../../modules/route-plans/application/use-cases/delete-route-plan.use-case';

export const routePlanRepository = new PrismaRoutePlanRepository();

export const routePlanController = new RoutePlanController(
  new CreateRoutePlanUseCase(routePlanRepository),
  new GetRoutePlanUseCase(routePlanRepository),
  new ListRoutePlansUseCase(routePlanRepository),
  new UpdateRoutePlanUseCase(routePlanRepository),
  new DeleteRoutePlanUseCase(routePlanRepository),
);
