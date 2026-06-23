# Jobmatcher Implementation Notes

This repository starts as a Vite + React + TypeScript app that follows the attached JobMatch AI PRD.

## What is implemented now

- Dark-first product shell with Dashboard, Discovery, CV Hub, Tracker, Alerts, Admin, and Settings routes.
- Supabase Auth signup/signin with user-scoped workspace loading.
- Deterministic local matching engine using the PRD score formula: skills, experience, role title, location, and recency.
- Local CV parser endpoint for PDF/DOCX/DOC/TXT uploads using `pdf-parse`, `mammoth`, and taxonomy/date heuristics. Anthropic is no longer required for first-pass parsing.
- User-owned profile, CVs, extracted skills, editable extracted experience, live job search results, applications, and notifications.
- Interactive save/apply flows, kanban status movement, CV activation, notification read state, filters, sorting, CSV export, sanitized job detail HTML, and charts.
- Supabase migrations for the core tables, indexes, RLS policies, and authenticated workspace write paths.
- OpenAPI starter and job aggregator normalizer scaffold.

## Keys

Sample keys are provided in `.env.example`. Replace them when Supabase, Apify, SerpAPI, Resend, OAuth, and Upstash projects are ready. The CV parser no longer needs Anthropic for first-pass extraction.

## Audit note

`npm audit --omit=dev` is clean. A full `npm audit` still reports dev-only Vite/esbuild advisories because this local machine is running Node 16 and the patched Vite/esbuild line requires Node 18+. When the project moves to Node 20 as planned in the PRD, upgrade Vite/Vitest/plugin-react together and remove the temporary Vite 4 override.

## Next backend steps

1. Move CV file binaries into Supabase Storage while keeping parsed data in `cvs`, `cv_skills`, and `cv_experience`.
2. Add server-side API validation around profile/CV/application writes.
3. Expand live extraction with Apify actor runs and webhook ingestion.
4. Add rate limiting and request validation.

## Supabase admin note

Project database credentials and publishable keys do not authenticate to the Supabase Management API. Supabase documents that Management API calls require a dashboard Personal Access Token or OAuth bearer token. Use that token to fetch secret/service-role keys or update hosted Auth provider settings programmatically.
