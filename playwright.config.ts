import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './helpers/config';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/change-password.spec.ts', '**/api/change-password.api.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  // Stop before another account mutation after an assertion or recovery failure.
  maxFailures: 1,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    // Authentication and password inputs must not appear in artifacts.
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
