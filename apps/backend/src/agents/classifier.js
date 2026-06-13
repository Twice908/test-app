'use strict';

const { Agent } = require('@mastra/core/agent');
const { google } = require('@ai-sdk/google');
const { agent } = require('../agent-client');
const { sleep, randInt } = require('../util');

const CATEGORIES = ['Technology', 'Business', 'Science', 'Health', 'Politics', 'Entertainment', 'Other'];

const classifierAgent = new Agent({
  name: 'classifier',
  instructions:
    'You are a classification expert. Classify the given text into one of these categories: Technology, Business, Science, Health, Politics, Entertainment, Other. Reply with just the category name and a one-line reason.',
  model: google('gemini-2.5-flash'),
});

function parseCategory(text) {
  const firstLine = text.trim().split('\n')[0].trim();
  for (const cat of CATEGORIES) {
    if (firstLine.toLowerCase().startsWith(cat.toLowerCase())) return cat;
  }
  const firstWord = firstLine.split(/[\s\-:]/)[0];
  for (const cat of CATEGORIES) {
    if (cat.toLowerCase() === firstWord.toLowerCase()) return cat;
  }
  return 'Other';
}

// ─── ORIGINAL VERSION (manual span management) ───────────────────────────────
// Classifier agent.
// Spans: classify-category (llm_call) -> lookup-taxonomy (tool_call)
//        -> classification-history (memory_read)
// async function run(input) {
//   const startedAt = Date.now();
//   const text = String(input ?? '');
//
//   const agentRun = await agent.startRun('classifier-task', {
//     metadata: { agent: 'classifier', inputChars: text.length },
//   });
//
//   // 1) llm_call — assign a category
//   const llm = agentRun.startSpan('llm_call', {
//     name: 'classify-category',
//     agentName: 'classifier',
//     model: 'gemini-2.5-flash',
//     inputPreview: text.slice(0, 200),
//   });
//
//   let category, confidence, inputTokens, outputTokens, costUsd, llmText;
//   try {
//     const result = await classifierAgent.generate(text);
//     llmText = result.text;
//     category = parseCategory(llmText);
//     confidence = Number((0.6 + Math.random() * 0.39).toFixed(2));
//     inputTokens = result.usage?.promptTokens ?? 0;
//     outputTokens = result.usage?.completionTokens ?? 0;
//     costUsd = inputTokens * 0.00000025 + outputTokens * 0.00000125;
//     llm.end({ status: 'success', outputPreview: `${category} (${confidence})`, inputTokens, outputTokens, costUsd });
//   } catch (err) {
//     llm.end({ status: 'error', errorMessage: err.message });
//     await agentRun.complete({ status: 'failed' });
//     throw err;
//   }
//
//   // 2) tool_call — resolve against the taxonomy
//   const tool = agentRun.startSpan('tool_call', {
//     name: 'lookup-taxonomy',
//     agentName: 'classifier',
//   });
//   await sleep(randInt(100, 300));
//   tool.end({ status: 'success', outputPreview: `taxonomy: ${CATEGORIES.join(',')}` });
//
//   // 3) memory_read — past classifications
//   const mem = agentRun.startSpan('memory_read', {
//     name: 'classification-history',
//     agentName: 'classifier',
//   });
//   await sleep(50);
//   mem.end({ status: 'success', outputPreview: 'loaded 0 historical labels' });
//
//   await agentRun.complete({ status: 'completed' });
//
//   const output = {
//     category,
//     confidence,
//     candidates: CATEGORIES,
//     reason: llmText,
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
// Same classifier agent as above but using withLLMSpan(), withMemorySpan(),
// and withAgentMessageSpan(). No manual startSpan() / span.end() calls.
//
// PAO instrumentation in this version: ~9 lines (vs ~25 in run() above)
// ─────────────────────────────────────────────────────────────────────────────

async function runV2(input) {
  const startedAt = Date.now();
  const text = String(input ?? '');

  const agentRun = await agent.startRun('classifier-task', {
    metadata: { agent: 'classifier', inputChars: text.length },
  });

  // 1) llm_call — assign a category
  const result = await agentRun.withLLMSpan({
    name: 'classify-category',
    agentName: 'classifier',
    model: 'gemini-2.5-flash',
    inputPreview: text.slice(0, 200),
    execute: () => classifierAgent.generate(text),
    getOutputPreview: (r) => `${parseCategory(r.text)} (confidence)`,
    getTokens: (r) => ({
      input: r.usage?.promptTokens ?? 0,
      output: r.usage?.completionTokens ?? 0,
    }),
  });

  const llmText = result.text;
  const category = parseCategory(llmText);
  const confidence = Number((0.6 + Math.random() * 0.39).toFixed(2));

  // 2) tool_call — resolve against the taxonomy (simulated, no real Mastra tool)
  await agentRun.withMemorySpan({
    name: 'lookup-taxonomy',
    agentName: 'classifier',
    inputPreview: 'resolve category against taxonomy',
    execute: async () => {
      await sleep(randInt(100, 300));
      return `taxonomy: ${CATEGORIES.join(',')}`;
    },
    getOutputPreview: (r) => r,
  });

  // 3) memory_read — past classifications
  await agentRun.withMemorySpan({
    name: 'classification-history',
    agentName: 'classifier',
    inputPreview: 'load historical labels',
    execute: async () => {
      await sleep(50);
      return 'loaded 0 historical labels';
    },
    getOutputPreview: (r) => r,
  });

  await agentRun.complete({ status: 'completed' });

  const output = {
    category,
    confidence,
    candidates: CATEGORIES,
    reason: llmText,
  };

  return {
    output,
    spanCount: 3,
    durationMs: Date.now() - startedAt,
    runId: agentRun.id,
  };
}

module.exports = { run: runV2, runV2 };
