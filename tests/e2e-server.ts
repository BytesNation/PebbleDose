import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, migrate } from '../packages/database/src/index';
import { createApp } from '../apps/api/src/app';
const store = openDatabase(
  join(mkdtempSync(join(tmpdir(), 'family-e2e-')), 'test.db'),
);
migrate(store.db, { migrationsFolder: 'packages/database/migrations' });
process.env.KIOSK_RETURN_DELAY = '1500';
const app = createApp(store);
await app.listen({ host: '127.0.0.1', port: 3101 });
