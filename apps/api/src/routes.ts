import { pushRoutes } from './routes/push';
import type { FastifyInstance } from 'fastify';
import type { FamilyService } from './domain/service';
import type { AuthService } from './domain/auth';
import { routeContext } from './routes/context';
import { identityRoutes } from './routes/identity';
import { kioskRoutes } from './routes/kiosk';
import { managementRoutes } from './routes/management';
import { rewardsRoutes } from './routes/rewards';
export function routes(
  app: FastifyInstance,
  service: FamilyService,
  auth: AuthService,
) {
  const context = routeContext(service, auth);
  identityRoutes(app, context);
  kioskRoutes(app, context);
  managementRoutes(app, context);
  rewardsRoutes(app, context);
  pushRoutes(app, context);
}
