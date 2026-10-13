export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

// Staff session lives in an httpOnly cookie set by the API, so every call sends credentials.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}
