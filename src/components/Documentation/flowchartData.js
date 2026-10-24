/**
 * Dashboard-level flowcharts as Mermaid definitions — the overview plus one per
 * dashboard. Real graphs with branching, merges, and loops. Shapes: ([..])
 * start/end · [..] process · {..} decision · [/../] input-output · [(..)] store.
 */

export const FLOWCHART_TABS = [
  { id: 'overview', label: 'Overview', accent: 'indigo' },
  { id: 'team-member', label: 'Team Member', accent: 'blue' },
  { id: 'team-leader', label: 'Team Leader', accent: 'violet' },
  { id: 'trainer', label: 'Trainer', accent: 'emerald' },
  { id: 'admin', label: 'Admin', accent: 'rose' },
];

export const FLOWCHARTS = {
  overview: {
    title: 'Platform Overview',
    subtitle: 'From sign-in through role routing to the shared data layer and background automation.',
    definition: `flowchart TD
  A(["User visits the app"]) --> B{"Sign-in method?"}
  B -->|Google SSO| C["Firebase Auth verifies"]
  B -->|Email| C
  B -->|Admin sudo| C
  C --> D[/"Read role from user doc"/]
  D --> E{"Approved role?"}
  E -->|No| F["Pending approval"]
  F --> D
  E -->|Yes| G{"Which role?"}
  G -->|Admin| H["Admin Dashboard"]
  G -->|Trainer| I["Trainer Dashboard"]
  G -->|Team Leader| J["Team Leader Dashboard"]
  G -->|Team Member| K["Team Member Dashboard"]
  H --> L[("Cloud Firestore")]
  I --> L
  J --> L
  K --> L
  L --> M["Cloud Functions automation"]
  M --> N(["Google Chat notifications"])`,
  },

  'team-member': {
    title: 'Team Member Dashboard',
    subtitle: 'Pick a tab, do the work; SPII-flagged cases branch into the notification flow.',
    definition: `flowchart TD
  A(["Member signs in"]) --> B["Team Member Dashboard"]
  B --> C{"Pick a tab"}
  C -->|Updates| D["Acknowledge updates"]
  C -->|Case Tracker| E["Log a case"]
  C -->|Templates| F["Save, share, export"]
  C -->|My SPII Cases| G["Track SPII review"]
  E --> H{"SPII flagged?"}
  H -->|Yes| G
  H -->|No| C
  G --> I[("SPII mirror synced")]
  I --> J["Daily follow-up"]
  J --> K(["Google Chat"])
  D --> C
  F --> C`,
  },

  'team-leader': {
    title: 'Team Leader Dashboard',
    subtitle: 'Run the team: broadcast with acknowledgment loops and approve migrations.',
    definition: `flowchart TD
  A(["Leader signs in"]) --> B["Team Leader Dashboard"]
  B --> C{"Pick a task"}
  C -->|Updates| D["Broadcast to team"]
  C -->|Migrations| E{"Approve move?"}
  C -->|Team Members| F["Manage roster"]
  D --> G["Track acknowledgments"]
  G --> H{"All acknowledged?"}
  H -->|No| G
  H -->|Yes| C
  E -->|Yes| I[("Roster updated")]
  E -->|No| C
  I --> C
  F --> C`,
  },

  trainer: {
    title: 'Trainer Dashboard',
    subtitle: 'A focused surface for cross-team broadcasting and core tools.',
    definition: `flowchart TD
  A(["Trainer signs in"]) --> B["Trainer Dashboard"]
  B --> C{"Pick a tab"}
  C -->|Updates| D["Cross-team broadcast"]
  C -->|Billing or Notes| E["Use tools"]
  D --> F["Track acknowledgments"]
  F --> C
  E --> C`,
  },

  admin: {
    title: 'Admin Dashboard',
    subtitle: 'Full-platform control with onboarding approvals and feedback triage.',
    definition: `flowchart TD
  A(["Admin signs in"]) --> B["Admin Dashboard"]
  B --> C{"Pick an area"}
  C -->|Pending| D{"Approve signup?"}
  C -->|Users| E["Manage roles and features"]
  C -->|Feedback| F["Triage bug and UAT"]
  C -->|SPII| G["Oversee SPII handling"]
  D -->|Yes| H[("Account activated")]
  D -->|No| C
  H --> C
  E --> C
  F --> I[("Export CSV")]
  I --> C
  G --> C`,
  },
};
