import type { Page } from '@playwright/test';
import { API_BASE_URL, BASE_URL } from './config';
import { LoginPage } from '../pages/login.page';

export interface Credentials { email: string; password: string }
export type CredentialStatus = 'VALID' | 'INVALID' | 'INDETERMINATE';
type LoginResult = { status: 'VALID'; token: string } | { status: 'INVALID' | 'INDETERMINATE' };

function privateDiagnostics(): void {
  if (process.env.DEBUG || process.env.PWDEBUG || process.env.NODE_DEBUG) {
    throw new Error('Disable diagnostic logging before authentication');
  }
}

async function authenticate(credentials: Credentials): Promise<LoginResult> {
  privateDiagnostics();
  try {
    // Native fetch avoids Playwright reports capturing API request secrets.
    const response = await fetch(new URL('/api/v1/auth/login', API_BASE_URL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      redirect: 'error', credentials: 'omit', cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();
    if (response.status === 401 && body?.success === false) return { status: 'INVALID' };
    const token = body?.data?.tokens?.access_token;
    if (response.status === 200 && body?.success === true && body?.data?.user?.active === true &&
        typeof token === 'string' && token.trim().length > 0) return { status: 'VALID', token };
    return { status: 'INDETERMINATE' };
  } catch { return { status: 'INDETERMINATE' }; }
}

export async function loginApi(credentials: Credentials): Promise<string> {
  const result = await authenticate(credentials);
  if (result.status === 'VALID') return result.token;
  throw new Error(result.status === 'INVALID' ? 'Authentication rejected' : 'Authentication could not be confirmed');
}

export async function verifyCredentials(email: string, password: string): Promise<CredentialStatus> {
  return (await authenticate({ email, password })).status;
}

export async function verifyWebLogin(page: Page): Promise<boolean> {
  try {
    await page.waitForURL(new URL('/home', BASE_URL).href, { timeout: 15000 });
    return !await page.getByRole('button', { name: 'Sign In', exact: true }).isVisible();
  } catch { return false; }
}

export async function loginWeb(page: Page, credentials: Credentials): Promise<void> {
  privateDiagnostics();
  try {
    const login = new LoginPage(page);
    await login.goto();
    // The authenticated /home redirect is the web login success contract.
    await login.login(credentials);
    if (!await verifyWebLogin(page)) throw new Error();
  } catch { throw new Error('Web authentication could not be confirmed'); }
}
