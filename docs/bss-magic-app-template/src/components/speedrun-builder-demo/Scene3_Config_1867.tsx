import React from 'react';
import { motion } from 'framer-motion';
import { Table, BarChart3, Filter, Play, Heading, ChevronDown, ArrowRight } from 'lucide-react';
import BuilderLayout from './BuilderLayout';
import WidgetCard from './WidgetCard';

interface Scene3_Config_1867Props {
  onNext: () => void;
  onBack: () => void;
}

const Scene3_Config_1867: React.FC<Scene3_Config_1867Props> = ({ onNext }) => {
  // Widget types for left panel
  const widgetTypes = [
    { icon: Table, name: 'Object Table', description: 'Display data in tables' },
    { icon: BarChart3, name: 'Chart', description: 'Visualize with charts' },
    { icon: Filter, name: 'Filter', description: 'Add filtering controls' },
    { icon: Play, name: 'Action', description: 'Create action buttons' },
    { icon: Heading, name: 'Header', description: 'Add titles and text' },
  ];

  // Properties for the Object Table configuration
  const properties = [
    { name: 'id', checked: true },
    { name: 'category', checked: true },
    { name: 'status', checked: true },
    { name: 'orderEntry_id', checked: true },
    { name: 'missing_fields', checked: true },
    { name: 'createdAt', checked: false },
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
        moduleName="Speedrun Builder - Configuration"
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
              title="Order Entry Data Patcher"
              description="Patch missing fields in Order Entry JSON"
              showMenu={true}
            />

            {/* Widget 2: Chart */}
            <WidgetCard
              type="chart"
              title="Missing Fields Distribution"
              description="PICEmail: 45%, CompanyRegNo: 32%, ActivationDate: 23%"
              showMenu={true}
            />

            {/* Widget 3: Filter */}
            <WidgetCard
              type="filter"
              title="Category: PartialDataMissing"
              description="Filter to show only OE issues"
              showMenu={true}
            />

            {/* Widget 4: Object Table (HIGHLIGHTED) */}
            <WidgetCard
              type="objectTable"
              title="ServiceProblems (OE Issues)"
              description="79 issues detected. Configuration active."
              highlight={true}
              showMenu={true}
            />

            {/* Widget 5: Action */}
            <WidgetCard
              type="action"
              title="Patch Order Entry"
              description="Generate and validate OE JSON"
              showMenu={true}
            />
          </div>
        }
        rightPanel={
          <div className="space-y-6">
            {/* Configuration Title */}
            <div>
              <h2 className="text-lg font-semibold text-slate-200 mb-1">
                Object Table Configuration
              </h2>
              <p className="text-xs text-slate-500">Configure table properties and behavior</p>
            </div>

            {/* Object Set Dropdown */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Object Set</label>
              <div className="relative">
                <select
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm appearance-none cursor-pointer hover:border-slate-600 transition-colors"
                  defaultValue="ServiceProblem"
                >
                  <option value="ServiceProblem">ServiceProblem (TMF656)</option>
                  <option value="Product">Product (TMF637)</option>
                  <option value="Service">Service (TMF638)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Properties Checkboxes */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Properties to Display
              </label>
              <div className="space-y-2">
                {properties.map((prop) => (
                  <label
                    key={prop.name}
                    className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-slate-200 transition-colors"
                  >
                    <input
                      type="checkbox"
                      defaultChecked={prop.checked}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="font-mono text-xs">{prop.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Filter */}
            <div className="pt-4 border-t border-slate-700">
              <label className="block text-sm font-medium text-slate-300 mb-2">Custom Filter</label>
              <div className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-400 font-mono">
                Category = PartialDataMissing
              </div>
            </div>

            {/* Action Configuration */}
            <div className="pt-4 border-t border-slate-700">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Action Configuration
              </label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">PICEmail</label>
                  <input
                    type="text"
                    placeholder="e.g., pic@example.com"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:border-slate-600 focus:ring-1 focus:ring-purple-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">CompanyRegNo</label>
                  <input
                    type="text"
                    placeholder="e.g., 201234567X"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:border-slate-600 focus:ring-1 focus:ring-purple-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">ActivationDate</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:border-slate-600 focus:ring-1 focus:ring-purple-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Preview Button */}
            <div className="pt-4">
              <button
                onClick={onNext}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all duration-200 font-medium"
              >
                Preview Module
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        }
      />
    </motion.div>
  );
};

export default Scene3_Config_1867;
