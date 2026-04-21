import { getCachedToken, loadToken } from '../lib/authStore';

export const API_BASE_URL = 'https://api-unplgd.dinedroid.com';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';
  body?: unknown;
  auth?: boolean;
};

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getCachedToken() ?? (await loadToken());
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await res.text();
  let parsed: any = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { message: raw };
    }
  }

  if (!res.ok) {
    throw new ApiError(
      parsed?.message ?? `HTTP ${res.status}`,
      res.status,
      parsed?.error,
      parsed?.details,
    );
  }

  return parsed as T;
}
