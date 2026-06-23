# Jobmatcher

Jobmatcher is an AI-ranked job discovery and application tracking app based on the attached JobMatch AI PRD. It ships as a React + Vite + TypeScript frontend with a mock API/state layer, deterministic match scoring, Supabase schema scaffold, OpenAPI starter, and job aggregator worker normalizer.

## Current Scope

- Dashboard with KPIs, activity chart, application funnel, and skills gap.
- Job discovery with score-first cards, advanced filters, detail panel, sanitized descriptions, save, and apply tracking.
- CV hub with profile/CV/preference onboarding, parsed skills, and multiple CV activation.
- Application tracker with drag-and-drop kanban columns and CSV export.
- Alerts, admin source health, settings, dummy env keys, database migration, and API/worker scaffolds.

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

Copy `.env.example` to `.env.local` and replace the dummy values when Supabase, Anthropic, Apify, SerpAPI, Resend, OAuth, and Upstash are ready.

## Backend Scaffolds

- `supabase/migrations/001_initial_schema.sql` contains the first database schema, indexes, and RLS policies.
- `api/openapi.yaml` captures the first API contract surface.
- `workers/job-aggregator/src/index.ts` contains job normalisation and dedup hash logic for Apify/API/RSS ingestion.
- `docs/implementation-notes.md` captures the next integration steps.
