'use strict';

// Single source of truth for configuration.
// Loads the root .env into process.env, validates everything with zod, and
// exports a frozen `env` object. NOTHING else in the codebase should read
// process.env directly — always import { env } from here.

const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Root .env lives two directories above src/ (apps/backend/src -> repo root).
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Coerce the string "true"/"false" that .env files always produce into a real
// boolean. Anything else is rejected so typos surface loudly.
const boolish = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const schema = z.object({
  // --- Pulse: Observe / Ingestion ---
  PULSE_API_KEY: z.string().min(1),
  PULSE_HOST: z.string().url(),
  PULSE_PROJECT_ID: z.string().min(1),

  // --- Pulse: Rate Limiter (read directly by @pulse/node from process.env) ---
  RATE_LIMITER_URL: z.string().url(),
  RATE_LIMITER_INTERNAL_TOKEN: z.string().min(1),

  // --- Pulse: Drift ---
  DRIFT_API_URL: z.string().url(),

  // --- App / server ---
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),
  NEXT_PUBLIC_BACKEND_URL: z.string().url(),
  APP_ENV: z.enum(['development', 'staging', 'production']),

  // --- Database ---
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_NAME: z.string().min(1),

  // --- Misc / feature flags ---
  CACHE_TTL: z.coerce.number().int().nonnegative(),
  FEATURE_DARK_MODE: boolish,
  EXTERNAL_API_URL: z.string().url(),

  // --- Environment-specific keys (present in some .env files, not all) ---
  FEATURE_BETA_API: boolish.optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  SENTRY_DSN: z.string().url().optional(),
  CDN_URL: z.string().url().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n[env] Invalid environment configuration:\n');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nFix your .env file and restart.\n');
  process.exit(1);
}

const env = Object.freeze(parsed.data);

module.exports = { env };
