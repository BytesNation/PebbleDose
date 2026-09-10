# Demo screenshots

These images show PebbleDose with four fictional people: Alex, Jamie, Riley, and Sam. All medication labels, amounts, recorded uses, reward balances, and history are synthetic. The demo clock is fixed at September 9, 2026, 09:15 UTC.

## Recreate the gallery

From a development checkout of `main`, install dependencies and Chromium, then run:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm --filter @family/web build
node --import tsx scripts/capture-demo.ts
```

The script starts an isolated in-memory API on port 3201 and a web preview on port 3200. It populates a week of records through the application services, captures five real browser screens at 1280 pixels wide, then shuts down. It never opens `DATABASE_PATH` or the household Docker volume. No demo database or browser session is committed.

To keep the demo open after capture:

```bash
node --import tsx scripts/capture-demo.ts --serve
```

Open http://127.0.0.1:3200. The fictional adult PIN is `246810`. This PIN exists only in the isolated demo. Stop the process with Ctrl+C to discard its data. The capture records Riley's final dose, so the interactive demo opens with that action completed.

Review every image before committing it. Use fictional data only. The gallery includes the family kiosk, member day and history, parent dashboard, reward store, and daily completion screen.
