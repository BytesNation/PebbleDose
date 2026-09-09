import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';
export function openDatabase(
  path = process.env.DATABASE_PATH ?? './data/medicine.db',
) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  return { sqlite, db: drizzle(sqlite, { schema }) };
}
export type Store = ReturnType<typeof openDatabase>;
export * from './schema';
export { migrate } from 'drizzle-orm/better-sqlite3/migrator';
