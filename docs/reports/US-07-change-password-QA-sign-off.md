# US-07 Change Password — Final QA Sign-Off

## Document information

| Field | Value |
|---|---|
| Document date | 2026-09-23 |
| Feature / user story | US-07 Change Password (In-App) |
| Project | Final Project Bootcamp Automation - Change Password (In-App) |
| QA Engineer | Resti Noor Fahmi |
| AgentQ Project ID | `307bf74e-9d6a-429a-a5ba-e8452ece5549` |
| Test run | Change Password (In-App) (1) |
| Test Run ID | `823e6fe8-fa10-42cb-bc2c-ff5e012e7071` |
| QA recommendation | **NOT RECOMMENDED FOR RELEASE** |
| Evidence basis | Completed execution cycle; no new execution for this document |

Source documents:

- [Final Defect Report](../defects/US-07-change-password-defect-report.md)
- [Final Test Execution Summary](US-07-change-password-test-execution-summary.md)

This document records the evidence-based QA recommendation. It does not attest to a personal signature or a release approval. No tests were rerun, and no AgentQ records, test cases, test data, defect report, or execution summary were changed to prepare it.

## Feature / scope

The reviewed scope is CP-001–CP-029: in-app password-change UI, required-field validation, notifications, authentication/access protection, session behavior, API contracts, password composition and length policy, confirmation matching, and optional-special-character/same-password scenarios.

CP-001–013 cover web behavior; CP-014–029 cover API behavior. AgentQ Expected Results, including the RFC requirements reflected in those definitions, provide the acceptance basis. Completed processing of all cases does not imply that all acceptance criteria passed or all downstream behaviors were reached.

## Test environment

| Item | Recorded value |
|---|---|
| AgentQ environment | `stagiing` (recorded spelling) |
| UI host | `https://www.emra.chat` |
| API host | `https://api.emra.chat` |
| Change Password page | `/settings/privacy` |
| Expected endpoint | `POST /api/v1/auth/change_password` |
| Execution host | Local Windows / PowerShell |
| Web execution | Playwright Chromium, headed |
| API execution | Playwright tests with existing native-fetch transport |
| Configuration | Sequential; `workers=1`, `retries=0` |
| Release / build | Release `001`; build not recorded |

The environment label alone does not establish the deployment tier of these hosts. Browser version and backend build were not recorded in the source reports. Captured evidence was sanitized; HTTP results were supplemented with independent password-state checks and recovery verification.

## Test execution summary

| Metric | Final result |
|---|---:|
| Total | 29 |
| Passed | 7 |
| Failed | 21 |
| Blocked | 0 |
| Skipped | 1 |
| Untested | 0 |
| Processed | 29/29 |

| Disposition | Test cases |
|---|---|
| Passed | CP-013, CP-015, CP-019, CP-020, CP-021, CP-022, CP-027 |
| Failed | CP-001–004, CP-006–012, CP-014, CP-016–018, CP-023–026, CP-028, CP-029 |
| Skipped | CP-005 |

Processed includes the skipped case. There are 28 non-skipped outcomes, not 29 fully executed and validated scenarios. Blocked = 0 is the final case-status count; it does not mean there are no prerequisite-related coverage gaps.

CP-027's final status is Passed after its assertion was corrected from exact equality to the AgentQ contains requirement. Its isolated rerun verified HTTP 422, success=false, the required error substring, and ORIGINAL_ACTIVE. This corrected result supersedes the prior automation failure; CP-027 is not a product defect. That rerun occurred before preparation of this document.

## Defect summary D1–D5

Severity and Open status below are taken from the existing defect report.

| ID | Area | Severity | Defect / evidence summary | Related cases | Status |
|---|---|---|---|---|---|
| D1 | FE | High | UI uses reset-password endpoint/payload instead of change-password contract; HTTP 422, Reset token is required. | CP-001, CP-006–012 | Open |
| D2 | FE | Medium | Generic required-field toast replaces field-specific inline errors. Submission is prevented. | CP-002–004 | Open |
| D3 | FE | Medium | UI replaces the API error with a misleading message to check the current password. | CP-010 | Open |
| D4 | BE | High | HTTP 500/INTERNAL_ERROR is returned although different submitted passwords become active; recovery responses have the same inconsistency. | CP-014, CP-016–018, CP-023–026, CP-028 | Open |
| D5 | BE | High | Password composition and 8–50 character length requirements are not enforced; noncompliant candidates become active. | CP-016–018, CP-025–026 | Open |

The 21 failed cases are consolidated into five defects, not 21 independent bugs. CP-010 overlaps D1/D3; CP-016–018 and CP-025–026 overlap D4/D5. Grouping is based on observed behavior; precise internal causes require engineering investigation.

CP-029 is recorded separately within D4: its same-password request returns HTTP 500 instead of acceptance. Original credentials remain valid, but mutation/internal rewrite cannot be proven when submitted and original values are identical.

## Outstanding risks

- **Core user flow unavailable:** D1 prevents successful in-app password changes and prevents reaching subsequent success-dependent behavior.
- **Response/state inconsistency:** D4 can leave users believing a change failed while their old password no longer authenticates, creating account-access and retry risks.
- **Security policy bypass:** D5 allows passwords lacking required composition or outside permitted lengths to become active.
- **Misleading validation and messaging:** D2/D3 reduce clarity and can direct users toward an incorrect remedy.
- **Recovery limitations:** some restoration requests returned HTTP 500. The helper reported that original credentials were verified but the recovery response was not confirmed. Independent subsequent login established ORIGINAL_ACTIVE in the recorded executions; the error was not evidence of an UNKNOWN final state. This is historical verification, not a new live account check.
- **Incomplete assurance:** passing access and validation checks do not establish overall release readiness while the above defects and coverage gaps remain.

## CP-005 requirement clarification

CP-005 remains Skipped because objective strength-indicator samples and expected transitions were not defined. No Weak/Medium/Strong thresholds were invented. This is a requirement clarification and coverage gap, not a product defect.

The requirement owner should define observable acceptance examples and expected indicator transitions. QA can then execute the clarified case and record its result. Until then, strength-indicator correctness is not signed off.

## Known coverage limitations

1. CP-006–009 and CP-011–012 failed at the password-change prerequisite caused by D1. Post-success session retention, field clearing, page retention, success-message propagation, new-password login, and old-password rejection were **not fully validated**.
2. The existing web matcher omitted reset_password and reported No Change Password response observed. Separate observer evidence established the actual request and product failure; the matcher error alone is not the defect evidence.
3. CP-005 was intentionally not executed against invented criteria.
4. CP-029 cannot distinguish same-value persistence from no internal rewrite through credential validation alone.
5. This conclusion is limited to the recorded environment and completed cases. It does not establish compatibility, performance, or security coverage beyond that evidence, nor results on a future fixed build.

## QA sign-off decision

**NOT RECOMMENDED FOR RELEASE while High-severity D1, D4, and D5 remain Open.**

The execution cycle is processed at 29/29, but the feature has not met release acceptance. The evidence shows an unusable UI flow, inconsistent backend response/persisted state, and missing password-policy enforcement. D2 and D3 also remain Open, and CP-005 plus the success-dependent scenarios leave coverage incomplete.

This is a negative release recommendation for the current evidence baseline. It is not a claim that all failed cases represent separate defects, and it is not approval of downstream behavior that was never reached.

## Conditions required before release

1. Fix D1, D4, and D5 and obtain QA verification and closure on an identified candidate build. Successful responses must match persisted state; rejected requests must preserve the original password.
2. Resolve and verify D2/D3, or document an explicit disposition and acceptance of any remaining risk by the responsible release owner. Neither is implicitly waived by this document.
3. Resolve CP-005 acceptance criteria and complete its testing, or obtain an explicit documented scope decision; do not represent it as validated while it remains skipped.
4. Complete the previously unreached post-success scenarios and the regression scope below. Record fresh sanitized evidence, final case dispositions, and independent password-state/recovery verification.
5. Update the execution/defect records after verification and obtain a new QA review. This recommendation remains negative until the High-severity defects are closed and release criteria are reassessed.

## Recommended retest / regression scope

These are future recommendations only; no tests were executed for this document.

| Focus | Cases | Required verification |
|---|---|---|
| Correct UI request and completed user flow | CP-001, CP-006–012 | Correct endpoint/payload; successful change; then independently validate session, cleared fields, page retention, API-derived notifications, new-password login, and old-password rejection. |
| Inline validation and error presentation | CP-002–004, CP-010 | Field-specific errors, no prohibited submission, and faithful API error display. |
| API success and state consistency | CP-014, CP-023–024, CP-028–029 | Expected acceptance/response, correct resulting credentials, same-password acceptance, and reliable recovery. |
| Policy enforcement and no mutation on rejection | CP-016–018, CP-025–026 | Required rejection status/error, unchanged password independently verified, both composition and length boundaries. |
| Previously passing security/validation regression | CP-013, CP-015, CP-019–022, CP-027 | Access protection, missing/invalid authentication separately, incorrect current password, required fields, confirmation checks; preserve CP-027 contains semantics. |
| Clarified strength indicator | CP-005 | Defined samples and transitions, without invented thresholds. |

Observe all relevant auth traffic rather than only the expected endpoint. Verify ORIGINAL_ACTIVE after each case and recover known changes; stop on UNKNOWN. After targeted verification, complete the full CP-001–029 regression on the candidate build with CP-005's disposition explicitly recorded.

## Sign-off

| Role | Name | Date | Status |
|---|---|---|---|
| QA Engineer | Resti Noor Fahmi | 2026-09-23 (document date) | **NOT RECOMMENDED FOR RELEASE** — High-severity D1, D4, D5 Open |

QA Engineer acknowledgment/signature: ____________________  
Acknowledgment date: ____________________

The named sign-off section is prepared for acknowledgment. No personal signature or release approval is asserted by creation of this document.
