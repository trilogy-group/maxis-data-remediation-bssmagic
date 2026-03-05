import React from 'react';
import { motion } from 'framer-motion';
import { Package, ArrowRight, Table, BarChart3, Filter, Play, Heading } from 'lucide-react';
import BuilderLayout from './BuilderLayout';

interface Scene1_EmptyProps {
  onNext: () => void;
}

const Scene1_Empty: React.FC<Scene1_EmptyProps> = ({ onNext }) => {
  // Widget types for left panel
  const widgetTypes = [
    { icon: Table, name: 'Object Table', description: 'Display data in tables' },
    { icon: BarChart3, name: 'Chart', description: 'Visualize with charts' },
    { icon: Filter, name: 'Filter', description: 'Add filtering controls' },
    { icon: Play, name: 'Action', description: 'Create action buttons' },
    { icon: Heading, name: 'Header', description: 'Add titles and text' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="h-full w-full"
    >
      <BuilderLayout
        moduleName="Speedrun Builder - Empty Canvas"
        leftPanel={
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
              Widgets
            </h2>
            {widgetTypes.map((widget) => {
              const Icon = widget.icon;
              return (
                <div
                  key={widget.name}
                  className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-all cursor-move"
                >
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 bg-slate-700/50 rounded">
                      <Icon className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200">{widget.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{widget.description}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        }
        centerPanel={
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              {/* Large Icon */}
              <div className="mb-6 flex justify-center">
                <div className="p-6 bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-700">
                  <Package className="w-16 h-16 text-slate-600" />
                </div>
              </div>

              {/* Message */}
              <h2 className="text-2xl font-semibold text-slate-200 mb-3">
                Drag widgets here to build your workflow
              </h2>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Start by dragging widgets from the left panel to create your custom Maxis issue
                resolution dashboard.
              </p>

              {/* Start Demo Button */}
              <button
                onClick={onNext}
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all duration-200 font-medium"
              >
                Start Demo
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        }
        rightPanel={
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-slate-500 text-sm px-4">
              Select a widget to configure its properties
            </div>
          </div>
        }
      />
    </motion.div>
  );
};

export default Scene1_Empty;
