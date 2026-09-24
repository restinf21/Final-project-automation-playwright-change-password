import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loginApi, verifyCredentials } from '../../helpers/auth';
import { withPasswordRecovery, type RecoveryAccount } from '../../helpers/password-recovery';
import { API_BASE_URL } from '../../helpers/config';

type AccountKey = 'api_success' | 'api_validation' | 'api_boundary' | 'api_negative' | 'api_policy';
interface TestData {
  accounts: Record<AccountKey, RecoveryAccount>;
  passwords: Record<string, string>;
  temporary_passwords: Record<string, string>;
  authentication_data: { invalid_token: string };
}
interface Scenario {
  id: number;
  account: RecoveryAccount;
  data: TestData;
  candidate: string;
}
interface ApiResult { status: number; body?: Record<string, unknown> }
const endpoint = new URL('/api/v1/auth/change_password', API_BASE_URL).href;
const mutationCases = new Set([14, 23, 24, 28, 29]);
const candidateFixtures: Record<number, string> = {
  15: 'valid_new_password',
  16: 'no_uppercase',
  17: 'no_lowercase',
  18: 'no_number',
  19: 'valid_new_password',
  20: 'valid_new_password',
  21: 'empty_password',
  22: 'valid_new_password',
  23: 'exactly_8_chars',
  24: 'exactly_50_chars',
  25: 'less_than_8_chars',
  26: 'more_than_50_chars',
  27: 'mismatch_new_password',
  28: 'without_special_character',
};

function accountKey(id: number): AccountKey {
  if (id === 14) return 'api_success';
  if (id <= 22) return 'api_validation';
  if (id <= 24) return 'api_boundary';
  if (id <= 27) return 'api_negative';
  return 'api_policy';
}

// No account data is read and no authentication occurs during --list.
// The separate fixture budget covers baseline authentication and finally cleanup.
const test = base.extend<{ scenario: Scenario }>({
  scenario: [async ({}, use, testInfo) => {
    let data: TestData;
    try { data = JSON.parse(readFileSync(resolve(__dirname, '../../data/user.json'), 'utf8').replace(/^\uFEFF/, '')); }
    catch { throw new Error('Unable to load API test data'); }
    const id = Number(testInfo.title.match(/^CP-(\d{3})/)?.[1]);
    if (!Number.isInteger(id) || id < 14 || id > 29) throw new Error('Invalid API case identifier');
    const account = data.accounts[accountKey(id)];
    const candidate = id === 14 ? data.temporary_passwords['CP-014']
      : id === 29 ? account.original_password : data.passwords[candidateFixtures[id]];
    if (typeof account?.email !== 'string' || typeof account?.original_password !== 'string' ||
        typeof candidate !== 'string') throw new Error('Required account or password fixture is missing');
    if (id !== 29 && candidate === account.original_password) {
      throw new Error('Scenario candidate must differ from original password');
    }
    await withPasswordRecovery(account, candidate, mutationCases.has(id), async () => {
      await use({ id, account, data, candidate });
    });
  }, { timeout: 120_000 }],
});

test.setTimeout(90_000);
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

/** Request transport only. Authentication and recovery stay in existing helpers. */
async function send(
  scenario: Scenario,
  options: {
    current?: string;
    confirmation?: string;
    authentication?: 'valid' | 'missing' | 'invalid';
  } = {},
): Promise<ApiResult> {
  const mode = options.authentication ?? 'valid';
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (mode !== 'missing') {
    const token = mode === 'invalid' ? scenario.data.authentication_data.invalid_token
      : await loginApi({ email: scenario.account.email, password: scenario.account.original_password });
    if (typeof token !== 'string' || !token) throw new Error('Required authentication input is missing');
    headers.Authorization = 'Bearer ' + token;
  }
  try {
    // Native fetch keeps request bodies/headers out of Playwright API call reports.
    // One request, no cookie jar, token persistence, retries, or redirect following.
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user: {
        current_password: options.current ?? scenario.account.original_password,
        new_password: scenario.candidate,
        password_confirmation: options.confirmation ?? scenario.candidate,
      } }),
      credentials: 'omit', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const body: unknown = await response.json().catch(() => undefined);
    return {
      status: response.status,
      body: body !== null && typeof body === 'object' && !Array.isArray(body)
        ? body as Record<string, unknown> : undefined,
    };
  } catch {
    // Never expose fetch exceptions, headers, credentials, or response bodies.
    throw new Error('Change Password request could not be completed; cleanup will inspect account state');
  }
}

function hasExactError(value: unknown, expected: string): boolean {
  if (typeof value === 'string') return value === expected;
  if (Array.isArray(value)) return value.some(item => hasExactError(item, expected));
  return !!value && typeof value === 'object' &&
    Object.values(value).some(item => hasExactError(item, expected));
}

function assertExactRejection(result: ApiResult, error: string): void {
  expect(result.status, 'Documented rejection status').toBe(422);
  expect(result.body?.success === false, 'Documented success=false').toBe(true);
  expect(hasExactError(result.body?.errors, error), 'Documented error entry is present').toBe(true);
}

function assertRejected(result: ApiResult): void {
  // No exact status specified by these AgentQ cases. A server outage is not validation.
  expect(result.status >= 400 && result.status < 500, 'Request is rejected with a client error').toBe(true);
  if (result.body && Object.prototype.hasOwnProperty.call(result.body, 'success')) {
    expect(result.body.success === false, 'Rejection does not claim success').toBe(true);
  }
}

async function assertAccepted(result: ApiResult, scenario: Scenario): Promise<void> {
  expect(result.status >= 200 && result.status < 300, 'Password change is accepted').toBe(true);
  if (result.body && Object.prototype.hasOwnProperty.call(result.body, 'success')) {
    expect(result.body.success === true, 'Accepted response does not report failure').toBe(true);
  }
  expect(await verifyCredentials(scenario.account.email, scenario.candidate),
    'Submitted password authenticates before cleanup').toBe('VALID');
}

function composition(password: string): boolean {
  return /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
}

test('CP-014 - API successfully changes password using valid request', async ({ scenario }) => {
  expect(composition(scenario.candidate) && scenario.candidate.length >= 8 &&
    scenario.candidate.length <= 50, 'Valid deterministic mutation fixture').toBe(true);
  const result = await send(scenario);
  expect(result.status).toBe(200);
  expect(result.body?.success === true).toBe(true);
  expect(result.body?.message === 'Password changed successfully', 'Exact AgentQ success message').toBe(true);
  await assertAccepted(result, scenario);
});

test('CP-015 - API rejects incorrect Current Password', async ({ scenario }) => {
  assertExactRejection(await send(scenario, {
    current: scenario.data.passwords.incorrect_current_password,
  }), 'Current password is incorrect');
});

test('CP-016 - API rejects New Password without uppercase letter', async ({ scenario }) => {
  expect(!/[A-Z]/.test(scenario.candidate) && /[a-z]/.test(scenario.candidate) &&
    /[0-9]/.test(scenario.candidate) && scenario.candidate.length >= 8 &&
    scenario.candidate.length <= 50, 'Only uppercase requirement is violated').toBe(true);
  assertExactRejection(await send(scenario), 'Password is too weak');
});

test('CP-017 - API rejects New Password without lowercase letter', async ({ scenario }) => {
  expect(!/[a-z]/.test(scenario.candidate) && /[A-Z]/.test(scenario.candidate) &&
    /[0-9]/.test(scenario.candidate) && scenario.candidate.length >= 8 &&
    scenario.candidate.length <= 50, 'Only lowercase requirement is violated').toBe(true);
  assertExactRejection(await send(scenario), 'Password is too weak');
});

test('CP-018 - API rejects New Password without number', async ({ scenario }) => {
  expect(!/[0-9]/.test(scenario.candidate) && /[A-Z]/.test(scenario.candidate) &&
    /[a-z]/.test(scenario.candidate) && scenario.candidate.length >= 8 &&
    scenario.candidate.length <= 50, 'Only number requirement is violated').toBe(true);
  assertExactRejection(await send(scenario), 'Password is too weak');
});

test('CP-019 - API rejects unauthenticated Change Password request', async ({ scenario }) => {
  for (const authentication of ['missing', 'invalid'] as const) {
    await test.step(authentication === 'missing' ? 'Missing Authorization' : 'Invalid Bearer token', async () => {
      assertRejected(await send(scenario, { authentication }));
      // Stop before the next subscenario if this request unexpectedly mutated state.
      // Fixture finally still recovers the one submitted candidate and fails.
      expect(await verifyCredentials(scenario.account.email, scenario.account.original_password),
        'Original credentials remain valid after unauthenticated request').toBe('VALID');
    });
  }
});

test('CP-020 - API rejects empty Current Password', async ({ scenario }) => {
  const result = await send(scenario, { current: scenario.data.passwords.empty_password });
  assertRejected(result);
  expect(hasExactError(result.body?.errors, 'Current password is required'),
    'Documented required-current-password error').toBe(true);
});

test('CP-021 - API rejects empty New Password', async ({ scenario }) => {
  expect(scenario.candidate.length === 0, 'New-password fixture is empty').toBe(true);
  const result = await send(scenario);
  assertRejected(result);
  expect(hasExactError(result.body?.errors, 'New password is required'),
    'Documented required-new-password error').toBe(true);
});

test('CP-022 - API validates empty Password Confirmation', async ({ scenario }) => {
  const result = await send(scenario, { confirmation: scenario.data.passwords.empty_password });
  assertRejected(result);
  // AgentQ/RFC does not specify an exact status or backend error text.
});

test('CP-023 - API accepts New Password with exactly 8 characters', async ({ scenario }) => {
  expect(scenario.candidate.length === 8 && composition(scenario.candidate),
    'Eight-character boundary satisfies composition').toBe(true);
  await assertAccepted(await send(scenario), scenario);
});

test('CP-024 - API accepts New Password with exactly 50 characters', async ({ scenario }) => {
  expect(scenario.candidate.length === 50 && composition(scenario.candidate),
    'Fifty-character boundary satisfies composition').toBe(true);
  await assertAccepted(await send(scenario), scenario);
});

test('CP-025 - API rejects New Password shorter than 8 characters', async ({ scenario }) => {
  expect(scenario.candidate.length === 7 && composition(scenario.candidate),
    'Seven-character fixture violates only length').toBe(true);
  assertExactRejection(await send(scenario), 'Password is too short (minimum is 8 characters)');
});

test('CP-026 - API rejects New Password longer than 50 characters', async ({ scenario }) => {
  expect(scenario.candidate.length === 51 && composition(scenario.candidate),
    'Fifty-one-character fixture violates only length').toBe(true);
  assertExactRejection(await send(scenario), 'Password is too long (maximum is 50 characters)');
});

test('CP-027 - API rejects mismatched Password Confirmation', async ({ scenario }) => {
  const confirmation = scenario.data.passwords.mismatch_confirmation;
  expect(typeof confirmation === 'string' && confirmation !== scenario.candidate,
    'Confirmation differs from submitted new password').toBe(true);
  const result = await send(scenario, { confirmation });
  expect(result.status, 'Documented rejection status').toBe(422);
  expect(result.body?.success === false, 'Documented success=false').toBe(true);
  const containsConfirmationError = (value: unknown): boolean => {
    if (typeof value === 'string') return value.includes("Password confirmation doesn't match");
    if (Array.isArray(value)) return value.some(containsConfirmationError);
    return !!value && typeof value === 'object' &&
      Object.values(value).some(containsConfirmationError);
  };
  expect(containsConfirmationError(result.body?.errors),
    'Documented confirmation error is contained in API errors').toBe(true);
});

test('CP-028 - API accepts valid New Password without special character', async ({ scenario }) => {
  expect(composition(scenario.candidate) && /^[A-Za-z0-9]+$/.test(scenario.candidate) &&
    scenario.candidate.length >= 8 && scenario.candidate.length <= 50,
    'Valid password without a special character').toBe(true);
  await assertAccepted(await send(scenario), scenario);
});

test('CP-029 - API accepts New Password equal to Current Password', async ({ scenario }) => {
  expect(scenario.candidate === scenario.account.original_password,
    'All three request fields use the original password').toBe(true);
  expect(composition(scenario.candidate) && scenario.candidate.length >= 8 &&
    scenario.candidate.length <= 50, 'Original password meets applicable policy').toBe(true);
  await assertAccepted(await send(scenario), scenario);
  // Recovery checks ORIGINAL_ACTIVE; the password value never intentionally changes.
});
