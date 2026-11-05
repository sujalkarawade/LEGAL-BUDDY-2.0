# Legal Buddy Connect — Phase 0 Codebase Audit & Implementation Plan

Status: **Phase 0 complete.** This is the original audit, kept for reference. Phases 1–4 were then
implemented as planned (with the decisions below); see [README.md](README.md) for the delivered module,
setup and test commands. Implementation differences from this plan: map clustering is done in-house
(no `leaflet.markercluster`/`react-leaflet` dependency), and API routes live under `/api/lawyers`,
`/api/lawyer-portal`, `/api/consultations`, `/api/admin/connect`, `/api/notifications` and `/api/geo`.
Date: 2026-11-05 · Branch: `main` (clean working tree at audit time)

---

## 1. Existing architecture (as found)

| Area | What exists | Implication for Connect |
|---|---|---|
| Monorepo | Root `package.json` with `concurrently`; `client/` and `server/` each have their own `package.json` | Add Connect code inside both; no new packages/workspaces |
| Frontend | React 18 + Vite 5 + TypeScript, React Router 6, `lucide-react`, Tailwind 3 installed but pages mostly use **inline styles + CSS variables** and shared classes in `client/src/index.css` | Follow the same: CSS tokens (`--surface`, `--border`, `--text-*`, `--success/warning/danger/info`), classes `.card .btn .btn-primary .input .label .badge-* .alert-* .empty-state .stat-card .page-header .table-wrapper .tab-nav` |
| Theming | Light/dark via `data-theme` (ThemeContext) | Map controls and popups must use the tokens; tiles stay standard |
| Layout | `AppLayout` = `Sidebar` + `Navbar` + `<Outlet/>`; sidebar groups: core, "Analysis" (only when docs exist), "Tools" (contains **Lawyer Portal → `/lawyer-login`**) | Add a "Connect" sidebar group; role-aware items |
| Client auth | `AuthContext`; JWT stored in `localStorage` (`legal_buddy_token`), sent as `Authorization: Bearer`; `ProtectedRoute` only checks "logged in" | Add a `RequireRole` route guard (UX only — server enforces) |
| API client | Static `ApiService` class in `client/src/services/api.ts`, `request<T>()` helper, errors read from `{ error }` | Add a separate `connectApi.ts` using the same helper pattern |
| Backend | Express 4, TypeScript ESM (`tsx` dev, `tsc` build), controllers as static-method classes, routers per module, `zod` validation, sanitized `errorHandler` | Same pattern: `lawyer.routes.ts`, `consultation.routes.ts`, `admin-lawyer.routes.ts`, … |
| Database | PostgreSQL via **Prisma 5**, `prisma migrate deploy`, 3 migrations (`baseline`, 2 RAG migrations). Status/role fields are **plain strings with comments**, not Prisma enums | New tables via a new additive migration; keep string statuses validated by shared `zod` constants for consistency |
| Users & roles | `User.role String @default("USER")` — comment says `USER, LAWYER`. **No ADMIN role, no role-check middleware**, register always creates `USER`, `LAWYER` is never assigned anywhere | Add `ADMIN` value (no column change) + `requireRole()` middleware. Admins created only by a server-side CLI script |
| Email verification | **Does not exist** (no email provider, no verification tokens) | Cannot "reuse" it. Admin credential review is the trust gate; email verification is flagged as a follow-up |
| Notifications | **Do not exist** (no table, no email/SMTP library) | New minimal in-app `Notification` table; email only if a provider is configured later — never faked |
| File uploads | `multer` disk storage in `UPLOAD_DIR`, **PDF-only** filter, random filenames, `MAX_FILE_SIZE_MB` | Separate multer instance for credentials (PDF/JPG/PNG, magic-byte check, smaller cap), stored under `UPLOAD_DIR/credentials/` and never statically served |
| Document ownership | `requireDocumentOwnership` + `isResourceOwner()`; returns 404 (not 403) to avoid leaking existence | Reuse the same 404-on-foreign-resource convention for consultations and credentials |
| Analysis pipeline | `RuleEngine` produces `ClauseFinding` rows with `category` (Payment, Termination, Confidentiality, Liability, Intellectual Property, Governing Law, Dispute Resolution, Renewal, Penalties, General Terms, Data Protection) and `riskLevel`; `ContractSummary.contractType`; RAG chatbot over `DocumentChunk` | AI matching reads **only stored categories + risk levels + contract type** — no contract text leaves the analysis tables, no new LLM call, no new chatbot |
| Rate limiting | **None** | Add a small in-process limiter (or `express-rate-limit`) on login-adjacent, geocode, consultation-create and report endpoints |
| Tests | `node:test` via `tsx --test`; `scripts/test-api.ts` boots the real routers on port 0 against the real DB | Connect integration tests follow the same pattern (`scripts/connect-api.test.ts`) |
| Seed | `src/prisma/seed.ts` upserts 2 `USER` accounts + templates | Optional **separate** `seed:connect-demo` script, synthetic records clearly flagged `isSynthetic=true`, never run by default |

### Existing lawyer-related code
- `client/src/pages/LawyerLoginPage.tsx` — static "Phase 2 — Under Active Development" placeholder, no backend.
- Sidebar "Lawyer Portal" link points to it. No lawyer models, routes or services exist. Nothing to deduplicate.

### Pre-existing issues noticed (outside Connect scope — not changed)
1. **`/api/logs`, `/api/logs/stream`, `/api/logs/clear`, `/api/logs/test`, `/api/logs/metrics` have no authentication.** Anyone who can reach the server can read HTTP logs and DB status. Once an `ADMIN` role exists these should be admin-only. Recommended as a separate fix.
2. `authenticateToken` reads `req.cookies.token` but `cookie-parser` is not installed — harmless dead branch.
3. `AppLayout` has no mobile breakpoint (sidebar always takes 64px). Connect pages will be responsive inside `<main>`; the shell itself is not redesigned.

---

## 2. Environment blocker

On this machine **Node.js, npm and PostgreSQL are not installed or not on PATH** (no `node.exe`, no `postgres` service, nothing listening on `localhost:5432`, no Docker/WSL). `DATABASE_URL` points at `localhost:5432/legal_buddy`.

Consequences until resolved:
- I cannot `npm install` Leaflet, run `prisma migrate`, build client/server, or run any test.
- The project rule "do not claim a feature works unless it has been tested" means I would deliver Phase 1 as **unverified code** unless Node 20+ and PostgreSQL are available to me.

---

## 3. Key technical decisions (recommendations)

### 3.1 Geographic search — PostGIS vs. plain PostgreSQL
- PostGIS is a server extension (`CREATE EXTENSION postgis` needs superuser and the extension installed on the DB host). I cannot confirm it exists on your server, and a migration that requires it would make `prisma migrate deploy` **fail** on any machine without it (e.g. an examiner's laptop).
- **Recommendation:** ship a portable implementation now — `latitude`/`longitude` `DOUBLE PRECISION` columns with a composite B-tree index, a **bounding-box prefilter** (uses the index) followed by an exact **Haversine** distance in SQL (`$queryRaw`, parameterised), `ORDER BY distance`, `LIMIT/OFFSET`. For the realistic scale (hundreds to low thousands of lawyers) this is index-assisted and fast.
- The query lives behind a `GeoSearchService` interface so a PostGIS implementation (`geography(Point)` + GiST + `ST_DWithin`) can be swapped in by an *optional* migration later if your DB has PostGIS.

### 3.2 Map tiles & geocoding (policies checked 2026-11-05)
- **Map library:** Leaflet + `react-leaflet` + `leaflet.markercluster` (open source, no key).
- **Tiles:** configurable `VITE_MAP_TILE_URL` / `VITE_MAP_ATTRIBUTION`. Default = OSM standard tiles **for development/demo only**: the OSMF tile policy gives no SLA, requires visible "© OpenStreetMap contributors" attribution, forbids bulk/offline prefetching, and states it is not suitable for heavy production traffic. Production should switch to a commercial or self-hosted provider via env vars.
- **Geocoding:** backend proxy `GET /api/geo/search` (never called from the browser directly). Default = public Nominatim for development only, honouring its policy: **max 1 request/second for the whole app** (server-side global throttle), identifying `User-Agent` from `GEOCODER_USER_AGENT`, results cached, **no autocomplete** (search on submit only), attribution shown, and a `GEOCODER_ENABLED=false` kill switch so it can be turned off without a code change. `GEOCODER_URL` can point at a self-hosted Nominatim or another provider.
- No paid keys in frontend code; any provider key stays server-side in `server/.env`.

### 3.3 Verification semantics
- Statuses: `DRAFT → PENDING_REVIEW → VERIFIED | REJECTED | INFO_REQUESTED`, and `VERIFIED ↔ SUSPENDED`. Only `VERIFIED` + not suspended + `source=LEGAL_BUDDY` profiles appear in search.
- Status fields are **not accepted** from lawyer-facing endpoints (zod schemas strip them); only admin routes can change them, each change writes an `AdminAuditLog` row (adminId, lawyerProfileId, action, previousStatus, newStatus, reason, timestamp).
- Wording in UI: "Credentials reviewed by Legal Buddy admin" — **never** "verified with Bar Council" (no such integration exists).
- `source` column (`LEGAL_BUDDY` | `EXTERNAL_DIRECTORY`) exists from day one; external rows can never carry the verified badge. In release 1 there are no external rows, so the "Verified only / All approved" filter is wired but has no visible effect until external sources are added — this will be stated in the README rather than hidden.

### 3.4 AI lawyer matching (Phase 3)
- Deterministic mapping table: clause `category` (+ `riskLevel` High/Needs Review) and `contractType` → suggested specialization(s), each with a human-readable reason ("3 high-risk Liability clauses → Contract / Corporate Law").
- Input to matching = category names and counts only. No excerpts, no chunks, no document text. No LLM call, no new chatbot.
- Results reuse the normal nearby search with the suggested specialization pre-selected; the user can clear it and search manually. No "best lawyer" claims.

### 3.5 Document sharing with lawyers
- A consultation can reference **one of the user's existing Documents** only if the user ticks an explicit consent box. Lawyer access goes through `GET /api/lawyer-portal/consultations/:id/document`, which checks (a) the lawyer owns the consultation, (b) consent is still active, (c) status is not rejected/cancelled. The user can revoke sharing at any time. Analysis results (clauses/summary/chat) are **not** shared — only the original PDF.

---

## 4. Proposed database changes (one additive migration, nothing dropped)

| Model | Purpose / key fields | Constraints & indexes |
|---|---|---|
| `User` (existing) | add relations only; role value `ADMIN` allowed | no column change |
| `LawyerProfile` | `userId` (1:1), professionalName, title, bio, photoPath, practiceStartYear, languages `String[]`, education, barCouncilState, enrollmentNumber, enrollmentNumberNormalized, enrollmentDate?, status, source, isSynthetic, offersInPerson, offersOnline, acceptingRequests, feeDisclosed, feeAmountInr?, publicPhone?, publishPhone, publicEmail?, publishEmail, verifiedAt, verifiedById, submittedAt, timestamps | `@@unique([barCouncilState, enrollmentNumberNormalized])`, `@@index([status, source])` |
| `LawyerOffice` | lawyerProfileId, officeName?, addressLine, locality?, city, state, postalCode, latitude, longitude, isPrimary | `@@index([latitude, longitude])`, lat/lng range validated in zod + DB `CHECK` |
| `Specialization` | slug, name, isActive, sortOrder (admin-managed; seeded with the 13 listed specializations — reference data, not fake people) | `slug @unique` |
| `LawyerSpecialization` | lawyerProfileId, specializationId | composite PK |
| `LawyerAvailability` | lawyerProfileId, dayOfWeek 0–6, startTime, endTime | `@@index([lawyerProfileId])` |
| `LawyerCredential` | lawyerProfileId, kind, originalName, storedName, mimeType, sizeBytes, sha256, uploadedAt | private files; never in public payloads |
| `ConsultationRequest` | userId, lawyerProfileId, specializationId?, contactName, contactPhone, contactEmail, description, mode, preferredDate, preferredTime, proposedDate?, proposedTime?, lawyerMessage?, status, sharedDocumentId?, documentShareConsentAt?, documentShareRevokedAt?, cancelledBy?, timestamps | `@@index([userId, status])`, `@@index([lawyerProfileId, status])` |
| `Notification` | userId, type, title, body, link, readAt?, createdAt | `@@index([userId, readAt])` |
| `LawyerReport` | lawyerProfileId, reporterId, reason, details, status, resolvedById?, resolution?, timestamps | one open report per reporter/lawyer |
| `AdminAuditLog` | adminId, action, entityType, entityId, previousStatus?, newStatus?, reason?, createdAt | append-only; `@@index([entityType, entityId])` |

Separate `LawyerVerification` / `LawyerContactPreference` tables from the brief are folded into `AdminAuditLog` and `LawyerProfile` columns respectively — they would only duplicate data.

---

## 5. Proposed API (follows existing `/api/<module>` conventions; all JWT-authenticated)

| Route | Role | Notes |
|---|---|---|
| `GET /api/lawyers/specializations` | any | active list |
| `GET /api/lawyers/nearby?lat&lng&radiusKm&specialization&experience&mode&language&accepting&sort&page&pageSize` | any | radius ∈ {5,10,25,50,100}; returns public projection only |
| `GET /api/lawyers/:id` | any | public profile; phone/email only if publish flags set; 404 unless VERIFIED |
| `POST /api/lawyers/:id/report` | USER | rate-limited |
| `GET /api/geo/search?q=` | any | throttled Nominatim proxy, cached |
| `POST /api/auth/register-lawyer` | public | creates `LAWYER` user + `DRAFT` profile, rate-limited |
| `GET/PUT /api/lawyer-portal/profile`, `PUT …/office`, `PUT …/availability`, `POST …/credentials`, `GET …/credentials/:id`, `POST …/submit` | LAWYER (own) | status fields not writable |
| `GET /api/lawyer-portal/consultations`, `PATCH …/:id` (accept/reject/propose/complete) | LAWYER (own) | |
| `POST /api/consultations`, `GET /api/consultations`, `PATCH /api/consultations/:id` (confirm/cancel/request-reschedule/revoke-share) | USER (own) | |
| `GET /api/notifications`, `PATCH /api/notifications/:id/read` | any (own) | |
| `GET /api/admin/lawyers/stats`, `GET /api/admin/lawyers`, `GET /api/admin/lawyers/:id`, `GET …/credentials/:credId`, `POST …/:id/decision`, `GET/PATCH /api/admin/reports`, `GET/POST/PATCH /api/admin/specializations`, `GET /api/admin/consultations/stats` | ADMIN | every decision audited; consultation stats are aggregates only (admins do not read issue descriptions) |
| `GET /api/documents/:id/lawyer-match` | owner | Phase 3; categories only |

## 6. Frontend pages

`/connect/find` (Find a Lawyer: search bar, radius, collapsible filters, map/list split on desktop, toggle on mobile), `/connect/lawyers/:id`, `/connect/consultations` (user requests), `/connect/lawyer/register`, `/connect/lawyer/dashboard` (+ profile/office/availability/requests tabs), `/connect/admin` (stats + queue), `/connect/admin/lawyers/:id` (review). The existing `/lawyer-login` placeholder becomes the lawyer entry page linking to register/sign-in.

## 7. New dependencies

- Client: `leaflet`, `react-leaflet@4` (React 18 compatible), `leaflet.markercluster`, `@types/leaflet`, `@types/leaflet.markercluster`.
- Server: none required (`zod`, `multer`, Prisma already present); rate limiter written in-house (~40 lines) unless you prefer `express-rate-limit`.

## 8. Testing plan

`server/scripts/connect-api.test.ts` (node:test, real routers + real DB, synthetic users created and deleted per run) covering every group A–G in the brief; pure unit tests for Haversine/bbox, specialization mapping, and the public-projection serializer; then `npm run build` for server and client and the existing `npm run test:rag` regression suite.

## 9. Phase plan

1. **Phase 1** — migration + roles/middleware + lawyer registration + credential upload + admin review + nearby search + map + profile pages.
2. **Phase 2** — contact actions, consultation workflow, notifications, lawyer dashboard, availability, user request history.
3. **Phase 3** — document → specialization matching on the analysis pages.
4. **Phase 4** — security review, logs endpoint hardening (if approved), responsiveness pass, README/env docs, full regression.
