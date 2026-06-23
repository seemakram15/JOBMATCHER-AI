# Jobmatcher

Jobmatcher is an AI-ranked job discovery and application tracking app based on the attached JobMatch AI PRD. It ships as a React + Vite + TypeScript frontend with Supabase Auth, user-scoped workspace persistence, deterministic match scoring, live job extraction, and a job aggregator worker normalizer.

## Current Scope

- Supabase email/password signup and signin.
- Dashboard with user-owned KPIs, activity chart, application funnel, and skills gap.
- Job discovery with live extraction, score-first cards, advanced filters, detail panel, sanitized descriptions, save, and apply tracking.
- CV hub with profile/CV/preference onboarding, local PDF/DOCX/TXT parsing, editable extracted experience, manual skills, and multiple CV activation.
- Application tracker with drag-and-drop kanban columns, detail modal, status updates, and CSV export.
- Alerts, admin source health, settings, sample env keys, database migration, and API/worker scaffolds.

## Stack

- React 18, Vite 4, TypeScript
- Tailwind CSS, Lucide icons, Framer Motion
- Zustand, TanStack Query, React Router
- Recharts, DnD Kit, DOMPurify
- Vitest for scoring engine tests

## Run Locally

```bash
npm install
npm run dev
```

The dev server defaults to `http://localhost:5173`.

## Verification

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## Environment

Copy `.env.example` to `.env.local` and replace the sample values when Supabase, Apify, SerpAPI, Resend, OAuth, and Upstash are ready. `SUPABASE_SERVICE_ROLE_KEY` is required for no-email admin signup. The CV parser works locally without an AI key.

## Backend Scaffolds

- `supabase/migrations/001_initial_schema.sql` contains the first database schema, indexes, and RLS policies.
- `supabase/migrations/002_user_workspace_policies.sql` enables user-owned workspace policies for auth profiles, CV skills/experience, live jobs, and application history.
- `api/openapi.yaml` captures the first API contract surface.
- `api/parse-cv.ts` parses CV uploads locally without Anthropic.
- `workers/job-aggregator/src/index.ts` contains job normalisation and dedup hash logic for Apify/API/RSS ingestion.
- `docs/implementation-notes.md` captures the next integration steps.
