import { expect, it } from 'vitest';
import { createApp } from './app';
import { openDatabase } from '@family/database';
it('health confirms the database can be queried', async () => {
  const store = openDatabase(':memory:');
  const app = createApp(store);
  const res = await app.inject('/api/health');
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ status: 'ok' });
  await app.close();
  store.sqlite.close();
});
