# NCBI-CMS implementation status

## Proposal-wide feature coverage audit

This matrix is the acceptance boundary for the submitted project proposal. "Partial" means useful APIs or shared operational records exist, but the full specialist workflow, controls or acceptance testing in the proposal is not yet delivered. A menu item or generic record type alone does not count as a completed module.

| Proposal area | Current coverage | Remaining work before it can be called complete |
|---|---|---|
| 1. Headquarters executive dashboard | Partial | Validate every KPI against approved definitions and live branch data; add outstanding-return alerts, branch trend thresholds and full browser acceptance tests. |
| 2. Membership management | Partial | Complete bulk import with duplicate-resolution preview, QR membership cards, family/household management, certificates, anniversary automation and complete transfer approval/notification workflow. |
| 3. Visitors and new believers | Partial | Add structured source/conversion funnel, follow-up schedules, escalation and retention analytics beyond generic visitor records. |
| 4. Attendance | Partial | Broad QR device/browser acceptance, offline queue and conflict-safe sync, self-check-in anti-abuse controls and complete attendance dashboards. |
| 5. Departments and ministries | Partial | Dedicated ministry work plans, budgets, meetings/minutes, responsibilities and cross-branch performance workflows rather than generic records alone. |
| 6. Finance and accounting | Partial | Configurable approval matrices by amount/role, budget-to-spending enforcement, bank-feed/import integration, electronic PDF receipts, tax treatment, supplier payment lifecycle, cashbook and independent reconciliation controls. A first server-side supplier register, purchase-request approval, supplier-invoice posting and partial supplier-payment workflow is now present; dedicated finance screens, commitment reservation, concurrency-safe settlement and full procurement controls remain outstanding. Budget requests have separate submit/approve/reject decisions; financial request rejection now requires an explanation. Trial balance, period income/expenditure, and balance sheet reporting derive from posted journals separately by organisation and currency. Basic requester/approver/confirmer separation and reversal journals for confirmed voids are implemented. Live M-Pesa remains dependent on approved production credentials and callback configuration. |
| 7. Events and programmes | Partial | Venue/resource conflict checks, event committee and speaker workflows, certificate generation, complete event budget controls and end-to-end registration tests. |
| 8. Pastoral care and welfare | Partial | Encrypted case notes, granular case assignment, counselling confidentiality, welfare disbursement controls and approved safeguarding procedures. |
| 9. Evangelism and missions | Partial | Structured field reports, mission-team deployment, missionary support, church-planting milestones, geospatial coverage and verified outcome reporting. |
| 10. Discipleship and Bible training | Partial | Full course authoring/content delivery, quizzes, assessments, certificates, course prerequisites and trainer reporting. |
| 11. Worship and service management | Partial | Dedicated song/hymn catalogue, rehearsal and musician rota, conflict checks, full order-of-service publishing and sermon media archive workflows. |
| 12. Leadership and HR | Partial | Credentials/ordination evidence, leave management, performance reviews, volunteer lifecycle, succession planning and restricted disciplinary workflows. |
| 13. Communication | Partial | Approved SMS, email and WhatsApp providers, consent/preferences, delivery receipts, retries, templates and audience segmentation. In-app notifications are not proof of external delivery. |
| 14. Assets and property | Partial | Depreciation, scheduled maintenance, insurance/valuation history, custody acceptance and disposal approval workflow. |
| 15. Projects and development | Partial | Formal proposal/approval stages, milestones, contractor procurement, change orders, evidence review and project-to-ledger budget controls. |
| 16. Children, youth and family | Partial | Parent/guardian portal, verified guardian relationships, authorised collection workflow, child attendance handover, staff vetting and complete safeguarding case management. Consent capture alone is not the full safeguarding module. |
| 17. Documents and records | Partial | Malware scanning, retention/legal holds, off-site replication, restore verification, richer document classification and archival policies. Private versioned storage exists but requires production persistent storage configuration. |
| 18. Public website and member portal | Partial | Native Android/iOS applications, secure online giving experience, broader member self-service, public sermon/media delivery and end-to-end accessibility/device acceptance. Public CMS, configurable homepage leader portrait, moderated church photo/video gallery and core member portal are present. Production persistent media storage and safeguarding/consent process validation are required before operational rollout. Super Admin and National Admin can now manage public email, telephone, WhatsApp, physical/postal address and office hours in the Contact page editor; published details appear on the public Contact page and footer. |
| 19. Security, governance and audit | Partial | MFA, per-device refresh-token rotation, password reset/recovery, formal immutable audit storage, security alerting, automated backup/restore drills, incident response and independent penetration testing. |
| Mobile and offline architecture | Not delivered | No native Android/iOS application or durable offline-first sync engine is present. Do not record financial payments offline as confirmed; future sync must be idempotent and reconcile conflicts. |
| Data migration and rollout | Not delivered | Import validation/mapping tools, controlled pilot migration, rollback rehearsal, branch onboarding and formal user acceptance sign-off. |
| Training and support | Not delivered | Role-specific manuals/video training, helpdesk workflow, support SLAs and operational handover. |

The current codebase is therefore a substantial working web/API foundation, not a completed implementation of every item in the proposal. Production integrations that require NCBI/provider credentials, verified organisational policy or real-world acceptance cannot be truthfully marked complete from code alone.


This document distinguishes working code from planned work. A module is not production-ready merely because a navigation item or model exists.


## Supplier procurement and accounts-payable workflow

- Added organisation-scoped supplier registration and maintenance, including active/suspended supplier status and audit events.
- Added purchase requests with unique organisation request numbers, active-supplier validation, independent approve/reject decisions and mandatory rejection reasons.
- Added supplier invoices with organisation-scoped supplier and ledger-account validation, optional linkage to an approved purchase request, positive exact-decimal amounts, invoice/due-date validation and duplicate invoice-number protection per supplier.
- Approving an invoice posts a balanced accrual journal: debit the selected expense account and credit the selected accounts-payable liability account. The journal is linked to the invoice for traceability, and an applicable approved monthly, quarterly or annual expense budget is checked before posting.
- Added supplier payment requests, independent approval, partial settlement and a separate confirmation step. Confirmation requires a different user from both requester and approver, validates the selected asset settlement account, prevents a payment from exceeding the remaining approved invoice balance, and posts a balanced debit-to-payables / credit-to-cash-or-bank journal.
- Paid supplier payments update invoice state to partially paid or paid using exact minor-unit arithmetic. Unique journal source links and supplier invoice uniqueness protect against ordinary duplicate submissions.
- API base: `/api/suppliers`; resources: `/suppliers`, `/purchase-requests`, `/invoices`, and `/payments`. Each list and mutation is authenticated and organisation-scoped.
- Automated pure-policy tests cover supplier naming, invoice validation, exact decimal handling, rejection/approval separation, payment overrun prevention and partial settlement.
- **Not yet complete:** no dedicated supplier/procurement/invoice/payment workspace has been added to the React client; pending purchase orders/payments do not reserve budget or invoice balance; concurrent settlement requests are not protected by a database transaction/atomic reservation; no supplier statement, tax withholding, purchase-order line-item/receiving, bank-feed matching or live payment-provider disbursement is implemented. Supplier payments are recorded and posted after an authorised human confirms settlement; this does not transfer money to a supplier.


## Public website contact information management

- Extended the existing Public Website CMS Contact page with public contact email, main telephone, WhatsApp number, physical/headquarters address, postal address and office hours.
- Super Admin and National Admin can edit these fields in the dashboard under **Institutional Configuration → Public Website → Contact page → Official contact information**, then publish them with the existing Save & Publish action.
- The public Contact page displays configured details as clickable email, telephone and WhatsApp links, plus address and office-hours information. Public footer also displays the configured email and telephone.
- The public website reads these values from the existing public content endpoint; no separate manual website edit or deployment configuration is required for each contact detail.
- Server-side validation rejects malformed email addresses, unsafe phone characters and overlong address/hours fields. The content remains plain text and existing CMS-managed page copy is preserved when fields are added.
- Contact details are optional and blank by default. NCBI administrators must enter and publish verified official details; no phone number, email or address has been invented.
- Automated policy tests cover valid details, malformed email/phone values and length limits; client terminology tests cover contact defaults and preservation through CMS merges.

## Supplier and procurement dashboard

- Added a role-restricted **Suppliers & procurement** finance workspace for authorised finance and leadership roles, including treasurers.
- The workspace provides supplier registration, purchase-request submission and review, supplier invoice submission and independent approval, supplier payment requests, payment approval and a separate settlement confirmation screen requiring selection of an active bank/cash asset account.
- The workspace uses the existing organisation-scoped /api/suppliers endpoints and chart-of-accounts API. It does not initiate bank transfers or M-Pesa disbursements; users confirm settlement only after the real-world payment has occurred.
- The dashboard is responsive and includes registers, status indicators and rejection-reason inputs. Full browser acceptance and real MongoDB integration tests remain outstanding.

## Implemented in this delivery
- Financial request rejection now requires an explanation in the API, stores it on the transaction and includes it in the audit event. The interface prompts for the explanation before sending the decision and uses distinct authorise, confirm-and-post, and decline action labels.
- Enterprise interface terminology is centralised in `client/src/content/terminology.js` for governance roles, role-specific overview titles, workspace navigation, primary page descriptions, contextual register empty states, action labels and public website defaults. Public defaults use cautious, service-focused language and do not assert unverified NCBI statistics, locations or programmes. Existing CMS-managed page copy is preserved and is not overwritten by these defaults. Node test coverage checks terminology resource completeness and public page defaults.
- GitHub Actions now runs `npm test -w client` for the terminology resource tests. This is copy-resource coverage, not browser-based interaction, accessibility or visual-regression testing.
- Expense budgets now persist a submitted/approved/rejected lifecycle. Only authorised approver roles can decide a budget, the requester cannot approve or reject their own request, rejection requires a reason, repeated decisions are blocked, and submission/decision events are audited. The budget register displays status, approver and decision actions.
- Authenticated `GET /api/accounting/statements?from=YYYY-MM-DD&to=YYYY-MM-DD&organisation=<optional-id>` returns posted-journal trial balances, period income/expenditure and balance sheets for each organisation in the caller's accessible scope. Balances use exact cent arithmetic; statements retain each organisation's currency and are not combined across currencies. Balance sheets include accumulated income less expenses through the selected end date. Unit tests cover balanced totals, period activity, reversals and currency separation. These are operational statements; they are not independently audited or a substitute for complete accounting-period close controls.
- Finance confirmation now requires a different user from both the requester and approver. Voiding a confirmed transaction creates an immutable, balanced reversal journal linked to its original posted entry; a missing original journal blocks the void rather than silently changing the transaction status. The decision and journal references are audited, and focused policy tests cover separation-of-duties rules.
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
- The reports workspace displays the posted-ledger trial balance and income/expenditure and balance-sheet totals separately for each accessible organisation, with currency labels and the reporting period. It does not perform FX conversion or combine branch values.
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

- Membership transfers now require a destination that is an active branch, reject transfers to the same branch or non-branch organisational units, preserve the transfer history, update the linked member portal account's organisation and write an audit event. Transfer policy boundary tests cover active-branch, same-branch and invalid-destination cases.

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


## Public website CMS
- A global public-site content document is stored in MongoDB and served with the public branch/programme/news feed.
- Super Admin and National Admin can edit the home, about, mission, ministries, branches, programmes, news and contact page copy, card arrays, navigation labels and footer from Administration → Public website.
- Logo replacement remains in Administration → Church branding. Branch records and public event/announcement content remain sourced from the existing organisation and operations modules.
- The protected CMS API validates page keys and object shapes, limits the payload to 100 KB and renders user copy as React text rather than executable HTML.


## Approved-budget enforcement at journal posting
- Journal posting now checks positive net debits to active expense accounts against the most specific approved budget available for the journal date (monthly, then quarterly, then annual).
- The calculation uses decimal minor units rather than floating-point arithmetic. If an approved budget exists and the proposed posting would exceed it, posting is blocked with a conflict response and an audit event.
- No approved budget configured for an account and period is not interpreted as a zero allocation; posting remains available and the absence of an approved allocation is not silently treated as an approval.
- This control currently measures posted actual expenditure. It does not yet reserve pending commitments, provide authorised overspend overrides, or provide an atomic cross-request budget reservation under concurrent posting. Those controls and MongoDB concurrency/integration tests remain outstanding.


## Configurable budget approval matrices
- Senior authorised leadership can configure organisation-scoped budget approval policies with non-overlapping amount bands, permitted approver roles and one to three required distinct approvers.
- Budget decisions are recorded individually with actor, role, decision, note and timestamp. Rejections require an explanation; a budget remains submitted until the configured number of independent approvals is reached.
- Configurable organisation-scoped approval matrices now support budgets, purchase requests, supplier invoices and supplier payments. Each amount band specifies permitted leadership roles and one to three distinct approvals. Purchase requests remain pending until the configured approval threshold is reached. Approved purchase requests can then be linked to supplier invoices. Supplier invoice approval posts the expense/payable journal only after the configured approval threshold is reached; supplier payment approval remains separate from settlement confirmation, and only the latter records the completed payment in the ledger. The financial approval matrix panel is available from Finance → Budgets and can configure all four transaction types. Existing role-based approval remains the fallback when no matching policy exists. MongoDB concurrency/integration coverage, atomic duplicate-decision protection and race-safe overlapping-range creation remain outstanding.


## Church media publishing and public gallery

- Added a dedicated **Church media & gallery** workspace for headquarters and branch administrators. Uploads accept JPEG, PNG and WebP photos (15 MiB maximum) and MP4/WebM videos (50 MiB maximum), with server-side MIME signature checks, safe generated storage keys, SHA-256 integrity metadata and organisation scope enforcement.
- Branch administrators and pastors submit media as pending/private. Super Admin, International Executive and National Admin may publish directly; Super Admin, International Executive, National Admin and Regional Overseer can review submissions within their authorised organisation scope. Approval publishes the item to the public gallery; rejection requires an explanation. Headquarters reviewers can archive published media.
- The public website now includes a Church Gallery page with branch attribution, descriptions, photo display and browser video playback. Only active records explicitly marked public are exposed; media files are served through the API rather than exposing storage paths.
- Upload requires the submitting user to confirm that NCBI has permission to publish identifiable people, including guardian permission when children appear. This confirmation is an uploader attestation, not a substitute for a documented guardian-consent workflow; branches must continue following NCBI safeguarding policy and must not publish identifiable children without verified authorisation.
- Church media files use `CHURCH_MEDIA_STORAGE_DIR` (or fall back to `DOCUMENT_STORAGE_DIR`). Configure this as an absolute path on a persistent disk shared by the API service; the route returns HTTP 503 when storage is not configured. Back up this directory with the database, restrict filesystem access and configure reverse-proxy/request limits for 50 MiB uploads. Local ephemeral storage is not suitable for production media retention.
- Church branding now includes a separate homepage leader portrait upload (JPG/PNG/WebP, 3 MiB maximum). It replaces only the portrait in the homepage hero; the official logo remains in the header and dashboard. The repository currently contains only `client/public/ncbi-logo.jpg` and `client/public/icon.svg`; it has no human/Bishop photograph. The homepage therefore uses the existing repository emblem as a temporary local placeholder (not a portrait) until the official photo is supplied. Super Admin or National Admin can replace it without a code change.
- **Not yet verified:** no live upload, browser playback, cross-branch permissions, persistent-disk restart, consent/a11y or MongoDB integration test has been run as part of this repository update. Video delivery supports single HTTP byte-range responses, ETag validation and If-Range, but currently reads the complete file into server memory per request and does not provide streaming-from-disk, CDN delivery or adaptive transcoding. Large-scale distribution should move to object storage/CDN and adaptive streaming before high-volume production use.


## Church media cloud storage and optimisation

- New church gallery photos and videos are uploaded directly from the API to Cloudinary; local disk is retained only as a compatibility fallback for older media records.
- Video uploads accept MP4/WebM up to 100 MiB; images accept up to 15 MiB and are resized to a maximum 1,920-pixel edge and compressed to WebP in supported browsers before upload.
- Cloudinary applies automatic quality and format optimisation and caps delivery dimensions (images 1,920 px; videos 1,920×1,080) to reduce transfer size and improve page loading. Video delivery is MP4/H.264-compatible.
- Cloudinary credentials must be configured as server-side secrets: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Never place these credentials in Vite/client environment variables or commit real secrets.
- Public media records still require publication approval. New uploads fail with a service-unavailable response when Cloudinary is not configured; they are not silently written to ephemeral local storage.
- Existing local media remains readable while the legacy persistent disk is configured. A separate migration of old media to Cloudinary is still required before removing that disk.
- Cloudinary plan/account upload limits and Render/proxy request-body limits must permit 100 MiB uploads; verify this on the deployed service before accepting large videos.


## Concurrent financial record protection

- Budget decisions, journal posting, purchase-request decisions, supplier-invoice decisions and supplier-payment decisions/settlement now use Mongoose optimistic concurrency. A stale write is rejected with HTTP 409 rather than silently overwriting another actor's update.
- The client must reload the latest record after a conflict before retrying. This protects concurrent edits to the same record; it is not a transactional reservation across separate budget-consuming records. Concurrent cross-record budget overspend prevention and pending purchase commitment reservation remain outstanding and require database-level atomic budget reservations/transactions plus integration tests.


## Visitor follow-up pipeline

- The visitor follow-up workspace now reads the branch-scoped visitor register and exposes open, due, overdue and unassigned follow-up totals.
- Authorised branch and senior leaders can start a follow-up directly from a visitor profile, record contact method/outcome/notes, assign the current officer by default, and schedule the next contact.
- Every follow-up action is appended to a bounded 100-entry history; the latest contact and next-action fields are maintained for operational queues. Open follow-ups require a future next-contact date; completed/closed follow-ups do not.
- Follow-up endpoints enforce organisation scope and restrict assignment to active authorised staff in the same branch. The overview is private/no-store.
- Automated policy tests cover supported methods/outcomes/statuses, future scheduling, completed follow-ups and malformed input. GitHub Actions passed for the backend route update and earlier frontend component/style commits; the latest combined frontend integration check is still running at the time of this note.
- Remaining work: richer assignment controls, reminders/notifications, visitor conversion analytics, escalation rules, and end-to-end tests against a configured MongoDB deployment. This workflow does not send SMS, WhatsApp or email.


## Operational module form upgrade (30 October 2026)

The inventory, procurement, communications, media, transport, compliance, membership-class and ministry-roster workspaces now expose dedicated, validated browser form fields for their domain-specific record data. The forms submit through the existing organisation-scoped operations API and preserve the existing record audit and access controls. Operational register search now checks record titles, references and commonly used module-specific fields. These changes improve record capture and discovery; they do not by themselves implement stock-ledger accounting, supplier quotation comparison, automated approval chains, vehicle telematics, learner assessment engines, or file uploads. Those require additional domain models, transaction-safe services and end-to-end verification before being described as complete.


## Inventory stock ledger (30 October 2026)

The inventory workspace now has a dedicated organisation-scoped stock register in addition to its general inventory records. Items have unique per-organisation item codes, units, storage locations, reorder thresholds and live balances. Stock receipts, issues, transfers out, adjustments and physical stocktakes are recorded as immutable movement history with before/after balances and an idempotency key. Stock issues that would create a negative balance are rejected. Movement writes use MongoDB transactions so the balance and movement ledger commit together; the deployment must use a MongoDB replica set or Atlas cluster with transaction support. The UI shows low-stock alerts and the recent movement ledger. Supplier procurement, multi-step approval and quotation comparison are separate workflows and are not represented as completed by this inventory release.


## Operational workflow integration (30 October 2026)

- The Inventory stewardship page now uses the dedicated stock register and inventory ledger APIs rather than the generic operations-record table. Staff with inventory management roles can register items, record opening stock, receipts, issues, transfers, adjustments and stocktakes, inspect running balances and review the latest 100 movements per item.
- Stock updates are performed inside a MongoDB transaction. The server prevents negative balances, permits opening stock only once, records before/after balances and uses organisation-scoped idempotency keys to avoid duplicate movements. A zero-count stocktake is valid and is covered by policy tests.
- The Purchasing and procurement page now opens the existing supplier and procurement workflow: supplier register, purchase request submission, independent approvals governed by the configured approval matrix, supplier invoices, invoice approvals and supplier payment requests/settlements.
- The client build and server syntax/unit checks completed successfully on GitHub Actions run [41065398554](https://github.com/isaacokubi/ncbi/actions/runs/41065398554) for commit `6a4fe700b78e85e28915da992a201698cc739164`; the workflow was still finalising its run status when this note was prepared.
- Supplier quotation comparison and purchase-order generation have since been implemented; supplier delivery/receiving reconciliation remains a separate enhancement. Inventory and procurement actions still require production integration testing with authorised users and a MongoDB replica-set deployment because stock movements rely on transactions.


## Media ministry workspace (30 October 2026)

- The Media ministry navigation page now opens the Cloudinary-backed church media workspace instead of the generic operations table.
- Upload controls now expose the formats already validated by the server: JPG/PNG/WebP images (15 MB), MP4/WebM video (100 MB), MP3/M4A/WAV/OGG audio (50 MB), and PDF documents (25 MB). Images are resized/compressed in the browser; Cloudinary stores and optimises supported image/video media.
- Audio and PDF submissions are shown as dedicated resource cards with an authenticated open action. Existing publication consent, branch scoping and headquarters review rules remain in place.
- GitHub Actions run [41065938920](https://github.com/isaacokubi/ncbi/actions/runs/41065938920) completed successfully for commit `b7626c6314ce003051cd16e40c0e47ea97a8f020`, including server checks, client terminology tests and the production Vite build.


## Operational workspace completion pass (30 October 2026)

The eight stewardship workspaces now have dedicated task-focused interfaces rather than falling back to the generic record table:

- **Inventory:** live stock register and immutable movement ledger, with receipts, issues, transfers, adjustments, stocktakes, reorder thresholds and balance safeguards.
- **Procurement:** supplier directory, purchase requests, configured multi-approver decisions, invoice review and supplier payment settlement workflows. Quotation comparison and automatic purchase-order conversion remain outstanding.
- **Communications:** campaign planning, audience/channel details, planned dates, approval notes and publication references. Server-side controls reserve approval, rejection and publication to headquarters leadership; publication requires a previously approved record and rejection requires a review explanation.
- **Media ministry:** Cloudinary-backed church media library with image/video upload and authenticated audio/PDF resource actions, preserving consent and publication review controls.
- **Transport:** trip scheduling with driver, vehicle, route, passenger, odometer, fuel and maintenance details, including next service date, provider, cost and vehicle availability state.
- **Governance and compliance:** policy, resolution, meeting, risk and action registers with responsible officers, review dates, evidence references, status and completion controls. Past-due work is highlighted in the workspace.
- **Membership and discipleship classes:** class programme/curriculum/capacity register plus learner enrolment requests, approval and dated lesson attendance history. Server checks the member's organisation, prevents repeat active enrolment for the same programme, enforces configured capacity and validates each attendance session. Attendance history is bounded to 100 sessions per enrolment.
- **Ministry service rosters:** team, leader, service date/time, venue, assigned-member/role text, confirmations, substitutions and attendance state. Server prevents duplicate active rosters for the same ministry team/date/time in an organisation.

All these records use the existing organisation-scoped OperationsRecord API and its audit trail. The pages do not claim to provide vehicle GPS/telematics, fuel-card reconciliation, automated calendar notifications, member-ID-based volunteer conflict detection, online examinations/certification, weighted procurement quote scoring or supplier delivery/receiving reconciliation. Those require additional integrations or data models.

Automated Node policy tests cover headquarters communication approval, approval-before-publication, and bounded/validated learner attendance history. GitHub Actions validates server/client syntax, client terminology resources and the production client build. These checks are not a substitute for a live multi-role MongoDB/Cloudinary integration test or user acceptance testing on the deployed production environment.


## Supplier quotation comparison and purchase-order issue (30 October 2026)

- Each purchase request can collect one quotation per active supplier in the same organisation. Quotes capture a supplier reference, comparable currency and amount, delivery lead time, validity date, terms and an evidence/document reference.
- The procurement workspace compares submitted offers and identifies the lowest quoted amount for review. Selection is restricted to independent approver roles, cannot be performed by the purchase requester or the quote submitter, and requires the purchase request to have completed its configured approval workflow.
- Selecting a quote checks that its currency matches and its amount does not exceed the approved request. The selection, rejection of competing quotes and purchase-order issue are committed together in a MongoDB transaction. The request is marked ordered and receives a purchase-order number derived from its unique request reference.
- Supplier invoices can be linked to an approved request or issued purchase order. Once a quote is selected, the invoice amount is capped at the selected quote amount, and the selected supplier must match the invoice supplier.
- The transaction-backed quote-selection operation requires MongoDB transaction support (Atlas or a replica set). Weighted scoring, quote-document binary uploads, delivery notes and goods-received reconciliation remain future enhancements.
- Automated policy tests cover quote amount/currency/delivery/validity validation and volunteer-shift overlap rules. GitHub Actions run [41071148491](https://github.com/isaacokubi/ncbi/actions/runs/41071148491) is running for the combined procurement and roster changes; verify its final result before treating this revision as CI-verified.


## Operational workflow completion updates (30 October 2026)

- Class enrolment approvals now use a dedicated server action restricted to senior leadership approvers. A user cannot approve their own submitted enrolment, and generic record edits cannot bypass the approval action.
- Class attendance now uses a dedicated append-only endpoint. It validates each session, prevents duplicate learner/session entries, retains the latest 100 sessions and writes an audit event. Attendance can only be recorded against an approved enrolment.
- Transport now has a separate vehicle maintenance register for routine service, inspections, repairs, licensing, costs, odometer readings and next-service dates, in addition to trip scheduling.
- Vehicle maintenance records are stored as organisation-scoped operational records and use the existing role checks, validation and audit trail.
- These workflows still require live role-based acceptance testing with the deployed MongoDB environment; CI checks validate source, policy and client build, not production data or permissions.


## Class, roster and fleet workflow hardening (30 October 2026)

- Class enrolment approval is now a dedicated server-side action for senior leadership. The submitter cannot approve their own request, and generic record updates cannot directly change enrolment status or replace attendance history.
- Class attendance is appended through a dedicated endpoint, validates date/title/status, rejects duplicate learner/session entries, is limited to approved enrolments and retains the most recent 100 sessions with an audit event.
- Ministry rosters support individual attendance outcomes for each assigned member (present, late, absent or excused). The server rejects attendance entries for people who are not assigned to that roster.
- The transport workspace includes a separate vehicle maintenance register. It validates service type, service status, dates, odometer and costs, and highlights next-service dates that are overdue. Trip records require a vehicle registration and a return time later than departure.
- GitHub Actions run [41072992067](https://github.com/isaacokubi/ncbi/actions/runs/41072992067) passed server/client checks, policy tests, terminology tests and the production client build for commit `7e36fb323d3df2072f74e54d81cd0e5107fad952`.
- These automated checks do not establish that production Cloudinary credentials, MongoDB replica-set transactions, live role assignments or real church workflows have been verified in the deployed environment. Complete those checks with authorised test accounts before declaring production readiness.
