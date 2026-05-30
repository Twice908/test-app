'use strict';

const express = require('express');
const cors = require('cors');
const { z } = require('zod');

const { pulse, rateLimit } = require('@pulse/node');
const { driftSnapshot } = require('@pulse/drift-agent');

const { env } = require('./env');
const { sleep, randInt } = require('./util');
const summarizer = require('./agents/summarizer');
const classifier = require('./agents/classifier');
const researcher = require('./agents/researcher');

const app = express();

// ---------------------------------------------------------------------------
// Middleware order matters (per spec):
//   1. cors + express.json
//   2. pulse (Observe ingestion)
//   3. rateLimit (auto rules, fail open)
//   4. routes
// ---------------------------------------------------------------------------

// 1) CORS + JSON body parsing
app.use(cors());
app.use(express.json());

// 2) Pulse Observe — captures every request except /health
app.use(
  pulse({
    apiKey: env.PULSE_API_KEY,
    host: env.PULSE_HOST,
    ignoreRoutes: ['/health'],
  })
);

// 3) Pulse Rate Limiter — pulls rules automatically from the limiter service.
//    failOpen so a limiter outage never takes the demo down.
app.use(
  rateLimit({
    rules: 'auto',
    failOpen: true,
  })
);

// ---------------------------------------------------------------------------
// 4) Routes
// ---------------------------------------------------------------------------

// Mock user store (read-mostly; POST returns a synthetic record).
const MOCK_USERS = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
  { id: 2, name: 'Alan Turing', email: 'alan@example.com' },
  { id: 3, name: 'Grace Hopper', email: 'grace@example.com' },
  { id: 4, name: 'Linus Torvalds', email: 'linus@example.com' },
  { id: 5, name: 'Margaret Hamilton', email: 'margaret@example.com' },
];

// Health — intentionally ignored by Pulse Observe.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// GET /api/users — list mock users
app.get('/api/users', (_req, res) => {
  res.json({ users: MOCK_USERS });
});

// POST /api/users — validate { name, email }, return 201 with new user
const createUserSchema = z.object({
  name: z.string().min(1, 'name is required'),
  email: z.string().email('valid email is required'),
});

app.post('/api/users', (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'ValidationError',
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  const newUser = {
    id: randInt(1000, 9999),
    name: parsed.data.name,
    email: parsed.data.email,
    createdAt: new Date().toISOString(),
  };
  res.status(201).json({ user: newUser });
});

// DELETE /api/users/:id — success for known ids, 404 otherwise
app.delete('/api/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const exists = MOCK_USERS.some((u) => u.id === id);
  if (!exists) {
    return res.status(404).json({ error: 'NotFound', message: `user ${req.params.id} not found` });
  }
  res.json({ success: true, deletedId: id });
});

// GET /api/data — randomised analytics
app.get('/api/data', (_req, res) => {
  const requests = randInt(500, 5000);
  const errors = randInt(0, Math.floor(requests * 0.05));
  res.json({
    requests,
    errors,
    avgLatency: randInt(40, 350),
    topRoutes: [
      { route: '/api/users', hits: randInt(100, 2000) },
      { route: '/api/data', hits: randInt(100, 2000) },
      { route: '/api/heavy', hits: randInt(10, 500) },
    ],
  });
});

// GET /api/heavy — deliberately slow (~800ms). Rate-limit target.
app.get('/api/heavy', async (_req, res) => {
  await sleep(800);
  res.json({
    message: 'Heavy operation completed',
    timestamp: new Date().toISOString(),
  });
});

// POST /api/agents/run — run one of the mock agents with Pulse Agent tracing
const agentRegistry = {
  summarizer,
  classifier,
  researcher,
};

const runAgentSchema = z.object({
  agentType: z.enum(['summarizer', 'classifier', 'researcher']),
  input: z.string().min(1, 'input is required'),
});

app.post('/api/agents/run', async (req, res) => {
  const parsed = runAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'ValidationError',
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  const { agentType, input } = parsed.data;
  try {
    const result = await agentRegistry[agentType].run(input);
    res.json({
      runId: result.runId,
      status: 'completed',
      output: result.output,
      spans: result.spanCount,
      durationMs: result.durationMs,
    });
  } catch (err) {
    console.error('[agents] run failed:', err);
    res.status(500).json({ error: 'AgentError', message: String(err && err.message) });
  }
});

// POST /api/drift/snapshot — push the current env-key manifest to the collector
const driftSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
});

app.post('/api/drift/snapshot', async (req, res) => {
  const parsed = driftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'ValidationError',
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  // driftSnapshot never throws/rejects by contract — it returns { ok:false } on error.
  const result = await driftSnapshot({
    environment: parsed.data.environment,
    projectKey: env.PULSE_API_KEY,
    apiUrl: env.DRIFT_API_URL,
    env: process.env,
  });

  res.json({ ok: result.ok, keyCount: result.keyCount });
});

// Fallback 404 for unknown routes
app.use((_req, res) => {
  res.status(404).json({ error: 'NotFound' });
});

app.listen(env.BACKEND_PORT, () => {
  console.log(`[backend] listening on http://localhost:${env.BACKEND_PORT} (APP_ENV=${env.APP_ENV})`);
});
