# Dumroo.ai — Outreach Orchestrator

A prototype B2B outreach tool for New Jersey K–12 schools and districts. It combines NCES Common Core of Data (CCD) files, PostgreSQL, a React dashboard, and a BullMQ worker that generates personalized email drafts using Groq.

> **Safety:** No real emails are sent. The worker logs a simulated email, waits two seconds, and stores the generated subject/body and lead status in PostgreSQL.

## Features

- Prepare New Jersey school and district directory/enrollment data from NCES CCD source downloads.
- Ingest districts, schools, and leads into PostgreSQL using Prisma.
- Start campaigns from the dashboard and enqueue lead batches in BullMQ.
- Generate personalized email drafts through the Groq Chat Completions API.
- Simulate email sending and persist `PENDING`, `PROCESSING`, `SENT`, and `FAILED` statuses.
- View lead records, search/filter leads, and monitor campaign progress.

## Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Node.js, Express, TypeScript
- **Database/ORM:** PostgreSQL (Supabase supported), Prisma
- **Queue:** BullMQ with Redis
- **AI:** Groq API
- **Data preparation:** Python, pandas
- **CSV validation/parsing:** Zod, csv-parse

## Architecture and workflow

1. **Prepare source data.** Python scripts in `server/src/scripts/` filter NCES CCD directory files to New Jersey and extract total enrollment. They produce four normalized CSV files.
2. **Ingest data.** `server/src/ingest/transform.ts` validates the CSVs, joins enrollment by NCES ID, maps districts and schools, and creates lead records. `server/src/ingest/index.ts` inserts records in batches, skipping duplicates.
3. **Start campaign.** `POST /api/campaigns/start` selects pending leads, creates a campaign, associates the leads, splits them into batches of up to five, and adds jobs to the `send-email` queue.
4. **Process jobs.** The separate BullMQ worker claims leads, requests generated drafts from Groq, simulates sending, and persists the result. Failed jobs/leads are retried or eventually marked failed.
5. **Monitor.** The React dashboard reads lead and campaign data through the Express API and polls campaign progress.

The API server and worker run as separate processes. BullMQ stores job state in Redis; PostgreSQL stores durable lead, campaign, and generated email data.

## Repository structure

```text
.
├── frontend/
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       └── types/
└── server/
    ├── prisma/
    │   ├── migrations/
    │   └── schema.prisma
    └── src/
        ├── config/
        ├── data/             # Four prepared New Jersey CSV files
        ├── ingest/
        ├── routes/
        ├── scripts/          # Python preparation and utility scripts
        ├── services/
        └── workers/
```

## Database schema

Defined in `server/prisma/schema.prisma`.

| Model | Purpose |
|---|---|
| `District` | NCES LEA ID, district name, city/ZIP, phone, website, district type, school count, enrollment |
| `School` | NCES school ID, parent district, name, location, phone/website, school type/level, grades, charter flag, enrollment |
| `Lead` | Contact identity, role, school/district relations, campaign relation, status, attempts, errors, generated email subject/body, processed timestamp |
| `Campaign` | Campaign status, selected lead count, start and completion timestamps |

**Relationships:** A district has many schools and leads. A school can have many leads. District administrator leads have no school relation. A campaign has many leads.

**Enums:**
- Lead status: `PENDING`, `PROCESSING`, `SENT`, `FAILED`.
- Campaign status: `RUNNING`, `COMPLETED`.

A campaign is marked complete when no associated leads remain `PENDING` or `PROCESSING`. Failed leads are terminal and count toward completion.

## NCES data preparation

The four prepared files expected by the ingestion process are:

- `server/src/data/nj_districts.csv`
- `server/src/data/nj_schools.csv`
- `server/src/data/nj_district_enrollment.csv`
- `server/src/data/nj_school_enrollment.csv`

The scripts expect the downloaded NCES source files in their current working directory.

- `director.py`: filters CCD directory files to New Jersey, retains Open/New/Reopened records, and selects the columns used by the application.
- `enrollment.py`: extracts New Jersey education-unit total enrollment rows and produces one enrollment value per district/school ID.

Install Python dependencies:

```bash
python -m pip install pandas openpyxl
```

From the directory containing the downloaded NCES source files, run the scripts (adjust script paths if needed):

```bash
python director.py
python enrollment.py
```

Copy the four resulting CSVs into `server/src/data/`.

From `server/`, validate the prepared data without inserting it:

```bash
npx tsx src/ingest/index.ts --dry-run
```

Then ingest:

```bash
npx tsx src/ingest/index.ts
```

The ingestion uses `createMany({ skipDuplicates: true })` to avoid inserting records whose unique keys already exist.

### Important: administrator contacts are mocked

The NCES CCD files provide the school/district directory and enrollment information. The current code does **not** extract verified administrator names or email addresses from NCES. Instead, `mockAdmin()` in `server/src/ingest/transform.ts` uses Faker to generate deterministic synthetic administrator names and `@example.org` email addresses. These are placeholders for this prototype and must not be treated as real contacts or used for actual outreach.

## Prerequisites

- Node.js and npm
- Python 3
- Docker Desktop with Docker Compose
- PostgreSQL database (Supabase is supported)
- Groq API key and a model enabled for your Groq account

## Local setup

### 1. Backend environment

Create `server/.env`:

```env
DATABASE_URL="your-postgresql-connection-string"

GROQ_API_KEY="your-groq-api-key"
GROQ_MODEL="qwen/qwen3.8-27b"

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

Use your own credentials. Do not commit `.env` or expose API keys.

**Environment variable names:** the current code reads `GROQ_MODEL` (singular), not `GROQ_MODELS`. Redis reads `REDIS_HOST` and `REDIS_PORT`; the current Redis config does not read `REDIS_URL`.

### 2. Start Redis

From the `server/` directory:

```bash
docker compose up -d
docker compose ps
```

The Compose file runs `redis:7-alpine`, exposes port `6379`, and persists Redis data in a named Docker volume.

### 3. Install backend dependencies and set up the database

From `server/`:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

For a brand-new development database where migrations have not yet been created/applied, use the appropriate Prisma development migration workflow. `migrate deploy` applies migrations already present in the repository.

### 4. Ingest data

From `server/`:

```bash
npx tsx src/ingest/index.ts --dry-run
npx tsx src/ingest/index.ts
```

### 5. Run the API server

From `server/`:

```bash
npm run dev
```

API base URL: `http://localhost:3000`. Health check: `GET /`.

### 6. Run the worker in a second terminal

From `server/`:

```bash
npx tsx src/workers/emailworker.ts
```

Keep this process running to process queued jobs. The worker is not started by the API's `npm run dev` command.

### 7. Run the frontend in a third terminal

```bash
cd frontend
npm install
npm run dev
```

Vite normally serves the app at `http://localhost:5173`.

If the backend is not at the default URL, create `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | API health check |
| GET | `/api/leads` | Paginated leads; supports `page`, `pageSize`, `search`, `status` |
| POST | `/api/campaigns/start` | Starts a campaign; JSON body: `{ "limit": 25 }` |
| GET | `/api/campaigns/stats` | Overall lead counts and latest campaigns |
| GET | `/api/campaigns/:campaignId` | Campaign counts and progress |

The start endpoint returns HTTP `202 Accepted`: the work has been queued, not completed. The limit is 1–500 leads. The current campaign service permits only one `RUNNING` campaign at a time.

## Queue and retry behavior

- One BullMQ job handles a batch of up to five leads.
- Worker concurrency is `1`; its limiter is five jobs per 60 seconds.
- Jobs are configured for up to five attempts with exponential backoff.
- Completed and finally failed jobs use `removeOnComplete: true` and `removeOnFail: true`.
- The simulator logs recipient, subject, and body, waits two seconds, then the processor marks the lead `SENT` and saves the generated draft.
- On processing failure, unfinished leads are returned to `PENDING` for retry or marked `FAILED` when retries are exhausted or a permanent Groq client error occurs.

## Current prototype scope / known limitations

- Administrator names and emails are generated placeholders, not verified NCES administrator contacts.
- Email delivery is simulated; no real email provider is integrated.
- Groq is the configured LLM provider; model selection uses `GROQ_MODEL`.
- Campaign progress is polled by the dashboard while a campaign is running.
- The backend stores generated email subjects and bodies, but the current frontend does not yet include a click-to-open draft view.
- The campaign service allows one running campaign at a time.
- The dashboard lead list fetches data on page/search/status changes; it does not currently poll each lead row continuously.



---

Built as a prototype assignment for Dumroo.ai.
