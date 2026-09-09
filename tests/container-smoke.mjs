import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const environment = {
  ...process.env,
  HOUSEHOLD_TIMEZONE: 'UTC',
  DEMO_REMINDER_TIME: '00:00',
  DEMO_PIN: '246810',
  LOG_LEVEL: 'error',
};
for (const file of ['dist/migrate.js', 'dist/seed.js']) {
  const result = spawnSync('node', [file], {
    env: environment,
    stdio: 'inherit',
  });
  assert.equal(result.status, 0, `${file} must complete`);
}
let server;
async function start() {
  server = spawn('node', ['dist/server.js'], {
    env: environment,
    stdio: 'inherit',
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:3001/api/health')).ok) return;
    } catch {
      /* Wait for the local server to start. */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Server did not become healthy');
}
async function stop() {
  const done = new Promise((resolve) => server.once('exit', resolve));
  server.kill('SIGTERM');
  await done;
}
async function request(path, body, cookie) {
  const response = await fetch(`http://127.0.0.1:3001/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'x-family-client': '1',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, data: await response.json() };
}
try {
  await start();
  const home = (await request('/kiosk')).data;
  assert.equal(home.profiles.length, 4);
  const child = home.profiles.find((p) => p.displayName === 'Kid 1');
  const profile = (await request(`/kiosk/profiles/${child.id}`)).data;
  const dose = profile.doses.find((d) => d.status === 'DUE');
  assert.ok(dose);
  const taken = await request(`/doses/${dose.id}/actions`, { action: 'TAKE' });
  assert.equal(taken.response.status, 200);
  assert.equal(taken.data.points, 5);
  const expectedPoints = child.rewardPoints + 5;
  const parent = (await request('/auth/adults')).data[0];
  const login = await request('/auth/login', {
    userId: parent.id,
    pin: environment.DEMO_PIN,
  });
  assert.equal(login.response.status, 200);
  const cookie = login.response.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ');
  assert.equal(
    (await request('/admin', undefined, cookie)).response.status,
    200,
  );
  await stop();
  await start();
  const persisted = (await request(`/kiosk/profiles/${child.id}`)).data;
  assert.equal(persisted.profile.complete, 1);
  assert.equal(persisted.profile.rewardPoints, expectedPoints);
  assert.equal(
    (await request(`/doses/${dose.id}/actions`, { action: 'TAKE' })).data
      .alreadyRecorded,
    true,
  );
  console.log(
    JSON.stringify({
      status: 'passed',
      architecture: process.arch,
      checks: [
        'migrations',
        'demo seed',
        'health',
        'kiosk',
        'acknowledgement',
        'rewards',
        'adult authentication',
        'restart persistence',
        'idempotency',
      ],
      network: 'none',
    }),
  );
} finally {
  if (server && server.exitCode === null) await stop();
}
