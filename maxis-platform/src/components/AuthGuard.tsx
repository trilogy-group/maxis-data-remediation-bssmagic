'use client';

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';

interface AuthState {
  isLoggedIn: boolean;
  name?: string;
  email?: string;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ isLoggedIn: false, loading: true, logout: async () => {} });
export const useAuth = () => useContext(AuthContext);

export default function AuthGuard({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<{ isLoggedIn: boolean; name?: string; email?: string }>({ isLoggedIn: false });
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    fetch('/platform/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.isLoggedIn) setAuth({ isLoggedIn: true, name: data.name, email: data.email });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch('/platform/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setAuth({ isLoggedIn: true, name: data.name, email: data.email });
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch {
      setLoginError('Connection error');
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    await fetch('/platform/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    setAuth({ isLoggedIn: false });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-slate-700 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading BSS Magic...</p>
        </div>
      </div>
    );
  }

  if (!auth.isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-lg font-bold">T</span>
            </div>
            <h1 className="text-2xl font-bold text-white">BSS Magic</h1>
            <p className="text-slate-400 text-sm mt-1">Sign in to access the Maxis platform</p>
          </div>

          <form onSubmit={handleLogin} className="bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            {loginError && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {loggingIn ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-slate-600 text-xs mt-6">
            This system is for authorized personnel only. All access is logged and monitored.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ ...auth, loading: false, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
