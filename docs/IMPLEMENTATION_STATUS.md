# NCBI-CMS implementation status

This document distinguishes working code from planned work. A module is not production-ready merely because a navigation item or model exists.

## Implemented in this delivery
- Department-leader dashboard and attendance data are narrowed to attendance records personally recorded by that account; department leaders do not receive executive financial, membership or branch metrics or organisation-wide upcoming-event cards. These rules are enforced in server-side query filters and covered by focused unit tests.
- Consolidated reporting API (`GET /api/reports/overview`) with validated hierarchy scope, 3–24 month membership and attendance trends, confirmed finance totals grouped by currency, ministry activity counts and branch comparison. Unconfirmed financial entries are excluded.
- Aggregate CSV export (`GET /api/reports/overview.csv`) with matching server-derived organisation scope, confirmed-only finance aggregates, no personal member data, no-store headers and spreadsheet-formula neutralisation. Corrected the branch membership `$filter` variable reference.
- React sign-in against the API, authenticated session restoration, sign-out, password change with current-password verification and a six-character minimum, and sign-out-everywhere with server-side JWT version revocation; role-scoped live dashboard KPIs/events/organisation directory.
- Role-specific dashboard presentation for platform, international, national, regional, district, branch, treasury and ministry leadership, with navigation reduced to the modules intended for each role; server authorization remains authoritative.
- Responsive reporting charts for monthly membership registrations, attendance and confirmed income/expenses, with currency selection and the supporting tabular data retained for accessibility and review.
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

- Public account registration is branch-scoped and creates pending member or non-member applications. Branch pastors decide verified member applications for their own branch; branch administrators decide non-member applications for their own branch; national and platform administrators decide non-member applications within their wider authority. These decision boundaries are enforced by a shared policy and automated tests.

## Not yet production-complete
- Bank feeds, electronic receipts, tax handling and multi-stage approval matrices. The manual bank reconciliation tool does not import statements or connect to a bank feed.
- Visitor conversion now promotes a scoped visitor to new believer or member, assigns a branch-sequenced membership number, preserves the original record and writes an audit event.
- Member portal API exposes only an administrator-linked member profile, that member's attendance, the member's own event registrations, upcoming branch events and organisation-wide branch announcements. User provisioning validates member-profile ownership and prevents linking one profile to multiple accounts. Browser QR attendance scanner UI using the native BarcodeDetector API on supported HTTPS browsers, manual signed-token fallback, usher member selection, signed session creation, locally generated QR image and browser print workflow. Broad device/browser compatibility tests and broader member self-service remain outstanding.
- Encrypted pastoral notes, granular case assignments and field-level access controls.
- SMS/email/WhatsApp provider integrations and delivery receipts; the public site currently displays only records explicitly marked public.
- QR attendance session issuance, signed-token check-in, native camera scanner, manual token fallback, local QR image generation and browser print workflow are implemented. Broad browser/device acceptance tests, venue/resource conflict checking and certificate generation remain outstanding. Event registration supports authenticated self-service, duplicate-safe submissions, cancellation/re-registration and leadership-managed statuses.
- Missions field reporting, advanced discipleship content delivery, quizzes, assessments and certificates.
- Asset depreciation, maintenance and disposal approvals; project procurement and milestone financial controls.
- Private authenticated document upload/download, organisation-scoped access, file type/signature checks, checksums, audit entries and append-only version history are implemented. Configure a private persistent storage path. Automated scanning, retention and off-site replication remain future work.
- MFA and password reset flows, per-device refresh-token rotation, formal audit immutability and security alerting remain outstanding. Password changes and explicit sign-out-everywhere increment a server-checked token version, invalidating previously issued JWT sessions; these account-security actions are written to the audit log. Password minimum is six characters across password changes, provisioned accounts, bootstrap and demo seeding.
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
Attendance officers can issue a signed, organisation-bound QR session token for a named activity. Tokens use HS256 with issuer/audience/purpose validation and expire after ten minutes. Member check-in verifies the token, organisation access and active member status. Only attendance officers or the member account linked to the exact member profile may submit a check-in; finance and unrelated roles are denied. It records checkInMethod=qr and relies on the attendance uniqueness constraint to make repeated or concurrent scans idempotent. QR tokens are not reusable as login credentials. A camera/scanner UI with a local QR encoder and browser print workflow is implemented; end-to-end device testing remains outstanding; the API is ready for that client integration.


## Member self-service portal improvements
- Expanded the member portal into a responsive personal workspace with membership identity, branch, contact details, membership status, ministry connections, attendance totals and recent check-ins, upcoming programmes, the member's own event registrations and branch announcements.
- Members can update only their own phone, residential location and emergency-contact fields. The sign-in email remains read-only here so changing a profile contact address cannot silently desynchronise the login identity. The server resolves the member profile from the authenticated account and rejects changes to membership number, status, branch, ministry assignments and other staff-managed fields.
- Portal attendance totals are derived from attendance records attached to the exact linked member profile; no sample or estimated values are shown.
- Giving history and printable receipts, private prayer requests, small-group enrolment requests, approved-course lesson completion, personal in-app notifications and member-specific private document downloads are implemented. External SMS/email/WhatsApp delivery, advanced learning assessments and server-generated PDF receipts remain outstanding.


## Role-based dashboard and operations access review
- Dashboard metrics remain role-filtered: treasurers receive confirmed finance KPIs only; department leaders receive their attendance KPI only; branch administrators receive operational KPIs without finance totals.
- The generic operations read API now enforces role policy server-side. Member accounts cannot enumerate general operational registers, treasurers cannot use generic operations as a route into non-finance records, and department leaders can read only the four operational record types used by their dashboard.
- Management roles retain access subject to organisation scope and additional restrictions for sensitive pastoral and safeguarding data.
- Automated policy tests cover member, treasurer, department leader, branch administrator and senior leadership access boundaries.


## Expanded member self-service delivery
- Member giving history reads only confirmed income transactions with an explicit `member` foreign-key match; historic transactions without that relationship are not guessed or backfilled. Finance staff can link new income entries to a member; they remain hidden until independently confirmed.
- Members can download printable HTML receipts for verified linked contributions and use browser print/save-as-PDF. A server-generated PDF service remains outstanding.
- Members can submit private prayer requests; requests are assigned to their linked assigned pastor where one exists. Members see only their own request status, and prayer text is omitted from audit summaries.
- Members can request enrolment in active branch small groups and discipleship courses. Duplicate requests are prevented by a deterministic programme/member reference.
- Member notifications can be addressed with `member_notification` records using `data.recipientUserId`; members can read only their own and mark them read.
- Member document metadata and active file versions are visible only when `data.memberId` exactly matches the linked profile. Authenticated member downloads verify organisation, document assignment, active file status and SHA-256 integrity and write an audit event. Malware scanning, retention policies and off-site replication remain future work.


## Member portal upgrade follow-through
- Approved course enrolments have member-specific lesson checklists and server-calculated progress. Pending requests cannot mark lessons complete.
- Member-specific document files can be downloaded through authenticated endpoints after a fresh assignment and checksum check.
- Prayer request follow-up supports assignment to an active pastor in the same branch, a controlled workflow status and a member-visible progress update. Internal prayer text is not included in the member-facing update.
- Branch managers can create and edit in-app notifications for a member's linked portal account. The recipient account is resolved and pinned by the API; notification records are not a substitute for external SMS/email delivery.
