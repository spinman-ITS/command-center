# Atlas Command Center

Dark-mode mission control frontend for an AI agent team, built with Vite, React 19, TypeScript, Tailwind CSS v4, React Router v7, React Query, Supabase realtime, Recharts, and Lucide.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your existing Supabase project values.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev`.

## Scripts

- `npm run dev` starts the Vite dev server.
- `npm run build` runs a strict TypeScript build and produces a production bundle.
- `npm run lint` runs ESLint across the project.
- `npm run preview` previews the production build locally.

## Notes

- The UI uses typed React Query hooks for all data access.
- Supabase realtime invalidates queries for `activity`, `tasks`, `projects`, `agents`, and `docs` where configured.
- If the configured Supabase tables are unavailable, the app falls back to local mock data so the interface still renders for development and review.
