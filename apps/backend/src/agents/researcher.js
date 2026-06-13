'use strict';

const { Agent } = require('@mastra/core/agent');
const { google } = require('@ai-sdk/google');
const { agent } = require('../agent-client');
const { sleep, randInt } = require('../util');

const researcherAgent = new Agent({
  name: 'researcher',
  instructions:
    'You are a research assistant. Given a topic, provide 3 key facts or findings about it, each in one sentence.',
  model: google('gemini-2.5-flash'),
});

// ─── ORIGINAL VERSION (manual span management) ───────────────────────────────
// Researcher agent.
// Spans: generate-queries (llm_call) -> web-search-sim (tool_call)
//        -> knowledge-cache (memory_read)
// async function run(input) {
//   const startedAt = Date.now();
//   const topic = String(input ?? '').trim() || 'unspecified topic';
//
//   const agentRun = await agent.startRun('researcher-task', {
//     metadata: { agent: 'researcher', topic: topic.slice(0, 80) },
//   });
//
//   // 1) llm_call — research the topic
//   const llm = agentRun.startSpan('llm_call', {
//     name: 'generate-queries',
//     agentName: 'researcher',
//     model: 'gemini-2.5-flash',
//     inputPreview: topic.slice(0, 200),
//   });
//
//   let researchText, inputTokens, outputTokens, costUsd;
//   try {
//     const result = await researcherAgent.generate(topic);
//     researchText = result.text;
//     inputTokens = result.usage?.promptTokens ?? 0;
//     outputTokens = result.usage?.completionTokens ?? 0;
//     costUsd = inputTokens * 0.00000025 + outputTokens * 0.00000125;
//     llm.end({ status: 'success', outputPreview: researchText.slice(0, 200), inputTokens, outputTokens, costUsd });
//   } catch (err) {
//     llm.end({ status: 'error', errorMessage: err.message });
//     await agentRun.complete({ status: 'failed' });
//     throw err;
//   }
//
//   const queries = [
//     `what is ${topic}`,
//     `${topic} latest developments`,
//     `${topic} pros and cons`,
//   ];
//
//   // 2) tool_call — simulate searching the web
//   const tool = agentRun.startSpan('tool_call', {
//     name: 'web-search-sim',
//     agentName: 'researcher',
//   });
//   await sleep(randInt(100, 300));
//   const findings = queries.map((q, i) => ({
//     query: q,
//     source: `https://example.com/result-${i + 1}`,
//     snippet: `Simulated finding ${i + 1} about ${topic}.`,
//   }));
//   tool.end({ status: 'success', outputPreview: `${findings.length} results` });
//
//   // 3) memory_read — knowledge cache lookup
//   const mem = agentRun.startSpan('memory_read', {
//     name: 'knowledge-cache',
//     agentName: 'researcher',
//   });
//   await sleep(50);
//   mem.end({ status: 'success', outputPreview: 'cache miss' });
//
//   await agentRun.complete({ status: 'completed' });
//
//   const output = {
//     topic,
//     queries,
//     findings,
//     summary: researchText,
//   };
//
//   return {
//     output,
//     spanCount: 3,
//     durationMs: Date.now() - startedAt,
//     runId: agentRun.id,
//   };
// }
// ─────────────────────────────────────────────────────────────────────────────

// ─── REFACTORED VERSION: using PAO SDK wrapper methods ───────────────────────
// Same researcher agent as above but using withLLMSpan(), withMemorySpan().
// No manual startSpan() / span.end() calls.
//
// PAO instrumentation in this version: ~8 lines (vs ~22 in run() above)
// ─────────────────────────────────────────────────────────────────────────────

async function runV2(input) {
  const startedAt = Date.now();
  const topic = String(input ?? '').trim() || 'unspecified topic';

  const agentRun = await agent.startRun('researcher-task', {
    metadata: { agent: 'researcher', topic: topic.slice(0, 80) },
  });

  // 1) llm_call — research the topic
  const result = await agentRun.withLLMSpan({
    name: 'generate-queries',
    agentName: 'researcher',
    model: 'gemini-2.5-flash',
    inputPreview: topic.slice(0, 200),
    execute: () => researcherAgent.generate(topic),
    getOutputPreview: (r) => r.text.slice(0, 200),
    getTokens: (r) => ({
      input: r.usage?.promptTokens ?? 0,
      output: r.usage?.completionTokens ?? 0,
    }),
  });

  const researchText = result.text;

  const queries = [
    `what is ${topic}`,
    `${topic} latest developments`,
    `${topic} pros and cons`,
  ];

  // 2) tool_call — simulate searching the web (simulated, no real Mastra tool)
  const findings = await agentRun.withMemorySpan({
    name: 'web-search-sim',
    agentName: 'researcher',
    inputPreview: `search ${queries.length} queries for ${topic}`,
    execute: async () => {
      await sleep(randInt(100, 300));
      return queries.map((q, i) => ({
        query: q,
        source: `https://example.com/result-${i + 1}`,
        snippet: `Simulated finding ${i + 1} about ${topic}.`,
      }));
    },
    getOutputPreview: (r) => `${r.length} results`,
  });

  // 3) memory_read — knowledge cache lookup
  await agentRun.withMemorySpan({
    name: 'knowledge-cache',
    agentName: 'researcher',
    inputPreview: `lookup cache for ${topic}`,
    execute: async () => {
      await sleep(50);
      return 'cache miss';
    },
    getOutputPreview: (r) => r,
  });

  await agentRun.complete({ status: 'completed' });

  const output = {
    topic,
    queries,
    findings,
    summary: researchText,
  };

  return {
    output,
    spanCount: 3,
    durationMs: Date.now() - startedAt,
    runId: agentRun.id,
  };
}

module.exports = { run: runV2, runV2 };
