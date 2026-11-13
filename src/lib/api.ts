const BASE = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').replace(/\/+$/, '');
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export const backendConfigured = Boolean(BASE && KEY);

export class ApiError extends Error {
  code: string;
  status: number;
  field?: string;

  constructor(code: string, message: string, status = 0, field?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.field = field;
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

function endpoint(path: string): string {
  return `${BASE}/functions/v1/planner${path}`;
}

function headers(token: string | null | undefined, extra?: Record<string, string>): HeadersInit {
  const h: Record<string, string> = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    Accept: 'application/json',
  };
  if (token) h['X-Owner-Token'] = token;
  if (extra) Object.assign(h, extra);
  return h;
}

function ensureConfigured() {
  if (!backendConfigured) {
    throw new ApiError(
      'backend_not_configured',
      'This build has no Supabase URL or anon key. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild.',
    );
  }
}

export async function request<T>(path: string, options: Options = {}): Promise<T> {
  ensureConfigured();
  const res = await fetch(endpoint(path), {
    method: options.method ?? 'GET',
    headers: headers(options.token, options.body === undefined ? undefined : { 'Content-Type': 'application/json' }),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  const raw = await res.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const err = (parsed as { error?: { code?: string; message?: string; field?: string } } | null)?.error;
    throw new ApiError(
      err?.code ?? 'request_failed',
      err?.message ?? `The server answered with ${res.status}. Try again in a moment.`,
      res.status,
      err?.field,
    );
  }
  return parsed as T;
}

export async function requestText(path: string, token: string): Promise<string> {
  ensureConfigured();
  const res = await fetch(endpoint(path), { headers: headers(token) });
  if (!res.ok) throw new ApiError('export_failed', `The export could not be built (${res.status}). Try again.`, res.status);
  return res.text();
}
