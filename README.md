# Pulse Demo

Demo app exercising all four Pulse features against the locally-running Pulse monorepo.

| Feature      | Where to test            | Pulse service                  |
| ------------ | ------------------------ | ------------------------------ |
| Observe      | `/observe` page          | Ingestion API `:3001`          |
| Rate Limiter | `/rate-limiter` page     | Rate Limiter `:3002`           |
| Agents       | `/agents` page           | Ingestion API `:3001` (spans)  |
| Drift CI     | `.github/workflows/...`  | Drift Detector `:3003`         |

## Layout

```
.env / .env.staging / .env.production   root env files (drift baselines)
.github/workflows/pulse-drift.yml       drift snapshot + ci-check workflow
apps/backend    Express + JavaScript, port 4000 (Pulse SDKs wired here)
apps/frontend   Next.js 14 App Router + Tailwind, port 4001
```

## Setup

1. Fill in real credentials in `.env` (and `.env.staging` / `.env.production`):
   - `PULSE_API_KEY` and `PULSE_PROJECT_ID` (currently `REPLACE_ME`)
   - `RATE_LIMITER_INTERNAL_TOKEN`
2. Install everything:
   ```
   npm run install:all
   ```
3. Run both apps:
   ```
   npm run dev          # backend :4000 + frontend :4001 together
   # or individually:
   npm run dev:backend
   npm run dev:frontend
   ```
4. Open http://localhost:4001

## Notes

- The backend SDKs are installed from the local `.tgz` files, vendored into
  `apps/backend/vendor/` and referenced via relative `file:` paths in
  `apps/backend/package.json`.
- All configuration is validated by zod in `apps/backend/src/env.js`; nothing
  else reads `process.env` directly.
- The rate limiter is configured `failOpen: true`, so if the limiter service is
  unreachable the backend keeps serving (you'll see a warning in logs).
- `driftSnapshot` never throws — it returns `{ ok: false }` when the collector
  is unreachable or the API key is a placeholder.
- Drift CI requires repo secrets `PULSE_API_KEY` and `PULSE_DRIFT_API_URL`.
