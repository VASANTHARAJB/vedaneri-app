import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL, ApiError } from './api';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'superadmin' | 'admin' | 'priest' | 'editor' | 'devotee';
}

export interface AuthCtx {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('cms_token');
    const savedUser = localStorage.getItem('cms_user');
    const loginTime = localStorage.getItem('cms_login_time');

    if (savedToken && savedUser && loginTime) {
      try {
        const now = Date.now();
        const loggedInAt = parseInt(loginTime, 10);
        const twentyFourHours = 24 * 60 * 60 * 1000;

        // Force logout if saved session exceeds 24 hours
        if (isNaN(loggedInAt) || now - loggedInAt > twentyFourHours) {
          console.warn("CMS Session expired. logging out automatically (24h rule).");
          localStorage.removeItem('cms_token');
          localStorage.removeItem('cms_user');
          localStorage.removeItem('cms_login_time');
        } else {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch {
        localStorage.removeItem('cms_token');
        localStorage.removeItem('cms_user');
        localStorage.removeItem('cms_login_time');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new ApiError(data.message || data.error?.message || 'Invalid email or password', res.status);
    }

    const allowedRoles = ['superadmin', 'admin', 'priest', 'editor'];
    if (!allowedRoles.includes(data.user?.role)) {
      throw new ApiError('Access denied. Devotee accounts cannot access the Staff Portal.', 403);
    }

    setToken(data.token);
    setUser(data.user);
    
    // Store exact session start time & details
    localStorage.setItem('cms_token', data.token);
    localStorage.setItem('cms_user', JSON.stringify(data.user));
    localStorage.setItem('cms_login_time', Date.now().toString());
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('cms_token');
    localStorage.removeItem('cms_user');
    localStorage.removeItem('cms_login_time');
  };

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