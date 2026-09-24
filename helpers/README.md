# Change Password foundation

No test cases are implemented. Nothing authenticates or changes passwords at import.

The future caller reads data/user.json and selects its account. Pass
{ email: account.email, password: account.original_password } to loginWeb or
loginApi. Helpers never read or modify account files. loginApi returns a fresh
access token in memory; verifyCredentials returns VALID, INVALID, or
INDETERMINATE without returning tokens.

Wrap future test actions AND assertions inside withPasswordRecovery(account,
exactKnownCandidate, expectedMutation, callback). Its finally verifies the
original first, tries only the known candidate after explicit credential
rejection, restores only a confirmed temporary state, then verifies the
original again. UNKNOWN stops without mutation. An unexpected mutation fails
a non-mutation scenario even after successful cleanup. Callback assertion
failures propagate when cleanup succeeds; a cleanup failure also fails the
run. Do not catch and suppress these failures. Reserve sufficient teardown
time for bounded logins and restoration; a worker crash/forced timeout cannot
guarantee finally cleanup. Never overlap separate runs against the same account.

API contract evidence:
- Public application login code sends flat JSON email/password to
  POST https://api.emra.chat/api/v1/auth/login with application/json.
- Existing related-project helper requires HTTP 200, success=true,
  data.user.active=true, and data.tokens.access_token.
- It recognizes HTTP 401 with success=false as credential rejection.
  Other statuses, malformed bodies, network failures and throttling remain
  INDETERMINATE. These response rules are existing-code evidence, not freshly
  verified server responses.
- Public login code redirects to /home. loginWeb requires both API success
  and that redirect; verifyWebLogin separately checks destination/form absence.
- Change Password route/labels come from the related-project POM. Recovery
  follows AgentQ's POST /api/v1/auth/change_password user payload and documented
  200/success=true response. Product behavior does not override AgentQ results.

Current blocker: browser email-format validation prevented the supplied Web
account from submitting login. No credential value was printed or modified.
No authenticated destination or Change Password locators could be freshly
confirmed. The caller must correct/confirm its own account data before CP-001.
The input setter approach should also be verified in that first authorized run.

Secrets: no helper logging, file writes, token cache, storage-state export,
or request/response attachments. Recording is disabled in Playwright config.
The Login POM suppresses application console output before navigation because
the application itself logs login data. Private input evaluation avoids values
in fill step titles. Keep DEBUG/PWDEBUG/NODE_DEBUG unset, do not enable tracing,
HAR/video/screenshots, and do not add listeners/reporters that capture secrets.
API helpers use native fetch to avoid Playwright request traces. Never log
returned tokens. Browser sessions naturally keep authentication state in
memory; close their contexts, never export storage state.

BASE_URL and API_BASE_URL environment variables override defaults in config.ts.
Run one worker with zero retries; do not override those settings on the CLI.
