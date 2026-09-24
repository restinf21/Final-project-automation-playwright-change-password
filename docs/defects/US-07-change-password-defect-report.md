# US-07 Change Password — Final Defect Report

Date: 2026-09-23  
Project: Final Project Bootcamp Automation - Change Password (In-App)  
AgentQ Project ID: `307bf74e-9d6a-429a-a5ba-e8452ece5549`  
Test Run ID: `823e6fe8-fa10-42cb-bc2c-ff5e012e7071`

## Scope and evidence

This report consolidates completed execution evidence only. No tests were rerun for this report. Severity is a suggested triage assessment; all five defects are Open. Grouping reflects observed common failure patterns, not a proven internal implementation cause.

The existing executions used Playwright with one worker and zero retries; web tests used local headed Chromium, and API tests used the existing native-fetch transport. API host: `https://api.emra.chat`; UI host: `https://www.emra.chat`. The AgentQ environment label is `stagiing`.

Evidence links below point to existing sanitized local artifacts. No credential values, password values, tokens, cookies, or Authorization values are included. Request payloads are described by field names only.

CP-027 is excluded: its contains assertion was corrected and the isolated rerun passed, including independent ORIGINAL_ACTIVE verification ([rerun result](../../.tmp-cp027-contains/CP-027-result.json), [evidence](../../.tmp-cp027-contains/CP-027.jsonl)). CP-005 is an unresolved requirement clarification about strength-indicator samples/transitions, not a product defect.

## D1 — Change Password UI uses reset-password endpoint/payload

- **Defect ID:** D1
- **FE/BE:** FE
- **Severity:** High
- **Related Test Cases:** CP-001, CP-006–CP-012
- **Status:** Open

### Preconditions

An active account is authenticated and viewing `/settings/privacy` (Change Password). Use the existing scenario data; CP-010 uses an incorrect current password.

### Steps to Reproduce

1. Populate Current Password, New Password, and matching confirmation with the existing TC data.
2. Select Update Password.
3. Observe all authentication requests and the response.

### Expected Result

The UI sends `POST /api/v1/auth/change_password` with `user.current_password`, `user.new_password`, and `user.password_confirmation`. Valid requests change the password; an incorrect current password is evaluated by the change-password API.

### Actual Result

The UI sends `POST /api/v1/auth/reset_password` with fields `user`, `user.password`, and `user.password_confirmation`. The current-password field is omitted. The request fails with HTTP 422, `success=false`, and `errors=["Reset token is required"]`.

### Evidence

- [CP-001 diagnostic capture](../../.tmp-cp001-diagnosis/diagnosis.json)
- Independent captures: [CP-006](../../.tmp-cp005-009/CP-006.jsonl), [CP-007](../../.tmp-cp005-009/CP-007.jsonl), [CP-008](../../.tmp-cp005-009/CP-008.jsonl), [CP-009](../../.tmp-cp005-009/CP-009.jsonl), [CP-010](../../.tmp-cp010-013/CP-010.jsonl), [CP-011](../../.tmp-cp010-013/CP-011.jsonl), [CP-012](../../.tmp-cp010-013/CP-012.jsonl).
- The existing web response matcher omitted `reset_password`, producing `No Change Password response observed`; the separate observer captured the actual request.

### Impact

Users cannot complete an in-app password change. CP-006–009 and CP-011–012 fail at this prerequisite: post-success session retention, field clearing, navigation, success notification, and new/old-password login expectations were not evaluated. These are not separate proven defects. The shared endpoint/payload mapping groups these failures under D1; CP-010 also independently demonstrates D3.

## D2 — Required-field validation is not displayed inline

- **Defect ID:** D2
- **FE/BE:** FE
- **Severity:** Medium
- **Related Test Cases:** CP-002–CP-004
- **Status:** Open

### Preconditions

An authenticated user is on the Change Password form.

### Steps to Reproduce

1. Using the existing TC data, leave Current Password empty (CP-002), New Password empty with confirmation empty as applicable (CP-003), or Confirm New Password empty (CP-004).
2. Populate the remaining applicable fields.
3. Select Update Password and inspect the empty field and notifications.

### Expected Result

A field-specific inline validation error identifies each required empty field. Submission is prevented, no password-change request is sent, and the password remains unchanged.

### Actual Result

Only the generic toast `Please fill in all fields` appears. The required field-specific inline errors are absent. Submission prevention works: no change/reset-password request is observed, and the original password remains active.

### Evidence

- [CP-002 UI/network evidence](../../.tmp-required-fields/CP-002-evidence.jsonl)
- [CP-003 UI/network evidence](../../.tmp-required-fields/CP-003.jsonl)
- [CP-004 UI/network evidence](../../.tmp-required-fields/CP-004.jsonl)
- The assertion `Field-specific inline required validation is visible` fails for all three cases. HTTP status for password submission: not applicable; no request sent.

### Impact

Users receive no field-specific guidance for correcting incomplete input. The repeated generic validation presentation is the common failure; this is not an API validation or password-mutation defect.

## D3 — UI replaces API error with misleading custom message

- **Defect ID:** D3
- **FE/BE:** FE
- **Severity:** Medium
- **Related Test Cases:** CP-010
- **Status:** Open

### Preconditions

An authenticated user is on Change Password with the existing incorrect-current-password scenario data.

### Steps to Reproduce

1. Enter the incorrect current password, a valid new password, and matching confirmation.
2. Select Update Password.
3. Compare the API error with the UI toast.

### Expected Result

The change-password API rejects the incorrect current password with HTTP 422, `success=false`, and `Current password is incorrect`. The UI displays the error returned by the API without replacing it with a custom message.

### Actual Result

The actual reset-password request returns `Reset token is required`, but the UI displays `Failed to change password. Please check your current password.` The UI neither preserves the returned error nor accurately explains this failure.

### Evidence

[CP-010 capture](../../.tmp-cp010-013/CP-010.jsonl): `POST /api/v1/auth/reset_password` → HTTP 422, `success=false`, `errors=["Reset token is required"]`; the captured toast differs. Independent final login confirms ORIGINAL_ACTIVE.

### Impact

Users are incorrectly directed to recheck their current password, masking the real API failure. Error presentation is independent of D1 routing: the same CP-010 execution proves both defects. A separate defect in success-message handling is not established because success was never reached.

## D4 — Change Password API returns 500 failure although password may be persisted

- **Defect ID:** D4
- **FE/BE:** BE
- **Severity:** High
- **Related Test Cases:** CP-014, CP-016–CP-018, CP-023–CP-026, CP-028
- **Additional observation:** CP-029, described separately below
- **Status:** Open

### Preconditions

An active account has verified original credentials and valid API authentication. Use each existing TC account and candidate; do not infer mutation from the HTTP status alone.

### Steps to Reproduce

1. Send the existing scenario to `POST /api/v1/auth/change_password` with matching confirmation and fields `user.current_password`, `user.new_password`, and `user.password_confirmation`.
2. Observe the response.
3. Independently verify original credentials; if explicitly rejected, verify the known submitted candidate.
4. Use the existing recovery procedure and verify the original credentials again.

### Expected Result

Valid changes return a successful response (CP-014 specifically requires HTTP 200, `success=true`, and `Password changed successfully`). Invalid policy inputs are rejected without changing the password. The response must accurately reflect the persisted account state.

### Actual Result

The API returns HTTP 500, `success=false`, `errors=["Internal server error"]`, and `error_code=INTERNAL_ERROR`, with no message. In the related different-password scenarios, the original credentials then fail with HTTP 401 while the candidate authenticates with HTTP 200, proving that the password changed despite the failure response.

Recovery requests also return HTTP 500, but a subsequent independent login verifies the original credentials with HTTP 200, `success=true`, `active=true`, and `authenticationConfirmed=true`. The helper reports `Original credentials verified, but recovery response was not confirmed; stop` because the restoration response failed, not because the final state is unknown. Each recorded final state is ORIGINAL_ACTIVE.

### Evidence

Sanitized request/response and authentication sequences:

- [CP-014](../../.tmp-cp014-018/CP-014.jsonl), [CP-016](../../.tmp-cp014-018/CP-016.jsonl), [CP-017](../../.tmp-cp014-018/CP-017.jsonl), [CP-018](../../.tmp-cp014-018/CP-018.jsonl)
- [CP-023](../../.tmp-cp023-026/CP-023.jsonl), [CP-024](../../.tmp-cp023-026/CP-024.jsonl), [CP-025](../../.tmp-cp023-026/CP-025.jsonl), [CP-026](../../.tmp-cp023-026/CP-026.jsonl), [CP-028](../../.tmp-cp027-029/CP-028.jsonl)

**Separate CP-029 observation:** A same-password request also returns HTTP 500/INTERNAL_ERROR, violating its acceptance expectation. Original credentials remain valid. Because submitted and original values are identical, mutation or an internal rewrite cannot be proven. The observer's `recoveryToOriginal=true` denotes value equality in this case; it is not a recovery request. See [CP-029 evidence](../../.tmp-cp027-029/CP-029.jsonl).

### Impact

Users may believe a change failed while their old password no longer works, creating access loss and unsafe retry decisions. Shared response/state inconsistency suggests a common backend failure path; server diagnostics are required to locate its precise cause. CP-016–018 and CP-025–026 also prove D5, independently of this response defect.

## D5 — Password policy is not enforced

- **Defect ID:** D5
- **FE/BE:** BE
- **Severity:** High
- **Related Test Cases:** CP-016–CP-018, CP-025–CP-026
- **Status:** Open

### Preconditions

An active account has verified original credentials and valid API authentication. Existing fixtures violate only the intended composition or length requirement.

### Steps to Reproduce

1. Use the existing candidate missing uppercase (CP-016), lowercase (CP-017), or a number (CP-018), or containing 7 characters (CP-025) or 51 characters (CP-026).
2. Submit `POST /api/v1/auth/change_password` with the valid current password and matching confirmation.
3. Verify account state independently after the response, then recover the original password using the existing procedure.

### Expected Result

All requests return HTTP 422 and `success=false`, preserving the password. Expected errors:

- CP-016–018: `Password is too weak`.
- CP-025: `Password is too short (minimum is 8 characters)`.
- CP-026: `Password is too long (maximum is 50 characters)`.

### Actual Result

Each noncompliant candidate becomes the active password. Responses are HTTP 500, `success=false`, `Internal server error`, and `INTERNAL_ERROR`, rather than the required policy rejection. Original login returns 401 and candidate login returns 200 before recovery. Recovery restores and independently verifies ORIGINAL_ACTIVE.

### Evidence

[CP-016](../../.tmp-cp014-018/CP-016.jsonl), [CP-017](../../.tmp-cp014-018/CP-017.jsonl), [CP-018](../../.tmp-cp014-018/CP-018.jsonl), [CP-025](../../.tmp-cp023-026/CP-025.jsonl), [CP-026](../../.tmp-cp023-026/CP-026.jsonl). Existing fixture assertions confirmed the intended isolated policy violation. Each test failed the expected HTTP 422 assertion; independent authentication proves the policy violation was persisted.

### Impact

Users can set passwords that violate required composition and length constraints. These cases are consolidated as missing enforcement of the declared password policy; whether composition and length share an implementation cause remains unconfirmed. D5 is distinct from D4: correcting the HTTP response alone would not prevent noncompliant passwords from being stored. All five executions prove both defects.
