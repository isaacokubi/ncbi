# NCBI-CMS architecture and delivery boundaries

## Architecture
The repository is an npm-workspaces MERN monorepo:
- `client/`: React + Vite responsive browser application.
- `server/`: Express REST API, Mongoose models and middleware.
- MongoDB is the system of record. The API is the only trusted path to protected data.

## Organisation and tenancy
Organisations form a parent-child tree with the levels international, national, regional, district and branch. The hierarchy is configurable rather than hard-coded to one constitution. Each user is assigned an organisation and role. Ordinary workspace endpoints scope records to that organisation. Cross-branch oversight must be implemented as an explicit, permission-checked capability; never trust a client-supplied organisation ID as authority.

## Security baseline
- Password hashes are never returned by API serializers.
- JWT secret is mandatory and must be a high-entropy secret of at least 32 characters.
- Login is rate-limited; Helmet is enabled; JSON payload size is bounded.
- No public self-registration or default administrator credentials.
- Finance records have explicit workflow states. Only confirmed income is included in dashboard totals.
- Pastoral/counselling and child-protection data require separate, narrowly scoped permissions before those modules are released.
- Audit events, MFA, refresh-token rotation, field-level encryption, consent records, retention and backup verification are required before production.

## Initial domain models
Organisation, User, Member, Attendance and FinanceTransaction are introduced as a base. Unique attendance constraints reduce accidental duplicate check-ins. Financial amounts use Decimal128, and unapproved transactions are not counted as confirmed income.

## Delivery roadmap
1. Foundation: monorepo, authentication, organisation hierarchy, shell dashboard.
2. Core administration: branch lifecycle, members, visitors, transfers, attendance.
3. Finance: chart of accounts, budgets, vouchers, approval matrix, receipts, reconciliation, immutable audit.
4. Ministry operations: departments, events, pastoral care, missions, discipleship and service planning.
5. Resources: people/leadership, assets, property, projects, document archive and communications.
6. Member experience: member portal, public website, mobile clients and offline-safe non-financial workflows.
7. Assurance: migration, accessibility, performance, security testing, disaster recovery and pilot rollout.

## Important implementation note
Dashboard figures and programme entries currently shown in the browser are illustrative design data, not live church records. Replace them with API-backed metrics after verified NCBI data and role scopes are configured. Do not represent sample figures as actual institutional statistics.
