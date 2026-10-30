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

The React client uses `VITE_API_URL` when set; otherwise it calls `/api`. Vite proxies `/api` to `http://localhost:5000` during development (override with `API_PROXY_TARGET`); production deployments must provide a same-origin reverse proxy or set `VITE_API_URL`. The dashboard obtains its KPIs, upcoming events and organisation directory from authenticated API endpoints. Other navigation modules are not yet complete data-entry screens.

There is intentionally no public sign-up route and no default administrator. Provision the first administrator once from a trusted terminal after setting the required variables in `server/.env`: `BOOTSTRAP_NAME`, `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD` (14+ characters), `BOOTSTRAP_ORG_NAME` and `BOOTSTRAP_ORG_CODE`. Optional variables are `BOOTSTRAP_COUNTRY` and `BOOTSTRAP_CURRENCY`. Then run `npm run bootstrap-admin -w server`. The script refuses to overwrite an existing account or organisation and never prints the password. Do not commit `.env` or share bootstrap credentials.

## Implemented API foundations
- `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/workspace/organisations`, branch status transitions
- `GET/POST /api/workspace/members`, authorised membership transfers
- `POST /api/workspace/attendance`, attendance summary
- `GET /api/dashboard/summary` — role-scoped, database-backed KPIs
- `GET/POST /api/operations/:entity`, `PATCH/DELETE /api/operations/:entity/:id`
- `GET/POST /api/finance/transactions`, `POST /api/finance/transactions/:id/decision` (confirmation posts a balanced journal to the general ledger)\n- `GET/POST /api/accounting/accounts`, `GET/POST /api/accounting/journals`, `GET/POST /api/accounting/budgets`, `GET/POST /api/accounting/reconciliations`\n- `GET/POST /api/workspace/users`, `PATCH /api/workspace/users/:id/status` (role-hierarchy constrained user administration)

Operations entities include departments, events and event registrations, visitor follow-ups, pastoral and prayer records, missions, church planting, discipleship, small groups, children/youth/family ministry programmes, baptisms, weddings, funerals, benevolence, service plans, leadership appointments, assets, property, facilities, inventory, procurement, projects, documents, communications, media, transport, compliance, volunteers, training and ministry reports. Sensitive pastoral, prayer, benevolence, discipline and counselling records are role-gated and private by default; field-level encryption and specialist safeguarding workflows are still required before real sensitive data is stored. Sensitive pastoral records are separately role-gated. Finance entries are submitted first; creator self-approval is prohibited and only confirmed transactions contribute to totals.

## Security and delivery notes
Organisation scopes are resolved server-side from the hierarchy; client-supplied organisation IDs are never accepted without checking the user's permitted subtree. Financial values use Decimal128. Sensitive pastoral data should undergo a privacy impact assessment and field-level access review before production. This codebase is an implementation baseline, not a claim of production certification.

Run `npm run check` and `npm run build` before deployment. Integration, migration, backup/restore, security, accessibility and user acceptance testing remain required.
