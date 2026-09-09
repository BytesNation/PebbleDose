import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './context';
import { users, households } from '@family/database';
import { eq } from 'drizzle-orm';
import { setupSchema, loginSchema } from '@family/shared';
export function identityRoutes(app: FastifyInstance, context: RouteContext) {
  const { db, service, auth, actor } = context;
  app.get('/api/setup', () => ({
    required: !db.select().from(households).get(),
    timezone: process.env.HOUSEHOLD_TIMEZONE ?? 'America/New_York',
  }));
  app.post(
    '/api/setup',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (r, reply) =>
      reply.code(201).send(await service.setup(setupSchema.parse(r.body))),
  );
  app.get('/api/auth/adults', () =>
    db
      .select()
      .from(users)
      .where(eq(users.active, true))
      .all()
      .filter((u) => u.role === 'ADULT')
      .map((u) => ({ id: u.id, displayName: u.displayName })),
  );
  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (r, reply) => {
      const input = loginSchema.parse(r.body);
      try {
        const { token, user } = await auth.login(input.userId, input.pin);
        reply.setCookie('family_session', token, {
          path: '/',
          httpOnly: true,
          sameSite: 'strict',
          secure: process.env.COOKIE_SECURE === 'true',
          maxAge: 900,
        });
        return { user: service.publicUser(user) };
      } catch (error) {
        app.log.warn({ userId: input.userId }, 'Authentication failed');
        throw error;
      }
    },
  );
  app.get('/api/auth/me', (r) => {
    const user = actor(r);
    return { user: user ? service.publicUser(user) : null };
  });
  app.post('/api/auth/logout', (r, reply) => {
    auth.logout(r.cookies.family_session);
    reply.clearCookie('family_session', { path: '/' });
    return { ok: true };
  });
}
