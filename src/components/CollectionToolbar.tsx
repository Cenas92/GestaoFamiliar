import { ArrowUpDown, FolderTree } from 'lucide-react';
import { COLLECTION_VIEW_MODE_OPTIONS, type CollectionViewMode } from '../utils/viewPrefs';

interface CollectionToolbarProps<TSort extends string> {
  viewMode: CollectionViewMode;
  onChangeViewMode: (mode: CollectionViewMode) => void;
  sortMode: TSort;
  sortOptions: { value: TSort; label: string }[];
  sortAriaLabel: string;
  onChangeSortMode: (sort: TSort) => void;
  groupActive: boolean;
  groupTitle: string;
  groupLabel?: string;
  onToggleGroup: () => void;
}

export function CollectionToolbar<TSort extends string>({
  viewMode,
  onChangeViewMode,
  sortMode,
  sortOptions,
  sortAriaLabel,
  onChangeSortMode,
  groupActive,
  groupTitle,
  groupLabel = 'Agrupar',
  onToggleGroup,
}: CollectionToolbarProps<TSort>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
      <div
        className="inline-flex items-center gap-0.5 rounded-xl bg-slate-100 p-0.5"
        role="group"
        aria-label="Modo de visualização"
      >
        {COLLECTION_VIEW_MODE_OPTIONS.map(({ id, label, shortLabel, Icon }) => {
          const active = viewMode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChangeViewMode(id)}
              aria-pressed={active}
              aria-label={label}
              title={label}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                active ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{shortLabel}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative flex items-center">
          <ArrowUpDown
            className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-slate-400"
            aria-hidden="true"
          />
          <select
            value={sortMode}
            onChange={(e) => onChangeSortMode(e.target.value as TSort)}
            aria-label={sortAriaLabel}
            className="rounded-lg border border-slate-200 bg-slate-50 py-1 pl-6 pr-2 text-xs font-medium text-slate-700 outline-none focus:border-teal-600"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onToggleGroup}
          aria-pressed={groupActive}
          title={groupTitle}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
            groupActive
              ? 'border-teal-300 bg-teal-50 text-teal-900'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FolderTree className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{groupLabel}</span>
        </button>
      </div>
    </div>
  );
}
