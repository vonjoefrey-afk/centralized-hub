# Project Handover & Operations Guide

Everything the next developer needs to take over, run, and ship this app.

---

## 1. What this is

- **Frontend:** React 18 + Vite 7 + Tailwind CSS (SPA, `react-router-dom`).
- **Backend:** Firebase — Firestore (data), Auth (Google SSO), Cloud Functions
  (privileged/server-side ops). No separate custom server.
- **Hosting/Project:** Firebase project **`centralized-gcp`** →
  <https://centralized-gcp.web.app>.
- **External integration:** optional Google Apps Script Web Apps, called only
  over HTTPS via `src/services/appsScriptService.js` (kept fully separate).

Repo: <https://github.com/vonjoefrey-afk/centralized-hub>

---

## 2. Prerequisites

- **Node.js 20** (matches Cloud Functions runtime).
- **Firebase CLI** (`npm i -g firebase-tools`) — only needed for manual/local work.
- A Google account that has been **granted access to the `centralized-gcp`
  GCP/Firebase project** (see §8).

---

## 3. Get the code & run locally

```bash
git clone https://github.com/vonjoefrey-afk/centralized-hub.git
cd centralized-hub
npm install                 # app dependencies (regenerates node_modules; NOT in git)
npm --prefix functions install   # Cloud Functions dependencies

# Create the local env file from the template and fill in the values (see §4)
cp .env.example .env        # then edit .env

npm start                   # local dev server at http://localhost:3000
npm run build               # production build into ./build
npm test                    # unit tests (Vitest)
```

> `node_modules` (~1.3 GB) is intentionally **not** in git — `npm install`
> rebuilds it. Never copy it between machines; that's why a Drive/folder copy
> fails.

---

## 4. Environment variables & secrets

**Client config (`.env`, git-ignored)** — build-time, `REACT_APP_` prefix (see
`.env.example`):

| Key | Purpose |
|---|---|
| `REACT_APP_FIREBASE_API_KEY` | Firebase web API key (public-safe) |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `REACT_APP_FIREBASE_PROJECT_ID` | `centralized-gcp` |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender id |
| `REACT_APP_FIREBASE_APP_ID` | Firebase app id |
| `REACT_APP_APPS_SCRIPT_URL` | *(optional)* fallback Apps Script `/exec` URL |

**Server secrets (never in git, never in the frontend):**

- Cloud Functions secrets in GCP: `GEMINI_API_KEY` (AI template extraction) and,
  if used, `APPS_SCRIPT_SECRET` (shared secret for the Apps Script proxy). These
  live in **GCP Secret Manager / functions config** and come with project access.
- Git-ignored recovery files if present: `RECOVERY_CODE.txt`, `BACKUP_ADMIN*.txt`.

> Hand these over through a **password manager share or a one-time-secret link**,
> not email or a shared Drive.

---

## 5. Deploying

**Normal path (recommended): through GitHub — no terminal.** See §6. Open a PR →
get it approved → merge → the GitHub Action deploys to production.

**Manual fallback** (only if you have project access + Firebase CLI):

```bash
npm run build
firebase login
firebase deploy --only hosting,functions,firestore:rules --project centralized-gcp
```

Deploy targets (`firebase.json`): `hosting` (the `build/` folder), `functions`
(the `functions/` folder), and Firestore `rules` (`firestore.rules`).

---

## 6. CI/CD — ship changes through GitHub (one-time setup)

The workflow in `.github/workflows/deploy.yml` deploys to Firebase automatically
when an approved change lands on `main`. To enable it once:

1. **Branch protection** — repo *Settings → Branches → Add rule* for `main`:
   require a pull request, require **≥ 1 approving review**, and disable direct
   pushes. (Optionally add required reviewers via a `CODEOWNERS` file.)
2. **Deploy approval gate** — *Settings → Environments → New environment →
   `production`*, then add the **authorized personnel** under *Required
   reviewers*. Now a merge pauses until one of them approves the actual go-live.
3. **Secrets** — *Settings → Secrets and variables → Actions*, add:
   - `FIREBASE_SERVICE_ACCOUNT` — full JSON of a GCP service-account key (see §8).
   - All seven `REACT_APP_*` values from §4.

**Resulting flow:** branch → PR → reviewer approves → merge to `main` →
`production` reviewer approves the deploy → GitHub Action builds & deploys. No
one runs `firebase deploy` by hand.

---

## 7. Making changes from a browser (no local setup — e.g. a managed Chromebook)

You don't need a terminal, local installs, or filesystem access to change this
codebase. **Claude Code on the web** runs each session in a cloud sandbox: the
repo is cloned there, Claude edits the code and runs the commands (`npm install`,
`npm run build`, `npm test`) in that sandbox, then pushes a branch and opens a
pull request. You only type prompts in the browser — nothing runs on your
device, so a locked-down Chromebook is fine.

**One-time setup (in Chrome):**

1. Go to <https://claude.ai/code> and sign in with your Claude account (needs a
   plan that includes Claude Code).
2. **Connect GitHub** and authorize access to `vonjoefrey-afk/centralized-hub`.
3. IT note: the network must allow `claude.ai` and `github.com`.

**Making a change:**

1. Start a session on the repo and describe the change in plain language
   (e.g. *"Add a CSV export button to the admin User Management table"*).
2. Claude creates a branch, writes the code, runs the build and tests in the
   cloud, and opens a **pull request**.
3. A second maintainer reviews and merges the PR (see §6 — `main` is protected,
   so every change goes through review). GitHub won't let you approve your own
   PR, so when one owner opens it, the **other owner approves**.
4. Merging to `main` triggers the GitHub Action, which deploys to production.

**Notes:**

- Build and tests in the cloud need **no secrets** — Claude never needs the
  `.env` or the service-account key. Deployment still happens through GitHub
  Actions (§6), not from Claude's sandbox.
- Because `main` is protected, a browser-only contributor can still only
  *propose* changes via PR — production stays gated behind review.

---

## 8. GCP / Firebase project handover

The code is only half the turnover — the app runs on **`centralized-gcp`**.

1. **Grant project access:** GCP Console → *IAM & Admin → IAM* → add the next
   dev's Google account as **Owner** (or Editor). Firebase Console →
   *Project settings → Users and permissions* works too. Ideally also move
   **billing/ownership** off any personal account.
2. **Service account for CI** (for `FIREBASE_SERVICE_ACCOUNT`): create a service
   account and grant roles sufficient for a full deploy — e.g. **Firebase Admin**,
   **Cloud Functions Admin**, **Service Account User**, **Artifact Registry
   Admin**, and **Cloud Build Editor**. Create a JSON key and paste it into the
   GitHub secret. Treat this key like a password.

---

## 9. Making the repo private

GitHub repo → *Settings → General → Danger Zone → Change repository visibility →
Private*. A private repo is visible only to you and collaborators you invite
(*Settings → Collaborators → Add people*). Grant the next dev access when ready;
remove access when offboarding.

---

## 10. Where things live (quick map)

- `src/components/dashboards/` — role dashboards (Admin, Team Member, Leader,
  Trainer) + feature tabs (Templates, Notes/Scratchpad, Case Tracker,
  Utilization Monitor, Metric Analytics, Apps Script, …).
- `src/services/` — data/service layer (`users`, `teams`, `updates`, `activity`,
  `appsScriptService`).
- `src/firebase/` — Firebase init, `auth.js`, `firestore.js`.
- `functions/` — Cloud Functions (`src/*.controller.js`, exported in `index.js`).
- `firestore.rules` — security rules (deployed with the app).
- `src/components/Documentation/` — in-app `/docs` (hand-maintained
  `docsContent.js` + `featureFlows.js`); every feature has an entry.

---

## 11. Offboarding checklist (for the outgoing owner)

- [ ] All code committed and pushed to `main` (private repo).
- [ ] Next dev added as a GitHub collaborator.
- [ ] Next dev granted `centralized-gcp` IAM access; ownership/billing moved off
      personal account.
- [ ] `.env`, functions secrets, and recovery files handed over securely.
- [ ] CI secrets (`FIREBASE_SERVICE_ACCOUNT`, `REACT_APP_*`) set in GitHub.
- [ ] Branch protection + `production` environment reviewers configured.
- [ ] Your personal access removed after the next dev confirms everything works.
