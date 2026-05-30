'use strict';

const { agent } = require('../agent-client');
const { sleep, randInt } = require('../util');

const CATEGORIES = ['billing', 'technical', 'sales', 'feedback', 'general'];

// Very small keyword classifier — deterministic enough to look real in a demo.
function classify(text) {
  const t = text.toLowerCase();
  if (/\b(invoice|payment|charge|refund|billing|price)\b/.test(t)) return 'billing';
  if (/\b(error|bug|crash|broken|fail|not working|issue)\b/.test(t)) return 'technical';
  if (/\b(buy|purchase|demo|quote|pricing|plan|upgrade)\b/.test(t)) return 'sales';
  if (/\b(love|hate|great|terrible|suggestion|feedback)\b/.test(t)) return 'feedback';
  return 'general';
}

// Classifier agent.
// Spans: classify-category (llm_call) -> lookup-taxonomy (tool_call)
//        -> classification-history (memory_read)
async function run(input) {
  const startedAt = Date.now();
  const text = String(input ?? '');

  const agentRun = await agent.startRun('classifier-task', {
    metadata: { agent: 'classifier', inputChars: text.length },
  });

  // 1) llm_call — assign a category
  const llm = agentRun.startSpan('llm_call', {
    name: 'classify-category',
    agentName: 'classifier',
    model: 'gpt-4o-mini',
    inputPreview: text.slice(0, 200),
  });
  await sleep(randInt(300, 700));
  const category = classify(text);
  const confidence = Number((0.6 + Math.random() * 0.39).toFixed(2));
  llm.end({ status: 'success', outputPreview: `${category} (${confidence})` });

  // 2) tool_call — resolve against the taxonomy
  const tool = agentRun.startSpan('tool_call', {
    name: 'lookup-taxonomy',
    agentName: 'classifier',
  });
  await sleep(randInt(100, 300));
  tool.end({ status: 'success', outputPreview: `taxonomy: ${CATEGORIES.join(',')}` });

  // 3) memory_read — past classifications
  const mem = agentRun.startSpan('memory_read', {
    name: 'classification-history',
    agentName: 'classifier',
  });
  await sleep(50);
  mem.end({ status: 'success', outputPreview: 'loaded 0 historical labels' });

  await agentRun.complete({ status: 'completed' });

  const output = {
    category,
    confidence,
    candidates: CATEGORIES,
  };

  return {
    output,
    spanCount: 3,
    durationMs: Date.now() - startedAt,
    runId: agentRun.id,
  };
}

module.exports = { run };
