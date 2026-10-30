# NCBI-CMS implementation status

This document distinguishes working code from planned work. A module is not production-ready merely because a navigation item or model exists.

## Implemented in this delivery
- Consolidated reporting API (`GET /api/reports/overview`) with validated hierarchy scope, 3–24 month membership and attendance trends, confirmed finance totals grouped by currency, ministry activity counts and branch comparison. Unconfirmed financial entries are excluded.
- React sign-in against the API, authenticated session restoration, sign-out and role-scoped live dashboard KPIs/events/organisation directory.
- Client loading, empty, retry and API error states; no illustrative dashboard figures are represented as live data.
- Database-backed registers and create/update/archive workflows for members, visitor follow-up, attendance, events and event registrations, departments, missions, church planting, discipleship, small groups, children/youth/family ministry programmes, baptisms, weddings, funerals, benevolence, service plans, leadership appointments, assets, property, facilities, inventory, procurement, projects, documents, communications, media, transport, compliance, volunteers, training, ministry reports and other operations.
- Scoped user administration with role hierarchy checks, account activation/deactivation and one-time temporary passwords.
- Finance transaction entry with separate approval/confirmation controls; confirming a transaction creates its corresponding balanced posted journal entry using validated organisation-specific debit and credit accounts.
- Daraja M-Pesa STK Push request, secret-protected callback handling, callback amount/phone validation and idempotent confirmed finance transaction plus balanced ledger posting. Live use requires NCBI's approved Safaricom credentials and a deployed public HTTPS callback URL.
- Chart of accounts, balanced double-entry journal submission and independent posting, expense budgets and bank statement reconciliation APIs and client workspaces. Bank reconciliation compares posted ledger activity with the entered statement balance; it does not import bank statements or connect to a bank feed.
- GitHub Actions CI workflow for server syntax/tests and client production build.
- Hierarchical organisation creation with parent-level validation and pending/active/suspended/archived lifecycle.
- Server-derived organisation subtree scopes for headquarters, national, regional and district oversight.
- Member registration, scoped listing and transfer history.
- Attendance entry with database uniqueness protection for duplicate member check-ins.
- Event self-registration for authenticated members, idempotent duplicate-submit handling, cancellation and re-registration, leadership registration lists, and controlled pending/confirmed/waitlisted/cancelled status transitions. Attendee contact details are limited to the attendee and authorised leaders.
- Reusable operational records for departments, events, pastoral cases, prayer requests, missions, discipleship, service plans, leadership appointments, assets, projects, documents, visitor follow-ups, announcements, volunteers, training and property.
- Audit log entries for operational record create/update/archive and finance state decisions.
- Finance submission and approval/confirmation state transitions; creator cannot approve own entry.
- Dashboard summary derived from MongoDB, with income and expenses restricted to confirmed transactions.
- Sensitive pastoral entities have narrower role access and default private visibility.

## Not yet production-complete
- Bank feeds, electronic receipts, tax handling and multi-stage approval matrices. The manual bank reconciliation tool does not import statements or connect to a bank feed.
- Visitor conversion now promotes a scoped visitor to new believer or member, assigns a branch-sequenced membership number, preserves the original record and writes an audit event.
- Member portal API exposes only an administrator-linked member profile, that member's attendance, the member's own event registrations, upcoming branch events and organisation-wide branch announcements. User provisioning validates member-profile ownership and prevents linking one profile to multiple accounts. QR attendance, broader member self-service, child safeguarding and consent management remain outstanding.
- Encrypted pastoral notes, granular case assignments and field-level access controls.
- SMS/email/WhatsApp provider integrations and delivery receipts; the public site currently displays only records explicitly marked public.
- QR attendance check-in, venue/resource conflict checking and certificate generation remain outstanding. Event registration supports authenticated self-service, duplicate-safe submissions, cancellation/re-registration and leadership-managed statuses.
- Missions field reporting, discipleship lesson delivery and assessments.
- Asset depreciation, maintenance and disposal approvals; project procurement and milestone financial controls.
- Document malware scanning, immutable retention, versioning and external object storage.
- MFA, refresh-token rotation/revocation, password reset, session management, formal audit immutability and alerting.
- Mobile apps, offline sync, public website, data migration tooling and multilingual/multi-currency reporting.
- Parent/guardian portal, safeguarding case management, encrypted counselling notes and child/guardian consent workflows. Generic operations records are not a substitute for these specialist controls.
- Automated integration/e2e/security/performance tests and verified backup/restore drills.

## Production gate
Do not load real member, child, counselling or financial records until NCBI has approved data ownership, privacy notices, lawful basis/consent where required, access roles, retention schedules, incident procedures, backup controls and a pilot acceptance plan. Complete a Kenya Data Protection Act assessment and obtain legal/privacy review for the actual processing.


## Reporting API contract
`GET /api/reports/overview?months=12&organisation=<optional-id>` returns:
- `scope`: accessible organisation unit and active branch counts.
- `totals`: confirmed income and expense by currency, plus confirmed transaction counts.
- `trend`: month-keyed new member registrations, attendance records and finance totals.
- `ministryActivity`: non-archived operational record counts by entity.
- `branchPerformance`: up to 30 accessible branches with current member and attendance-record counts.

The optional organisation filter is rejected unless it belongs to the authenticated user's server-derived organisation scope. This endpoint is an operational management report, not an audited financial statement. Financial values are included only for transactions whose state is `confirmed`.


## Database index migration
The member-number uniqueness rule now uses a partial index so a branch can register multiple visitors before membership numbers are assigned. A second partial unique index guarantees that one member profile is linked to at most one portal account. Before deploying this schema change to an existing database, back up MongoDB and run `npm run migrate-member-indexes -w server` with the production `MONGODB_URI`. The migration is idempotent; resolve any duplicate linked profiles before running it.


## Child safeguarding consent workflow
A dedicated safeguarding-consent API records explicit guardian authority, purpose-specific consent (participation, photography, public media publication, emergency medical care, authorised collection and off-site travel), authorised collection contacts, and a bounded validity period. Consent capture is restricted to verified members under 18 in the caller's organisation scope. Only senior pastoral roles or users with the explicit safeguarding:manage permission can read, create or revoke records. Consent records are immutable after capture; withdrawal is recorded as a revocation with actor, timestamp and reason, preserving history. Audit entries omit guardian contact details. This workflow is a technical control, not a substitute for NCBI-approved safeguarding policy, identity verification, staff vetting or legal review.


## QR attendance API
Attendance officers can issue a signed, organisation-bound QR session token for a named activity. Tokens use HS256 with issuer/audience/purpose validation and expire after ten minutes. Member check-in verifies the token, organisation access and active member status, records checkInMethod=qr, and relies on the attendance uniqueness constraint to make repeated or concurrent scans idempotent. QR tokens are not reusable as login credentials. A camera/scanner UI and end-to-end device testing remain outstanding; the API is ready for that client integration.
