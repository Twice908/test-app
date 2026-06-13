'use strict';

// PAO instrumentation: ~15 lines

// ─── PAO SETUP ───────────────────────────────────────────────────────────────
const { agent } = require('../../backend/src/agent-client');
// ─────────────────────────────────────────────────────────────────────────────

// ─── AGENT SETUP ─────────────────────────────────────────────────────────────
const { Agent } = require('@mastra/core/agent');
const { z } = require('zod');
const { google } = require('@ai-sdk/google');
const { sleep, randInt } = require('../../backend/src/util');
// ─────────────────────────────────────────────────────────────────────────────

const researchAgent = new Agent({
  name: 'research-pipeline',
  instructions:
    'You are a research assistant. Given a topic, write a concise 3-paragraph research summary covering: what it is, current state, and future implications. Keep it under 300 words.',
  model: google('gemini-2.5-flash'),
});

async function run(input) {
  const startedAt = Date.now();
  const topic = String(input ?? '').trim() || 'quantum computing';

  // ─── PAO: start run ────────────────────────────────────────────────────────
  const agentRun = await agent.startRun('research-pipeline-task', {
    metadata: { agent: 'research-pipeline', topic: topic.slice(0, 80) },
  });
  // ───────────────────────────────────────────────────────────────────────────

  let report, readability, approved, summary, formatted;

  try {
    // 1) db_read — check research cache
    await agentRun.withDbSpan({
      name: 'check-research-cache',
      operation: 'read',
      table: 'research_cache',
      inputPreview: topic,
      execute: async () => { await sleep(randInt(50, 100)); return null; },
      getOutputPreview: () => 'cache miss',
    });

    // 2) search — search knowledge index
    await agentRun.withSearchSpan({
      name: 'search-knowledge-index',
      index: 'knowledge-base',
      query: topic,
      topK: 5,
      execute: async () => {
        await sleep(randInt(100, 200));
        return [`${topic} overview`, `${topic} applications`, `${topic} recent advances`];
      },
      getOutputPreview: (r) => `${r.length} results found`,
    });

    // 3) http — fetch reference article
    await agentRun.withHttpSpan({
      name: 'fetch-reference-article',
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(topic)}`,
      method: 'GET',
      inputPreview: topic,
      execute: async () => {
        await sleep(randInt(200, 400));
        return { title: topic, excerpt: `${topic} is an emerging field with significant implications.` };
      },
      getOutputPreview: (r) => r.excerpt.slice(0, 100),
    });

    // 4) file — read research template
    await agentRun.withFileSpan({
      name: 'read-research-template',
      filePath: 'templates/research-template.txt',
      operation: 'read',
      inputPreview: 'research-template.txt',
      execute: async () => {
        await sleep(randInt(20, 50));
        return 'Introduction:\nFindings:\nConclusion:';
      },
      getOutputPreview: (r) => r.slice(0, 80),
    });

    // 5) embedding — embed search results
    await agentRun.withEmbeddingSpan({
      name: 'embed-search-results',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      inputPreview: topic,
      execute: async () => {
        await sleep(randInt(100, 300));
        return { vector: Array(1536).fill(0.1), dimensions: 1536 };
      },
      getOutputPreview: (r) => `vector dims=${r.dimensions}`,
    });

    // 6) memory — load research history
    await agentRun.withMemorySpan({
      name: 'load-research-history',
      memoryType: 'in-memory',
      inputPreview: `history for ${topic}`,
      execute: async () => { await sleep(50); return []; },
      getOutputPreview: () => 'loaded 0 prior research entries',
    });

    // 7) llm — synthesize research report (real Gemini call)
    const llmResult = await agentRun.withLLMSpan({
      name: 'synthesize-research-report',
      agentName: 'research-pipeline',
      model: 'gemini-2.5-flash',
      inputPreview: topic,
      execute: () => researchAgent.generate(`Write a research summary about: ${topic}`),
      getOutputPreview: (r) => r.text.slice(0, 200),
      getTokens: (r) => ({ input: r.usage?.promptTokens ?? 0, output: r.usage?.completionTokens ?? 0 }),
    });
    report = llmResult.text;

    // 8) code — analyze report readability
    readability = await agentRun.withCodeSpan({
      name: 'analyze-report-readability',
      language: 'javascript',
      inputPreview: 'word count + readability score',
      execute: async () => {
        await sleep(randInt(30, 80));
        const words = report.split(/\s+/).length;
        const sentences = report.split(/[.!?]+/).length;
        return { wordCount: words, sentenceCount: sentences, avgWordsPerSentence: Math.round(words / sentences) };
      },
      getOutputPreview: (r) => `words=${r.wordCount} sentences=${r.sentenceCount}`,
    });

    // 9) human approval — await publish approval
    const approvalResult = await agentRun.withHumanApprovalSpan({
      name: 'await-publish-approval',
      prompt: `Approve research report on "${topic}" for publishing?`,
      timeoutMs: 30000,
      execute: async () => { await sleep(500); return { approved: true, approvedBy: 'auto-approver' }; },
      getOutputPreview: (r) => `approved=${r.approved}`,
    });
    approved = approvalResult.approved;

    // 10) sub-agent — invoke summarizer agent
    const subAgentResult = await agentRun.withSubAgentSpan({
      name: 'invoke-summarizer-agent',
      subAgentName: 'summarizer',
      inputPreview: report.slice(0, 100),
      execute: async () => {
        await sleep(randInt(300, 600));
        return { summary: `${topic}: ${report.slice(0, 100)}...` };
      },
      getOutputPreview: (r) => r.summary.slice(0, 100),
    });
    summary = subAgentResult.summary;

    // 11) agent message — notify report complete
    await agentRun.withAgentMessageSpan({
      name: 'notify-report-complete',
      fromAgent: 'research-pipeline',
      toAgent: 'notifier',
      inputPreview: `Research on "${topic}" complete`,
      execute: async () => { await sleep(50); return { sent: true }; },
      getOutputPreview: () => 'notification sent',
    });

    // 12) createTrackedTool — format final output
    const formatTool = agentRun.createTrackedTool({
      id: 'format-output',
      spanName: 'format-final-output',
      description: 'Formats the research output as a structured JSON object',
      inputSchema: z.object({ topic: z.string(), report: z.string(), summary: z.string() }),
      execute: async ({ topic: t, report: rpt, summary: sum }) => {
        await sleep(randInt(100, 200));
        return { topic: t, report: rpt, summary: sum, formattedAt: new Date().toISOString() };
      },
    });
    formatted = await formatTool.execute({ topic, report, summary });

    // ─── PAO: complete run ──────────────────────────────────────────────────
    await agentRun.complete({ status: 'completed' });
    // ───────────────────────────────────────────────────────────────────────
  } finally {
    // ensure complete always fires
    if (!agentRun._completed) {
      await agentRun.complete({ status: 'completed' }).catch(() => {});
    }
  }

  return {
    output: {
      topic,
      report,
      summary,
      readability,
      approved,
      formatted,
    },
    spanCount: 12,
    durationMs: Date.now() - startedAt,
    runId: agentRun.id,
  };
}

module.exports = { run };
