'use strict';

const { agent } = require('../agent-client');
const { sleep, randInt } = require('../util');

// Summarizer agent.
// Spans: summarize-text (llm_call) -> extract-key-points (tool_call)
//        -> retrieve-prior-summaries (memory_read)
async function run(input) {
  const startedAt = Date.now();
  const text = String(input ?? '');

  const agentRun = await agent.startRun('summarizer-task', {
    metadata: { agent: 'summarizer', inputChars: text.length },
  });

  // 1) llm_call — the actual summarization
  const llm = agentRun.startSpan('llm_call', {
    name: 'summarize-text',
    agentName: 'summarizer',
    model: 'gpt-4o-mini',
    inputPreview: text.slice(0, 200),
  });
  await sleep(randInt(300, 700));
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const summary = sentences.length
    ? `Summary: ${sentences.slice(0, 2).join('. ')}.`
    : 'Summary: (no meaningful content provided)';
  llm.end({ status: 'success', outputPreview: summary.slice(0, 200) });

  // 2) tool_call — pull out key points
  const tool = agentRun.startSpan('tool_call', {
    name: 'extract-key-points',
    agentName: 'summarizer',
  });
  await sleep(randInt(100, 300));
  const keyPoints = sentences.slice(0, 3).map((s, i) => `${i + 1}. ${s}`);
  tool.end({ status: 'success', outputPreview: keyPoints.join(' | ').slice(0, 200) });

  // 3) memory_read — look at prior summaries
  const mem = agentRun.startSpan('memory_read', {
    name: 'retrieve-prior-summaries',
    agentName: 'summarizer',
  });
  await sleep(50);
  mem.end({ status: 'success', outputPreview: 'loaded 0 prior summaries' });

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

module.exports = { run };
