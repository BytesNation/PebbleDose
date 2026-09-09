import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './context';
import { z } from 'zod';
import {
  userSchema,
  userUpdateSchema,
  medicationSchema,
  scheduleSchema,
} from '@family/shared';
export function managementRoutes(app: FastifyInstance, context: RouteContext) {
  const { service, adult, id } = context;
  app.get('/api/admin', (r) => {
    adult(r);
    service.scheduler.generate();
    return service.adminData();
  });
  app.post('/api/admin/users', async (r, reply) =>
    reply
      .code(201)
      .send(await service.saveUser(userSchema.parse(r.body), adult(r).id)),
  );
  app.put('/api/admin/users/:id', (r) =>
    service.saveUser(userUpdateSchema.parse(r.body), adult(r).id, id(r)),
  );
  app.post('/api/admin/medications', (r, reply) =>
    reply
      .code(201)
      .send(
        service.saveMedication(medicationSchema.parse(r.body), adult(r).id),
      ),
  );
  app.put('/api/admin/medications/:id', (r) =>
    service.saveMedication(medicationSchema.parse(r.body), adult(r).id, id(r)),
  );
  app.post('/api/admin/schedules', (r, reply) =>
    reply
      .code(201)
      .send(service.saveSchedule(scheduleSchema.parse(r.body), adult(r).id)),
  );
  app.put('/api/admin/schedules/:id', (r) =>
    service.saveSchedule(scheduleSchema.parse(r.body), adult(r).id, id(r)),
  );
  app.get('/api/admin/analytics', (r) => {
    adult(r);
    service.scheduler.generate();
    return service.analytics(
      z.coerce
        .number()
        .refine((n) => n === 7 || n === 30)
        .parse((r.query as { days?: string }).days ?? 7),
    );
  });
}
