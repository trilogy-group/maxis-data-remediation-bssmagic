import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Filter, MoreVertical, Play } from 'lucide-react';

interface Scene4_Preview_1867Props {
  onBack: () => void;
}

const Scene4_Preview_1867: React.FC<Scene4_Preview_1867Props> = ({ onBack }) => {
  // Sample data for the OE issues table
  const sampleProblems = [
    {
      id: '#12346',
      category: 'PartialDataMissing',
      status: 'pending',
      description: 'Missing PICEmail in Order Entry',
      field: 'PICEmail',
      created: '2026-02-24 14:22'
    },
    {
      id: '#12347',
      category: 'PartialDataMissing',
      status: 'pending',
      description: 'Missing CompanyRegNo in Order Entry',
      field: 'CompanyRegNo',
      created: '2026-02-24 13:45'
    },
    {
      id: '#12348',
      category: 'PartialDataMissing',
      status: 'inProgress',
      description: 'Patching Order Entry with PICEmail...',
      field: 'PICEmail',
      created: '2026-02-24 12:18'
    },
    {
      id: '#12349',
      category: 'PartialDataMissing',
      status: 'resolved',
      description: 'OE patched successfully - PICEmail added',
      field: 'PICEmail',
      created: '2026-02-24 11:30'
    },
    {
      id: '#12350',
      category: 'PartialDataMissing',
      status: 'pending',
      description: 'Missing ActivationDate in Order Entry',
      field: 'ActivationDate',
      created: '2026-02-24 10:15'
    }
  ];

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'inProgress':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-neutral-100 text-neutral-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'inProgress':
        return 'In Progress';
      case 'resolved':
        return 'Resolved';
      default:
        return status;
    }
  };

  return (
    <div className="h-full flex flex-col bg-neutral-50">
      {/* Top Bar */}
      <div className="h-16 bg-slate-900 px-6 flex items-center justify-between border-b border-slate-800">
        <button
          onClick={onBack}
          className="text-slate-300 hover:text-white flex items-center gap-2 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Builder</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-slate-400 text-sm">Preview Mode</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">
              Order Entry Data Patcher
            </h1>
            <p className="text-neutral-600">
              Patch missing fields in Order Entry JSON and validate data
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-lg shadow p-6 border border-neutral-200"
            >
              <div className="text-sm font-medium text-neutral-500 mb-2">
                Total Issues
              </div>
              <div className="text-4xl font-bold text-neutral-900">79</div>
              <div className="text-xs text-neutral-400 mt-2">
                OE issues detected
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-lg shadow p-6 border border-neutral-200"
            >
              <div className="text-sm font-medium text-neutral-500 mb-2">
                Pending
              </div>
              <div className="text-4xl font-bold text-yellow-600">45</div>
              <div className="text-xs text-neutral-400 mt-2">
                Awaiting patches
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-lg shadow p-6 border border-neutral-200"
            >
              <div className="text-sm font-medium text-neutral-500 mb-2">
                Resolved
              </div>
              <div className="text-4xl font-bold text-green-600">34</div>
              <div className="text-xs text-neutral-400 mt-2">
                Successfully patched
              </div>
            </motion.div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Pie Chart - Missing Fields Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-lg shadow p-6 border border-neutral-200"
            >
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Missing Fields Distribution
              </h3>
              <div className="flex items-center justify-center h-48">
                {/* Simple SVG Pie Chart */}
                <svg viewBox="0 0 200 200" className="w-48 h-48">
                  {/* PICEmail - 45% */}
                  <path
                    d="M 100 100 L 100 0 A 100 100 0 0 1 187.9 141.4 Z"
                    fill="#a855f7"
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  />
                  {/* CompanyRegNo - 32% */}
                  <path
                    d="M 100 100 L 187.9 141.4 A 100 100 0 0 1 45.4 181.6 Z"
                    fill="#3b82f6"
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  />
                  {/* ActivationDate - 23% */}
                  <path
                    d="M 100 100 L 45.4 181.6 A 100 100 0 0 1 100 0 Z"
                    fill="#cbd5e1"
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  />
                </svg>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <span className="text-sm text-neutral-600">PICEmail</span>
                  </div>
                  <span className="text-sm font-medium text-neutral-900">45%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm text-neutral-600">CompanyRegNo</span>
                  </div>
                  <span className="text-sm font-medium text-neutral-900">32%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                    <span className="text-sm text-neutral-600">ActivationDate</span>
                  </div>
                  <span className="text-sm font-medium text-neutral-900">23%</span>
                </div>
              </div>
            </motion.div>

            {/* Trend Chart - Resolution Trend */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-lg shadow p-6 border border-neutral-200"
            >
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Patching Trend
              </h3>
              <div className="flex items-end justify-around h-48 border-b border-l border-neutral-200">
                {[35, 48, 42, 61, 55, 68, 52].map((height, idx) => (
                  <div
                    key={idx}
                    className="w-8 bg-gradient-to-t from-purple-500 to-purple-400 hover:from-purple-600 hover:to-purple-500 transition-all cursor-pointer rounded-t"
                    style={{ height: `${height}%` }}
                  ></div>
                ))}
              </div>
              <div className="mt-4 flex justify-around text-xs text-neutral-500">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </motion.div>
          </div>

          {/* Filter Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-lg shadow p-4 mb-6 border border-neutral-200"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-neutral-600">
                <Filter size={18} />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              <select className="px-3 py-1.5 border border-neutral-300 rounded text-sm bg-white text-neutral-700 hover:border-neutral-400 transition-colors">
                <option>All Statuses</option>
                <option>Pending</option>
                <option>In Progress</option>
                <option>Resolved</option>
              </select>
              <select className="px-3 py-1.5 border border-neutral-300 rounded text-sm bg-white text-neutral-700 hover:border-neutral-400 transition-colors">
                <option>All Fields</option>
                <option>PICEmail</option>
                <option>CompanyRegNo</option>
                <option>ActivationDate</option>
              </select>
              <div className="flex-1"></div>
              <button className="px-4 py-1.5 bg-neutral-100 text-neutral-400 rounded text-sm cursor-not-allowed">
                Patch Selected (0)
              </button>
            </div>
          </motion.div>

          {/* Service Problems Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-lg shadow overflow-hidden border border-neutral-200"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                      <input type="checkbox" className="rounded border-neutral-300" disabled />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                      Issue ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                      Missing Field
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {sampleProblems.map((problem, idx) => (
                    <motion.tr
                      key={problem.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + idx * 0.05 }}
                      className="hover:bg-neutral-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <input type="checkbox" className="rounded border-neutral-300" disabled />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                        {problem.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                        {problem.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(problem.status)}`}>
                          {getStatusLabel(problem.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-purple-600">
                        {problem.field}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600">
                        {problem.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                        {problem.created}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            className="p-1 hover:bg-neutral-100 rounded transition-colors text-neutral-600 hover:text-neutral-900"
                            title="View details"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {problem.status === 'pending' && (
                            <button
                              className="p-1 hover:bg-purple-50 rounded transition-colors text-purple-600 hover:text-purple-700"
                              title="Start patching"
                            >
                              <Play size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between text-sm text-neutral-600">
            <div>Showing 1-5 of 79 issues</div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                Previous
              </button>
              <button className="px-3 py-1 bg-purple-500 text-white rounded">1</button>
              <button className="px-3 py-1 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors">2</button>
              <button className="px-3 py-1 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors">3</button>
              <button className="px-3 py-1 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Scene4_Preview_1867;
