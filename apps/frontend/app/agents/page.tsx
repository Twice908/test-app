"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { DASHBOARD_URL } from "@/lib/api";

type AgentType = "summarizer" | "classifier" | "researcher";

interface RunResult {
  runId: string;
  status: string;
  output: unknown;
  spans: number;
  durationMs: number;
}

interface HistoryRow extends RunResult {
  agent: AgentType;
  at: string;
}

const AGENTS: { type: AgentType; label: string; placeholder: string }[] = [
  {
    type: "summarizer",
    label: "Summarizer",
    placeholder: "Paste text to summarize…",
  },
  {
    type: "classifier",
    label: "Classifier",
    placeholder: "Enter a message to classify…",
  },
  {
    type: "researcher",
    label: "Researcher",
    placeholder: "Enter a research topic…",
  },
];

function AgentCard({
  type,
  label,
  placeholder,
  onRun,
}: {
  type: AgentType;
  label: string;
  placeholder: string;
  onRun: (row: HistoryRow) => void;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await apiFetch<RunResult>("/api/agents/run", {
      method: "POST",
      body: JSON.stringify({ agentType: type, input }),
    });
    setLoading(false);
    if (res.ok && res.data) {
      setResult(res.data);
      onRun({ ...res.data, agent: type, at: new Date().toLocaleTimeString() });
    } else {
      setError(
        (res.data as { message?: string })?.message ||
          res.error ||
          `Request failed (${res.status})`
      );
    }
  }

  return (
    <div className="flex flex-col rounded-lg border border-gray-800 bg-gray-900/40 p-4">
      <h2 className="font-semibold">{label}</h2>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="mt-3 resize-none rounded-md border border-gray-700 bg-gray-950 p-2 text-sm"
      />
      <button
        onClick={run}
        disabled={loading || !input.trim()}
        className="mt-3 flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        )}
        {loading ? "Running…" : "Run"}
      </button>

      {error && (
        <p className="mt-3 rounded-md border border-red-500 bg-red-500/10 p-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-3 space-y-1 rounded-md border border-emerald-500 bg-gray-950 p-3 text-xs">
          <div>
            <span className="text-gray-400">Run ID:</span>{" "}
            <span className="font-mono">{result.runId}</span>
          </div>
          <div>
            <span className="text-gray-400">Status:</span>{" "}
            <span className="text-emerald-300">{result.status}</span>
          </div>
          <div>
            <span className="text-gray-400">Spans:</span> {result.spans}
          </div>
          <div>
            <span className="text-gray-400">Duration:</span>{" "}
            {result.durationMs} ms
          </div>
          <div className="text-gray-400">Output:</div>
          <pre className="max-h-40 overflow-auto rounded bg-gray-900 p-2 text-gray-200">
            {JSON.stringify(result.output, null, 2)}
          </pre>
          <a
            href={DASHBOARD_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-emerald-400 underline"
          >
            View in dashboard →
          </a>
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const [history, setHistory] = useState<HistoryRow[]>([]);

  function addRow(row: HistoryRow) {
    setHistory((prev) => [row, ...prev].slice(0, 5));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Agents — Runner</h1>
        <p className="text-sm text-gray-400">
          Each run is traced with Pulse Agent (3 spans: llm_call → tool_call →
          memory_read).
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {AGENTS.map((a) => (
          <AgentCard key={a.type} {...a} onRun={addRow} />
        ))}
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Last 5 runs</h2>
        <div className="overflow-hidden rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">time</th>
                <th className="px-4 py-2 text-left">agent</th>
                <th className="px-4 py-2 text-left">run id</th>
                <th className="px-4 py-2 text-left">status</th>
                <th className="px-4 py-2 text-left">spans</th>
                <th className="px-4 py-2 text-left">duration</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    No runs yet.
                  </td>
                </tr>
              ) : (
                history.map((r, i) => (
                  <tr key={`${r.runId}-${i}`} className="border-t border-gray-800">
                    <td className="px-4 py-2">{r.at}</td>
                    <td className="px-4 py-2">{r.agent}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.runId}</td>
                    <td className="px-4 py-2 text-emerald-300">{r.status}</td>
                    <td className="px-4 py-2">{r.spans}</td>
                    <td className="px-4 py-2">{r.durationMs} ms</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
