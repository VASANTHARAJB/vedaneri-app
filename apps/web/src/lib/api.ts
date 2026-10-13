const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

// Server-side fetch helper for public content. Pages are cached and revalidated on publish.
export async function api<T>(path: string, lang: 'en' | 'ta', revalidate = 60): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${path}${sep}lang=${lang}`, { next: { revalidate } });
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}
