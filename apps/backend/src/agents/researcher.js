'use strict';

const { agent } = require('../agent-client');
const { sleep, randInt } = require('../util');

// Researcher agent.
// Spans: generate-queries (llm_call) -> web-search-sim (tool_call)
//        -> knowledge-cache (memory_read)
async function run(input) {
  const startedAt = Date.now();
  const topic = String(input ?? '').trim() || 'unspecified topic';

  const agentRun = await agent.startRun('researcher-task', {
    metadata: { agent: 'researcher', topic: topic.slice(0, 80) },
  });

  // 1) llm_call — turn the topic into search queries
  const llm = agentRun.startSpan('llm_call', {
    name: 'generate-queries',
    agentName: 'researcher',
    model: 'gpt-4o-mini',
    inputPreview: topic.slice(0, 200),
  });
  await sleep(randInt(300, 700));
  const queries = [
    `what is ${topic}`,
    `${topic} latest developments`,
    `${topic} pros and cons`,
  ];
  llm.end({ status: 'success', outputPreview: queries.join(' | ').slice(0, 200) });

  // 2) tool_call — simulate searching the web
  const tool = agentRun.startSpan('tool_call', {
    name: 'web-search-sim',
    agentName: 'researcher',
  });
  await sleep(randInt(100, 300));
  const findings = queries.map((q, i) => ({
    query: q,
    source: `https://example.com/result-${i + 1}`,
    snippet: `Simulated finding ${i + 1} about ${topic}.`,
  }));
  tool.end({ status: 'success', outputPreview: `${findings.length} results` });

  // 3) memory_read — knowledge cache lookup
  const mem = agentRun.startSpan('memory_read', {
    name: 'knowledge-cache',
    agentName: 'researcher',
  });
  await sleep(50);
  mem.end({ status: 'success', outputPreview: 'cache miss' });

  await agentRun.complete({ status: 'completed' });

  const output = {
    topic,
    queries,
    findings,
    summary: `Gathered ${findings.length} simulated sources on "${topic}".`,
  };

  return {
    output,
    spanCount: 3,
    durationMs: Date.now() - startedAt,
    runId: agentRun.id,
  };
}

module.exports = { run };
