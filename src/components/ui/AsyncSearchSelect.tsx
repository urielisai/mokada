import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, ChevronDown, Search, X, Loader2 } from 'lucide-react';

export interface AsyncSearchSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface AsyncSearchSelectProps {
  label: string;
  value?: string | null;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  isLoading?: boolean;
  options: AsyncSearchSelectOption[];
  onChange: (value: string) => void;
  onClear?: () => void;
  onSearch: (query: string) => void;
  defaultOption?: AsyncSearchSelectOption | null; // Used to display initially selected option if options are not loaded yet
}

export const AsyncSearchSelect = ({
  label,
  value,
  placeholder = 'Buscar...',
  emptyMessage = 'Sin resultados',
  disabled = false,
  required = false,
  isLoading = false,
  options,
  onChange,
  onClear,
  onSearch,
  defaultOption,
}: AsyncSearchSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Find selected option in current options, or use defaultOption
  const selectedOption = options.find((option) => option.value === value) || (value === defaultOption?.value ? defaultOption : null);

  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isOpen) {
        onSearchRef.current(query);
      }
    }, 300); // 300ms debounce
    return () => clearTimeout(timeoutId);
  }, [query, isOpen]);

  const selectOption = (option: AsyncSearchSelectOption) => {
    onChange(option.value);
    setIsOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      className="relative min-w-0"
      onBlur={(event) => {
        if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      <span className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!isOpen) {
            onSearch(query); // Trigger initial search on open
          }
          setIsOpen((current) => !current);
        }}
        className="flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-sm outline-none transition-colors hover:border-[#0066CC]/60 focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
      >
        <span className={`min-w-0 flex-1 truncate ${selectedOption ? 'text-[#1D1D1F]' : 'text-[#86868B]'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        {selectedOption && onClear && !required ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onClear();
              setQuery('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClear();
                setQuery('');
              }
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#86868B] transition-colors hover:bg-gray-100 hover:text-[#1D1D1F]"
          >
            <X className="h-4 w-4" />
          </span>
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#86868B]" />
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <label className="flex h-10 items-center gap-2 border-b border-gray-100 px-3">
            <Search className="h-4 w-4 shrink-0 text-[#86868B]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {isLoading && <Loader2 className="w-4 h-4 text-[#0066CC] animate-spin" />}
          </label>
          <div className="max-h-64 overflow-y-auto py-1">
            {!isLoading && options.length === 0 ? (
              <div className="px-3 py-4 text-center text-[13px] text-[#86868B]">{emptyMessage}</div>
            ) : (
              options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => selectOption(option)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-[#F5F5F7] ${
                      isSelected ? 'bg-[#0066CC]/5' : ''
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#1D1D1F]">{option.label}</span>
                      {option.description && (
                        <span className="mt-0.5 block truncate text-[12px] text-[#86868B]">{option.description}</span>
                      )}
                    </span>
                    {isSelected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0066CC]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
