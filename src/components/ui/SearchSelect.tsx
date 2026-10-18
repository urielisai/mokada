import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SearchSelectOption {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
}

interface SearchSelectProps {
  label?: string;
  options: SearchSelectOption[];
  value?: string | null;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  onChange: (value: string) => void;
  onClear?: () => void;
}

export const SearchSelect = ({
  label,
  options,
  value,
  placeholder = 'Buscar...',
  emptyMessage = 'Sin resultados',
  disabled = false,
  required = false,
  onChange,
  onClear,
}: SearchSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) || null;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options.slice(0, 30);

    return options
      .filter((option) =>
        [option.label, option.description, option.keywords]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 30);
  }, [options, query]);

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

  const selectOption = (option: SearchSelectOption) => {
    onChange(option.value);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      {label && <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-sm outline-none transition-colors hover:border-accent/60 focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
      >
        <span className={`min-w-0 flex-1 truncate ${selectedOption ? 'text-ink' : 'text-muted'}`}>
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
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-gray-100 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </span>
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <label className="flex h-10 items-center gap-2 border-b border-gray-100 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <div className="max-h-64 overflow-y-auto py-1">
            {!filteredOptions.length ? (
              <div className="px-3 py-4 text-center text-[13px] text-muted">{emptyMessage}</div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => selectOption(option)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-canvas ${
                      isSelected ? 'bg-accent/5' : ''
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{option.label}</span>
                      {option.description && (
                        <span className="mt-0.5 block truncate text-[12px] text-muted">{option.description}</span>
                      )}
                    </span>
                    {isSelected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
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
