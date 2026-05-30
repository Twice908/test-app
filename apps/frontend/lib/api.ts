// Shared helpers for talking to the demo backend.

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  latencyMs: number;
  data: T | null;
  retryAfter?: string | null;
  error?: string;
}

// Fetch a backend endpoint and always return a structured result (never throws).
export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<ApiResult<T>> {
  const start = performance.now();
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    const latencyMs = Math.round(performance.now() - start);

    let data: T | null = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = text as unknown as T;
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      latencyMs,
      data,
      retryAfter: res.headers.get("retry-after"),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      latencyMs: Math.round(performance.now() - start),
      data: null,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export const DASHBOARD_URL = "http://localhost:3000";
