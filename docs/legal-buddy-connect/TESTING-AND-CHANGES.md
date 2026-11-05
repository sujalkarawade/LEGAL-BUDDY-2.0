# Legal Buddy Connect — How to Test It & What Changed

This file has three parts:

1. **[How to test that it works](#part-1--how-to-test-that-it-works)**: setup, automated tests and a click-by-click manual test.
2. **[What was changed](#part-2--what-was-changed)**: every file that was modified or added.
3. **[Advanced features (round 2)](#part-3--advanced-features-round-2)**: Indian law checks, risk score, accuracy dashboard,
   lawyer clause review, obligation calendar, Hindi/Marathi read-aloud and template comparison — how to test them and what changed.

> **Important:** the code was written on a machine without Node.js or PostgreSQL, so it has **not
> been compiled or run yet**. Some small errors on the first run are likely. If a step fails, copy
> the full error message and send it back so it can be fixed.

---

# Part 1 — How to test that it works

## Step 0. What you need

- Node.js 20 or newer (`node --version`)
- PostgreSQL running, with the same `legal_buddy` database you already use (`DATABASE_URL` in `server/.env`)
- The project folder on your laptop with these changes in it

All commands below are for **PowerShell** on Windows. Run them one line at a time.
(Windows PowerShell 5.1 does not support `&&`, so commands are kept on separate lines.)

## Step 1. Install the new packages

Only the client gained new packages (`leaflet` and `@types/leaflet`), but run both installs to be safe.

```powershell
cd "C:\path\to\LEGAL BUDDY 2.0"
npm install --prefix server
npm install --prefix client
```

✅ **Expected:** both finish without `ERR!` lines. Warnings are fine.

## Step 2. Apply the database migration

This **adds** 10 new tables. It does not change or delete any existing table or data.

```powershell
cd server
npm run prisma:migrate
npm run prisma:generate
```

✅ **Expected:** `Applying migration 20261105000000_legal_buddy_connect` and then
`All migrations have been successfully applied`, followed by `Generated Prisma Client`.

Check the 13 specializations were inserted (optional):

```powershell
npx prisma studio
```

Open the `Specialization` table in the browser window. You should see Corporate Law, Contract Law and the other 11.

## Step 3. Add the new settings to `server/.env`

Open `server/.env.connect.example` and copy its lines into `server/.env`. The only one you must
edit is:

```
GEOCODER_USER_AGENT=LegalBuddy/2.0 (final-year project; contact: your-email@example.com)
```

Without it, searching by city or PIN code is switched off. "Use my location" and "Pick on map" still work.

(Optional) To use a different map tile provider, copy `client/.env.example` to `client/.env` and edit it.
The defaults work without any key.

## Step 4. Type-check and run the automated tests

Still inside the `server` folder:

```powershell
npm run typecheck
```

✅ **Expected:** no output and no errors. Any `error TS…` lines mean a compile error; send them back.

```powershell
npm run test:connect
```

This is the unit test suite. It needs no database. ✅ **Expected:** `# pass 22` and `# fail 0`.

```powershell
npm run test:connect:api
```

This is the full API test suite against your real database. It creates temporary accounts named
`connect-test-…@example.test` and deletes them afterwards.
✅ **Expected:** `# fail 0`.

Then check that nothing existing broke:

```powershell
npm run test:rag
cd ..
npm run build
```

✅ **Expected:** `test:rag` passes as it did before, and `npm run build` builds both the server and
the client without errors.

### What the automated tests cover

| Area | Checked by |
|---|---|
| Distance maths, radius box, experience ranges | `test:connect` |
| Input validation (bad coordinates, radius, PIN code, dates, unknown fields) | `test:connect` + `test:connect:api` |
| Lawyer cannot set `status: VERIFIED` or other admin-only fields | both |
| Consultation state machine (accept, reject, propose time, confirm, reschedule, cancel, complete, invalid moves) | both |
| Unpublished phone/email and undisclosed fee never appear publicly | both |
| File type checks (fake PDF, `.exe` rejected) | both |
| AI matching suggestions, the "unclear" case, and no contract text leaking | both |
| Role checks: user, lawyer, admin, no token (401/403) | `test:connect:api` |
| Registration, duplicate enrollment number, missing fields | `test:connect:api` |
| Draft → pending → approve / request info / reject / suspend / restore, plus audit log rows | `test:connect:api` |
| Unapproved, rejected and suspended lawyers hidden from search and profile | `test:connect:api` |
| Nearby search radius, specialization/language/experience filters, pagination, empty result | `test:connect:api` |
| Cross-user isolation (another user cannot see or change a request) | `test:connect:api` |
| Document sharing needs consent and ownership; revoking blocks the lawyer immediately | `test:connect:api` |
| Credentials visible only to the owner and admins | `test:connect:api` |
| Reports (one open report per user, admin-only resolution) | `test:connect:api` |
| Notifications created for each event, without the issue description in them | `test:connect:api` |

## Step 5. Start the app

```powershell
cd "C:\path\to\LEGAL BUDDY 2.0"
npm run dev
```

Open http://localhost:5173.

## Step 6. Manual test, click by click

You need **three accounts**. Use a normal window for one and private/incognito windows for the
others, or sign out between steps.

### 6.1 Create the admin

1. Register a normal account at `/register`, e.g. `admin@test.local`.
2. In PowerShell, inside the `server` folder:
   ```powershell
   npm run admin:promote -- admin@test.local
   ```
3. Sign out and sign in again as that account.

✅ The sidebar shows **Connect Admin**, and `/connect/admin` shows the statistics and an empty queue.

### 6.2 Register a lawyer

1. In a second window, open `/lawyer-login` and click **Register as a lawyer**.
2. Fill in name, email, password, State Bar Council and an enrollment number such as `MAH/1234/2015`.
3. You land on the **Lawyer dashboard**, with status "Draft — not submitted".

Then fill in each tab:

| Tab | What to do | ✅ Expected |
|---|---|---|
| Profile | Upload a JPG/PNG photo, set "Practising since", tick 1–2 specializations and languages, add a phone, leave **Publish** unticked, then save | "Profile saved." |
| Office | Enter an address, city, state and 6-digit PIN, then click **Find address on map** (or click the map) and drag the pin onto the building. Save. | Pin is shown and "Office location saved." |
| Availability | Add e.g. Monday 10:00–13:00 and save | "Availability saved." |
| Documents | Pick "Enrollment certificate", choose a PDF, then Upload | The file is listed, and **View** opens it |
| Overview | All required items are ticked, so click **Submit for review** | Status becomes "Pending verification" |

Negative checks:

- Try uploading a `.txt` renamed to `.pdf`. ✅ You get the error "The file content does not match its type".
- Try **Submit for review** before adding a document. ✅ It is disabled or shows the missing items.

### 6.3 The lawyer is not public yet

1. In a third window, register a normal user, e.g. `user@test.local`.
2. Open **Find a Lawyer** from the sidebar, click **Pick on map**, and click near the lawyer's office.

✅ The lawyer does **not** appear, and you see the "No lawyers found here" empty state.

### 6.4 Admin approves

1. As the admin, open **Connect Admin** and click **Review** on the lawyer.
2. Click **Open** on the uploaded document.
3. Choose **Approve and verify**. The button stays disabled until you tick
   "I have personally reviewed…". Tick it and click **Record decision**.

✅ The status becomes Verified, and **Audit history** shows the entry with your name and the time.
✅ The lawyer's bell icon shows "Profile verified".

Also try the other admin actions (it is easiest to use a second lawyer account):

- **Request more information** with a reason. ✅ The lawyer sees the reason on Overview and can resubmit.
- **Reject** with a reason. ✅ It is the same as above, with status Rejected.
- **Suspend** a verified lawyer. ✅ They disappear from search. **Restore** brings them back.

### 6.5 User finds the lawyer

As the user, on **Find a Lawyer**:

| Action | ✅ Expected |
|---|---|
| Click **Use my location** | An explanation box appears first. Click **Continue**, and the browser asks for permission. |
| Deny the browser permission | Message: "Location permission was denied…" and the other options still work |
| Type the city or PIN code and click Search (needs `GEOCODER_USER_AGENT`) | A list of places, or the map jumps there directly |
| Change the radius to 5 km / 100 km | Blue circle and results update |
| Lawyer marker on map | A green pin (verified). Clicking it opens the preview card at the bottom of the map. |
| Click the preview card | The full profile page opens |
| Filter by a specialization the lawyer does **not** have | The lawyer disappears |
| Sort by "Most experienced" / "Recently verified" | The order changes (only visible with several lawyers) |
| Pan the map | A "Search this area" button appears |
| Narrow the browser window to phone width | List/Map toggle and Filters button appear, with no sideways scrolling |

On the profile page:

- ✅ The phone shows "Phone number not published by the lawyer" because Publish was left unticked.
- As the lawyer, tick **Publish on my profile** for the phone and save. Reload the profile as the user.
  ✅ A **Call** button now appears and opens your phone/dialer app.

### 6.6 Consultation request

1. As the user, on the profile, click **Request consultation**.
2. Fill in the form, pick a date and time, and optionally choose an uploaded document and tick the consent box.
3. Click **Send request**.

✅ "Your request was sent…", and it appears under **My Consultations** with status *Pending*.
✅ Sending a second request to the same lawyer shows "You already have an open request…".

Then follow the request through each stage:

| Who | Action | ✅ Expected |
|---|---|---|
| Lawyer | Bell shows "New consultation request". Open **Requests**. | Request visible with description and contact. A shared document opens with the file button. |
| Lawyer | **Propose another time** | The user sees status "Reschedule requested" plus the proposed time |
| User | **Accept proposed time** | Status *Confirmed*, with the scheduled time shown |
| User | **Change time** with a new date | The lawyer sees "new time requested by client" |
| Lawyer | **Accept** | The user sees *Accepted*, then clicks **Confirm consultation** to make it *Confirmed* |
| User | **Stop sharing document** | When the lawyer clicks the document, it says "This file is not available" |
| Lawyer | **Mark completed** | Status *Completed* for both |

Also try **Decline** (lawyer) and **Cancel request** (user) on new requests.

### 6.7 AI lawyer matching

1. As the user, upload a contract (the existing Upload page) and wait for the analysis to finish.
2. Open **Clause Analysis** and click **"Need a lawyer for this contract?"**.

✅ It shows suggested specializations, each with "Why this is suggested" reasons, plus a disclaimer.
✅ **Find … lawyers near me** opens Find a Lawyer with that specialization pre-selected, plus a note
saying it is only a suggestion.
✅ **Ignore suggestions and search all lawyers** opens the search with no filter.

### 6.8 Access-control spot checks (browser)

| Try | ✅ Expected |
|---|---|
| As the user, open `/connect/admin` | Redirected to the dashboard |
| As the user, open `/connect/lawyer` | Redirected to the dashboard |
| As the lawyer, open `/connect/consultations` | Redirected to the dashboard |
| As the lawyer, look for a request button on another lawyer's profile | Text says requests are for client accounts |
| Sign out, then open `/connect/find` | Redirected to the login page |

These redirects are only the front-end. The server checks roles on every request regardless, and
`test:connect:api` proves that with direct API calls.

### 6.9 Regression check (existing features)

Quickly confirm the old features still work: sign-in, upload, summary, clause analysis, the chatbot,
completeness, obligations and the document generator. ✅ They behave as before. The only visible
additions are the bell icon, new sidebar items and the "Need a lawyer?" panel on Clause Analysis.

## Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| `error TS…` during `typecheck` or `build` | A compile error in the new code. Send the full message. |
| Migration fails on `gen_random_uuid` | PostgreSQL older than 13. Upgrade, or run `CREATE EXTENSION pgcrypto;` first. |
| `Property 'lawyerProfile' does not exist on type PrismaClient` | Run `npm run prisma:generate` in `server`. |
| `test:connect:api` says "Run the Legal Buddy Connect migration first" | Step 2 was not done on the database in `DATABASE_URL`. |
| Map is grey with no streets | No internet, or `VITE_MAP_TILE_URL` is wrong. Restart `npm run dev` after editing `client/.env`. |
| City/PIN search box is disabled | `GEOCODER_USER_AGENT` is not set in `server/.env`. Restart the server after adding it. |
| "Use my location" error about HTTPS | Location only works on `https://` or `http://localhost`. Don't open the app by IP address. |
| "Too many requests" | Rate limit hit (e.g. 10 lawyer registrations per hour). Wait, or restart the server. |
| Admin pages not visible after promoting | Sign out and sign in again. |

---

# Part 2 — What was changed

Nothing existing was deleted. Database changes only **add** tables. Nothing has been committed to git.

## Existing files modified (16)

| File | Change |
|---|---|
| `.gitignore` | Ignore `server/private_uploads/` (lawyer credentials and photos) |
| `README.md` | Replaced the "Lawyer Portal Placeholder" section with a Legal Buddy Connect summary linking to these docs |
| `client/package.json` | Added `leaflet` and `@types/leaflet` |
| `client/src/App.tsx` | Added the 7 Connect routes (`/connect/find`, `/connect/lawyers/:id`, `/connect/consultations`, `/connect/lawyer`, `/connect/lawyer/register`, `/connect/admin`, `/connect/admin/lawyers/:id`) with role guards |
| `client/src/components/layout/Navbar.tsx` | Added the notification bell |
| `client/src/components/layout/Sidebar.tsx` | Role-based items: Find a Lawyer (all), My Consultations + Lawyer Portal (user), Lawyer Dashboard (lawyer), Connect Admin (admin). Active-link matching made exact so `/connect/lawyer` isn't highlighted on `/connect/lawyers/…`. |
| `client/src/index.css` | Appended Connect styles (map, markers, split layout, mobile toggles, forms). Existing styles untouched. |
| `client/src/pages/DocumentClausesPage.tsx` | Added the "Need a lawyer for this contract?" panel |
| `client/src/pages/LawyerLoginPage.tsx` | Placeholder page replaced with a real entry page (register / sign in / open dashboard) |
| `server/package.json` | New scripts: `admin:promote`, `test:connect`, `test:connect:api`, `typecheck` |
| `server/prisma/schema.prisma` | `User.role` comment now includes `ADMIN`, plus relations on `User`/`Document` and 10 new models |
| `server/src/config/index.ts` | New settings: private upload folder, upload size limits, geocoder settings |
| `server/src/controllers/auth.controller.ts` | New `registerLawyer` (creates a `LAWYER` account and a draft profile) |
| `server/src/index.ts` | Mounted the 6 new route groups |
| `server/src/routes/auth.routes.ts` | Added `POST /api/auth/register-lawyer` (rate-limited) |
| `server/src/routes/document.routes.ts` | Added `GET /api/documents/:id/lawyer-match` (owner only) |

## New files

### Database

| File | Purpose |
|---|---|
| `server/prisma/migrations/20261105000000_legal_buddy_connect/migration.sql` | Creates `lawyer_profiles`, `lawyer_offices`, `specializations`, `lawyer_specializations`, `lawyer_availability`, `lawyer_credentials`, `consultation_requests`, `notifications`, `lawyer_reports` and `admin_audit_logs`, with indexes, foreign keys and coordinate checks, and inserts the 13 specializations |

### Backend (`server/src/…`)

| File | Purpose |
|---|---|
| `middleware/require-role.ts` | `requireRole('USER' \| 'LAWYER' \| 'ADMIN')`, the server-side role gate |
| `middleware/rate-limit.ts` | Small in-memory rate limiter |
| `middleware/connect-upload.ts` | Credential/photo upload checks (type, size, real file signature) |
| `services/connect/constants.ts` | Statuses, Bar Council list and all input validation rules |
| `services/connect/geo.service.ts` | Nearby search SQL (bounding box plus exact distance), distance helpers |
| `services/connect/lawyer-serializer.ts` | The only "public" shape of a lawyer (hides private data) |
| `services/connect/consultation-workflow.ts` | Consultation state machine and document-access rule |
| `services/connect/consultation-serializer.ts` | What the user vs the lawyer sees for a request |
| `services/connect/profile-completion.ts` | Profile completion checklist |
| `services/connect/notification.service.ts` | In-app notifications |
| `services/connect/geocoding.service.ts` | City/PIN search proxy (throttled, cached, policy-compliant) |
| `services/connect/connect-file.service.ts` | Saves and serves private files safely |
| `services/connect/lawyer-matching.service.ts` | AI specialization suggestions from clause categories |
| `controllers/lawyer.controller.ts` | Search, public profile, photo, report, document matching |
| `controllers/lawyer-portal.controller.ts` | Lawyer's own profile, office, availability, documents, submission, requests |
| `controllers/consultation.controller.ts` | User's consultation requests |
| `controllers/admin-lawyer.controller.ts` | Admin stats, review, decisions plus audit log, reports, specializations |
| `controllers/notification.controller.ts` | Notification list/read, plus the location search endpoint |
| `routes/connect.routes.ts` | All new API routes with their role checks and rate limits |

### Backend scripts and tests (`server/scripts/…`)

| File | Purpose |
|---|---|
| `promote-admin.ts` | `npm run admin:promote -- <email>` (`--revoke` to undo) |
| `connect-unit.test.ts` | Unit tests (no database) |
| `connect-api.test.ts` | API integration tests (real database, cleans up after itself) |

### Frontend (`client/src/…`)

| File | Purpose |
|---|---|
| `types/connect.ts` | TypeScript types and constant lists |
| `services/connectApi.ts` | All Connect API calls |
| `vite-env.d.ts` | Types for the map settings in `client/.env` |
| `components/connect/mapConfig.ts` | Map tile provider settings |
| `components/connect/LawyerMap.tsx` | Leaflet map with clustering, search circle, preview selection, "Search this area" |
| `components/connect/OfficeLocationPicker.tsx` | Draggable office pin for lawyers |
| `components/connect/ConnectUi.tsx` | Shared badges, lawyer card, avatar, formatters, disclaimer |
| `components/connect/ConsultationRequestModal.tsx` | Request form with the document consent checkbox |
| `components/connect/NotificationBell.tsx` | Navbar bell and dropdown |
| `components/connect/LawyerMatchPanel.tsx` | AI suggestion panel on Clause Analysis |
| `components/connect/RequireRole.tsx` | Front-end route guard |
| `pages/connect/FindLawyerPage.tsx` | Find a Lawyer |
| `pages/connect/LawyerProfilePage.tsx` | Public lawyer profile |
| `pages/connect/MyConsultationsPage.tsx` | User's request history |
| `pages/connect/LawyerRegisterPage.tsx` | Lawyer sign-up |
| `pages/connect/LawyerDashboardPage.tsx` | Lawyer dashboard (6 tabs) |
| `pages/connect/AdminConnectPage.tsx` | Admin stats, lawyer list, reports, specializations |
| `pages/connect/AdminLawyerReviewPage.tsx` | Admin verification review and audit history |

### Configuration and docs

| File | Purpose |
|---|---|
| `server/.env.connect.example` | New server settings to copy into `server/.env` |
| `client/.env.example` | Optional map tile settings |
| `docs/legal-buddy-connect/PHASE-0-AUDIT.md` | Original codebase audit and plan |
| `docs/legal-buddy-connect/README.md` | Module documentation (architecture, security, configuration) |
| `docs/legal-buddy-connect/TESTING-AND-CHANGES.md` | This file |

## Folders created when the server first runs

- `server/private_uploads/connect/credentials/` and `server/private_uploads/connect/photos/`
  hold private lawyer files. They are git-ignored, never publicly served, and not touched by `clean:uploads`.

---

# Part 3 — Advanced features (round 2)

Seven features were added on top of Legal Buddy Connect. Like the rest, they have **not been run yet**.

| # | Feature | Where to find it |
|---|---|---|
| 1 | **Indian law checks**: rule-based flags citing the Indian Contract Act (s.23, 27, 28, 74), Arbitration and Conciliation Act (s.20), DPDP Act 2023, Stamp Act (s.35) and CPC (ss.16–20) | Document tab **Indian Law Checks** |
| 2 | **Overall risk score** (0–100) with a point-by-point "Why this score?" breakdown | Top of **Summary**, and on **Indian Law Checks** |
| 3 | **Accuracy & Evaluation dashboard**: precision/recall per clause type and per law rule, plus the existing retrieval, hybrid-search and end-to-end results | Sidebar **Accuracy & Evaluation** |
| 4 | **Lawyer clause review**: the lawyer marks each clause *Acceptable* / *Needs change*, comments and suggests wording; the client replies | Lawyer dashboard → Requests; user → My Consultations; feedback also appears on **Clause Analysis** |
| 5 | **Obligation calendar**: "Remind me" date per obligation (in-app notification on that day) and **Add to calendar (.ics)** | **Obligations** tab |
| 6 | **Hindi / Marathi explanations + read aloud** | **Summary** and each clause on **Clause Analysis** |
| 7 | **Compare with a standard template** (NDA / MSA / Employment): present, different wording or missing, per section | Document tab **Compare** |

## Step A. Apply the new migration and run the new tests

From the `server` folder (after the Part 1 setup):

```powershell
npm run prisma:migrate
npm run prisma:generate
npm run typecheck
npm run test:insights
npm run eval:clauses
npm run test:connect:api
```

| Command | ✅ Expected |
|---|---|
| `prisma:migrate` | Applies `20261106000000_insights_reviews_reminders` (adds 2 tables and 1 column, nothing removed) |
| `test:insights` | `# fail 0`. This covers 14 unit tests: every law rule positive and negative, risk score caps, template parsing and comparison, `.ics` format and date parsing, metrics maths, and review consent rules. |
| `eval:clauses` | Prints clause-detection and law-check precision/recall and saves `evaluations/last-clause-results.json`. The numbers are whatever the engine really scores on the 10 hand-labelled cases. **Do not edit the labels to raise the score.** |
| `test:connect:api` | `# fail 0`, now including clause review, reminders, calendar export, insights/compare endpoints and translation input checks |

## Step B. Manual test

| Feature | How to test | ✅ Expected |
|---|---|---|
| Indian law checks | Upload a contract containing "shall not engage in any competing business for two years after termination" and "liquidated damages". Open **Indian Law Checks**. | Flags for Section 27 (Important) and Section 74 (Review), each with the excerpt, page, explanation and a **Find a lawyer for this** button |
| Risk score | Open **Summary** | A circular score with Low/Moderate/High/Very high. **Why this score?** lists every point and the formula. |
| Evaluation dashboard | Run `npm run eval:clauses`, then open **Accuracy & Evaluation** | Score tiles, precision/recall bars per category and rule, and per-case results, each with its scope notice and run time |
| Lawyer clause review | As a user, request a consultation, choose a document, tick consent **and** "also share Legal Buddy's clause findings". As the lawyer, go to **Requests → Review clauses with the client**, choose *Needs change*, write a comment and suggested wording. | The user gets a notification. The comment appears under **My Consultations → Lawyer feedback on clauses** and under that clause on **Clause Analysis**. The user can reply. **Stop sharing document** closes the review for the lawyer. |
| Review without consent | Send a request with a document but leave the second box unticked | The lawyer sees no "Review clauses" button |
| Reminders | On **Obligations**, click **Remind me** and pick a date | A badge shows the date. On that day (checked hourly while the server runs) a bell notification appears. |
| Calendar | Click **Add to calendar (.ics)** and open the file | Google Calendar / Outlook / phone imports the dated obligations and your reminders, with a 1-day alert |
| Read aloud | Click **Read aloud** on the Summary | The browser speaks the summary. Nothing is sent to a server. |
| Hindi / Marathi | Click **हिंदी** or **मराठी** | **Needs `GROQ_API_KEY` or `OPENROUTER_API_KEY`** in `server/.env`. Shows the translation plus a "machine translation" notice; read aloud works if your device has a Hindi/Marathi voice. Without a key you see a clear message saying a provider is needed. |
| Compare | Open **Compare** and choose the Mutual NDA template | Each template section shows Present / Different wording / Missing, a % word match, the closest contract text and its page |

## What changed in round 2

**Database:** new migration `server/prisma/migrations/20261106000000_insights_reviews_reminders/`:
- new tables `clause_review_comments` and `obligation_reminders`;
- new column `consultation_requests.analysisShareConsentAt`;
- `schema.prisma` updated to match.

**New backend files**

| File | Purpose |
|---|---|
| `server/src/services/insights/indian-law-checks.ts` | The 8 Indian-law rules, with statute, section, reason, excerpt and page for each flag |
| `server/src/services/insights/risk-score.ts` | Risk score formula and breakdown |
| `server/src/services/insights/template-compare.ts` | Template section parser and word-overlap comparison |
| `server/src/services/insights/ics.ts` | iCalendar writer and explicit-date parser |
| `server/src/services/insights/translation.service.ts` | Hindi/Marathi translation through the existing AI provider, with a cache |
| `server/src/services/insights/reminder.service.ts` | Hourly reminder → notification job |
| `server/src/services/insights/clause-benchmark.ts` | Precision/recall scoring for the evaluation |
| `server/src/controllers/insights.controller.ts` | Law checks/risk, compare, translate, reminders, calendar, lawyer feedback per document |
| `server/src/controllers/clause-review.controller.ts` | Lawyer and client clause-review endpoints |
| `server/src/controllers/evaluation.controller.ts` | Serves saved evaluation results to the dashboard |
| `server/evaluations/clause-cases.json` | 10 synthetic, hand-labelled benchmark cases |
| `server/scripts/evaluate-clauses.ts` | `npm run eval:clauses` |
| `server/scripts/insights-unit.test.ts` | `npm run test:insights` |

**Backend files modified:**
- `ai-service.ts`: new `translateExplanation` method.
- `document.routes.ts`: 8 new document routes.
- `connect.routes.ts`: 4 review routes.
- `index.ts`: evaluation route and starts the reminder job.
- `consultation.controller.ts`: accepts the new analysis-share consent.
- `consultation-workflow.ts`: new `canLawyerReviewAnalysis` rule.
- `consultation-serializer.ts`: adds an `analysisShared` flag.
- `constants.ts`: review and consent validation.
- `package.json`: `test:insights` and `eval:clauses` scripts.
- `connect-api.test.ts`: 4 new test groups.

**New frontend files**

| File | Purpose |
|---|---|
| `client/src/pages/DocumentCompliancePage.tsx` | Indian Law Checks page |
| `client/src/pages/DocumentComparePage.tsx` | Template comparison page |
| `client/src/pages/EvaluationPage.tsx` | Accuracy & Evaluation dashboard |
| `client/src/components/insights/RiskScoreCard.tsx` | Score dial and breakdown |
| `client/src/components/insights/TranslateSpeak.tsx` | Read aloud plus Hindi/Marathi |
| `client/src/components/insights/ClauseReviewPanel.tsx` | Lawyer/client clause review thread |
| `client/src/components/insights/ReminderControl.tsx` | "Remind me" control |
| `client/src/services/insightsApi.ts`, `client/src/types/insights.ts` | API client and types |

**Frontend files modified:**
- `App.tsx`: 3 routes.
- `Sidebar.tsx`: Indian Law Checks, Compare Template and Accuracy & Evaluation entries.
- `DocumentNavHeader.tsx`: 2 tabs.
- `DocumentSummaryPage.tsx`: risk card, read aloud and translation.
- `DocumentClausesPage.tsx`: per-clause read aloud/translation and lawyer feedback.
- `DocumentObligationsPage.tsx`: reminders and calendar button.
- `ConsultationRequestModal.tsx`: second consent box.
- `LawyerDashboardPage.tsx` and `MyConsultationsPage.tsx`: review panel.
- `types/connect.ts`: `analysisShared` flag.
- `connectApi.ts`: exports its request helper.
- `index.css`: new styles.

**Docs:** this section, plus the sharing paragraph in `docs/legal-buddy-connect/README.md`.

## Limits to state honestly in your presentation
- The law checks are **pattern-based flags**, not legal conclusions. Have a lawyer or faculty member check the rule wording.
- The evaluation uses **10 synthetic cases**. Present the numbers as "on our labelled test set", not as real-world accuracy.
- Template comparison measures **word overlap**, not legal equivalence.
- Hindi/Marathi output is **machine translation**. It needs an AI key, and important details should be checked against the English.
- Reminders fire only while the server is running (checked hourly). The `.ics` export works independently of that.
