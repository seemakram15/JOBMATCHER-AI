# Jobmatcher Implementation Notes

This repository starts as a Vite + React + TypeScript app that follows the attached JobMatch AI PRD.

## What is implemented now

- Dark-first product shell with Dashboard, Discovery, CV Hub, Tracker, Alerts, Admin, and Settings routes.
- Deterministic local matching engine using the PRD score formula: skills, experience, role title, location, and recency.
- Mock user/CV/jobs/applications/sources data shaped to match the Supabase schema and REST API reference.
- Interactive save/apply flows, kanban status movement, CV activation, notification read state, filters, sorting, CSV export, sanitized job detail HTML, and charts.
- Supabase migration scaffold for the core tables, indexes, and RLS policies.
- OpenAPI starter and job aggregator normalizer scaffold.

## Keys

Dummy keys are provided in `.env.example`. Replace them when Supabase, Anthropic, Apify, SerpAPI, Resend, OAuth, and Upstash projects are ready.

## Audit note

`npm audit --omit=dev` is clean. A full `npm audit` still reports dev-only Vite/esbuild advisories because this local machine is running Node 16 and the patched Vite/esbuild line requires Node 18+. When the project moves to Node 20 as planned in the PRD, upgrade Vite/Vitest/plugin-react together and remove the temporary Vite 4 override.

## Next backend steps

1. Create the Supabase project and run `supabase/migrations/001_initial_schema.sql`.
2. Replace mock Zustand state with TanStack Query calls against the API.
3. Implement `/cv/upload` storage plus Claude parsing.
4. Wire the worker normalizers to Apify/direct API/RSS fetchers.
5. Add auth middleware, rate limiting, and request validation.
