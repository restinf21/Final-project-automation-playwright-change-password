import type { Locator, Page } from '@playwright/test';
import { BASE_URL } from '../helpers/config';

// Keep secret values out of Playwright fill step titles. Recording stays off.
export async function fillPrivateInput(locator: Locator, value: string): Promise<void> {
  try {
    await locator.waitFor({ state: 'visible' });
    await locator.evaluate((element, text) => {
      if (!(element instanceof HTMLInputElement) || element.disabled || element.readOnly) throw new Error();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) throw new Error();
      element.focus();
      setter.call(element, text);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.blur();
    }, value);
  } catch { throw new Error('Unable to populate authentication field'); }
}

export class LoginPage {
  readonly page: Page;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;

  constructor(page: Page) {
    this.page = page;
    this.email = page.getByRole('textbox', { name: 'Email', exact: true });
    this.password = page.getByLabel('Password', { exact: true });
    this.submit = page.getByRole('button', { name: 'Sign In', exact: true });
  }

  async goto(): Promise<void> {
    // The application logs login responses itself. Suppress console at source.
    await this.page.addInitScript(() => {
      for (const key of ['log', 'info', 'debug', 'warn', 'error', 'trace', 'dir', 'table'] as const) {
        console[key] = () => {};
      }
    });
    await this.page.goto(new URL('/login', BASE_URL).href);
  }

  async login(credentials: { email: string; password: string }): Promise<void> {
    await fillPrivateInput(this.email, credentials.email);
    await fillPrivateInput(this.password, credentials.password);
    try { await this.submit.click(); }
    catch { throw new Error('Unable to submit login'); }
  }

  async logout(): Promise<void> {
    // Confirmed application navigation exposes Logout; do not substitute cookie clearing.
    const action = this.page.getByRole('link', { name: 'Logout', exact: true })
      .or(this.page.getByRole('button', { name: 'Logout', exact: true })).first();
    try { await action.click(); }
    catch { throw new Error('Application Logout control could not be used'); }
  }
}
