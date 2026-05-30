'use strict';

// Single shared PulseAgent instance used by every mock agent.
// Points at the Pulse Ingestion API (PULSE_HOST). If the API key is a
// placeholder the SDK simply runs in a disabled/no-op mode — it never throws,
// so the demo keeps working even before a real key is filled in.

const { PulseAgent } = require('@pulse/agent');
const { env } = require('./env');

const agent = new PulseAgent({
  apiKey: env.PULSE_API_KEY,
  host: env.PULSE_HOST,
});

module.exports = { agent };
