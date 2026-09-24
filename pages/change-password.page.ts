import type { Locator, Page } from '@playwright/test';
import { BASE_URL } from '../helpers/config';
import { fillPrivateInput } from './login.page';

export class ChangePasswordPage {
  readonly page: Page;
  readonly currentPassword: Locator;
  readonly newPassword: Locator;
  readonly confirmation: Locator;
  readonly updatePassword: Locator;

  constructor(page: Page) {
    this.page = page;
    // Labels and route reused from the existing related-project POM.
    this.currentPassword = page.getByLabel('Current Password', { exact: true });
    this.newPassword = page.getByLabel('New Password', { exact: true });
    this.confirmation = page.getByLabel('Confirm New Password', { exact: true });
    this.updatePassword = page.getByRole('button', { name: 'Update Password', exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto(new URL('/settings/privacy', BASE_URL).href);
    await this.currentPassword.waitFor({ state: 'visible' });
  }

  async fill(values: { currentPassword: string; newPassword: string; confirmation: string }): Promise<void> {
    await fillPrivateInput(this.currentPassword, values.currentPassword);
    await fillPrivateInput(this.newPassword, values.newPassword);
    await fillPrivateInput(this.confirmation, values.confirmation);
  }

  async submit(): Promise<void> {
    try { await this.updatePassword.click(); }
    catch { throw new Error('Unable to submit password form'); }
  }

  requiredError(field: 'current' | 'new' | 'confirmation'): Locator {
    const labels = { current: 'Current Password', new: 'New Password', confirmation: 'Confirm New Password' };
    // Field-scoped inline validation, never a page-level toast substitute.
    return this.page.locator('label').filter({ hasText: new RegExp('^' + labels[field] + '$') })
      .locator('..').getByText(/required/i);
  }

  notification(message: string): Locator {
    return this.page.locator('[role="alert"], [role="status"], [data-sonner-toast]')
      .getByText(message, { exact: true }).first();
  }
}
