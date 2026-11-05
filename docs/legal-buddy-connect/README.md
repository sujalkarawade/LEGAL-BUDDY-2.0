# Legal Buddy Connect

> **Find the Right Lawyer. Get the Right Legal Assistance.**
> Lawyer discovery, verification and consultation module for Legal Buddy 2.0.

> ⚠️ **Verification status: written but NOT yet compiled or run.** The code was written on a machine
> without Node.js or PostgreSQL. Run every command in [First run](#first-run-and-verification) and fix
> anything that fails before demonstrating the module. Nothing in this document claims a feature works
> until those commands pass on your machine.

Legal Buddy Connect is a discovery and connection tool. It is **not** legal advice, does not rank or
recommend individual lawyers, and has no paid placement, ratings, or referral commissions (see
[Professional-conduct notes](#professional-conduct-notes)).

---

## What's included

| Area | Where |
|---|---|
| Find a Lawyer (map + list, location search, filters, sorting, clustering) | `client/src/pages/connect/FindLawyerPage.tsx`, `components/connect/LawyerMap.tsx` |
| Public lawyer profile, call/email actions, consultation request, report | `pages/connect/LawyerProfilePage.tsx`, `components/connect/ConsultationRequestModal.tsx` |
| User request history (confirm / reschedule / cancel / revoke document) | `pages/connect/MyConsultationsPage.tsx` |
| Lawyer registration + dashboard (profile, office pin, availability, documents, requests) | `pages/connect/LawyerRegisterPage.tsx`, `pages/connect/LawyerDashboardPage.tsx` |
| Admin stats, verification queue, review page, audit log, reports, specializations | `pages/connect/AdminConnectPage.tsx`, `pages/connect/AdminLawyerReviewPage.tsx` |
| AI practice-area matching on the Clause Analysis page | `components/connect/LawyerMatchPanel.tsx`, `server/src/services/connect/lawyer-matching.service.ts` |
| In-app notifications bell | `components/connect/NotificationBell.tsx` |
| Backend routes | `server/src/routes/connect.routes.ts` (+ `/api/auth/register-lawyer`, `/api/documents/:id/lawyer-match`) |
| Schema + migration | `server/prisma/schema.prisma`, `server/prisma/migrations/20261105000000_legal_buddy_connect/` |
| Tests | `server/scripts/connect-unit.test.ts`, `server/scripts/connect-api.test.ts` |

## First run and verification

Requires Node.js 20+ and PostgreSQL (tested target: 17). From the project root:

```bash
npm install --prefix server
```

```bash
npm install --prefix client
```

```bash
npm --prefix server run prisma:migrate
```

```bash
npm --prefix server run prisma:generate
```

Add the Connect settings to `server/.env` (copy from `server/.env.connect.example`). At minimum set
`GEOCODER_USER_AGENT` if you want city/PIN search; without it, place search is disabled and users can
still use their current location or pick a point on the map.

Create an administrator from an **existing** account (register it normally first):

```bash
npm --prefix server run admin:promote -- admin@example.com
```

Then verify, in this order:

```bash
npm --prefix server run typecheck
```

```bash
npm --prefix server run test:connect
```

```bash
npm --prefix server run test:connect:api
```

```bash
npm --prefix server run test:rag
```

```bash
npm run build
```

`test:connect` needs no database. `test:connect:api` needs the migrated database; it creates
uniquely-named `connect-test-…@example.test` accounts and deletes them (and their uploaded files)
when it finishes. `test:rag` and `npm run build` are the existing regression checks.

## Roles and access

| Role | How it is created | Can |
|---|---|---|
| `USER` | normal sign-up | search lawyers, view profiles, request/track consultations, report profiles, use AI matching on own documents |
| `LAWYER` | `/connect/lawyer/register` | manage own profile/office/availability/documents, submit for review, act on own consultation requests |
| `ADMIN` | `npm run admin:promote -- <email>` only | verification decisions, view credentials, reports, specializations, aggregate statistics |

Authorization is enforced on the server by `requireRole()` on every route group and by ownership
checks in every query (`userId` / `lawyerProfileId` scoping, 404 for other people's resources).
The React `RequireRole` guard only hides pages. `authenticateToken` reloads the role from the
database on every request, so a demoted user loses access immediately.

Lawyer and admin are deliberately separate accounts: the promote script refuses lawyer accounts,
and an admin cannot decide on a profile linked to their own user.

## Verification workflow

```
DRAFT ──submit──▶ PENDING_REVIEW ──APPROVE──▶ VERIFIED ◀──RESTORE── SUSPENDED
  ▲                  │      │                     └──────SUSPEND──────▲
  └──(edit, resubmit)┤      ├─REQUEST_INFO──▶ INFO_REQUESTED ──resubmit──┐
                     │      └─REJECT──▶ REJECTED ──resubmit──────────────┤
                     └◀──────────────────────────────────────────────────┘
```

* Only `VERIFIED` Legal Buddy profiles appear in search and can receive requests.
* Approval requires the admin to tick "I have personally reviewed the submitted documents". The UI
  says "Credentials reviewed by Legal Buddy" — it never claims a Bar Council database check, because
  no such integration exists.
* Reject / request-info / suspend / restore require a reason, which is shown to the lawyer.
* Each decision writes `admin_audit_logs` (admin, profile, action, previous status, new status,
  reason, timestamp) in the same transaction, using an optimistic status check to avoid races.
* Lawyers can never write `status`, `verifiedAt`, `verifiedById`, `source`, `isSynthetic` or
  `statusReason` — the update schema is `.strict()` and rejects those keys with HTTP 400.
* Name and enrollment details lock while a profile is pending, verified or suspended.

## Consultation workflow

```
PENDING ─ACCEPT→ ACCEPTED ─CONFIRM(user)→ CONFIRMED ─COMPLETE→ COMPLETED
   │ REJECT→ REJECTED          ▲
   └ PROPOSE_TIME / REQUEST_RESCHEDULE → RESCHEDULE_REQUESTED (by LAWYER or USER)
Any open state → CANCELLED (user; lawyer once accepted)
```

The state machine is a pure function (`consultation-workflow.ts`) with unit tests. Updates use an
optimistic `status + updatedAt` check so a lawyer and user acting at the same moment cannot overwrite
each other.

**Document sharing:** a request can reference one of the user's existing uploaded documents only
when the user ticks an explicit consent box. By default only the original PDF is shared. A second,
optional checkbox also shares Legal Buddy's clause findings so the lawyer can comment on each clause
(chat history and extracted text are never shared). Sharing is limited to that one lawyer and only
while the request is live, and the user can revoke it at any time. Revocation takes effect immediately
for both the PDF and the clause review.

**Notifications** are in-app only (`notifications` table, bell in the navbar). They never contain
the issue description, contact details or document content. No email provider is configured in
this project, so the module does not send or claim to send email; adding one later means calling
it from `NotificationService.notify`.

## Geographic search (why not PostGIS)

`GET /api/lawyers/nearby` uses plain PostgreSQL so the migration works on any server, including
machines without the PostGIS extension:

1. bounding-box prefilter on `lawyer_offices(latitude, longitude)` (B-tree index),
2. exact Haversine distance in SQL,
3. filters, sort and `LIMIT/OFFSET` with `COUNT(*) OVER ()` for the total, in one query.

This is index-assisted and comfortably fast for thousands of offices. If you later enable PostGIS,
replace `findNearbyLawyerIds()` in `geo.service.ts` with an `ST_DWithin` query on a
`geography(Point)` column + GiST index; nothing else needs to change.

User coordinates are used only for the search request. They are never stored, and the browser
location is read once (`getCurrentPosition`, no `watchPosition`) after an in-page explanation.

## Map and geocoding providers

| Setting | Default | Notes |
|---|---|---|
| `VITE_MAP_TILE_URL`, `VITE_MAP_ATTRIBUTION` (client) | OSM standard tiles | Dev/demo only per the [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/): no SLA, visible attribution, no bulk/offline use. Use a commercial or self-hosted provider in production. |
| `GEOCODER_URL` (server) | `https://nominatim.openstreetmap.org` | Dev/demo only per the [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/): ≤1 req/s for the whole app (enforced by a global server-side queue), identifying `GEOCODER_USER_AGENT` (required), 24 h cache, search on submit only (no autocomplete), `GEOCODER_ENABLED=false` kill switch. |

No API key is needed for the defaults, and no key is ever placed in the client bundle.

## AI lawyer matching

On **Clause Analysis**, "Need a lawyer for this contract?" calls
`GET /api/documents/:id/lawyer-match` (owner only). The server reads only the **stored labels**
from the existing pipeline — `ClauseFinding.category` + `riskLevel`, `ContractSummary.contractType`,
and `CompletenessCheck` sections marked `NOT_FOUND` — and maps them deterministically to practice
areas with a written reason for each suggestion. No excerpt, chunk or extracted text is read or
returned, no LLM is called, and no new chatbot exists. Low-risk clauses alone never trigger a
suggestion; if nothing clear is found the response says so. The user can follow a suggestion
(pre-fills the specialization filter, still requires choosing a location) or ignore it and search
manually.

## Security summary

* Server-side RBAC and ownership checks on every endpoint; foreign resources return 404.
* `zod` validation everywhere; `.strict()` schemas reject unexpected fields.
* Uploads: memory-buffered, extension + MIME + magic-byte checks (PDF/JPG/PNG), size caps,
  random file names, private directory outside `uploads/`, streamed with `nosniff`, `no-store` and a
  sandboxing CSP. Credential files are visible only to their owner and admins.
* Rate limits (in-process, per user or IP) on lawyer registration, search, geocoding,
  consultation create/update, reports, uploads and submissions.
* Public projection (`toPublicLawyer`) is the only lawyer shape returned by discovery endpoints:
  no user id, credentials, internal notes, or unpublished phone/email.
* Error responses are generic; no request bodies, document text or credentials are logged.
* Admin statistics show consultation counts only, not users' issue descriptions.

## Data model

New tables (one additive migration; nothing existing is altered or dropped): `lawyer_profiles`,
`lawyer_offices`, `specializations` (13 reference rows seeded by the migration), `lawyer_specializations`,
`lawyer_availability`, `lawyer_credentials`, `consultation_requests`, `notifications`,
`lawyer_reports`, `admin_audit_logs`. The existing `users` table gains only relations and the
`ADMIN` value for its existing `role` string.

`lawyer_profiles.source` (`LEGAL_BUDDY` | `EXTERNAL_DIRECTORY`) and status `LISTED` exist so that
authorised external directories can be added later. External rows can never receive the verified
badge; the "All approved listings" filter will include them. No external data is imported or
scraped in this release, so today that filter returns the same lawyers as "Legal Buddy verified only".

There is **no demo seed data**. To demo, register a lawyer, complete the profile with a real office
location you are allowed to use, and approve it as admin. If you ever add synthetic records, set
`isSynthetic = true`; the UI then shows a red "Demo record" badge everywhere.

## Professional-conduct notes

Rule 36 of the Bar Council of India Rules restricts advocates from advertising or soliciting work.
The module is therefore designed as a neutral directory: profiles contain factual information the
lawyer supplies (as permitted for advocates' websites), there are no ratings, rankings, "best
lawyer" claims, paid placement, featured listings or referral fees, and default ordering is by
distance. Review the current BCI rules before adding any promotional feature.

## Known limitations / follow-ups

* No email verification exists in the base app; admin credential review is the trust gate.
* Rate limiter and geocoder cache are in-memory (single server). Use Redis for multiple instances.
* One office per lawyer (the table supports more; search uses the primary office).
* An existing `USER` account cannot be converted into a lawyer; lawyers register separately.
* The pre-existing `/api/logs*` endpoints are unauthenticated; now that an `ADMIN` role exists they
  should be restricted to it (not changed here because it is outside this module).
