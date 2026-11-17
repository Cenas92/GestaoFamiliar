import { useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (nextValue: string) => void;
  onClear?: () => void;
  onFocus?: () => void;
  placeholder: string;
  size?: 'sm' | 'md';
  wrapperClassName?: string;
  inputClassName?: string;
  clearLabel?: string;
}

export function SearchInput({
  value,
  onChange,
  onClear,
  onFocus,
  placeholder,
  size = 'md',
  wrapperClassName = 'min-w-0 flex-1',
  inputClassName = '',
  clearLabel = 'Limpar pesquisa',
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isSmall = size === 'sm';

  const handleClear = () => {
    onChange('');
    onClear?.();
    inputRef.current?.focus();
  };

  return (
    <div className={`relative flex items-center ${wrapperClassName}`}>
      <Search
        className={`pointer-events-none absolute text-slate-400 ${
          isSmall ? 'left-2.5 h-3.5 w-3.5' : 'left-3 h-4 w-4'
        }`}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-slate-200 bg-white outline-none focus:border-teal-600 ${
          isSmall
            ? 'py-1.5 pl-8 pr-7 text-xs sm:text-sm'
            : 'py-2 pl-9 pr-9 text-sm text-slate-900 focus:ring-2 focus:ring-teal-600/15'
        } ${inputClassName}`}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={clearLabel}
          title={clearLabel}
          className={`absolute rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 ${
            isSmall ? 'right-1.5 p-0.5' : 'right-2 p-1'
          }`}
        >
          <X className={isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
