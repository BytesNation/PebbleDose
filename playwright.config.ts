import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node --import tsx tests/e2e-server.ts',
      url: 'http://127.0.0.1:3101/api/health',
      reuseExistingServer: false,
    },
    {
      command:
        'pnpm --filter @family/web build && API_TARGET=http://127.0.0.1:3101 pnpm --filter @family/web exec vite preview --host 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
});
