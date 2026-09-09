import { PushService } from './domain/push';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '@family/database';
import { createApp } from './app';
import { FamilyService } from './domain/service';
const store = openDatabase();
// Verify schema is present. Schema changes belong to the explicit migration command.
store.sqlite.prepare('SELECT id FROM households LIMIT 1').get();
const secretPath = join(
  dirname(process.env.DATABASE_PATH ?? './data/medicine.db'),
  'session-secret',
);
let secret = process.env.SESSION_SECRET;
if (!secret) {
  mkdirSync(dirname(secretPath), { recursive: true });
  if (!existsSync(secretPath))
    writeFileSync(secretPath, randomBytes(48).toString('hex'), {
      mode: 0o600,
      flag: 'wx',
    });
  secret = readFileSync(secretPath, 'utf8').trim();
}
if (secret.length < 32)
  throw new Error('SESSION_SECRET must have at least 32 characters');
const app = createApp(store, { secret, logging: true });
const service = new FamilyService(store, () => new Date().toISOString());
const push = new PushService(service);
const tick = () => {
  try {
    service.scheduler.generate();
    void push.tick().catch(() => app.log.warn('Push delivery check failed'));
  } catch (err) {
    app.log.error(
      { errorType: err instanceof Error ? err.name : 'UnknownError' },
      'Scheduler failed',
    );
  }
};
tick();
const timer = setInterval(tick, 15000);
timer.unref();
app.addHook('onClose', () => {
  clearInterval(timer);
  store.sqlite.close();
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    void app.close();
  });
await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' });
