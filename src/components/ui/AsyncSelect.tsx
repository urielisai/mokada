import { useCallback, useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, Search, X, Loader2 } from 'lucide-react';

export interface AsyncSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface AsyncSelectProps {
  label?: string;
  value?: string | null;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  defaultOption?: AsyncSelectOption | null;
  loadOptions: (query: string) => Promise<AsyncSelectOption[]>;
  onChange: (value: string | null, option: AsyncSelectOption | null) => void;
  onClear?: () => void;
}

export const AsyncSelect = ({
  label,
  value,
  placeholder = 'Buscar...',
  emptyMessage = 'Sin resultados',
  disabled = false,
  required = false,
  defaultOption,
  loadOptions,
  onChange,
  onClear,
}: AsyncSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<AsyncSelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<AsyncSelectOption | null>(defaultOption || null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleSearch = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const results = await loadOptions(searchQuery);
      setOptions(results);
    } catch (error) {
      console.error('Error loading options:', error);
      setOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [loadOptions]);

  // Update selected option if value changes externally (e.g. form reset)
  useEffect(() => {
    if (defaultOption && defaultOption.value === value) {
      setSelectedOption(defaultOption);
    } else if (!value) {
      setSelectedOption(null);
    }
  }, [value, defaultOption]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isOpen) {
        handleSearch(query);
      }
    }, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [query, isOpen, handleSearch]);

  useEffect(() => {
    if (!isOpen) return;

    const closeWhenOutside = (event: Event) => {
      if (!wrapperRef.current?.contains(event.target as Node | null)) setIsOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', closeWhenOutside);
    document.addEventListener('focusin', closeWhenOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside);
      document.removeEventListener('focusin', closeWhenOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [isOpen]);

  const selectOption = (option: AsyncSelectOption) => {
    setSelectedOption(option);
    onChange(option.value, option);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    if (onClear) onClear();
    onChange(null, null);
    setSelectedOption(null);
    setQuery('');
  };

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      {label && <span className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">{label}</span>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-sm outline-none transition-colors hover:border-[#0066CC]/60 focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
      >
        <span className={`min-w-0 flex-1 truncate ${selectedOption ? 'text-[#1D1D1F]' : 'text-[#86868B]'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        {selectedOption && !required && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleClear(event);
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
            {isLoading && <Loader2 className="h-4 w-4 shrink-0 text-[#0066CC] animate-spin" />}
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
