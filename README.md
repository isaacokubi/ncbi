# NCBI Church Management System

NCBI-CMS is a MERN monorepo for New Church Believers International. It is designed for configurable international, national, regional, district and branch administration.

## Stack
- MongoDB + Mongoose, Express + Node.js, React + Vite
- JWT authentication and bcrypt password hashing
- Recharts/Lucide for reporting and interface components

## Run locally
1. Use Node.js 20+ and MongoDB 7+.
2. Copy `server/.env.example` to `server/.env`; set a MongoDB URI and a random JWT secret (32+ characters).
3. Run `npm install`, then `npm run dev`.
4. Client: http://localhost:5173; API health: http://localhost:5000/api/health.
5. Sign in with an administrator provisioned through the one-time bootstrap procedure below; there is no public registration.

The React client uses `VITE_API_URL` when set; otherwise it calls `/api`. Vite proxies `/api` to `http://localhost:5000` during development (override with `API_PROXY_TARGET`); production deployments must provide a same-origin reverse proxy or set `VITE_API_URL`. The dashboard obtains its KPIs, upcoming events and organisation directory from authenticated API endpoints. The reporting workspace reads consolidated trend and branch-performance data from the reporting API. The public NCBI website reads only active branch details and records explicitly published with public visibility. Member accounts can be linked to a member profile and use a restricted self-service portal for attendance, branch events, registrations and public notices. Several advanced capabilities remain explicitly gated in the implementation status document.

There is intentionally no public sign-up route and no default administrator. Provision the first administrator once from a trusted terminal after setting the required variables in `server/.env`: `BOOTSTRAP_NAME`, `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD` (at least 6 characters), `BOOTSTRAP_ORG_NAME` and `BOOTSTRAP_ORG_CODE`. Optional variables are `BOOTSTRAP_COUNTRY` and `BOOTSTRAP_CURRENCY`. Then run `npm run bootstrap-admin -w server`. The script refuses to overwrite an existing account or organisation and never prints the password. Do not commit `.env` or share bootstrap credentials.

## Implemented API foundations
- `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/workspace/organisations`, branch status transitions
- `GET/POST /api/workspace/members`, authorised membership transfers
- `POST /api/workspace/attendance`, attendance summary
- `GET /api/dashboard/summary` — role-scoped, database-backed KPIs
- `GET /api/reports/overview?months=12&organisation=<id>` — hierarchy-scoped membership and attendance trends, confirmed finance totals by currency, ministry activity and branch comparisons. An optional organisation filter is validated against the caller's accessible subtree.
- `GET /api/reports/overview.csv?months=12&organisation=<id>` — downloads aggregate management indicators as CSV; finance rows include confirmed transactions only, with no personal member or transaction-level details.
- `GET/POST /api/operations/:entity`, `PATCH/DELETE /api/operations/:entity/:id`
- `POST /api/operations/events/:id/register`, `PATCH /api/operations/events/:id/register/cancel`, `GET /api/operations/events/:id/registrations`, `PATCH /api/operations/event-registrations/:id/status`
- `GET/POST /api/finance/transactions`, `POST /api/finance/transactions/:id/decision` (confirmation posts a balanced journal to the general ledger)
- `GET/POST /api/accounting/accounts` (including standard NCBI chart provisioning), `GET/POST /api/accounting/journals`, `GET/POST /api/accounting/budgets`, `GET/POST /api/accounting/reconciliations`
- `/api/payments/mpesa/stk-push` and secret-protected Daraja callback; credentials and deployed callback URL are required for live collections
- `GET/POST /api/workspace/users`, `PATCH /api/workspace/users/:id/status` (role-hierarchy constrained user administration)
- `POST /api/operations/attendance/qr-session`, `POST /api/operations/attendance/qr-checkin` (10-minute signed, organisation-bound QR attendance sessions; duplicate-safe member check-in)
- `GET/POST /api/operations/safeguarding/consents`, `PATCH /api/operations/safeguarding/consents/:id/revoke` (restricted minor consent capture and immutable revocation history)

Event registration supports authenticated self-service, duplicate-safe submissions, cancellation/re-registration, and leadership-managed registration status. Member accounts can only list their own registration records; the leadership register is role-restricted. Operations entities include departments, events and event registrations, visitor follow-ups, pastoral and prayer records, missions, church planting, discipleship, small groups, children/youth/family ministry programmes, baptisms, weddings, funerals, benevolence, service plans, leadership appointments, assets, property, facilities, inventory, procurement, projects, documents, communications, media, transport, compliance, volunteers, training and ministry reports. Sensitive pastoral, prayer, benevolence, discipline and counselling records are role-gated and private by default; field-level encryption and specialist safeguarding workflows are still required before real sensitive data is stored. Sensitive pastoral records are separately role-gated. Finance entries are submitted first; creator self-approval is prohibited and only confirmed transactions contribute to totals.

## Attendance controls

Attendance submissions are validated before persistence: activity names, dates, category values, member identifiers and visitor names are checked and normalised. A submission must identify either one registered member or one visitor, and a registered member must belong to the exact organisation selected for the attendance record. Attendance history is indexed by organisation and date for the paginated register.

## Security and delivery notes
Organisation scopes are resolved server-side from the hierarchy; client-supplied organisation IDs are never accepted without checking the user's permitted subtree. Financial values use Decimal128. Sensitive pastoral data should undergo a privacy impact assessment and field-level access review before production. This codebase is an implementation baseline, not a claim of production certification.

Run `npm run check` and `npm run build` before deployment. Integration, migration, backup/restore, security, accessibility and user acceptance testing remain required.
