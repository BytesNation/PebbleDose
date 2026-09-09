import { test, expect } from '@playwright/test';
test.describe.configure({ mode: 'serial' });
let childId: string, supervisedId: string;
test.beforeAll(async ({ playwright, browser }) => {
  const api = await playwright.request.newContext({
    baseURL: 'http://127.0.0.1:3101',
    extraHTTPHeaders: { 'x-family-client': '1' },
  });
  const setupPage = await browser.newPage();
  await setupPage.goto('http://127.0.0.1:3100/setup');
  await setupPage
    .getByLabel('Household name', { exact: true })
    .fill('The demo family');
  await setupPage.getByLabel('Your name', { exact: true }).fill('Parent');
  await setupPage
    .getByRole('combobox', { name: 'Household timezone', exact: true })
    .click();
  await setupPage.getByRole('option', { name: 'UTC', exact: true }).click();
  await setupPage.getByLabel('Adult PIN', { exact: true }).fill('246810');
  await setupPage.getByLabel('Repeat PIN', { exact: true }).fill('246810');
  await setupPage
    .getByRole('button', { name: 'Create household', exact: true })
    .click();
  await expect(
    setupPage.getByRole('heading', { name: 'Family members', exact: true }),
  ).toBeVisible();
  await setupPage.close();
  const adultId = (await (await api.get('/api/auth/adults')).json())[0].id;
  await api.post('/api/auth/login', {
    data: { userId: adultId, pin: '246810' },
  });
  for (const [name, supervision, avatar] of [
    ['Kid 1', false, 'star'],
    ['Kid 2', true, 'leaf'],
  ] as const) {
    const child = await api.post('/api/admin/users', {
      data: { name, displayName: name, role: 'CHILD', avatar },
    });
    const { id } = await child.json();
    if (supervision) supervisedId = id;
    else childId = id;
    const med = await api.post('/api/admin/medications', {
      data: {
        userId: id,
        name: 'Demo medicine',
        displayName: 'Morning Medicine',
        doseDisplay: '1 demo tablet',
        instructions: 'Take with water',
        requiresSupervision: supervision,
      },
    });
    const medicationId = (await med.json()).id;
    expect(
      (
        await api.post('/api/admin/schedules', {
          data: {
            medicationId,
            scheduleType: 'MORNING',
            timeOfDay: '00:01',
            daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
            startDate: new Date().toISOString().slice(0, 10),
          },
        })
      ).status(),
    ).toBe(201);
  }
  await api.post('/api/admin/users', {
    data: {
      name: 'Mom',
      displayName: 'Mom',
      role: 'ADULT',
      pin: '246810',
      avatar: 'flower',
    },
  });
  await api.dispose();
});
test('child acknowledges a dose and returns home with the updated status', async ({
  page,
}) => {
  await page.goto('/kiosk');
  await expect(
    page.getByRole('heading', { name: 'Your family' }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/kiosk-home.png',
    fullPage: true,
  });
  await page.locator(`a[href="/kiosk/profile/${childId}"]`).click();
  await expect(
    page.getByRole('heading', { name: 'Morning Medicine' }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/kiosk-medication.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'I TOOK IT', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'All done for today!', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back home', exact: true }).click();
  await expect(page).toHaveURL(/\/kiosk$/);
  await expect(
    page.locator(`a[href="/kiosk/profile/${childId}"]`),
  ).toContainText('All done');
});
test('supervised medicine waits for a parent PIN and explicit confirmation', async ({
  page,
}) => {
  await page.goto(`/kiosk/profile/${supervisedId}`);
  await expect(
    page.getByRole('button', { name: 'I TOOK IT', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'I’M READY', exact: true }).click();
  await expect(page.getByText('Waiting for parent confirmation')).toBeVisible();
  await page.getByLabel('PIN', { exact: true }).fill('246810');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'All done for today!', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back home', exact: true }).click();
  await expect(page).toHaveURL(/\/kiosk$/);
});
test('kiosk fits the smallest tablet and has large touch targets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto('/kiosk');
  await expect(
    page.getByRole('heading', { name: 'Your family' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/kiosk-1024.png',
    fullPage: true,
  });
  const card = await page.locator('.profile-card').first().boundingBox();
  expect(card!.width).toBeGreaterThan(44);
  expect(card!.height).toBeGreaterThan(44);
});

test('parent creates a family member, medication, and schedule in the UI', async ({
  page,
}) => {
  await page.goto('/admin');
  await page.getByLabel('PIN', { exact: true }).fill('246810');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Today, together.' }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/parent-dashboard.png',
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Family members', exact: true }).click();
  await page
    .getByRole('button', { name: 'Add family member', exact: true })
    .click();
  await page.getByLabel('Name', { exact: true }).fill('Test Child');
  await page.getByLabel('Name on kiosk', { exact: true }).fill('Test Child');
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await page
    .getByRole('button', { name: 'Choose Person 17', exact: true })
    .click();
  await page.getByRole('button', { name: 'Lavender background' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Test Child', exact: true }),
  ).toBeVisible();
  const member = page.locator('.member-card').filter({
    has: page.getByRole('heading', { name: 'Test Child', exact: true }),
  });
  await expect(
    member.getByRole('img', { name: 'Person 17 avatar' }),
  ).toBeVisible();
  await member.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Choose Person 17', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Animals', exact: true }).click();
  await page.getByRole('button', { name: 'Choose Cat', exact: true }).click();
  await page.getByRole('button', { name: 'Peach background' }).click();
  await page.getByRole('combobox', { name: 'Celebration style' }).click();
  await page
    .getByRole('option', { name: 'Quiet: a simple check and points' })
    .click();
  await page
    .getByRole('checkbox', { name: 'Play a soft completion chime' })
    .check();
  await page.screenshot({
    path: 'test-results/avatar-picker.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.reload();
  await expect(member.getByRole('img', { name: 'Cat avatar' })).toHaveClass(
    /avatar-color-peach/,
  );
  await page.getByRole('link', { name: 'Medications', exact: true }).click();
  await page
    .getByRole('button', { name: 'Add medication', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: 'Family member', exact: true })
    .click();
  await page.getByRole('option', { name: 'Test Child', exact: true }).click();
  await page.getByLabel('Medication name, parent view').fill('Demo Vitamin');
  await page.getByLabel('Display name on kiosk').fill('My Vitamin');
  await page.getByLabel('Dose text', { exact: true }).fill('1 demo tablet');
  await page
    .getByLabel('Instructions', { exact: true })
    .fill('Demo instruction');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'My Vitamin', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Schedules', exact: true }).click();
  await page.getByRole('button', { name: 'Add schedule', exact: true }).click();
  await page.getByRole('combobox', { name: 'Medication', exact: true }).click();
  await page
    .getByRole('option', { name: 'Test Child · My Vitamin', exact: true })
    .click();
  await page.getByLabel('Reminder time').fill('00:01');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'My Vitamin', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(
    page.locator('.overdue-card').filter({ hasText: 'Test Child' }),
  ).toContainText('My Vitamin');
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('My Vitamin');
});

test('a reward requires parent confirmation and subtracts points', async ({
  page,
}) => {
  await page.goto('/admin/rewards');
  await page.getByLabel('PIN', { exact: true }).fill('246810');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Add reward', exact: true }).click();
  await page.getByLabel('Reward name').fill('Movie choice');
  await page.getByLabel('Point cost').fill('3');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Movie choice', exact: true }),
  ).toBeVisible();
  await page.goto(`/kiosk/profile/${childId}/rewards`);
  await expect(page.getByText('5 points', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Choose reward', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Confirm Movie choice' }),
  ).toBeVisible();
  await page.getByLabel('PIN', { exact: true }).fill('246810');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Movie choice is yours.' }),
  ).toBeVisible();
  await expect(page.getByText('2 points', { exact: true })).toBeVisible();
});

test('PWA is installable and caches no private API responses', async ({
  page,
  context,
}) => {
  await page.goto('/kiosk');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Your family' }),
  ).toBeVisible();
  const manifest = await (
    await page.request.get('/manifest.webmanifest')
  ).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toHaveLength(2);
  const cdp = await context.newCDPSession(page);
  const installability = await cdp.send('Page.getInstallabilityErrors');
  expect(installability.installabilityErrors).toEqual([]);
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys())
      for (const request of await (await caches.open(key)).keys())
        urls.push(request.url);
    return urls;
  });
  expect(cached.length).toBeGreaterThan(3);
  expect(cached.some((url) => url.includes('/api/'))).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByText(
      'Cannot reach your household server. Check the local connection and try again.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'I TOOK IT' })).toHaveCount(0);
  await context.setOffline(false);
});
test('core kiosk needs no external Internet services', async ({ page }) => {
  const external: string[] = [];
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') {
      external.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto('/kiosk');
  await expect(
    page.getByRole('heading', { name: 'Your family' }),
  ).toBeVisible();
  await page.locator(`a[href="/kiosk/profile/${childId}"]`).click();
  await expect(
    page.getByRole('heading', { name: 'You’re all done.' }),
  ).toBeVisible();
  expect(external).toEqual([]);
});

test('returning to the kiosk locks parent controls', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel('PIN', { exact: true }).fill('246810');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('link', { name: 'Open kiosk', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your family' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Parent settings' }).click();
  await expect(
    page.getByRole('heading', { name: 'Parent sign-in' }),
  ).toBeVisible();
});

test('multiple medicines advance one at a time without an early daily bonus', async ({
  page,
  playwright,
}) => {
  const api = await playwright.request.newContext({
    baseURL: 'http://127.0.0.1:3101',
    extraHTTPHeaders: { 'x-family-client': '1' },
  });
  const adult = (await (await api.get('/api/auth/adults')).json())[0];
  await api.post('/api/auth/login', {
    data: { userId: adult.id, pin: '246810' },
  });
  const child = (
    await (
      await api.post('/api/admin/users', {
        data: {
          name: 'Two routines',
          displayName: 'Two routines',
          role: 'CHILD',
        },
      })
    ).json()
  ).id;
  for (const name of ['First demo', 'Second demo']) {
    const medicationId = (
      await (
        await api.post('/api/admin/medications', {
          data: {
            userId: child,
            name,
            displayName: name,
            doseDisplay: '1 demo tablet',
          },
        })
      ).json()
    ).id;
    await api.post('/api/admin/schedules', {
      data: {
        medicationId,
        scheduleType: 'MORNING',
        timeOfDay: '00:01',
        startDate: new Date().toISOString().slice(0, 10),
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      },
    });
  }
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto(`/kiosk/profile/${child}`);
  await expect(
    page.getByRole('button', { name: 'I TOOK IT', exact: true }),
  ).toBeVisible();
  const primary = await page
    .getByRole('button', { name: 'I TOOK IT', exact: true })
    .boundingBox();
  expect(primary!.y + primary!.height).toBeLessThanOrEqual(600);
  await page.getByRole('button', { name: 'I TOOK IT', exact: true }).click();
  await expect(page.getByText('+2 points', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'All done for today!' }),
  ).toHaveCount(0);
  await expect(page.locator('.completion-balance strong')).toHaveCSS(
    'opacity',
    '1',
  );
  await page.screenshot({
    path: 'test-results/medicine-celebration.png',
    fullPage: true,
  });
  await expect(
    page.getByRole('button', { name: 'I TOOK IT', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'I TOOK IT', exact: true }).click();
  await expect(page.getByText('+5 points', { exact: true })).toBeVisible();
  await expect(page.getByText('+3 daily bonus', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'All done for today!' }),
  ).toBeVisible();
  await expect(page.locator('.completion-balance strong')).toHaveCSS(
    'opacity',
    '1',
  );
  await page.screenshot({
    path: 'test-results/daily-celebration.png',
    fullPage: true,
  });
  const back = await page
    .getByRole('button', { name: 'Back home', exact: true })
    .boundingBox();
  expect(back!.y + back!.height).toBeLessThanOrEqual(600);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.celebration-particles')).toBeHidden();
  await expect(page.locator('.earned')).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Back home', exact: true }).click();
  await expect(page).toHaveURL(/\/kiosk$/);
  await expect(page.locator(`a[href="/kiosk/profile/${child}"]`)).toContainText(
    'All done',
  );
  await api.dispose();
});

test('app menus use themed DOM controls and support keyboard dismissal', async ({
  page,
}) => {
  await page.goto('/kiosk');
  await page.getByRole('heading', { name: /Good/ }).click({ button: 'right' });
  await expect(page.getByRole('menu', { name: 'App menu' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.getByRole('link', { name: 'Parent settings' }).click();
  const adult = page.getByRole('combobox', { name: 'Adult', exact: true });
  await adult.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.screenshot({ path: 'test-results/themed-menu.png' });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(adult).toBeFocused();
  await expect(page.locator('select, datalist')).toHaveCount(0);
});

test('schedule prerequisites do not look like an endless loading operation', async ({
  page,
}) => {
  await page.goto('/admin');
  await page.getByLabel('PIN', { exact: true }).fill('246810');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.route('**/api/admin', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({
      response,
      json: { ...data, medications: [], schedules: [] },
    });
  });
  await page.getByRole('link', { name: 'Schedules', exact: true }).click();
  await page.reload();
  const add = page.getByRole('button', { name: 'Add schedule', exact: true });
  await expect(add).toBeDisabled();
  await expect(add).not.toHaveCSS('cursor', 'wait');
  await expect(
    page.getByRole('link', { name: 'Add a medication', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Add a medication', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/medications$/);
});

test('adult kiosk opens without a PIN and shows tiled member history', async ({
  page,
}) => {
  await page.goto('/kiosk');
  await page
    .getByRole('link')
    .filter({ has: page.getByRole('heading', { name: 'Parent', exact: true }) })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Your medicine history' }),
  ).toBeVisible();
  await expect(page.locator('.history-tile')).toHaveCount(7);
  await page.screenshot({
    path: 'test-results/kiosk-history.png',
    fullPage: true,
  });
  await page.goto('/admin');
  await expect(page.getByLabel('PIN', { exact: true })).toBeVisible();
});

test('as-needed medicines record use in kiosk history without points or daily completion', async ({
  page,
  playwright,
}) => {
  const api = await playwright.request.newContext({
    baseURL: 'http://127.0.0.1:3101',
    extraHTTPHeaders: { 'x-family-client': '1' },
  });
  const adult = (await (await api.get('/api/auth/adults')).json())[0];
  await api.post('/api/auth/login', {
    data: { userId: adult.id, pin: '246810' },
  });
  const user = (
    await (
      await api.post('/api/admin/users', {
        data: {
          name: 'As needed demo',
          displayName: 'As needed demo',
          role: 'CHILD',
        },
      })
    ).json()
  ).id;
  await api.post('/api/admin/medications', {
    data: {
      userId: user,
      name: 'Demo inhaler',
      displayName: 'My as-needed medicine',
      doseDisplay: 'Prescribed amount',
      instructions: 'Follow your prescribed instructions.',
      usageType: 'AS_NEEDED',
    },
  });
  await page.goto(`/kiosk/profile/${user}`);
  await expect(
    page.getByRole('heading', { name: 'As needed', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Record use', exact: true }).click();
  await page.getByLabel('Amount used').fill('Demo amount used');
  await page
    .getByRole('button', { name: 'Record use now', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Use recorded' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Your medicine history' }),
  ).toContainText('My as-needed medicine · As needed');
  await expect(
    page.getByRole('region', { name: 'Your medicine history' }),
  ).toContainText('Demo amount used');
  await expect(page.locator('.points-link')).toContainText('0 points');
  await expect(page.locator('.completion')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/as-needed.png', fullPage: true });
  await api.dispose();
});

test('device alert and sound controls persist without requesting push permission', async ({
  page,
}) => {
  await page.goto('/kiosk');
  await page.getByRole('button', { name: 'Alerts and sounds' }).click();
  await expect(
    page.getByRole('heading', { name: 'Alerts & sounds' }),
  ).toBeVisible();
  await page.getByLabel('Medicine success & reward sounds').check();
  await page.getByLabel('Reminder chime while open').check();
  await page.getByRole('button', { name: 'Try celebration' }).click();
  await page.getByRole('button', { name: 'Try reminder' }).click();
  await page.screenshot({
    path: 'test-results/alerts-sounds.png',
    fullPage: true,
  });
  await page.reload();
  await page.getByRole('button', { name: 'Alerts and sounds' }).click();
  await expect(
    page.getByLabel('Medicine success & reward sounds'),
  ).toBeChecked();
  await expect(page.getByLabel('Reminder chime while open')).toBeChecked();
  await expect(
    page.getByRole('button', { name: 'Enable notifications' }),
  ).toBeVisible();
});
