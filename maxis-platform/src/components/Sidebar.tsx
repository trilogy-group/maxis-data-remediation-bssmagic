'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LAYERS, NAV_ITEMS, type LayerType } from '@/lib/navigation';
import { useTheme } from './ThemeProvider';
import {
  Database, Share2, Zap, HardDrive, GitBranch, Link as LinkIcon,
  CheckCircle, Search, Box, Shield, Lock, AlertTriangle, Activity,
  PlayCircle, ChevronDown, BookOpen, Tag,
} from 'lucide-react';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Database, Share2, Zap, HardDrive, GitBranch, Link: LinkIcon,
  CheckCircle, Search, Box, Shield, Lock, AlertTriangle, Activity, PlayCircle, BookOpen, Tag,
};

export default function Sidebar() {
  const pathname = usePathname();
  const currentLayer = pathname.startsWith('/ontology') ? 'ontology'
    : pathname.startsWith('/capabilities') ? 'capabilities' : 'data';
  const [layer, setLayer] = useState<LayerType>(currentLayer);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { theme } = useTheme();
  const dark = theme === 'dark';
  const layerConfig = LAYERS.find(l => l.id === layer)!;
  const LayerIcon = ICONS[layerConfig.icon];
  const items = NAV_ITEMS[layer];

  return (
    <aside className={`w-60 border-r flex flex-col h-full ${dark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
      <div className="relative p-3">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${dark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200'}`}
        >
          {LayerIcon && <LayerIcon className="w-4 h-4 text-purple-500" />}
          <span className="flex-1 text-left">{layerConfig.label}</span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {dropdownOpen && (
          <div className={`absolute top-full left-3 right-3 mt-1 rounded-lg border shadow-xl z-50 overflow-hidden ${dark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
            {LAYERS.map(l => {
              const Icon = ICONS[l.icon];
              return (
                <button
                  key={l.id}
                  onClick={() => { setLayer(l.id); setDropdownOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${l.id === layer ? 'bg-purple-600/20 text-purple-600' : dark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {l.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 pb-4 space-y-1">
        {items.map(item => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href;
          return (
            <div key={item.href}>
              {item.separator && (
                <div className={`px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
                  {item.separator}
                </div>
              )}
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${active ? (dark ? 'bg-purple-600/20 text-white font-medium' : 'bg-purple-50 text-purple-700 font-medium') : dark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-white'}`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className={`p-3 border-t ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className={`px-3 py-2 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          Maxis CloudSense Runtime
          <br />
          <span className={dark ? 'text-slate-600' : 'text-slate-300'}>ap-southeast-1</span>
        </div>
      </div>
    </aside>
  );
}
