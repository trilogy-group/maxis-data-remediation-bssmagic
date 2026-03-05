import React from 'react';
import { motion } from 'framer-motion';
import { Table, BarChart3, Filter, Play, Heading } from 'lucide-react';
import BuilderLayout from './BuilderLayout';
import WidgetCard from './WidgetCard';

interface Scene2_PopulatedProps {
  onNext: () => void;
  onBack: () => void;
}

const Scene2_Populated: React.FC<Scene2_PopulatedProps> = ({ onNext }) => {
  // Widget types for left panel (same as Scene 1)
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
        moduleName="Speedrun Builder - Workflow Canvas"
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
          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Widget 1: Header */}
            <WidgetCard
              type="header"
              title="SolutionEmpty Detection & Remediation"
              description="Module for detecting and fixing empty solution data"
              showMenu={true}
            />

            {/* Widget 2: Chart */}
            <WidgetCard
              type="chart"
              title="Issue Distribution"
              description="Pie chart showing issue count by status"
              showMenu={true}
            />

            {/* Widget 3: Filter */}
            <WidgetCard
              type="filter"
              title="Status: pending"
              description="Filter to show only pending issues"
              showMenu={true}
            />

            {/* Widget 4: Object Table (HIGHLIGHTED) */}
            <WidgetCard
              type="objectTable"
              title="ServiceProblems"
              description="Table showing service problems that need remediation. Click to configure."
              highlight={true}
              onClick={onNext}
              showMenu={true}
            />

            {/* Widget 5: Action */}
            <WidgetCard
              type="action"
              title="Remediate Selected"
              description="Button to trigger remediation workflow on selected items"
              showMenu={true}
            />
          </div>
        }
        rightPanel={
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-slate-400 text-sm px-4">
              <p className="mb-2">Click a widget to configure</p>
              <p className="text-xs text-slate-500">
                Try clicking the highlighted <span className="text-purple-400">ServiceProblems</span> table
              </p>
            </div>
          </div>
        }
      />
    </motion.div>
  );
};

export default Scene2_Populated;
