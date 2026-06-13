'use strict';

const { Agent } = require('@mastra/core/agent');
const { google } = require('@ai-sdk/google');
const { agent } = require('../agent-client');
const { sleep, randInt } = require('../util');

const summarizerAgent = new Agent({
  name: 'summarizer',
  instructions: 'You are a summarization expert. Summarize the given text concisely in 2-3 sentences.',
  model: google('gemini-2.5-flash'),
});

// ─── ORIGINAL VERSION (manual span management) ───────────────────────────────
// Summarizer agent.
// Spans: summarize-text (llm_call) -> extract-key-points (tool_call)
//        -> retrieve-prior-summaries (memory_read)
// async function run(input) {
//   const startedAt = Date.now();
//   const text = String(input ?? '');
//
//   const agentRun = await agent.startRun('summarizer-task', {
//     metadata: { agent: 'summarizer', inputChars: text.length },
//   });
//
//   // 1) llm_call — the actual summarization
//   const llm = agentRun.startSpan('llm_call', {
//     name: 'summarize-text',
//     agentName: 'summarizer',
//     model: 'gemini-2.5-flash',
//     inputPreview: text.slice(0, 200),
//   });
//
//   let summary, inputTokens, outputTokens, costUsd;
//   try {
//     const result = await summarizerAgent.generate(text);
//     summary = result.text;
//     inputTokens = result.usage?.promptTokens ?? 0;
//     outputTokens = result.usage?.completionTokens ?? 0;
//     costUsd = inputTokens * 0.00000025 + outputTokens * 0.00000125;
//     llm.end({ status: 'success', outputPreview: summary.slice(0, 200), inputTokens, outputTokens, costUsd });
//   } catch (err) {
//     llm.end({ status: 'error', errorMessage: err.message });
//     await agentRun.complete({ status: 'failed' });
//     throw err;
//   }
//
//   // 2) tool_call — pull out key points
//   const tool = agentRun.startSpan('tool_call', {
//     name: 'extract-key-points',
//     agentName: 'summarizer',
//   });
//   await sleep(randInt(100, 300));
//   const sentences = text
//     .split(/[.!?]+/)
//     .map((s) => s.trim())
//     .filter(Boolean);
//   const keyPoints = sentences.slice(0, 3).map((s, i) => `${i + 1}. ${s}`);
//   tool.end({ status: 'success', outputPreview: keyPoints.join(' | ').slice(0, 200) });
//
//   // 3) memory_read — look at prior summaries
//   const mem = agentRun.startSpan('memory_read', {
//     name: 'retrieve-prior-summaries',
//     agentName: 'summarizer',
//   });
//   await sleep(50);
//   mem.end({ status: 'success', outputPreview: 'loaded 0 prior summaries' });
//
//   await agentRun.complete({ status: 'completed' });
//
//   const output = {
//     summary,
//     keyPoints,
//     wordCount: text.split(/\s+/).filter(Boolean).length,
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
// Same summarizer agent as above but using withLLMSpan(), withMemorySpan().
// No manual startSpan() / span.end() calls.
//
// PAO instrumentation in this version: ~8 lines (vs ~22 in run() above)
// ─────────────────────────────────────────────────────────────────────────────

async function runV2(input) {
  const startedAt = Date.now();
  const text = String(input ?? '');

  const agentRun = await agent.startRun('summarizer-task', {
    metadata: { agent: 'summarizer', inputChars: text.length },
  });

  // 1) llm_call — the actual summarization
  const result = await agentRun.withLLMSpan({
    name: 'summarize-text',
    agentName: 'summarizer',
    model: 'gemini-2.5-flash',
    inputPreview: text.slice(0, 200),
    execute: () => summarizerAgent.generate(text),
    getOutputPreview: (r) => r.text.slice(0, 200),
    getTokens: (r) => ({
      input: r.usage?.promptTokens ?? 0,
      output: r.usage?.completionTokens ?? 0,
    }),
  });

  const summary = result.text;

  // 2) tool_call — pull out key points (simulated, no real Mastra tool)
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const keyPoints = sentences.slice(0, 3).map((s, i) => `${i + 1}. ${s}`);

  await agentRun.withMemorySpan({
    name: 'extract-key-points',
    agentName: 'summarizer',
    inputPreview: 'extract key points from text',
    execute: async () => {
      await sleep(randInt(100, 300));
      return keyPoints.join(' | ').slice(0, 200);
    },
    getOutputPreview: (r) => r,
  });

  // 3) memory_read — look at prior summaries
  await agentRun.withMemorySpan({
    name: 'retrieve-prior-summaries',
    agentName: 'summarizer',
    inputPreview: 'load prior summaries',
    execute: async () => {
      await sleep(50);
      return 'loaded 0 prior summaries';
    },
    getOutputPreview: (r) => r,
  });

  await agentRun.complete({ status: 'completed' });

  const output = {
    summary,
    keyPoints,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  };

  return {
    output,
    spanCount: 3,
    durationMs: Date.now() - startedAt,
    runId: agentRun.id,
  };
}

module.exports = { run: runV2, runV2 };
