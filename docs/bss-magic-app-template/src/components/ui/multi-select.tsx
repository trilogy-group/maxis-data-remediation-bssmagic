import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X, Check, ExternalLink } from 'lucide-react';

/** Option for the MultiSelect component */
export interface MultiSelectOption {
  value: string;
  label: string;
  /** Whether this option is disabled */
  disabled?: boolean;
  /** Help text shown below the option */
  helpText?: string;
  /** Group identifier for indentation */
  group?: string;
  /** Whether this is a group header (non-selectable) */
  isGroupHeader?: boolean;
  /** External link URL - shows link icon that opens in new tab */
  linkUrl?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxDisplayedChips?: number;
  disabled?: boolean;
  className?: string;
  showSearch?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  maxDisplayedChips = 2,
  disabled = false,
  className = '',
  showSearch = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const lowerSearch = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.isGroupHeader ||
        opt.label.toLowerCase().includes(lowerSearch) ||
        opt.value.toLowerCase().includes(lowerSearch)
    );
  }, [options, searchTerm]);

  // Get selected options for display (exclude group headers and disabled)
  const selectedOptions = useMemo(() => {
    return options.filter((opt) => !opt.isGroupHeader && value.includes(opt.value));
  }, [options, value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (opt: MultiSelectOption) => {
    if (opt.disabled || opt.isGroupHeader) return;
    
    if (value.includes(opt.value)) {
      onChange(value.filter((v) => v !== opt.value));
    } else {
      onChange([...value, opt.value]);
    }
  };

  const removeOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  const handleContainerClick = () => {
    if (!disabled) {
      setIsOpen(true);
      inputRef.current?.focus();
    }
  };

  const displayedChips = selectedOptions.slice(0, maxDisplayedChips);
  const remainingCount = selectedOptions.length - maxDisplayedChips;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Main container styled like the other dropdowns */}
      <div
        onClick={handleContainerClick}
        className={`w-full min-h-[38px] bg-neutral-50 border border-border rounded-lg px-3 py-1.5 pr-8 text-sm text-text-primary transition-all cursor-pointer hover:border-primary/50 flex flex-wrap items-center gap-1.5 ${
          isOpen ? 'ring-2 ring-primary border-transparent' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-text-tertiary py-0.5">{placeholder}</span>
        ) : (
          <>
            {displayedChips.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded"
              >
                <span className="max-w-[100px] truncate">{opt.label}</span>
                <button
                  onClick={(e) => removeOption(opt.value, e)}
                  className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                  type="button"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {remainingCount > 0 && (
              <span className="inline-flex items-center text-xs font-medium text-text-secondary bg-neutral-200 px-2 py-0.5 rounded">
                +{remainingCount} more
              </span>
            )}
          </>
        )}

        {/* Chevron icon */}
        <ChevronDown
          size={16}
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          {showSearch && (
            <div className="p-2 border-b border-border">
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full bg-neutral-50 border border-border rounded px-2 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                autoFocus
              />
            </div>
          )}

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-text-tertiary">No results found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value.includes(opt.value);
                
                // Render group header
                if (opt.isGroupHeader) {
                  return (
                    <div
                      key={opt.value}
                      className="px-3 py-2 text-xs font-semibold text-text-secondary bg-neutral-50 border-t border-border first:border-t-0"
                    >
                      {opt.label}
                    </div>
                  );
                }
                
                // Render option (enabled or disabled)
                return (
                  <div
                    key={opt.value}
                    onClick={() => toggleOption(opt)}
                    className={`flex flex-col px-3 py-2 text-sm transition-colors ${
                      opt.disabled
                        ? 'cursor-not-allowed opacity-60'
                        : 'cursor-pointer'
                    } ${
                      opt.group ? 'pl-6' : ''
                    } ${
                      isSelected && !opt.disabled
                        ? 'bg-primary/5 text-primary'
                        : opt.disabled
                        ? 'text-text-tertiary'
                        : 'text-text-primary hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{opt.label}</span>
                        {opt.linkUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(opt.linkUrl, '_blank', 'noopener,noreferrer');
                            }}
                            className="p-0.5 rounded hover:bg-primary/10 text-text-tertiary hover:text-primary transition-colors"
                            title="Open in new tab"
                            type="button"
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}
                      </div>
                      {isSelected && !opt.disabled && (
                        <Check size={16} className="text-primary flex-shrink-0" />
                      )}
                    </div>
                    {opt.helpText && (
                      <span className="text-xs text-text-tertiary mt-0.5">{opt.helpText}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with count and clear */}
          {selectedOptions.length > 0 && (
            <div className="px-3 py-2 border-t border-border flex items-center justify-between text-xs">
              <span className="text-text-secondary">{selectedOptions.length} selected</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                className="text-primary hover:text-primary/80 font-medium"
                type="button"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelect;

