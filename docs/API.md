# API outline

All workspace endpoints except health and login require `Authorization: Bearer <JWT>`.

## Authentication
- `POST /api/auth/login` — email/password; returns short-lived JWT and safe user profile.
- `GET /api/auth/me` — current active account.

## Organisation and people
- `GET /api/workspace/organisations` — organisations in the user's permitted scope.
- `POST /api/workspace/organisations` — create a child at the next valid hierarchy level.
- `PATCH /api/workspace/organisations/:id/status` — approve/activate, suspend or archive.
- `GET/POST /api/workspace/members` — list and register members.
- `POST /api/workspace/members/:id/transfer` — transfer a member with history.
- `POST /api/workspace/attendance` — record a member or visitor attendance.
- `GET /api/workspace/attendance/summary` — scoped attendance/member/confirmed-income summary.

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
- `GET/POST /api/accounting/accounts` — chart of accounts; `PATCH /api/accounting/accounts/:id/status` toggles an account.
- `GET/POST /api/accounting/journals` — submit a balanced double-entry journal.
- `POST /api/accounting/journals/:id/post` — independent approver posts a submitted journal; creator self-posting is blocked.
- `POST /api/accounting/journals/:id/reject` — independent approver rejects a submitted journal.
- `GET/POST /api/accounting/budgets` — expense budgets by account and fiscal period.
- `GET/POST /api/accounting/reconciliations` — record statement balances; `POST /api/accounting/reconciliations/:id/reconcile` compares statement balance with posted ledger activity.

All accounting endpoints require authentication, finance roles and server-derived organisation scope. Journal entries require equal positive debits and credits and active accounts belonging to the same organisation.
