# NCBI-CMS implementation status

This document distinguishes working code from planned work. A module is not production-ready merely because a navigation item or model exists.

## Implemented in this delivery
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
- Reusable operational records for departments, events, pastoral cases, prayer requests, missions, discipleship, service plans, leadership appointments, assets, projects, documents, visitor follow-ups, announcements, volunteers, training and property.
- Audit log entries for operational record create/update/archive and finance state decisions.
- Finance submission and approval/confirmation state transitions; creator cannot approve own entry.
- Dashboard summary derived from MongoDB, with income and expenses restricted to confirmed transactions.
- Sensitive pastoral entities have narrower role access and default private visibility.

## Not yet production-complete
- Bank feeds, electronic receipts, tax handling and multi-stage approval matrices. The manual bank reconciliation tool does not import statements or connect to a bank feed.
- Full visitor conversion workflow, QR attendance, member self-service, child safeguarding and consent management.
- Encrypted pastoral notes, granular case assignments and field-level access controls.
- SMS/email/WhatsApp provider integrations and delivery receipts.
- Event registration/ticketing, QR check-in, venue/resource conflict checking and certificate generation; event records are available, but the complete registration workflow remains to be built.
- Missions field reporting, discipleship lesson delivery and assessments.
- Asset depreciation, maintenance and disposal approvals; project procurement and milestone financial controls.
- Document malware scanning, immutable retention, versioning and external object storage.
- MFA, refresh-token rotation/revocation, password reset, session management, formal audit immutability and alerting.
- Mobile apps, offline sync, public website, data migration tooling and multilingual/multi-currency reporting.
- Dedicated member/parent portals, safeguarding case management, encrypted counselling notes and child/guardian consent workflows. Generic operations records are not a substitute for these specialist controls.
- Automated integration/e2e/security/performance tests and verified backup/restore drills.

## Production gate
Do not load real member, child, counselling or financial records until NCBI has approved data ownership, privacy notices, lawful basis/consent where required, access roles, retention schedules, incident procedures, backup controls and a pilot acceptance plan. Complete a Kenya Data Protection Act assessment and obtain legal/privacy review for the actual processing.
