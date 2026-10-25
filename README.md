# Legal Buddy — AI-Powered Contract Intelligence Platform

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.6-blue.svg)
![PostgreSQL](https://img.shields.io/badge/postgresql-17-blue.svg)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-3.4-indigo.svg)
**RAG setup, migrations, behavior and measured limitations:** [RAG implementation guide](RAG.md).

**Legal Buddy** is an enterprise-grade legal-tech SaaS platform designed to assist legal counsels, procurement teams, and corporate executives in reviewing, interpreting, and generating commercial agreements. Built with a dark **Midnight Glass** design system, the platform features page-level grounded contract parsing, risk-rated clause identification, document-grounded question answering (RAG), contract completeness checking, obligation tracking, and structured legal draft generation.

---

## 🌟 Key Features (Phase 1 Baseline MVP)

### 1. 📄 PDF Contract Upload & Text Extraction
- Support for searchable multi-page PDF agreements up to 15MB.
- Page-accurate text indexing preserving per-page boundary markers (`---PAGE_X---`).
- Graceful detection of scanned image-only PDFs with informative OCR requirement alerts.
- Error handling for password-protected/encrypted or corrupt documents.

### 2. 📊 AI Contract Summary
- Instant generation of structured executive summaries.
- Fact extraction: Contract Type, Parties Involved, Purpose of Agreement, Effective Date, Expiration/Term, Payment Terms, Core Responsibilities, Termination Protocol, Confidentiality, and Liability Caps.
- Dedicated **Missing Information** callout highlighting unspecified dates or structural omissions.
- Distinct separation of factual document quotes from items **"Not found in document"**.

### 3. ⚖️ Clause Analysis & Risk Identification
- Automated clause segmentation across 10 vital commercial categories: Payment, Termination, Confidentiality, Limitation of Liability, Intellectual Property, Dispute Resolution, Governing Law, Renewal, Penalties, and Data Protection.
- Document-grounded verbatim excerpts with **Page Number** citations.
- Plain-language translation and identified potential ambiguity/risk.
- Suggested questions for human attorney review.
- Counsel review workflow: Mark clauses as **Approved**, **Flagged**, or **Pending**.

### 4. 💬 Document-Grounded Legal Buddy Chatbot (RAG)
- Conversational contract assistant connected strictly to the active agreement.
- Retrieval-augmented generation querying extracted per-page chunks.
- Interactive **Citation Drawer** displaying verified source excerpts, extraction page numbers, OCR warnings and authenticated PDF links.
- Insufficient retrieved evidence is reported explicitly. Retrieval alone does not prove a provision is absent from the entire contract.

### 5. ✅ Contract Completeness Checker
- Comprehensive audit of operative clauses against standard commercial contracting norms.
- Status categorization: **Found** (green), **Needs Review** (amber), **Not Found** (red).
- Evidence quotations and reviewer check-off toggle persisted to the database.

### 6. 📅 Key Dates & Obligations Extractor
- Identification of binding covenants, payment deadlines, notice windows, and milestone obligations.
- Differentiates explicit **Calendar Dates** from relative **Notice Periods** (e.g., "30 days prior written notice").
- Responsible party assignment and review acknowledgement tracking.

### 7. 📝 Legal Document Generator
- Interactive multi-step drafting wizard for commercial templates:
  - **Mutual Non-Disclosure Agreement (NDA)**
  - **Master Services Agreement (MSA)**
  - **Standard Employment Agreement**
- Form validation preventing missing required fields.
- Real-time editable preview with watermark banner: `[DRAFT — REVIEW BEFORE USE. NOT LEGAL ADVICE.]`.
- Export directly to formatted **Microsoft Word (.DOCX)** files and printable views.

### 8. 🛡️ Multi-User Data Isolation & Security
- Password hashing with `bcryptjs`.
- Session token generation with `jsonwebtoken` (JWT).
- Tenant isolation: Document ownership verification ensures User A cannot access User B's contracts or analysis.

### 9. 💼 Lawyer Portal Placeholder (Phase 2 Preview)
- Dedicated entry point at `/lawyer-login` explaining the forthcoming Phase 2 attorney workspace (redlining, statutory compliance, bar verification).

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide React, React Router 6, Framer Motion |
| **Backend** | Node.js (v22), Express, TypeScript (`tsx`), Multer, `docx` |
| **Database** | PostgreSQL 17 via Prisma ORM |
| **Document Engine** | `pdf-parse`, `pdf-lib` |
| **AI / NLP** | Dual-Engine Adapter: Configurable Gemini / Groq / OpenRouter with deterministic legal NLP rule engine fallback |

---

## 📁 Repository Structure

```
LEGAL BUDDY 2.0/
├── package.json              # Root unified dev & build scripts
├── .env.example              # Environment variable template
├── .gitignore                # Git exclusions
├── README.md                 # Project documentation
│
├── server/                   # Backend Express & Prisma Application
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                  # Local server environment configuration
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma     # Prisma database schema (11 entities)
│   │   ├── client.ts         # Prisma client singleton
│   │   └── seed.ts           # Database seed script (test user & templates)
│   ├── sample_contracts/     # Generated multi-page sample test PDFs
│   ├── scripts/
│   │   ├── create-sample-contracts.ts # Generates test legal contracts
│   │   ├── test-e2e.ts       # Automated 22-step verification test suite
│   │   └── upload-samples.ts # Seed test contracts into DB
│   └── src/
│       ├── config/           # Environment and directory paths
│       ├── controllers/      # Auth, Document, Template, Dashboard controllers
│       ├── middleware/       # JWT auth and file upload guards
│       ├── routes/           # Express router endpoints
│       ├── services/         # PDF extraction, AI adapter, Rule engine, DOCX
│       └── index.ts          # Server entrypoint (Port 5000)
│
└── client/                   # Frontend React & Vite Application
    ├── package.json
    ├── vite.config.ts        # Vite config with API proxy
    ├── tailwind.config.js    # Midnight Glass design tokens
    ├── index.html
    └── src/
        ├── components/       # Layout, Navbar, Sidebar, DocumentNavHeader
        ├── context/          # AuthContext with persistent JWT state
        ├── pages/            # Login, Register, Dashboard, Upload, Documents,
        │                     # Summary, Clauses, Chat, Completeness, Obligations,
        │                     # Generator, LawyerLogin, Profile
        ├── services/         # Typed API service client
        ├── types/            # TypeScript data interfaces
        ├── App.tsx           # React Router route registry
        ├── index.css         # Custom scrollbars & glass panel utilities
        └── main.tsx          # DOM root mount
```

---

## ⚙️ Prerequisites & Installation

### Prerequisites
1. **Node.js**: v20.0.0 or higher (Tested on v22.18.0)
2. **PostgreSQL**: v15 or higher (Running locally on port 5432)
3. **npm**: v9 or higher

### Step-by-Step Setup

1. **Clone or Open Repository**:
   ```bash
   cd "d:/DON/LEGAL BUDDY 2.0"
   ```

2. **Install Dependencies**:
   ```bash
   # Install root dependencies
   npm install

   # Install server dependencies
   cd server && npm install

   # Install client dependencies
   cd ../client && npm install
   cd ..
   ```

3. **Configure Environment Variables**:
   In `server/.env` (or copy from `server/.env.example`):
   ```env
   PORT=5000
   NODE_ENV=development
   DATABASE_URL="postgresql://your_user:your_password@localhost:5432/legal_buddy?schema=public"
   JWT_SECRET="replace-with-a-long-random-secret"
   JWT_EXPIRES_IN="7d"

   MAX_FILE_SIZE_MB=15
   UPLOAD_DIR="./uploads"
   CLIENT_URL="http://localhost:5173"
   ```

4. **Initialize Database & Seed Test User**:
   ```bash
   # Apply Prisma schema to PostgreSQL
   cd server
   npm run prisma:generate
   npm run prisma:migrate

   # Run seed script
   npm run seed
   cd ..
   ```

   Existing databases created with `db push` must follow the baseline instructions in [RAG.md](RAG.md#setup-and-migrations) before running migrations. Do not reset an existing database.

5. **Generate Sample Test Contracts** *(Optional but recommended)*:
   ```bash
   cd server
   npx tsx scripts/create-sample-contracts.ts
   npx tsx scripts/upload-samples.ts
   cd ..
   ```

---

## 🚀 Running the Application Locally

You can launch both the backend server and frontend client concurrently with a single command from the root directory:

```bash
npm run dev
```

- **Frontend Client**: [http://localhost:5173](http://localhost:5173)
- **Backend API Server**: [http://localhost:5000](http://localhost:5000)
- **API Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 🔑 Test Credentials

| Account | Email | Password | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Test User** | `test@legalbuddy.io` | `Password123!` | User / Counsel | Adv. Sarah Jenkins (Apex Legal Partners) |
| **Isolation Test User** | `alex@techcorp.io` | `Password123!` | User | Alex Rivera (TechCorp Solutions) |

> 💡 **Quick Test Tip**: The login screen features a 1-click **"Autofill Test User"** button for immediate sign-in.

---

## Document analysis

The current build preserves shared PDF/OCR processing and the existing answer integration. Retrieval combines local CPU semantic embeddings with BM25 using Reciprocal Rank Fusion, with optional local reranking and explicit keyword fallback. Citation metadata is resolved and validated on the server.

See [RAG.md](RAG.md) for local model installation, page-aware indexing, retrieval/reranking settings, authorization, citations and measured limitations. Retrieval needs no paid API or new database. Existing documents need reprocessing to create compatible local vectors.

## Automated verification

The RAG suites test citation verification, keyword retrieval, authorization with a real database, processing failures and retries. The OCR suite exercises digital and image-only Marathi-English sample PDFs. Live sample answers and timings are recorded separately from deterministic tests. See [actual results and limitations](server/evaluations/RESULTS.md).

```powershell
npm run test:rag --prefix server
npm run test:rag:integration --prefix server
npm run test:api --prefix server
npm run eval:rag --prefix server
npm run eval:hybrid --prefix server
npm run test:ocr --prefix server
```

The full application smoke script is `server/scripts/test-e2e.ts`; it requires the running server and development seed users. `npm run test:api --prefix server` runs the same checks with controlled synthetic answer generation and blocks external requests. See [current hybrid retrieval details and measurements](RAG.md); older audit files describe earlier implementation states.

---

## 📡 API Endpoint Documentation

### Authentication
- `POST /api/auth/register` — Create a new user account.
- `POST /api/auth/login` — Sign in and obtain JWT.
- `GET /api/auth/me` — Retrieve authenticated user profile and stats.

### Document Management
- `POST /api/documents/upload` — Upload PDF contract (`multipart/form-data`).
- `GET /api/documents` — List user's contracts.
- `GET /api/documents/:id` — Get contract details and analysis.
- `DELETE /api/documents/:id` — Delete contract and associated analysis.
- `GET /api/documents/:id/download` — Download original PDF file.

### Analysis & Chat
- `GET /api/documents/:id/summary` — Retrieve executive summary.
- `POST /api/documents/:id/summary/reanalyze` — Re-run summary extraction.
- `GET /api/documents/:id/clauses` — List clauses (supports `category` & `risk` query filters).
- `PATCH /api/documents/:id/clauses/:clauseId` — Update clause status (`APPROVED`, `FLAGGED`, `PENDING`).
- `GET /api/documents/:id/completeness` — Get completeness checklist.
- `PATCH /api/documents/:id/completeness/:checkId` — Toggle item review status.
- `GET /api/documents/:id/obligations` — List extracted obligations and deadlines.
- `PATCH /api/documents/:id/obligations/:obligationId` — Update obligation status.
- `GET /api/documents/:id/chat` — Retrieve conversation history.
- `POST /api/documents/:id/chat` — Send question and receive grounded answer with citations.
- `DELETE /api/documents/:id/chat` — Reset conversation history.

### Document Generator & Dashboard
- `GET /api/templates` — List available document templates.
- `POST /api/document-generator/generate` — Generate draft and create `.docx` file.
- `GET /api/document-generator/history` — List user's generated drafts.
- `GET /api/document-generator/:id/download` — Download generated `.docx` document.
- `GET /api/dashboard/stats` — Retrieve aggregated dashboard metrics.
- `GET /api/dashboard/status` — Get system health, database, and AI provider status.

---

## 📊 Feature Status Matrix

| Module | Feature | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Auth** | User Registration & Login | **Implemented** | Bcrypt hashing, JWT tokens, test seed |
| **Auth** | Multi-User Isolation | **Implemented** | Ownership and nested-resource checks (other-user documents return 404) |
| **Auth** | Lawyer Portal Placeholder | **Implemented** | Professional coming-soon preview (`/lawyer-login`) |
| **Ingestion** | PDF Text Extraction | **Implemented** | Page boundaries preserved (`---PAGE_X---`) |
| **Ingestion** | Scanned / Empty PDF Detection | **Implemented** | Detects non-text PDFs with OCR notice |
| **Analysis** | AI Executive Summary | **Implemented** | Facts vs "Not found in document" separation |
| **Analysis** | Clause Risk Identification | **Implemented** | 10 clause categories, risk levels, human questions |
| **Chatbot** | Document-Grounded Chatbot | **Implemented** | Owner-scoped cosine + BM25/RRF, optional local reranking, server-verified citations |
| **Checker** | Completeness Checker | **Implemented** | Checklist matching, reviewer check-off toggle |
| **Extractor**| Dates & Obligations | **Implemented** | Calendar dates vs notice periods, party tags |
| **Generator**| Legal Document Generator | **Implemented** | Form wizard, validation, editable view, DOCX export |
| **Dashboard**| Analytics & Recent Feed | **Implemented** | Real persisted stats, upcoming deadlines timeline |
| **Phase 2**  | Contract Guard Policy Engine | *Planned* | Scheduled for Phase 2 |
| **Phase 3**  | Contract Version Comparison | *Planned* | Scheduled for Phase 3 |
| **Phase 3**  | Indian Kanoon Legal Precedents | *Planned* | Future API integration hook |

---

## ⚠️ Known Limitations & Assumptions

1. **Scanned PDF OCR**: PaddleOCR runs locally for scanned pages and flags low-confidence output for review. Unreadable or flagged OCR should be verified in the OCR preview before relying on its text.
2. **Retrieval and uncertainty**: Local embeddings and keyword search rank authorized chunks. The existing answer provider must supply exact verified excerpts; unavailable generation or insufficient evidence produces an honest abstention. Rule-based summaries and other analyses retain their existing fallback.
3. **Legal Disclaimer**: Legal Buddy is an automated contract intelligence and analysis tool. It does not provide legal advice and does not substitute for qualified attorney counsel.
