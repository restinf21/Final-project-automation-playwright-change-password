import { test as base, expect, type Browser, type Page, type Request, type Response } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loginWeb, verifyCredentials, verifyWebLogin } from '../helpers/auth';
import { withPasswordRecovery, type RecoveryAccount } from '../helpers/password-recovery';
import { API_BASE_URL, BASE_URL } from '../helpers/config';
import { LoginPage } from '../pages/login.page';
import { ChangePasswordPage } from '../pages/change-password.page';

interface TestData {
  accounts: { web: RecoveryAccount };
  passwords: Record<string, string>;
  temporary_passwords: Record<string, string>;
  authentication_data: { invalid_token: string };
  strength_indicator: { status: string; samples: unknown[]; reason: string };
}
interface Scenario { account: RecoveryAccount; data: TestData; candidate: string }
const mutationCases = new Set(['CP-001', 'CP-006', 'CP-007', 'CP-008', 'CP-009', 'CP-011', 'CP-012']);
const changeURL = new URL('/api/v1/auth/change_password', API_BASE_URL).href;
const loginURL = new URL('/api/v1/auth/login', API_BASE_URL).href;
const privacyURL = new URL('/settings/privacy', BASE_URL).href;
const successMessage = 'Password changed successfully';
const incorrectMessage = 'Current password is incorrect';

// Lazy loading: --list never reads credentials or authenticates.
// This fixture's separate timeout reserves time for cleanup after a test timeout.
const test = base.extend<{ scenario: Scenario }>({
  scenario: [async ({}, use, testInfo) => {
    let data: TestData;
    try { data = JSON.parse(readFileSync(resolve(__dirname, '../data/user.json'), 'utf8').replace(/^\uFEFF/, '')); }
    catch { throw new Error('Unable to load Change Password test data'); }
    const id = testInfo.title.match(/^CP-\d{3}/)?.[0];
    if (!id) throw new Error('Missing CP identifier');
    const account = data.accounts.web;
    const mutates = mutationCases.has(id);
    const candidate = mutates ? data.temporary_passwords[id]
      : ['CP-003', 'CP-005', 'CP-013'].includes(id) ? data.passwords.empty_password
      : data.passwords.valid_new_password;
    if (typeof candidate !== 'string' || typeof account?.email !== 'string' ||
        typeof account?.original_password !== 'string') throw new Error('Required fixture is missing');
    if (mutates && candidate === account.original_password) throw new Error('Mutation candidate must differ from original');
    await withPasswordRecovery(account, candidate, mutates, async () => {
      await use({ account, data, candidate });
    });
  }, { timeout: 120_000 }],
});

test.setTimeout(90_000);
test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 10_000, navigationTimeout: 15_000 });

async function openForm(page: Page, scenario: Scenario): Promise<ChangePasswordPage> {
  await loginWeb(page, { email: scenario.account.email, password: scenario.account.original_password });
  const form = new ChangePasswordPage(page);
  await form.goto();
  return form;
}

// Observe, never block: a forbidden product request must make the test fail.
// Include the legacy route so an incorrect product endpoint cannot evade detection.
function isPasswordRequest(request: Request): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(request.method()) &&
    /\/(?:change_password|auth\/password)\/?$/.test(new URL(request.url()).pathname);
}

async function captureSubmission(page: Page, submit: () => Promise<void>): Promise<Response> {
  const pending = page.waitForResponse(r => isPasswordRequest(r.request()), { timeout: 15_000 })
    .catch(() => undefined);
  await submit();
  const response = await pending;
  if (!response) throw new Error('No Change Password response observed');
  // Only non-secret scalars reach assertion output.
  expect(response.url() === changeURL, 'Documented Change Password endpoint').toBe(true);
  expect(response.request().method() === 'POST', 'Documented Change Password method').toBe(true);
  return response;
}

async function responseBody(response: Response): Promise<any> {
  try { return await response.json(); }
  catch { throw new Error('Change Password response must be JSON'); }
}

async function successfulChange(page: Page, form: ChangePasswordPage, scenario: Scenario): Promise<any> {
  await form.fill({
    currentPassword: scenario.account.original_password,
    newPassword: scenario.candidate,
    confirmation: scenario.candidate,
  });
  const response = await captureSubmission(page, () => form.submit());
  expect(response.status(), 'Successful Change Password HTTP status').toBe(200);
  const body = await responseBody(response);
  expect(body?.success === true, 'API confirms success').toBe(true);
  return body;
}

async function assertCandidate(scenario: Scenario): Promise<void> {
  expect(await verifyCredentials(scenario.account.email, scenario.candidate), 'Candidate credentials authenticate').toBe('VALID');
}

async function notificationVisible(form: ChangePasswordPage, expectedMessage: string): Promise<void> {
  // Never assert raw API messages or DOM text: they might contain secrets.
  await expect.poll(() => form.notification(expectedMessage).isVisible(),
    { message: 'Required API notification is displayed', timeout: 10_000 }).toBe(true);
}

async function assertExistingSession(page: Page): Promise<void> {
  // Navigate using this exact context; no relogin or API token injection.
  await page.goto(privacyURL);
  const form = new ChangePasswordPage(page);
  await expect.poll(() => form.currentPassword.isVisible(),
    { message: 'Existing session can still access protected functionality' }).toBe(true);
  expect(new URL(page.url()).pathname === '/settings/privacy').toBe(true);
  expect(await page.getByRole('button', { name: 'Sign In', exact: true }).isVisible()).toBe(false);
}

async function assertRequiredField(page: Page, scenario: Scenario, missing: 'current' | 'new' | 'confirmation'): Promise<void> {
  const form = await openForm(page, scenario);
  let sent = 0;
  const observe = (request: Request) => { if (isPasswordRequest(request)) sent++; };
  page.on('request', observe);
  try {
    await form.fill({
      currentPassword: missing === 'current' ? scenario.data.passwords.empty_password : scenario.account.original_password,
      newPassword: missing === 'new' ? scenario.data.passwords.empty_password : scenario.candidate,
      confirmation: missing === 'new' || missing === 'confirmation' ? scenario.data.passwords.empty_password : scenario.candidate,
    });
    await form.submit();
    await expect.poll(() => form.requiredError(missing).isVisible(),
      { message: 'Field-specific inline required validation is visible' }).toBe(true);
    // Bounded quiet window catches async/debounced submissions after validation.
    await page.waitForTimeout(1_000);
    expect(sent, 'Required-field validation prevents all Change Password requests').toBe(0);
    // Fixture teardown separately verifies the original password still works.
  } finally { page.off('request', observe); }
}

async function logoutAndDiscardSession(page: Page): Promise<void> {
  await new LoginPage(page).logout();
  await expect.poll(() => new URL(page.url()).pathname === '/login',
    { message: 'Application logout returns to Login' }).toBe(true);
  await page.context().close();
}

async function inFreshContext(browser: Browser, run: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try { await run(await context.newPage()); }
  finally { await context.close(); }
}

function includesError(value: unknown, expected: string): boolean {
  if (typeof value === 'string') return value.includes(expected);
  if (Array.isArray(value)) return value.some(item => includesError(item, expected));
  return !!value && typeof value === 'object' &&
    Object.values(value).some(item => includesError(item, expected));
}

test('CP-001 - User successfully changes password using valid credentials', async ({ page, scenario }) => {
  const form = await openForm(page, scenario);
  const body = await successfulChange(page, form, scenario);
  expect(body?.message === successMessage, 'Exact AgentQ API success message').toBe(true);
  await notificationVisible(form, successMessage);
  await assertCandidate(scenario);
  await assertExistingSession(page);
});

test('CP-002 - Validate Current Password is required', async ({ page, scenario }) => {
  await assertRequiredField(page, scenario, 'current');
});

test('CP-003 - Validate New Password is required', async ({ page, scenario }) => {
  await assertRequiredField(page, scenario, 'new');
});

test('CP-004 - Validate Confirm New Password is required', async ({ page, scenario }) => {
  await assertRequiredField(page, scenario, 'confirmation');
});

// AgentQ requires visibility and updates across strengths, but supplies no
// samples, expected transitions, or stable indicator contract; data.samples=[].
// Keep the case visible in discovery, explicitly unresolved, never falsely passed.
test.fixme('CP-005 - Verify password strength indicator for New Password', async ({ page, scenario }) => {
  test.info().annotations.push({
    type: 'unresolved',
    description: 'AgentQ must define strength samples/expected updates; confirm an indicator locator. No thresholds or levels are invented.',
  });
  const form = await openForm(page, scenario);
  // Supported setup only. Never submit this non-mutation scenario.
  await form.fill({
    currentPassword: scenario.data.passwords.empty_password,
    newPassword: scenario.data.passwords.valid_new_password,
    confirmation: scenario.data.passwords.empty_password,
  });
});

test('CP-006 - Verify existing session remains active after password change', async ({ page, scenario }) => {
  const form = await openForm(page, scenario);
  await successfulChange(page, form, scenario);
  await assertExistingSession(page);
  await assertCandidate(scenario);
});

test('CP-007 - Verify password fields reset after successful change', async ({ page, scenario }) => {
  const form = await openForm(page, scenario);
  await successfulChange(page, form, scenario);
  for (const input of [form.currentPassword, form.newPassword, form.confirmation]) {
    // toHaveValue would expose a retained password on failure.
    await expect.poll(async () => await input.inputValue() === '',
      { message: 'Password field is cleared after successful change' }).toBe(true);
  }
  await assertCandidate(scenario);
});

test('CP-008 - Verify user remains on Change Password page after success', async ({ page, scenario }) => {
  const form = await openForm(page, scenario);
  await successfulChange(page, form, scenario);
  expect(page.url() === privacyURL, 'Remains on Change Password without navigation').toBe(true);
  expect(await form.currentPassword.isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Sign In', exact: true }).isVisible()).toBe(false);
  await assertCandidate(scenario);
});

test('CP-009 - Verify success notification uses API message', async ({ page, scenario }) => {
  const form = await openForm(page, scenario);
  const body = await successfulChange(page, form, scenario);
  expect(body?.message === successMessage, 'AgentQ API success message is not replaced').toBe(true);
  await notificationVisible(form, successMessage);
  await assertCandidate(scenario);
});

test('CP-010 - Verify incorrect Current Password displays API error', async ({ page, scenario }) => {
  const form = await openForm(page, scenario);
  await form.fill({
    currentPassword: scenario.data.passwords.incorrect_current_password,
    newPassword: scenario.candidate,
    confirmation: scenario.candidate,
  });
  const response = await captureSubmission(page, () => form.submit());
  expect(response.status()).toBe(422);
  const body = await responseBody(response);
  expect(body?.success === false).toBe(true);
  expect(includesError(body?.errors, incorrectMessage), 'API errors contain the AgentQ error').toBe(true);
  await notificationVisible(form, incorrectMessage);
});

test('CP-011 - Verify login succeeds using new password after change', async ({ page, browser, scenario }) => {
  const form = await openForm(page, scenario);
  await successfulChange(page, form, scenario);
  await assertCandidate(scenario);
  await logoutAndDiscardSession(page);
  await inFreshContext(browser, async fresh => {
    await loginWeb(fresh, { email: scenario.account.email, password: scenario.candidate });
    expect(await verifyWebLogin(fresh)).toBe(true);
    await assertExistingSession(fresh);
  });
});

test('CP-012 - Verify old password is rejected after change', async ({ page, browser, scenario }) => {
  const form = await openForm(page, scenario);
  await successfulChange(page, form, scenario);
  await logoutAndDiscardSession(page);
  await inFreshContext(browser, async fresh => {
    const login = new LoginPage(fresh);
    await login.goto();
    const pending = fresh.waitForResponse(r => r.request().method() === 'POST' && r.url() === loginURL,
      { timeout: 15_000 }).catch(() => undefined);
    await login.login({ email: scenario.account.email, password: scenario.account.original_password });
    const response = await pending;
    if (!response) throw new Error('No rejected-login response observed');
    const body = await responseBody(response);
    // Existing authentication contract; AgentQ requires actual rejection.
    expect(response.status()).toBe(401);
    expect(body?.success === false).toBe(true);
    expect(new URL(fresh.url()).pathname === '/login').toBe(true);
    expect(await login.submit.isVisible()).toBe(true);
    // Attempt protected navigation to prove no usable authenticated session.
    await fresh.goto(privacyURL);
    await expect.poll(() => new URL(fresh.url()).pathname === '/login',
      { message: 'Rejected old credentials cannot access protected functionality' }).toBe(true);
    expect(await new ChangePasswordPage(fresh).currentPassword.isVisible()).toBe(false);
  });
});

test('CP-013 - Verify unauthenticated user cannot access Change Password', async ({ browser, scenario }) => {
  // scenario fixture checks original credentials independently using native fetch;
  // it never injects authentication into this fresh browser context.
  await inFreshContext(browser, async fresh => {
    const login = new LoginPage(fresh);
    await login.goto(); // installs secret-safe console handling, without submitting
    let sent = 0;
    const observe = (request: Request) => { if (isPasswordRequest(request)) sent++; };
    fresh.on('request', observe);
    try {
      await fresh.goto(privacyURL);
      const form = new ChangePasswordPage(fresh);
      // Public application evidence redirects protected unauthenticated routes.
      await expect.poll(() => new URL(fresh.url()).pathname === '/login',
        { message: 'Unauthenticated navigation is denied' }).toBe(true);
      expect(await login.submit.isVisible()).toBe(true);
      expect(await form.currentPassword.isVisible()).toBe(false);
      expect(await form.updatePassword.isVisible()).toBe(false);
      await fresh.waitForTimeout(1_000);
      expect(sent, 'Unauthenticated navigation performs no password change').toBe(0);
    } finally { fresh.off('request', observe); }
  });
});
