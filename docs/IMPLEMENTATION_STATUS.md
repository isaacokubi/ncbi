# NCBI-CMS implementation status

This document distinguishes working code from planned work. A module is not production-ready merely because a navigation item or model exists.

## Implemented in this delivery
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
- Finance general ledger, chart of accounts, double-entry posting, budgets, bank reconciliation, payment gateway callbacks, receipts and multi-person approval matrices.
- Full visitor conversion workflow, QR attendance, member self-service, child safeguarding and consent management.
- Encrypted pastoral notes, granular case assignments and field-level access controls.
- SMS/email/WhatsApp provider integrations and delivery receipts.
- Event registration, ticketing, venue/resource conflict checking and certificates.
- Missions field reporting, discipleship lesson delivery and assessments.
- Asset depreciation, maintenance and disposal approvals; project procurement and milestone financial controls.
- Document malware scanning, immutable retention, versioning and external object storage.
- MFA, refresh-token rotation/revocation, password reset, session management, formal audit immutability and alerting.
- Mobile apps, offline sync, public website, data migration tooling and multilingual/multi-currency reporting.
- Automated integration/e2e/security/performance tests and verified backup/restore drills.

## Production gate
Do not load real member, child, counselling or financial records until NCBI has approved data ownership, privacy notices, lawful basis/consent where required, access roles, retention schedules, incident procedures, backup controls and a pilot acceptance plan. Complete a Kenya Data Protection Act assessment and obtain legal/privacy review for the actual processing.
