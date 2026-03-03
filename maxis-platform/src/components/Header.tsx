'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchMetadata } from '@/lib/api';
import { useAuth } from './AuthGuard';
import { useTheme } from './ThemeProvider';
import { Wifi, WifiOff, LogOut, User, Sun, Moon } from 'lucide-react';

export default function Header() {
  const { data, isError, isLoading } = useQuery({
    queryKey: ['header-health'],
    queryFn: fetchMetadata,
    refetchInterval: 30000,
    retry: 1,
  });

  const { name, email, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const connected = !!data && !isError;
  const entityCount = data?.resources.filter(r => r.mapped).length ?? 0;
  const dark = theme === 'dark';

  return (
    <header className={`h-14 border-b flex items-center justify-between px-6 shrink-0 ${dark ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">T</span>
        </div>
        <span className={`font-semibold text-lg tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>totogi</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
          <div className="w-5 h-5 rounded bg-purple-600/30 flex items-center justify-center">
            <span className="text-purple-300 text-[10px]">M</span>
          </div>
          <span>Maxis CloudSense</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${connected ? (dark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700') : isLoading ? (dark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400') : (dark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600')}`}>
          {connected ? (
            <><Wifi className="w-3 h-3" /> Runtime ({entityCount})</>
          ) : isLoading ? (
            <><div className={`w-3 h-3 border ${dark ? 'border-slate-500' : 'border-slate-300'} border-t-transparent rounded-full animate-spin`} /> Connecting...</>
          ) : (
            <><WifiOff className="w-3 h-3" /> Offline</>
          )}
        </div>
        <button onClick={toggle} className={`p-1.5 rounded-lg transition-colors ${dark ? 'text-slate-400 hover:text-yellow-400 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`} title="Toggle theme">
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        {name && (
          <div className={`flex items-center gap-2 pl-2 border-l ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              <User className="w-3 h-3" />
              <span>{name}</span>
            </div>
            <button
              onClick={logout}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${dark ? 'text-slate-500 hover:text-red-400 hover:bg-slate-800' : 'text-slate-400 hover:text-red-500 hover:bg-slate-100'}`}
              title="Sign out"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
