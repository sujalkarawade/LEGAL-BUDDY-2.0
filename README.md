# Legal Buddy — AI-Powered Contract Intelligence Platform

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.6-blue.svg)
![PostgreSQL](https://img.shields.io/badge/postgresql-17-blue.svg)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-3.4-indigo.svg)
![Status](https://img.shields.io/badge/MVP-Fully%20Operational-emerald.svg)

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
- Interactive **Citation Drawer** displaying exact verbatim quotes, page numbers, and relevance scores.
- Strict legal safeguard: If an inquiry cannot be answered from the document, the assistant explicitly states that the clause was not found rather than hallucinating.

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
| **AI / NLP** | Dual-Engine Adapter: Google Gemini 1.5 / OpenAI GPT-4o with deterministic legal NLP rule engine fallback |

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
   DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/legal_buddy?schema=public"
   JWT_SECRET="legalbuddy_super_secure_jwt_secret_dev_key_2026_xyz"
   JWT_EXPIRES_IN="7d"

   # AI Provider Configuration (Groq Llama 3.3 70B recommended)
   AI_PROVIDER="auto"
   GROQ_API_KEY="gsk_your_groq_api_key_here"
   LLM_MODEL="meta-llama/llama-3.3-70b-instruct"
   GEMINI_API_KEY=""
   OPENAI_API_KEY=""
   MAX_FILE_SIZE_MB=15
   UPLOAD_DIR="./uploads"
   CLIENT_URL="http://localhost:5173"
   ```

4. **Initialize Database & Seed Test User**:
   ```bash
   # Apply Prisma schema to PostgreSQL
   cd server
   npx prisma db push

   # Run seed script
   npm run seed
   cd ..
   ```

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

## 🤖 AI Provider Configuration

Legal Buddy features a flexible AI Adapter supporting **Google Gemini**, **OpenAI**, and an **Offline Deterministic Legal Rule Engine**:

1. **Deterministic Rule Engine (Offline / Default)**:
   - If no API key is provided, the platform automatically utilizes a comprehensive legal rule engine that extracts operative clauses, performs regex pattern matching, checks completeness checklists, and grounds RAG chat in extracted contract text.
   - The UI clearly displays a badge indicating that the **Heuristic Legal Engine** is active.
2. **Google Gemini (Recommended)**:
   - Set `GEMINI_API_KEY="your-gemini-key"` in `server/.env`.
   - The platform will leverage `gemini-1.5-flash` for high-speed generative summaries, structured clause extraction, and document-grounded responses.
3. **OpenAI**:
   - Set `OPENAI_API_KEY="your-openai-key"` in `server/.env`.

---

## 🧪 Automated End-to-End Verification

The repository includes a 22-step automated test suite covering all critical workflows:

```bash
cd server
npx tsx scripts/test-e2e.ts
```

### Verified Test Cases:
- [x] Test User Authentication & JWT generation
- [x] Rejection of invalid credentials with 401
- [x] User profile retrieval (`/api/auth/me`)
- [x] Non-PDF upload rejection with validation errors
- [x] Detection of scanned/empty PDFs with OCR alerts
- [x] Upload & multi-page text extraction of a 2-page Mutual NDA
- [x] Summary fact extraction (parties, dates, purpose)
- [x] Clause classification and risk assignment
- [x] Real excerpt correlation with source text
- [x] Updating clause review status to APPROVED
- [x] Completeness checklist evaluation (Found, Needs Review, Not Found)
- [x] Toggling completeness item review status
- [x] Extracting contract deadlines and performance obligations
- [x] Grounded chat answers with page numbers and citation excerpts
- [x] Chat rejection of out-of-document inquiries with "Not Found" safeguard
- [x] Multi-user data isolation (User B receives 403 Forbidden on User A's contract)
- [x] Fetching legal template gallery
- [x] Validating required fields in document generator wizard
- [x] Generating structured draft document from template
- [x] Downloading valid Microsoft Word `.docx` file
- [x] Dashboard metrics reflecting real persisted records

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
| **Auth** | Multi-User Isolation | **Implemented** | Strict ownership checks (403 forbidden) |
| **Auth** | Lawyer Portal Placeholder | **Implemented** | Professional coming-soon preview (`/lawyer-login`) |
| **Ingestion** | PDF Text Extraction | **Implemented** | Page boundaries preserved (`---PAGE_X---`) |
| **Ingestion** | Scanned / Empty PDF Detection | **Implemented** | Detects non-text PDFs with OCR notice |
| **Analysis** | AI Executive Summary | **Implemented** | Facts vs "Not found in document" separation |
| **Analysis** | Clause Risk Identification | **Implemented** | 10 clause categories, risk levels, human questions |
| **Chatbot** | Document-Grounded Chatbot | **Implemented** | RAG retrieval, page citations, "not found" safeguard |
| **Checker** | Completeness Checker | **Implemented** | Checklist matching, reviewer check-off toggle |
| **Extractor**| Dates & Obligations | **Implemented** | Calendar dates vs notice periods, party tags |
| **Generator**| Legal Document Generator | **Implemented** | Form wizard, validation, editable view, DOCX export |
| **Dashboard**| Analytics & Recent Feed | **Implemented** | Real persisted stats, upcoming deadlines timeline |
| **Phase 2**  | Contract Guard Policy Engine | *Planned* | Scheduled for Phase 2 |
| **Phase 3**  | Contract Version Comparison | *Planned* | Scheduled for Phase 3 |
| **Phase 3**  | Indian Kanoon Legal Precedents | *Planned* | Future API integration hook |

---

## ⚠️ Known Limitations & Assumptions

1. **Scanned PDF OCR**: The baseline MVP includes detection of image-only / scanned PDFs and alerts the user that OCR is required. Full Tesseract/Vision OCR is scheduled for a future pipeline phase.
2. **Deterministic Fallback**: In the absence of a `GEMINI_API_KEY` or `OPENAI_API_KEY`, the application operates in Heuristic Legal Engine mode. It reliably extracts operative clauses, dates, and answers keyword-matched questions, clearly indicating the active engine in the UI.
3. **Legal Disclaimer**: Legal Buddy is an automated contract intelligence and analysis tool. It does not provide legal advice and does not substitute for qualified attorney counsel.
