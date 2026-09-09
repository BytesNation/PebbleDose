import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openDatabase } from './index';
const store = openDatabase();
migrate(store.db, {
  migrationsFolder:
    process.env.MIGRATIONS_PATH ?? './packages/database/migrations',
});
store.sqlite.close();
console.log(
  JSON.stringify({
    level: 'info',
    event: 'database_migrations_complete',
    at: new Date().toISOString(),
  }),
);
