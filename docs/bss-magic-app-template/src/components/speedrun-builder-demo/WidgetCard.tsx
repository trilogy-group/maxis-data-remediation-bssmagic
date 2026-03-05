import React from 'react';
import { Table, BarChart3, Filter, Play, Heading, MoreVertical, LucideIcon } from 'lucide-react';

export type WidgetType = 'objectTable' | 'chart' | 'filter' | 'action' | 'header';

interface WidgetCardProps {
  type: WidgetType;
  title: string;
  description?: string;
  highlight?: boolean;
  onClick?: () => void;
  showMenu?: boolean;
}

const widgetConfig: Record<WidgetType, { icon: LucideIcon; description: string }> = {
  objectTable: {
    icon: Table,
    description: 'Display objects in a table with sorting and filtering',
  },
  chart: {
    icon: BarChart3,
    description: 'Visualize data with pie, bar, or line charts',
  },
  filter: {
    icon: Filter,
    description: 'Add filtering criteria for objects',
  },
  action: {
    icon: Play,
    description: 'Create buttons to trigger workflows',
  },
  header: {
    icon: Heading,
    description: 'Add titles and descriptions to your module',
  },
};

const WidgetCard: React.FC<WidgetCardProps> = ({
  type,
  title,
  description,
  highlight = false,
  onClick,
  showMenu = false,
}) => {
  const config = widgetConfig[type];
  const Icon = config.icon;
  const displayDescription = description || config.description;

  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-lg p-4 transition-all duration-200
        ${
          highlight
            ? 'border-2 border-dashed border-purple-500 bg-purple-900/20'
            : 'border border-slate-700 bg-[#242b38]/50'
        }
        ${isClickable ? 'cursor-pointer hover:border-purple-400 hover:bg-[#242b38]' : ''}
      `}
    >
      {/* Three-dot menu */}
      {showMenu && (
        <button
          className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-200 rounded transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            console.log('Menu clicked for', title);
          }}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      )}

      {/* Widget Icon */}
      <div className="flex items-start gap-3">
        <div
          className={`
          p-2 rounded-lg
          ${highlight ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-700/50 text-slate-400'}
        `}
        >
          <Icon className="w-5 h-5" />
        </div>

        {/* Widget Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-200 mb-1">{title}</h3>
          <p className="text-xs text-slate-400 leading-relaxed">{displayDescription}</p>
        </div>
      </div>
    </div>
  );
};

export default WidgetCard;
