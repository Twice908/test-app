"use client";

import { useState } from "react";
import { apiFetch, ApiResult } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

type State = {
  loading: boolean;
  result: ApiResult | null;
};

const idle: State = { loading: false, result: null };

// Border colour reflects the last outcome: grey idle/loading, green 2xx, red error.
function borderClass(s: State): string {
  if (s.loading) return "border-gray-600";
  if (!s.result) return "border-gray-800";
  return s.result.ok ? "border-emerald-500" : "border-red-500";
}

function Meta({ state }: { state: State }) {
  if (!state.result && !state.loading) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <StatusBadge
        status={state.result?.status ?? 0}
        loading={state.loading}
      />
      {state.result && (
        <span className="text-gray-400">{state.result.latencyMs} ms</span>
      )}
    </div>
  );
}

function ResultBox({ state }: { state: State }) {
  return (
    <pre
      className={`mt-3 max-h-64 overflow-auto rounded-md border bg-gray-900 p-3 text-xs text-gray-200 ${borderClass(
        state
      )}`}
    >
      {state.loading
        ? "loading…"
        : state.result
        ? JSON.stringify(state.result.data ?? state.result.error, null, 2)
        : "No request yet."}
    </pre>
  );
}

export default function ObservePage() {
  const [getUsers, setGetUsers] = useState<State>(idle);
  const [postUser, setPostUser] = useState<State>(idle);
  const [data, setData] = useState<State>(idle);
  const [heavy, setHeavy] = useState<State>(idle);
  const [del, setDel] = useState<State>(idle);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [deleteId, setDeleteId] = useState("");

  async function fire(
    setter: (s: State) => void,
    path: string,
    init?: RequestInit
  ) {
    setter({ loading: true, result: null });
    const result = await apiFetch(path, init);
    setter({ loading: false, result });
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Observe — Request Tester</h1>
        <p className="text-sm text-gray-400">
          Fire requests at the backend; each is captured by Pulse Observe and
          shows status + latency.
        </p>
      </header>

      {/* 1. GET /api/users */}
      <section className="rounded-lg border border-gray-800 bg-gray-900/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">GET /api/users</h2>
          <Meta state={getUsers} />
        </div>
        <button
          onClick={() => fire(setGetUsers, "/api/users")}
          disabled={getUsers.loading}
          className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          Fetch users
        </button>
        <ResultBox state={getUsers} />
      </section>

      {/* 2. POST /api/users */}
      <section className="rounded-lg border border-gray-800 bg-gray-900/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">POST /api/users</h2>
          <Meta state={postUser} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="name"
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm"
          />
          <button
            onClick={() =>
              fire(setPostUser, "/api/users", {
                method: "POST",
                body: JSON.stringify({ name, email }),
              })
            }
            disabled={postUser.loading}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            Create user
          </button>
        </div>
        <ResultBox state={postUser} />
      </section>

      {/* 3. GET /api/data */}
      <section className="rounded-lg border border-gray-800 bg-gray-900/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">GET /api/data</h2>
          <Meta state={data} />
        </div>
        <button
          onClick={() => fire(setData, "/api/data")}
          disabled={data.loading}
          className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          Fetch analytics
        </button>
        {data.result?.ok && data.result.data ? (
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {(() => {
              const d = data.result.data as {
                requests: number;
                errors: number;
                avgLatency: number;
                topRoutes: { route: string }[];
              };
              return (
                <>
                  <span>requests: <b>{d.requests}</b></span>
                  <span>errors: <b>{d.errors}</b></span>
                  <span>avgLatency: <b>{d.avgLatency}ms</b></span>
                  <span>topRoutes: <b>{d.topRoutes?.length ?? 0}</b></span>
                </>
              );
            })()}
          </div>
        ) : (
          <ResultBox state={data} />
        )}
      </section>

      {/* 4. GET /api/heavy */}
      <section className="rounded-lg border border-gray-800 bg-gray-900/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">GET /api/heavy</h2>
            <p className="text-xs text-amber-400">
              Slow endpoint — watch for it in dashboard
            </p>
          </div>
          <Meta state={heavy} />
        </div>
        <button
          onClick={() => fire(setHeavy, "/api/heavy")}
          disabled={heavy.loading}
          className="mt-3 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium hover:bg-amber-500 disabled:opacity-50"
        >
          Hit heavy endpoint
        </button>
        {heavy.result && !heavy.loading && (
          <p className="mt-2 text-sm text-gray-300">
            Response time: <b>{heavy.result.latencyMs} ms</b> (expect ~800ms)
          </p>
        )}
        <ResultBox state={heavy} />
      </section>

      {/* 5. DELETE /api/users/:id */}
      <section className="rounded-lg border border-gray-800 bg-gray-900/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">DELETE /api/users/:id</h2>
          <Meta state={del} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={deleteId}
            onChange={(e) => setDeleteId(e.target.value)}
            placeholder="user id (1-5 exists)"
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm"
          />
          <button
            onClick={() =>
              fire(setDel, `/api/users/${encodeURIComponent(deleteId)}`, {
                method: "DELETE",
              })
            }
            disabled={del.loading || !deleteId}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-50"
          >
            Delete user
          </button>
        </div>
        <ResultBox state={del} />
      </section>
    </div>
  );
}
