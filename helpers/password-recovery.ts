import { loginApi, verifyCredentials } from './auth';
import { API_BASE_URL } from './config';

export type PasswordState = 'ORIGINAL_ACTIVE' | 'TEMPORARY_ACTIVE' | 'UNKNOWN';
export interface RecoveryAccount {
  email: string;
  original_password: string;
}

export async function inspectPasswordState(
  account: RecoveryAccount, candidate: string,
): Promise<PasswordState> {
  const original = await verifyCredentials(account.email, account.original_password);
  if (original === 'VALID') return 'ORIGINAL_ACTIVE';
  // Only an explicit rejection permits trying the one known candidate.
  if (original !== 'INVALID' || !candidate || candidate === account.original_password) return 'UNKNOWN';
  return await verifyCredentials(account.email, candidate) === 'VALID' ? 'TEMPORARY_ACTIVE' : 'UNKNOWN';
}

async function restoreKnownCandidate(account: RecoveryAccount, candidate: string): Promise<void> {
  const token = await loginApi({ email: account.email, password: candidate });
  let success = false;
  try {
    const response = await fetch(new URL('/api/v1/auth/change_password', API_BASE_URL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ user: {
        current_password: candidate,
        new_password: account.original_password,
        password_confirmation: account.original_password,
      } }),
      redirect: 'error', credentials: 'omit', cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();
    success = response.status === 200 && body?.success === true;
  } catch {
    // An uncertain response may still have mutated state. Never resend.
  }
  const verified = await verifyCredentials(account.email, account.original_password);
  if (verified !== 'VALID') throw new Error('Recovery could not confirm original credentials; stop');
  if (!success) throw new Error('Original credentials verified, but recovery response was not confirmed; stop');
}

export async function restoreOriginalPassword(
  account: RecoveryAccount, candidate: string,
): Promise<void> {
  const state = await inspectPasswordState(account, candidate);
  if (state === 'UNKNOWN') throw new Error('Password state UNKNOWN; no recovery attempted');
  if (state === 'TEMPORARY_ACTIVE') await restoreKnownCandidate(account, candidate);
}

/**
 * The callback includes the future test actions AND assertions.
 * finally always checks/restores state, including when those assertions fail.
 * Successful cleanup cannot swallow a callback failure.
 */
export async function withPasswordRecovery<T>(
  account: RecoveryAccount,
  candidate: string,
  expectedMutation: boolean,
  run: () => Promise<T>,
): Promise<T> {
  // Blank/no-submission scenarios verify original only; never guess a replacement.
  if (expectedMutation && !candidate) throw new Error('Supply the exact known candidate password');
  if (await verifyCredentials(account.email, account.original_password) !== 'VALID') {
    throw new Error('Original credentials not confirmed; test must not start');
  }
  try {
    return await run();
  } finally {
    const state = await inspectPasswordState(account, candidate);
    if (state === 'UNKNOWN') throw new Error('Password state UNKNOWN; stop without guessing');
    if (state === 'TEMPORARY_ACTIVE') {
      await restoreKnownCandidate(account, candidate);
      if (!expectedMutation) throw new Error('Unexpected password mutation detected; recovery does not make the test pass');
    }
  }
}
