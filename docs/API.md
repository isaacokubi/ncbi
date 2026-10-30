# API outline

All workspace endpoints except health and login require `Authorization: Bearer <JWT>`.

## Authentication
- `POST /api/auth/login` — email/password; returns short-lived JWT and safe user profile.
- `GET /api/auth/me` — current active account.
- `POST /api/auth/change-password` — verifies the current password, enforces a 6-character minimum, changes the password and revokes all existing JWT sessions.
- `POST /api/auth/logout-all` — increments the server-side token version to invalidate all previously issued access tokens; the action is written to the audit log.
- `GET/POST /api/workspace/users` — scoped user directory and role-controlled account provisioning.
- `PATCH /api/workspace/users/:id/status` — activate or deactivate a lower-privilege account.

## Organisation and people
- `GET /api/workspace/organisations` — organisations in the user's permitted scope.
- `POST /api/workspace/organisations` — create a child at the next valid hierarchy level.
- `PATCH /api/workspace/organisations/:id/status` — approve/activate, suspend or archive.
- `GET/POST /api/workspace/members` — list and register members.
- `POST /api/workspace/members/:id/transfer` — transfer a member with history.
- `POST /api/workspace/members/:id/convert` — convert a visitor to `new_believer` or `member`, allocate a branch-sequenced membership number and write an audit event.
- `POST /api/workspace/users` accepts optional `memberProfile` for a member-role account; the profile must belong to the selected organisation and cannot already be linked to another account.
- `POST /api/workspace/attendance` — record a member or visitor attendance.
- `GET /api/workspace/attendance` — scoped paginated attendance register.
- `GET /api/workspace/attendance/summary` — scoped attendance/member/confirmed-income summary.
- `PATCH /api/workspace/members/:id` — update an authorised member profile.

## Public website
- `GET /api/public/content` — active branch directory, future public events and published public announcements. Only records explicitly marked with `visibility: public` are exposed; no member, finance or pastoral data is returned.

## Member portal
- `GET /api/portal/summary` — for member-role accounts linked to a member profile; returns only that profile, its attendance, the account's own event registrations, upcoming branch events and organisation-wide branch announcements.

## Reporting
- `GET /api/reports/overview?months=12&organisation=<optional-id>` — returns membership and attendance trends, confirmed finance totals by currency, ministry activity counts and branch comparisons. Months are limited to 3–24. Any organisation filter must be inside the caller's authorised hierarchy. This is an operational report, not an audited financial statement.

## Dashboard
- `GET /api/dashboard/summary` — scoped counts, confirmed income/expenses by currency, pending records and upcoming events.

## Operations records
Supported entity keys: `department`, `event`, `pastoral_case`, `prayer_request`, `mission`, `discipleship_course`, `service_plan`, `leadership_appointment`, `asset`, `project`, `document`, `visitor_follow_up`, `announcement`, `volunteer`, `training`, `property`.
- `GET /api/operations/:entity?page=1&limit=25&status=active&search=...`
- `POST /api/operations/:entity`
- `PATCH /api/operations/:entity/:id`
- `DELETE /api/operations/:entity/:id` — soft archive.
- `GET /api/operations/audit/logs` — scoped recent audit entries.

A record accepts `title`, optional `organisation`, `reference`, `status`, `startAt`, `endAt`, `assignedTo`, `visibility` and a JSON object `data` (maximum 30 KB). The API validates organisation scope on create and derives scope on reads/updates. Pastoral cases and prayer requests are restricted and cannot be organisation-wide.

## Private document files
- `GET /api/documents/:id/files` — lists metadata and version history for an authorised document record.
- `POST /api/documents/:id/files` — uploads a new version as a raw `application/octet-stream` request body with `X-File-Name` and `X-File-Type` headers. Maximum size is 10 MiB; accepted types are PDF, JPEG, PNG, WebP, DOCX and XLSX. File signatures are checked and SHA-256 checksums are recorded.
- `GET /api/documents/files/:fileId/download` — authenticated attachment download; organisation scope and document status are rechecked for every request.

Set `DOCUMENT_STORAGE_DIR` to an absolute path on a private persistent disk outside the public web root. Files are not exposed as static URLs. Document management is limited to management roles within their organisation scope. Uploads create append-only version records; prior versions remain available. Malware scanning, content disarm/reconstruction, retention automation and external object-storage replication are not included and must be added before accepting high-risk files.

## Finance
- `GET /api/finance/transactions`
- `POST /api/finance/transactions` — creates a submitted entry, not confirmed income.
- `POST /api/finance/transactions/:id/decision` with `decision`: approve, reject, confirm or void.

Only separate authorised approvers can approve a submitted transaction. Confirmation requires prior approval. No unverified transaction contributes to dashboard totals.

## Accounting
- `GET/POST /api/accounting/accounts` — chart of accounts; `POST /api/accounting/accounts/seed-defaults` installs the idempotent standard NCBI chart without overwriting existing account codes. `PATCH /api/accounting/accounts/:id/status` toggles an account.
- `GET/POST /api/accounting/journals` — submit a balanced double-entry journal.
- `POST /api/accounting/journals/:id/post` — independent approver posts a submitted journal; creator self-posting is blocked.
- `POST /api/accounting/journals/:id/reject` — independent approver rejects a submitted journal.
- `GET/POST /api/accounting/budgets` — expense budgets by account and fiscal period.
- `GET/POST /api/accounting/reconciliations` — record statement balances; `POST /api/accounting/reconciliations/:id/reconcile` compares statement balance with posted ledger activity.

All accounting endpoints require authentication, finance roles and server-derived organisation scope. Journal entries require equal positive debits and credits and active accounts belonging to the same organisation.

## M-Pesa collections
- `POST /api/payments/mpesa/stk-push` — authenticated STK push request; requires finance role, scoped asset and income accounts, and configured Daraja credentials.
- `GET /api/payments/mpesa/payments` and `GET /api/payments/mpesa/payments/:id` — scoped payment status.
- `POST /api/payments/mpesa/callback/:secret` — public Safaricom callback protected by a high-entropy callback path secret. Matching successful callbacks create a confirmed finance transaction and balanced posted journal once.

Set `MPESA_ENV`, consumer key/secret, shortcode, passkey, callback URL and a random callback secret of at least 32 characters. The callback URL must be public HTTPS and end in `/api/payments/mpesa/callback/<MPESA_CALLBACK_SECRET>`. M-Pesa requests are not live until Safaricom credentials and the deployed callback URL have been configured and verified.


## Child safeguarding consent
- `GET /api/operations/safeguarding/consents?child=<memberId>&status=active|revoked` — restricted to senior pastoral roles or users explicitly granted `safeguarding:manage`. Returns effective status, including expired consent.
- `POST /api/operations/safeguarding/consents` — captures guardian identity/contact, confirmed guardian authority, one or more consent purposes, optional expiry, and authorised collection persons when that purpose is selected. The child must be a registered minor in the caller's organisation scope.
- `PATCH /api/operations/safeguarding/consents/:id/revoke` — requires a reason and preserves the original record with revocation actor/time.

## QR attendance
- `POST /api/operations/attendance/qr-session` — attendance officers create a signed QR session for an activity, category, organisation and date. The returned token expires in 10 minutes.
- `POST /api/operations/attendance/qr-checkin` — authenticated users submit the session token and member ID. Members may only check in their own linked profile; staff must have access to the token's organisation. Repeated scans return the existing attendance record.


## Member self-service profile
- `GET /api/portal/summary` — returns the authenticated member's linked profile, own attendance history and totals, own event registrations, upcoming branch events and branch announcements.
- `PATCH /api/portal/profile` — members may update only their own phone, residential location and emergency-contact details. Sign-in email is read-only in this workflow. The server derives the member profile from the authenticated account; membership identity, status, branch and ministry assignments cannot be changed through this endpoint.


## Role-based operations access
The generic operations register is available to senior, district and branch management roles within their server-derived organisation scope. Department leaders receive read-only access to department, event, discipleship-course and service-plan records. Member accounts use the dedicated member portal and event-registration endpoints; treasurers use finance and accounting endpoints. Other roles are denied access to the generic operations register. Sensitive pastoral records retain additional role restrictions.


## Member self-service (expanded)
- `GET /api/portal/summary` includes giving only for `FinanceTransaction` records explicitly linked to the authenticated member profile and in `confirmed` income state. Existing unlinked records are intentionally excluded.
- `GET /api/portal/giving/:id/receipt` returns a private printable HTML receipt only when the transaction is confirmed income linked to that member; browser print can save it as PDF.
- `POST /api/portal/prayer-requests` creates a private member-owned prayer request, assigned to the member's assigned pastor where one exists. Prayer text is excluded from audit summaries.
- `POST /api/portal/enrolments` accepts `programmeId` and `programmeType` (`small_group` or `discipleship_course`); duplicate submissions are idempotent.
- `PATCH /api/portal/notifications/:id/read` marks only a notification addressed to the authenticated account as read.
- Member documents are listed only when a document record has an exact `data.memberId` match. Active private file versions are downloadable through authenticated member-specific routes after branch, assignment and checksum verification.


## Member portal delivery controls
- Pastoral prayer-request follow-up is managed through the dedicated follow-up route; the portal exposes only the short member-visible update, not internal pastoral notes.
- The Documents register allows a manager to assign a document to a member profile before uploading files. Only the exact assigned member account can download its private file versions.
- The Member Notifications workspace resolves the selected member to one active portal account and sends an in-app notification. This is not an email/SMS provider integration.


## Public website CMS
- `GET /api/public/content` returns only active branches, explicitly public upcoming events, active public announcements and the currently published public website copy. Website copy is returned as `siteContent.pages`, `siteContent.navigation` and `siteContent.footer`.
- `GET /api/site-content` requires an authenticated super_admin or national_admin account and returns the editable global website content document.
- `PUT /api/site-content` requires an authenticated super_admin or national_admin account. Send `{ content: { pages, navigation, footer } }`. Only the supported public page keys are accepted and the complete content payload is limited to 100 KB. The API never accepts HTML for execution; public copy is rendered as ordinary React text.
- `PUT /api/branding/logo` remains the separate authorised logo replacement endpoint. Public branch, event and announcement records continue to be managed in their respective workspaces rather than duplicated in the CMS.
