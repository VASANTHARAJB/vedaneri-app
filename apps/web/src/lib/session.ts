const TOKEN_KEY = 'devotee_token';
export const MAX_SESSION_SECONDS = 24 * 60 * 60;

function decodePayload(token: string): { exp?: number; iat?: number } | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

// The session ends at the earlier of the token's own expiry and 24 hours after it was issued.
// Returns the end time in milliseconds, or null when the token cannot be read.
export function sessionEndsAt(token: string): number | null {
  const p = decodePayload(token);
  if (!p) return null;
  const ends: number[] = [];
  if (typeof p.exp === 'number') ends.push(p.exp * 1000);
  if (typeof p.iat === 'number') ends.push((p.iat + MAX_SESSION_SECONDS) * 1000);
  return ends.length ? Math.min(...ends) : null;
}

export function readSessionToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event('devotee-auth-change'));
}