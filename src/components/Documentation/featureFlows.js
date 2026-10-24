/**
 * Per-feature flowcharts as Mermaid definitions, keyed by
 * `${dashboardId}:${featureId}` (matching docsContent.js ids).
 *
 * These are real graphs — decisions branch, paths merge back together, and
 * several flows loop — so Mermaid lays them out as proper flowcharts rather
 * than a single vertical line. Shapes: ([..]) start/end · [..] process ·
 * {..} decision · [/../] input-output · [(..)] stored record.
 */

export const FEATURE_FLOWS = {
  // ---- Platform Overview ----
  'overview:roles': `flowchart TD
  A(["User signs in"]) --> B[/"Read role from user doc"/]
  B --> C{"Approved and valid role?"}
  C -->|No| D["Send to pending or login"]
  D --> A
  C -->|Yes| E["Route to matching dashboard"]
  E --> F["Render allowed tabs only"]
  F --> G(["Scoped workspace shown"])`,

  'overview:quick-access': `flowchart TD
  A(["Open nav drawer"]) --> B[/"Tap the star on a tab"/]
  B --> C["Tab pinned, saved per user"]
  C --> D["Shows in Quick Access bar"]
  D --> E[/"Click pill"/]
  E --> F(["Jump to tab, no drawer"])
  F --> D`,

  'overview:auth': `flowchart TD
  A(["User opens the app"]) --> B{"Sign-in method?"}
  B -->|SSO or Email| C["Firebase Auth verifies"]
  B -->|Admin sudo| D["Sudo route re-verifies admin"]
  D --> C
  C --> E{"Authenticated?"}
  E -->|No| F["Access denied"]
  F --> A
  E -->|Yes| G(["Session granted"])`,

  'overview:data-automation': `flowchart TD
  A(["Record changes in the app"]) --> B[("Write to Firestore")]
  B --> C{"SPII-flagged case?"}
  C -->|No| Z(["No sync needed"])
  C -->|Yes| D["Trigger updates SPII mirror"]
  D --> E["Scheduled job compiles follow-up"]
  E --> F{"Still unreviewed?"}
  F -->|No| Z
  F -->|Yes| G["Google Chat notified"]
  G --> E`,

  // ---- Team Member Dashboard ----
  'team-member:updates': `flowchart TD
  A(["Open Updates tab"]) --> B[/"Load team updates"/]
  B --> C{"Any pending?"}
  C -->|No| D(["All caught up"])
  C -->|Yes| E["Read update"]
  E --> F["Click Acknowledge"]
  F --> G[("Acknowledgment recorded")]
  G --> B`,

  'team-member:case-tracker': `flowchart TD
  A(["Open Case Tracker"]) --> B[/"Enter case details"/]
  B --> C["Save tracked case"]
  C --> D{"Contains SPII?"}
  D -->|No| E["Logged as normal case"]
  D -->|Yes| F["Trigger mirrors to My SPII Cases"]
  F --> G[("SPII mirror kept in sync")]
  E --> H{"Log another case?"}
  G --> H
  H -->|Yes| B
  H -->|No| I(["Done"])`,

  'team-member:spii-cases': `flowchart TD
  A(["Open My SPII Cases"]) --> B["Update case status"]
  B --> C{"Privacy review done?"}
  C -->|No| D["Keep working the case"]
  D --> B
  C -->|Yes| E["Submit review or exclude with reason"]
  E --> F[("Review state recorded")]
  F --> G(["Case resolved and auditable"])`,

  'team-member:spii-audit': `flowchart TD
  A(["Member types in notes or cases"]) --> B{"Detection enabled?"}
  B -->|No| Z(["No scan"])
  B -->|Yes| C["Scan text for PII or SPII"]
  C --> D{"Match found?"}
  D -->|No| Z
  D -->|Yes| E[("Redacted match logged")]
  E --> F{"Send Chat alert?"}
  F -->|No| G(["Stays in audit log"])
  F -->|Yes| H(["Alert pushed to Chat"])`,

  'team-member:spii-analytics': `flowchart TD
  A(["Open SPII Analytics"]) --> B[/"Load SPII cases"/]
  B --> C["Apply team, member, date filters"]
  C --> D["Summarize by status and review state"]
  D --> E{"Adjust filters?"}
  E -->|Yes| C
  E -->|No| F{"Export?"}
  F -->|No| G(["View on screen"])
  F -->|Yes| H[("Generate CSV")]
  H --> G`,

  'team-member:templates': `flowchart TD
  A(["Open Templates tab"]) --> B{"Have templates?"}
  B -->|No| C["Create manually or AI-import"]
  C --> D[/"Pick an action"/]
  B -->|Yes| D
  D --> E{"Which action?"}
  E -->|Copy| F["Copy to clipboard"]
  E -->|Export| G[("Export CSV")]
  E -->|Share| H["Select templates and recipients"]
  H --> I[("Pending share stored")]
  I --> J["Recipient reviews shares"]
  J --> K{"Accept?"}
  K -->|No| L(["Share dismissed"])
  K -->|Yes| N[("Templates copied to their list")]
  N --> O(["Available to recipient"])
  F --> M{"Do more?"}
  G --> M
  M -->|Yes| D
  M -->|No| P(["Done"])`,

  'team-member:gcp-billing': `flowchart TD
  A(["Open GCP Billing"]) --> B[/"Enter inputs"/]
  B --> C["Calculator computes result"]
  C --> D{"Recalculate?"}
  D -->|Yes| B
  D -->|No| E(["Result ready"])`,

  'team-member:notes': `flowchart TD
  A(["Open Documents"]) --> B{"Have a document?"}
  B -->|No| C["Create, migrate legacy, or import"]
  B -->|Yes| D["Pick document from sidebar tree"]
  C --> D
  D --> O{"Organize tabs?"}
  O -->|Add sub-tab| P["Nested under parent (max 3 levels)"]
  O -->|Drag to reorder/nest| Q["Depth clamped; new order saved"]
  O -->|Delete a parent| R["Removes its sub-tabs too (with warning)"]
  P --> E
  Q --> E
  O -->|"No, just edit"| E
  E[/"Edit title & rich text"/]
  E --> J{"Bring in content?"}
  J -->|Upload .docx/.html| K["Convert & sanitize"]
  J -->|Paste from Google Docs| K
  J -->|Pick from Google Drive| K
  K --> F
  E --> F["Auto-save (debounced)"]
  F --> G{"Detection on?"}
  G -->|Yes| H["Scan text for sensitive data"]
  H --> I(["Saved"])
  G -->|No| I
  I --> E`,

  'team-member:metric-analytics': `flowchart TD
  A(["Open Metric Analytics"]) --> B[/"Load performance data"/]
  B --> C["Visualize metrics"]
  C --> D{"Change range?"}
  D -->|Yes| B
  D -->|No| E(["Self-service view"])`,

  'team-member:feedback': `flowchart TD
  A(["Click feedback button"]) --> B{"Bug or UAT?"}
  B -->|Bug| C[/"Enter title and details"/]
  B -->|UAT| D["Rate each feature Working or Not"]
  D --> E{"Any not working?"}
  E -->|Yes| F[/"Explain per feature"/]
  E -->|No| G["Mark all working"]
  C --> H[("Submission saved")]
  F --> H
  G --> H
  H --> I(["Appears in Admin feedback"])`,

  // ---- Team Leader Dashboard ----
  'team-leader:team-members': `flowchart TD
  A(["Open Team Members"]) --> B[/"Load your team"/]
  B --> C{"Add or remove?"}
  C -->|Add| D["Add member"]
  C -->|Remove| E["Remove member"]
  D --> F[("Roster updated")]
  E --> F
  F --> G{"More changes?"}
  G -->|Yes| C
  G -->|No| H(["Team current"])`,

  'team-leader:updates': `flowchart TD
  A(["Compose team update"]) --> B[/"Set content and deadline"/]
  B --> C[("Published to team")]
  C --> D["Members acknowledge"]
  D --> E{"All acknowledged?"}
  E -->|No| F["Follow up with pending"]
  F --> D
  E -->|Yes| G(["Full read-receipt"])`,

  'team-leader:acknowledgments': `flowchart TD
  A(["Open My Acknowledgments"]) --> B[/"Load pending acks"/]
  B --> C{"Any pending?"}
  C -->|No| D(["Compliant"])
  C -->|Yes| E["Acknowledge one"]
  E --> B`,

  'team-leader:migrations': `flowchart TD
  A(["Member requests a move"]) --> B["Request surfaced to leader"]
  B --> C{"Approve?"}
  C -->|No| D(["Denied - no change"])
  C -->|Yes| E[("Member team updated")]
  E --> F(["Rosters accurate"])`,

  'team-leader:shared': `flowchart TD
  A(["Open a shared tool"]) --> B[/"Data loaded, team-scoped"/]
  B --> C["Work or read rollups"]
  C --> D{"Switch tool?"}
  D -->|Yes| A
  D -->|No| E(["Done"])`,

  // ---- Trainer Dashboard ----
  'trainer:updates': `flowchart TD
  A(["Compose cross-team update"]) --> B[/"Set content and deadline"/]
  B --> C[("Published to audience")]
  C --> D["Track acknowledgments"]
  D --> E{"Follow up needed?"}
  E -->|Yes| D
  E -->|No| F(["Verifiable reach"])`,

  'trainer:shared': `flowchart TD
  A(["Open Billing or Notes"]) --> B["Use the trimmed toolset"]
  B --> C(["Just what the role needs"])`,

  // ---- Admin Dashboard ----
  'admin:users': `flowchart TD
  A(["Open User Management"]) --> B[/"Load all users"/]
  B --> C{"Action type?"}
  C -->|Role or features| D["Update fields"]
  C -->|Reset or delete| E["Privileged action"]
  E --> F["Role-checked Cloud Function"]
  D --> G[("Change persisted")]
  F --> G
  G --> H{"More users?"}
  H -->|Yes| C
  H -->|No| I(["Access model correct"])`,

  'admin:add-user': `flowchart TD
  A(["Admin clicks Add User"]) --> B[/"Enter name, email, role, team"/]
  B --> C[("Invite saved to provisioned_users")]
  C --> D(["Awaiting first login"])
  D --> E["User signs in with Google SSO"]
  E --> F{"Invite for this email?"}
  F -->|Yes| G["Create account with assigned role, approved"]
  G --> H["Consume invite"]
  H --> I(["Working immediately, no approval"])
  F -->|No| J["Normal sign-in flow"]`,

  'admin:pending': `flowchart TD
  A(["Leader or trainer registers"]) --> B["Lands in pending queue"]
  B --> C{"Approve?"}
  C -->|No| D(["Rejected"])
  C -->|Yes| E[("Account activated")]
  E --> F(["Access granted"])`,

  'admin:apps-script': `flowchart TD
  A(["Admin sets Web App /exec URL"]) --> B[("Saved to settings/integrations")]
  B --> C["Enable per user in Manage features"]
  C --> D["User opens Apps Script tab"]
  D --> E[/"appsScriptService call"/]
  E --> F["HTTPS to Apps Script Web App"]
  F --> G["Sheets / Docs / Drive / Gmail"]
  G --> H(["JSON back to the app"])`,

  'admin:settings': `flowchart TD
  A(["Open System Settings"]) --> B[/"Adjust SPII schedule, template, statuses"/]
  B --> C[("Settings saved")]
  C --> D{"Adjust more?"}
  D -->|Yes| B
  D -->|No| E(["Behavior tuned"])`,

  'admin:analytics': `flowchart TD
  A(["Open Analytics"]) --> B[/"Aggregate acknowledgments"/]
  B --> C["Show org-wide breakdown"]
  C --> D(["Compliance measurable"])`,

  'admin:spii-oversight': `flowchart TD
  A(["Open SPII Analytics or Audit"]) --> B[/"Load org-wide data and ledger"/]
  B --> C{"Delete a log?"}
  C -->|Restricted| D["Records preserved"]
  C -->|Review| E["Investigate and oversee"]
  D --> E
  E --> F(["Auditable end-to-end"])`,

  'admin:feedback': `flowchart TD
  A(["Open User Feedback"]) --> B[/"Stream submissions"/]
  B --> C["Filter by type or dashboard"]
  C --> D{"Export?"}
  D -->|Yes| E[("CSV, one column per feature")]
  D -->|No| F["Read on screen"]
  E --> G(["Actionable record"])
  F --> G`,

  'admin:audit-forensics': `flowchart TD
  A(["User performs an action"]) --> B{"Productive action?"}
  B -->|"Track/edit case, log SPII, send/ack update, save note"| C[("Append event: user, dashboard, case ID, SPII flag")]
  B -->|Just browsing tabs| D[("Append navigation event")]
  C --> E[/"Admin opens the trail"/]
  D --> E
  E --> F["Filter by category / date / search"]
  F --> G{"Drill into a user?"}
  G -->|Yes| H["Reconstruct that user's timeline"]
  G -->|No| I{"Export?"}
  H --> I
  I -->|Detailed| J[("Row-per-event CSV")]
  I -->|Pivot| K[("Users x actions + compliance CSV")]
  I -->|No| L["Compliance: flag 'access only' users"]
  J --> M(["Accountable forensic record"])
  K --> M
  L --> M`,

  'admin:updates-cleanup': `flowchart TD
  A(["Open Updates tab"]) --> B[/"Load all updates (real-time)"/]
  B --> C{"Delete what?"}
  C -->|One card| D["Delete single"]
  C -->|Tick several| E["Delete selected"]
  C -->|Everything| F["Delete all"]
  D --> G{"Confirm?"}
  E --> G
  F --> G
  G -->|Cancel| B
  G -->|Confirm| H["Cascade: update + acks + notifications"]
  H --> I["Notify affected members"]
  I --> J(["Clean update list"])`,

  'admin:utilization': `flowchart TD
  A(["User active in the app"]) --> B{"Tab visible and not idle?"}
  B -->|No| A
  B -->|Yes| C["Heartbeat accrues active time"]
  A --> D["Tab opened"]
  D --> E[("Log activity + audit event")]
  C --> E
  E --> F[/"Admin monitor reads live"/]
  F --> G["Join with tracked-case data"]
  G --> H(["Per-user usage, charts and audit trail"])`,
};
