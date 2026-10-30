# API outline

All workspace endpoints except health and login require `Authorization: Bearer <JWT>`.

## Authentication
- `POST /api/auth/login` — email/password; returns short-lived JWT and safe user profile.
- `GET /api/auth/me` — current active account.
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
