import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE_URL, ApiError } from './api';
import { STAFF_ROLES } from './access';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'superadmin' | 'admin' | 'website' | 'payments' | 'registration' | 'sales' | 'priest' | 'editor' | 'devotee';
  // The pages ticked for this login on the Users page; null or missing = the pages of the role
  page_access?: string[] | null;
}

export interface AuthCtx {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

const SESSION_MS = 24 * 60 * 60 * 1000; // one login lasts 24 hours

const clearSession = () => {
  localStorage.removeItem('cms_token');
  localStorage.removeItem('cms_user');
  localStorage.removeItem('cms_login_time');
};

// When the saved login ends: 24 hours after sign-in, or when the token itself expires, whichever is first
function expiryOf(token: string, loggedInAt: number): number {
  let end = loggedInAt + SESSION_MS;
  try {
    const part = token.split('.')[1];
    const json = JSON.parse(decodeURIComponent(escape(atob(part.replace(/-/g, '+').replace(/_/g, '/')))));
    if (typeof json.exp === 'number') end = Math.min(end, json.exp * 1000);
  } catch { /* an unreadable token is checked by the server */ }
  return end;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const endSession = useCallback((reason?: 'expired' | 'ended') => {
    if (reason) { try { localStorage.setItem('cms_notice', reason); } catch { /* ignore */ } }
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  // Restore a saved login, and drop it if the 24 hours are over
  useEffect(() => {
    const savedToken = localStorage.getItem('cms_token');
    const savedUser = localStorage.getItem('cms_user');
    const loginTime = localStorage.getItem('cms_login_time');

    if (savedToken && savedUser && loginTime) {
      try {
        const loggedInAt = parseInt(loginTime, 10);
        if (isNaN(loggedInAt) || Date.now() >= expiryOf(savedToken, loggedInAt)) {
          endSession('expired');
        } else {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch {
        endSession();
      }
    }
    setLoading(false);
  }, [endSession]);

  // Sign out by itself at the moment the 24 hours end, even if the portal stays open
  useEffect(() => {
    if (!token) return;
    const loggedInAt = parseInt(localStorage.getItem('cms_login_time') || '0', 10);
    const wait = expiryOf(token, loggedInAt) - Date.now();
    if (wait <= 0) { endSession('expired'); return; }
    // setTimeout cannot wait longer than about 24.8 days, and 24 hours is well below that
    const t = setTimeout(() => endSession('expired'), wait);
    return () => clearTimeout(t);
  }, [token, endSession]);

  // Ask the server who this login is now, so a changed role or a deactivated login is noticed
  useEffect(() => {
    if (!token) return;
    let alive = true;
    fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 401 || res.status === 403) { endSession('ended'); return; }
        if (!res.ok) return;
        const d = await res.json();
        if (!alive || !d?.user) return;
        setUser((prev) => {
          if (prev && prev.role === d.user.role && prev.full_name === d.user.full_name && prev.email === d.user.email
            && JSON.stringify(prev.page_access ?? null) === JSON.stringify(d.user.page_access ?? null)) return prev;
          localStorage.setItem('cms_user', JSON.stringify(d.user));
          return d.user as User;
        });
      })
      .catch(() => { /* offline: keep the saved login until the server can be reached */ });
    return () => { alive = false; };
  }, [token, endSession]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new ApiError(data.message || data.error?.message || 'Invalid email or password', res.status);
    }

    if (!STAFF_ROLES.includes(data.user?.role)) {
      throw new ApiError('Access denied. This login cannot use the Staff Portal.', 403);
    }

    // Store the exact session start time and details
    localStorage.setItem('cms_token', data.token);
    localStorage.setItem('cms_user', JSON.stringify(data.user));
    localStorage.setItem('cms_login_time', Date.now().toString());
    try { localStorage.removeItem('cms_notice'); } catch { /* ignore */ }
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => endSession();

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}