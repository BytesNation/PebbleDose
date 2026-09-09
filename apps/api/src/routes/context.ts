import type { FastifyRequest } from 'fastify';
import type { FamilyService } from '../domain/service';
import type { AuthService } from '../domain/auth';
import { idSchema } from '@family/shared';
import { DomainError } from '../errors';
export function routeContext(service: FamilyService, auth: AuthService) {
  const { db } = service.store;
  const actor = (r: FastifyRequest) => auth.actor(r.cookies.family_session);
  const adult = (r: FastifyRequest) => {
    const user = actor(r);
    if (!user) throw new DomainError(401, 'Adult sign-in required');
    if (user.role !== 'ADULT')
      throw new DomainError(403, 'Adult access required');
    return user;
  };
  const id = (r: FastifyRequest) =>
    idSchema.parse((r.params as { id: string }).id);
  const profileAccess = (r: FastifyRequest, userId: string) => {
    const user = service.user(userId),
      who = actor(r);
    if (!user.active) throw new DomainError(404, 'Profile unavailable');
    if (user.kioskPinRequired && who?.id !== user.id && who?.role !== 'ADULT')
      throw new DomainError(401, 'Unlock this profile first');
  };
  return { db, service, auth, actor, adult, id, profileAccess };
}
export type RouteContext = ReturnType<typeof routeContext>;
