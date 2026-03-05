import React, { ReactNode } from 'react';
import { Save, Eye } from 'lucide-react';

interface BuilderLayoutProps {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
  moduleName?: string;
  onSave?: () => void;
  onPreview?: () => void;
}

const BuilderLayout: React.FC<BuilderLayoutProps> = ({
  leftPanel,
  centerPanel,
  rightPanel,
  moduleName = 'Speedrun Builder',
  onSave,
  onPreview,
}) => {
  return (
    <div className="h-full w-full flex flex-col bg-[#0f1419]">
      {/* Top Bar */}
      <div className="h-16 bg-[#1a1f29] border-b border-slate-700 flex items-center justify-between px-6">
        <h1 className="text-xl font-semibold text-slate-200">{moduleName}</h1>
        <div className="flex gap-3">
          {onSave && (
            <button
              onClick={onSave}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-all duration-200 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          )}
          {onPreview && (
            <button
              onClick={onPreview}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all duration-200 flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
          )}
        </div>
      </div>

      {/* Three-Panel Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Panel - Widget Palette */}
        <div className="w-full md:w-64 bg-[#1a1f29] border-b md:border-b-0 md:border-r border-slate-700 overflow-y-auto">
          <div className="p-4">{leftPanel}</div>
        </div>

        {/* Center Panel - Canvas */}
        <div className="flex-1 bg-[#0f1419] overflow-y-auto">
          <div className="p-6">{centerPanel}</div>
        </div>

        {/* Right Panel - Configuration */}
        <div className="w-full md:w-80 bg-[#1a1f29] border-t md:border-t-0 md:border-l border-slate-700 overflow-y-auto">
          <div className="p-4">{rightPanel}</div>
        </div>
      </div>
    </div>
  );
};

export default BuilderLayout;
