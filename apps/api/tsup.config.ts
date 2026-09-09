import { defineConfig } from 'tsup';
export default defineConfig({
  entry: {
    server: 'src/server.ts',
    migrate: '../../packages/database/src/migrate.ts',
    seed: '../../packages/database/src/seed.ts',
  },
  format: ['esm'],
  outDir: 'dist',
  noExternal: [/^@family\//],
  external: ['better-sqlite3'],
});
