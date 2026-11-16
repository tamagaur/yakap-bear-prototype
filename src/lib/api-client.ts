/**
 * Tiny typed fetch wrapper for the Rust API (proxied at /api/*). Errors use
 * the API's `{ error: { code, message, details } }` shape.
 */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function apiFetch<T>(url: string, opts: ApiOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.json !== undefined || opts.body ? "POST" : "GET"),
      headers: {
        ...(opts.json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...opts.headers,
      },
      body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
      credentials: "same-origin",
      cache: "no-store",
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError(0, "NETWORK", "Can't reach the Yakap server. Check your connection.");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    const fallback =
      res.status === 502 || res.status === 504
        ? "The Yakap API isn't responding. Is the Rust server running?"
        : `Request failed (${res.status}).`;
    throw new ApiClientError(res.status, err?.code ?? "HTTP_ERROR", err?.message ?? fallback, err?.details);
  }
  return data as T;
}

/** SWR fetcher. */
export const fetcher = <T>(url: string) => apiFetch<T>(url);

export function errorMessage(e: unknown): string {
  if (e instanceof ApiClientError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}
