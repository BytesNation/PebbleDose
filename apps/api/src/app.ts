import Fastify, { LogController } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import { ZodError } from 'zod';
import { openDatabase, type Store } from '@family/database';
import { FamilyService } from './domain/service';
import { AuthService } from './domain/auth';
import { routes } from './routes';
import { uploads } from './uploads';
export interface AppOptions {
  uploadFolder?: string;
  now?: () => string;
  secret?: string;
  logging?: boolean;
}
export function createApp(
  store: Store = openDatabase(),
  options: AppOptions = {},
) {
  const now = options.now ?? (() => new Date().toISOString());
  const app = Fastify({
    logger: options.logging
      ? {
          level: process.env.LOG_LEVEL ?? 'info',
          redact: [
            'req.headers.cookie',
            'req.headers.authorization',
            'body.pin',
            'body.adult.pin',
          ],
        }
      : false,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 1024 * 1024,
  });
  const service = new FamilyService(store, now);
  const auth = new AuthService(
    store,
    options.secret ?? 'test-only-secret-pass-a-runtime-secret',
    now,
  );
  app.register(cookie);
  app.register(rateLimit, { max: 180, timeWindow: '1 minute' });
  app.register(helmet, { contentSecurityPolicy: false });
  app.addHook('onRequest', async (r, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method)) {
      if (r.headers['x-family-client'] !== '1')
        return reply
          .code(403)
          .send({ message: 'Request verification required' });
      const origin = r.headers.origin;
      if (origin) {
        let host = '';
        try {
          host = new URL(origin).host;
        } catch {
          /* Invalid origins are rejected. */
        }
        if (host !== r.headers.host)
          return reply.code(403).send({ message: 'Origin not allowed' });
      }
    }
  });
  app.setErrorHandler((error, _r, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        message: error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      });
    const e = error as Error & { statusCode?: number };
    const code = e.statusCode ?? 500;
    if (code >= 500)
      app.log.error({ errorType: e.name, requestId: _r.id }, 'Request failed');
    return reply.code(code).send({
      message:
        code >= 500
          ? 'The request could not be saved. Please try again.'
          : e.message,
    });
  });
  app.get('/api/health', () => {
    store.sqlite.prepare('SELECT 1').get();
    return { status: 'ok' };
  });
  routes(app, service, auth);
  uploads(app, service, auth, options.uploadFolder);
  return app;
}
