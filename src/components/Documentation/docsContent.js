/**
 * Structured documentation content, organized per dashboard → per feature.
 * Each feature entry follows the same shape (problem / howItWorks / solution)
 * so the docs page renders uniformly and new features are trivial to append.
 */

export const APP_META = {
  name: 'Centralized Team Management Platform',
  tagline:
    'A single, role-aware workspace for team updates, SPII case handling, metrics, and operational tooling.',
};

export const DOCS = [
  {
    id: 'overview',
    dashboard: 'Platform Overview',
    accent: 'indigo',
    blurb:
      'How the platform is structured, who uses it, and how data moves between the app, Firestore, and background automation.',
    features: [
      {
        id: 'roles',
        name: 'Roles & Access Control',
        problem:
          'Different people need very different things: an admin manages the whole org, a team leader manages their team, a member does day-to-day case work. Showing everyone the same screen is confusing and unsafe.',
        howItWorks:
          'On sign-in the user\'s role (admin, trainer, team_leader, team_member) is read from their Firestore user document and they are routed to the matching dashboard. Every dashboard renders only the tabs their role and per-user feature flags allow. Firestore Security Rules enforce the same boundaries server-side, so the UI and the database agree.',
        solution:
          'Each person sees exactly the surface they are meant to, and privilege-bearing fields (role, team, feature flags) can only be changed by an admin — a normal user cannot escalate themselves even by calling the database directly.',
      },
      {
        id: 'auth',
        name: 'Authentication',
        problem:
          'The platform holds sensitive customer-adjacent data, so access has to be gated and tied to a verifiable identity.',
        howItWorks:
          'Users authenticate with Google SSO or email/password through Firebase Auth. A dedicated, unlinked admin sign-in route exists for legacy administrator accounts, and it re-verifies the admin role server-side before granting access.',
        solution:
          'Only authenticated, approved users reach any dashboard, and administrative entry points are role-checked rather than trusting the front-end alone.',
      },
      {
        id: 'data-automation',
        name: 'Data & Background Automation',
        problem:
          'Some work must happen reliably even when no one is looking — keeping records in sync and sending scheduled reminders.',
        howItWorks:
          'The app reads and writes Firestore in real time. Cloud Functions handle the rest: a Firestore trigger keeps SPII case mirrors current the instant a case changes, a scheduled job sends the daily SPII follow-up to Google Chat, and callable functions cover admin actions like password resets and AI template extraction.',
        solution:
          'Records stay consistent without manual effort, and time-based notifications fire on their own so nothing is forgotten.',
      },
      {
        id: 'quick-access',
        name: 'Quick-Access Shortcuts',
        problem:
          'Reaching a frequently-used tab meant opening the navigation drawer and finding it every single time, adding friction to routine work.',
        howItWorks:
          'Every dashboard\'s navigation drawer shows a star on each tab. Tapping it pins that tab, and pinned tabs appear as one-click pill buttons in a "Quick access" bar directly beneath the top app bar — so switching to them no longer requires opening the drawer. Each person\'s picks are saved per user (in the browser) and persist across reloads; the same shortcut mechanism is shared by all four dashboards.',
        solution:
          'The tabs each person uses most stay one click away, removing repetitive navigation without cluttering the interface for anyone else.',
      },
    ],
  },
  {
    id: 'team-member',
    dashboard: 'Team Member Dashboard',
    accent: 'blue',
    blurb: 'The daily workspace for front-line members: updates to act on, case logging, and personal tooling.',
    features: [
      {
        id: 'updates',
        name: 'Updates',
        problem:
          'Important process changes and announcements get lost in chat threads, and leaders have no reliable way to know who actually read them.',
        howItWorks:
          'Members see pending and acknowledged updates for their team in real time. Acknowledging an update records who confirmed it and when. Members granted the "Create & Send Updates" permission can also compose updates with an optional acknowledgment deadline.',
        solution:
          'Announcements land in one predictable place, and every acknowledgment is tracked — so leaders get a verifiable read-receipt trail instead of guessing.',
      },
      {
        id: 'case-tracker',
        name: 'Case Tracker',
        problem:
          'Members handle many interactions a day and need a lightweight, structured log — and any case involving sensitive info has to feed the SPII workflow without extra manual steps.',
        howItWorks:
          'Members log each case (ID, status, Case Type, survey, origin, IRT, comments). The Case Type classifies the work as "New Case" or "Backlog" (new submissions default to New Case) so end-of-day reporting can separate fresh work from carried-over backlog. The ledger shows it on every case, can filter by it, and summarizes the New Case / Backlog counts for the current view. Older cases logged before this existed have no Case Type and show as "Unclassified" (with their own filter option); editing one keeps it Unclassified unless the owner picks a type. "Export CSV" downloads exactly what the ledger currently shows (all filters applied) with a Case Type column, for EOD submission. Notes entered when logging a case are saved with it and can be read in the ledger: the card view shows each case\'s notes in full, and the compact list has a "Notes" toggle (a dot marks cases that have notes) that expands the row. Line breaks are preserved, cases without notes say so, and — because notes must never contain SPII — anything the SPII detector flags is masked with a warning to edit it out (the owner can reveal it temporarily). The ledger only ever lists the signed-in member\'s own cases. If a case is flagged as containing SPII, a background Cloud Function mirrors it into "My SPII Cases" and keeps that mirror\'s status current on every later edit.',
        solution:
          'One quick entry doubles as both a personal activity ledger and the trigger for SPII tracking — now with a New Case vs Backlog split and a one-click CSV for EOD reporting — with the SPII sync handled server-side so a flagged case can never be left out of the notification flow.',
      },
      {
        id: 'spii-cases',
        name: 'My SPII Cases',
        problem:
          'SPII (sensitive personally identifiable information) cases need a documented privacy-review lifecycle, and cases awaiting review must be surfaced until they are handled.',
        howItWorks:
          'Each SPII case carries a status and a privacy-review flag. Members update status as the case progresses and mark the privacy review as submitted (or excluded with a reason). Unreviewed cases are what the SPII Chat follow-up pulls from.',
        solution:
          'Every sensitive case has an auditable review state, and anything still pending stays visible until it is genuinely resolved.',
      },
      {
        id: 'spii-audit',
        name: 'SPII Audit Logs',
        problem:
          'Sensitive data can slip into free-text notes by accident, and there needs to be a record when it does.',
        howItWorks:
          'When detection is enabled, text entered in notes and case tracking is scanned for PII/SPII patterns. Matches are written to an audit log (with redaction) that authorized roles can review and optionally push to Google Chat.',
        solution:
          'Accidental exposure is caught and logged automatically, giving the team a defensible detection trail rather than relying on manual vigilance.',
      },
      {
        id: 'spii-analytics',
        name: 'SPII Analytics',
        problem:
          'Leaders and members need to see SPII case volume and review progress at a glance, not by reading a raw list.',
        howItWorks:
          'A visual dashboard summarizes case counts by status (Open / SO / Closed) and privacy-review state, with team and member filtering and CSV export.',
        solution:
          'The state of SPII work is legible in seconds, making it easy to spot backlogs and confirm reviews are keeping up.',
      },
      {
        id: 'spii-case-management',
        name: 'SPII Case Management (POC)',
        problem:
          'SPII cases pile up open when their owner has left, is on leave, or is otherwise unavailable — no one else could update those cases, so they lingered in the database and kept firing chat follow-ups.',
        howItWorks:
          'Authorized people can edit ANY SPII case, not just their own, from a dedicated "SPII Case Management" tab: a searchable list of all SPII cases with an edit dialog carrying the full set of owner fields (status, origin, survey, IRT, transfer, comments). Moving a case to a resolved status (SO / Closed) drops it from the open list and the SPII chat follow-up. Who may do this: Admins, Trainers, and Team Leaders by role, plus any member an admin grants the per-user "SPII Case POC" feature (off by default). The power is enforced server-side — a Firestore rule lets these roles/POCs update cases flagged isSpii, while everyone else stays owner-only, and deletes remain owner-only for everyone. Every privileged edit is stamped with who made it (lastEditedBy) and logged to the activity feed.',
        solution:
          'Stale SPII cases can be closed and kept up to date even when the owner is gone, so the database and chat notifications reflect reality — without giving anyone the ability to delete other people\'s cases.',
      },
      {
        id: 'templates',
        name: 'Templates',
        problem:
          'Members retype the same canned responses constantly, and there is no easy way to share a good template with a teammate or move a set between accounts.',
        howItWorks:
          'Members save reusable snippets and copy them in one click. AI Import extracts templates from an uploaded file or Google Doc/Sheet. Export produces a CSV (name + content) that can be re-imported. Share sends selected templates to chosen users, who then review and accept only the ones they want. A "Float" button pops the Templates tab into an always-on-top floating window (Document Picture-in-Picture, with a pop-out-window fallback) so it stays visible while the member works in another app such as a chat client; the floating window renders with its own React root so it stays fully interactive, and "Bring back" (or closing the window) restores it inline.',
        solution:
          'Repetitive writing becomes a click, and templates move between people and accounts cleanly — with the recipient always in control of what actually lands in their list. Keeping templates on top of a chat window means no more tab-switching mid-conversation.',
      },
      {
        id: 'gcp-billing',
        name: 'GCP Billing Calculation',
        problem:
          'Billing-related calculations were done ad hoc in separate tools, which is slow and error-prone.',
        howItWorks:
          'A built-in calculator handles the billing computation directly inside the dashboard.',
        solution:
          'The calculation lives where the work happens, removing tool-switching and manual arithmetic mistakes.',
      },
      {
        id: 'notes',
        name: 'Documents (Scratchpad)',
        problem:
          'A single shared scratchpad forced members to keep every note in one long block, with no way to separate drafts, checklists, or reference material.',
        howItWorks:
          'A Google-Docs-style workspace: a "Document tabs" sidebar lists all of the member\'s documents (create, rename, duplicate, delete). Tabs nest like Google Docs — a tab can hold sub-tabs up to three levels deep, shown as a collapsible tree; drag a tab to reorder it among its siblings or drop it onto another to re-nest (depth is clamped so nothing exceeds three levels), and the "⋮" menu adds a sub-tab. Deleting a tab that has sub-tabs removes the whole branch after a warning that names how many will go. The editor provides rich formatting (headings, bold/italic/underline, lists, quotes, code, links) on a per-document basis. Every keystroke auto-saves, a live word/character count and last-edited time are shown, and each document\'s text is still scanned by SPII detection when enabled. Content can be brought in three ways: uploading a file (.docx via Mammoth, or .html/.txt), pasting directly from Google Docs (the messy inline styles are sanitized into clean semantic markup), or — when configured for the deployment — picking a Doc straight from Google Drive. Documents are private to the member (owner-only) and stored under scratchpads/{uid}/documents. An existing legacy scratchpad is migrated into a "My Notes" document automatically on first open.',
        solution:
          'A durable multi-document workspace that feels like a lightweight word processor while still respecting the platform\'s data-safety rules.',
      },
      {
        id: 'metric-analytics',
        name: 'Metric Analytics',
        problem:
          'Teams need a consolidated, trustworthy view of operational performance; the survey (CES/NCES) metric was deprecated because it was prone to manipulation.',
        howItWorks:
          'The tab focuses on two reliable metrics — IRT (initial-response-time breaches) and Backlogs (open cases) — with team/agent/date filters, a Case Type filter (New Case / Backlog / Unclassified — the EOD classification members set in Case Tracker, distinct from the Backlogs metric, which counts open statuses), and CSV export that includes a Case Type column. IRT shows breach reasons and breaches-by-origin as premium donut charts; Backlogs shows open cases by team and top agents as bar charts, plus detailed team/agent breakdowns. All charts are the theme-aware Aurora chart set.',
        solution:
          'Performance is self-serviceable and resistant to gaming — leaders and members track IRT and backlog health at a glance without waiting for a report.',
      },
      {
        id: 'feedback',
        name: 'Feedback (Bug & UAT)',
        problem:
          'When something breaks or a feature is being tested, there was no consistent channel to report it with enough context for the admin to act.',
        howItWorks:
          'A floating feedback button is available on every dashboard. Bug reports capture a title and details; UAT feedback presents every feature on the user\'s own dashboard as a Working / Not-Working checklist, requiring a reason for anything flagged. Submissions land in the Admin User Feedback tab.',
        solution:
          'Every user has a one-click, structured way to report issues, and admins get feedback that is specific enough to triage — including a per-feature UAT pass.',
      },
    ],
  },
  {
    id: 'team-leader',
    dashboard: 'Team Leader Dashboard',
    accent: 'violet',
    blurb: 'Tools for running a team: membership, broadcasting updates, tracking acknowledgments, and team-level SPII/metrics.',
    features: [
      {
        id: 'team-members',
        name: 'Team Members',
        problem:
          'Leaders need to see and manage exactly who is on their team, without touching anyone else\'s.',
        howItWorks:
          'The tab lists the leader\'s team members and supports adding/removing members within the boundaries the security rules permit.',
        solution:
          'Team composition is manageable by the person responsible for it, scoped safely to just their team.',
      },
      {
        id: 'updates',
        name: 'Updates',
        problem:
          'Leaders need to push announcements to their team and confirm the whole team actually saw them.',
        howItWorks:
          'Leaders compose updates for their team with optional deadlines, then track acknowledgment status per member.',
        solution:
          'Team communication is centralized and measurable, replacing "did everyone see this?" with a live acknowledgment breakdown.',
      },
      {
        id: 'acknowledgments',
        name: 'My Acknowledgments',
        problem:
          'Leaders also receive updates and need to keep their own acknowledgments current.',
        howItWorks:
          'A dedicated view lists updates awaiting the leader\'s own acknowledgment.',
        solution:
          'Leaders stay compliant with the same acknowledgment expectations as their members.',
      },
      {
        id: 'migrations',
        name: 'Migration Requests',
        problem:
          'Members sometimes need to move between teams, and that shouldn\'t happen silently or without the receiving/losing leader\'s awareness.',
        howItWorks:
          'Team-move requests are surfaced to the relevant leader, who can approve or deny them.',
        solution:
          'Team changes go through a clear approval step instead of happening invisibly, keeping team rosters accurate.',
      },
      {
        id: 'shared',
        name: 'GCP Billing · Notes · Case Tracker · SPII Analytics · Metric Analytics',
        problem:
          'Leaders need the same operational tooling members have, but scoped to their team where relevant.',
        howItWorks:
          'These tabs mirror the member versions, with SPII Analytics and Case Tracker scoped to the leader\'s team.',
        solution:
          'Leaders can do hands-on work and see team-level rollups in one place without switching contexts.',
      },
    ],
  },
  {
    id: 'trainer',
    dashboard: 'Trainer Dashboard',
    accent: 'emerald',
    blurb: 'A focused surface for trainers to broadcast across teams and use core tooling.',
    features: [
      {
        id: 'updates',
        name: 'Updates',
        problem:
          'Trainers need to reach members across multiple teams, not just one.',
        howItWorks:
          'Trainers compose updates that can target the broader audience, with the same acknowledgment tracking as team updates.',
        solution:
          'Cross-team announcements have a single owner and a verifiable read trail.',
      },
      {
        id: 'shared',
        name: 'GCP Billing · Notes',
        problem:
          'Trainers need lightweight operational tools without the full member/leader surface.',
        howItWorks:
          'A trimmed toolset provides the billing calculator and notes.',
        solution:
          'Trainers get just what their role requires, keeping their dashboard uncluttered.',
      },
    ],
  },
  {
    id: 'admin',
    dashboard: 'Admin Dashboard',
    accent: 'rose',
    blurb: 'Full-platform control: users, approvals, org-wide analytics, SPII oversight, and feedback triage.',
    features: [
      {
        id: 'users',
        name: 'User Management',
        problem:
          'Someone has to own the source of truth for who exists, what role they hold, and what features they can use.',
        howItWorks:
          'Admins view every user and can change roles, toggle per-user feature flags, reset passwords, update auth emails, and remove users. Sensitive operations run through role-checked Cloud Functions.',
        solution:
          'The org\'s access model is centrally and safely administered, with privileged actions verified server-side.',
      },
      {
        id: 'add-user',
        name: 'Add User Manually',
        problem:
          'When an admin already knows a new teammate and their role, making them self-register and then wait for approval is unnecessary friction.',
        howItWorks:
          'From User Management, an admin clicks "Add User" and enters the person\'s display name, their Google (SSO) email, a role, and an optional team. This writes an invite to a provisioned_users record keyed by the lowercased email. The first time that person signs in with Google SSO, the app finds the invite, creates their account with the assigned role and team already approved (no pending step), and consumes the invite. A tightly-scoped Firestore rule lets a new user claim an elevated role ONLY if an admin pre-provisioned that exact role for their email, so no one can self-assign privilege. Pending invites are listed under "Awaiting first login" and can be revoked.',
        solution:
          'Admins can pre-authorize teammates of any role so they sign in and start working immediately, while the security model still guarantees roles are only ever granted by an admin.',
      },
      {
        id: 'pending',
        name: 'Pending Approvals',
        problem:
          'Team leaders and trainers self-register, but they shouldn\'t get elevated access automatically.',
        howItWorks:
          'New leader/trainer accounts land in a pending queue until an admin approves or rejects them.',
        solution:
          'Elevated roles require a deliberate human approval, preventing unvetted privilege.',
      },
      {
        id: 'settings',
        name: 'System Settings',
        problem:
          'Platform-wide behavior (like SPII automation) needs a configuration home.',
        howItWorks:
          'Admins manage global settings, including the SPII Chat automation schedule, message template, and target statuses.',
        solution:
          'Org-wide behavior is tunable from one place without code changes.',
      },
      {
        id: 'apps-script',
        name: 'Apps Script Integration',
        problem:
          'Some workflows live in a separate Google Apps Script Web App (backed by Sheets/Docs/Drive/Gmail), and the platform needs to use them without merging the two codebases.',
        howItWorks:
          'The two projects stay completely separate and independently deployable; the app talks to each Apps Script Web App only over HTTPS via its deployed /exec URL. An admin can add MULTIPLE Web Apps under System Settings — each with a name (shown as its tab label), a URL, and a per-app connection method — stored as a list in the settings/integrations doc; enabled users get a picker to switch between them. Names are editable (rename anytime). Access is controlled per user AND per script: the master "Apps Script Integration" flag shows the tab, and a checklist in Manage features picks exactly which scripts that user may open (enforced in the UI, the tab picker, and the proxy Cloud Function). All calls go through one service layer (appsScriptService.js) with two admin-switchable transports: Direct (browser → Apps Script; GET for reads, POST as text/plain to avoid a CORS preflight) and Secure proxy (browser → the appsScriptProxy Cloud Function → Apps Script), which removes browser CORS and can attach a shared secret that never reaches the frontend. The Apps Script must be deployed with access = Anyone for either transport. No Google credentials or secrets live in the frontend. The feature is off for everyone by default and is turned on per user via the "Apps Script Integration" toggle in Manage features; enabled users get an Apps Script tab on their dashboard.',
        solution:
          'Existing Apps Script automation is reused cleanly and securely, controlled per user, while both projects remain independently maintainable.',
      },
      {
        id: 'analytics',
        name: 'Analytics',
        problem:
          'Leadership needs visibility into whether updates are actually being acknowledged across the org.',
        howItWorks:
          'The analytics tab aggregates update acknowledgment breakdowns across all users.',
        solution:
          'Communication compliance is measurable at the org level, not just per team.',
      },
      {
        id: 'spii-oversight',
        name: 'SPII Analytics & Audit Logs',
        problem:
          'SPII handling and accidental-exposure detection need org-wide oversight and a permanent record.',
        howItWorks:
          'Admins see SPII analytics across all teams and the full audit-log ledger, with delete restricted to preserve records.',
        solution:
          'Sensitive-data handling is auditable end-to-end, satisfying oversight and record-keeping needs.',
      },
      {
        id: 'updates-cleanup',
        name: 'Updates Management & Cleanup',
        problem:
          'Old or test updates pile up and clutter every dashboard, and there was no admin surface to reach and remove them in bulk.',
        howItWorks:
          'The Updates tab lists every update across all teams/channels in real time. Admins can delete a single update, tick several and "Delete Selected", or "Delete All" — each with a confirmation that spells out the consequences. Every deletion runs the full cascade (removes the update, its acknowledgments, and related notifications, and notifies affected members). Delete permission is admin-only, enforced by Firestore Security Rules.',
        solution:
          'Admins can keep the platform tidy — clearing unnecessary updates one-by-one, in batches, or all at once — so members see a clean, relevant list.',
      },
      {
        id: 'audit-forensics',
        name: 'Forensic Audit Trail',
        problem:
          'Knowing someone was "online" is not enough for oversight — you need to know what they actually did: which cases they touched, whether a case was flagged SPII, and whether a person logged in but never did real work.',
        howItWorks:
          'Beyond sessions and tab views, the app records every productive action to an append-only audit trail — case tracked/edited/deleted (with case ID, status, and SPII flag), SPII case logged, update created/acknowledged/deleted, note saved (with a short content preview), and template created/copied/deleted (with the template name) — each tagged with the user, role, and dashboard. The admin monitor shows this as a filterable trail (by category, date range, or search on LDAP/case ID/action), a click-to-expand detail popup on any event (showing the full captured context — e.g. which template was copied, its content, and how many times that template has been used), a per-user drill-down that reconstructs one person\'s timeline, a compliance flag that marks users who were present but performed zero productive actions ("Access only"), and two CSV exports: a detailed row-per-event dump and a pivot (users × action counts with a productive total). Only identifiers and flags are stored — never raw sensitive content — and the trail is admin-read + append-only, so it can\'t be edited after the fact.',
        solution:
          'Admins get a forensic, tamper-evident record of who did what, when, and on which case — turning utilization from "who\'s online" into an accountable activity log for compliance and investigations.',
      },
      {
        id: 'utilization',
        name: 'App Utilization Monitor',
        problem:
          'Admins had no visibility into how the app is actually used per person — who is online, how long they are active, which tabs they rely on, and how much case work they log.',
        howItWorks:
          'While a user is signed in, the app records lightweight activity to Firestore: a session heartbeat accrues active (visible, non-idle) time, and each tab they open is logged. The admin-only monitor reads this live and joins it with tracked-case data to show, per user: LDAP, online status, active time, last tab clicked, most-used tab, case count, and when they last recorded a case — plus interactive charts and an append-only audit trail with CSV export. A Utilization Rate gauge expresses active time as a share of the shift (selectable: 9, 9.5, 10.5, 11 hours, or a custom length); it can show the team average or be scoped to a single user, and each user\'s own utilization also appears as a column in the table. Access is restricted to admins by Firestore Security Rules; each user can only write their own activity.',
        solution:
          'Leadership gets a real-time, per-user picture of app utilization and an accountable audit trail, without anyone having to self-report.',
      },
      {
        id: 'feedback',
        name: 'User Feedback',
        problem:
          'Bug reports and UAT results from across the org need one triage surface, and results need to be exportable for review.',
        howItWorks:
          'All submissions stream into a filterable table (by type and dashboard). Clicking a row opens a detail view with the full submission (no truncation), including per-feature UAT results. From there an admin can run AI Triage: a Gemini-backed Cloud Function (admin-only) assesses whether the item is fixable, rates severity, guesses the likely area of the codebase, lays out a short plan, and produces a ready-to-paste prompt for an AI coding agent (e.g. Claude Code). The result is cached on the feedback record and can be re-run. Export still produces a CSV with one column per feature.',
        solution:
          'Every piece of feedback is collected, searchable, exportable, and — with one click — turned into an actionable plan and a prompt a developer can run immediately, shrinking the gap between a report and a fix.',
      },
    ],
  },
];
