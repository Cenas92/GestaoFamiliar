import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChefHat,
  ChevronDown,
  ChevronRight,
  Clock,
  Plus,
  Search,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  X,
} from 'lucide-react';
import { AttachmentImage } from '../../components/AttachmentPreview';
import { CollectionToolbar } from '../../components/CollectionToolbar';
import { TypeIconBadge, type TypeVisualMeta } from '../../components/TypeIconBadge';
import { RECIPE_CATEGORY_LABELS } from '../../constants/labels';
import type {
  CatalogItem,
  HouseholdMember,
  Recipe,
  RecipeCategory,
  ShoppingItem,
  StockLot,
  StorageLocation,
} from '../../types/domain';
import { formatDatePt, normalizeText, todayDateString } from '../../utils/units';
import { CookRecipeModal } from './CookRecipeModal';
import { evaluateRecipeMatch, type RecipeMatchResult } from './matchingEngine';
import { RecipeDetailModal } from './RecipeDetailModal';
import { RecipeFormModal } from './RecipeFormModal';
import {
  getRecipeCategoryVisual,
  loadRecipeViewPreferences,
  RECIPE_CATEGORY_ORDER,
  RECIPE_SORT_OPTIONS,
  RecipeVisualThumb,
  saveRecipeViewPreferences,
  type RecipeSortMode,
  type RecipeViewPreferences,
} from './recipeVisuals';

interface RecipesViewProps {
  recipes: Recipe[];
  stockLots: StockLot[];
  catalogItems: CatalogItem[];
  locations: StorageLocation[];
  members: HouseholdMember[];
  shoppingItems: ShoppingItem[];
  expiryWarningDays: number;
  deviceId: string;
}

type MatchFilter = 'all' | 'ready' | 'almost' | 'expiring';

const MATCH_FILTER_OPTIONS: [MatchFilter, string][] = [
  ['all', 'Todas'],
  ['ready', 'Prontas 100%'],
  ['almost', 'Quase lá'],
  ['expiring', 'Aproveitar já'],
];

interface RecipeCategoryGroup {
  category: RecipeCategory;
  label: string;
  visual: TypeVisualMeta;
  items: RecipeMatchResult[];
}

function getStatusBadgeInfo(match: RecipeMatchResult): {
  label: string;
  shortLabel: string;
  pillClass: string;
  textClass: string;
} {
  if (match.status === 'ready') {
    return {
      label: 'Pronta 100%',
      shortLabel: 'Pronta',
      pillClass: 'bg-emerald-100 text-emerald-800 font-bold',
      textClass: 'text-emerald-700',
    };
  }
  if (match.status === 'almost') {
    return {
      label: `Falta ${match.missingMandatoryCount}`,
      shortLabel: `Falta ${match.missingMandatoryCount}`,
      pillClass: 'bg-amber-100 text-amber-800 font-bold',
      textClass: 'text-amber-700',
    };
  }
  return {
    label: `Faltam ${match.missingMandatoryCount}`,
    shortLabel: `Faltam ${match.missingMandatoryCount}`,
    pillClass: 'bg-slate-100 text-slate-600 font-medium',
    textClass: 'text-slate-600',
  };
}

function sortRecipeMatches(items: RecipeMatchResult[], sortMode: RecipeSortMode): RecipeMatchResult[] {
  return [...items].sort((a, b) => {
    if (sortMode === 'time') {
      const timeDiff =
        a.recipe.prepMinutes +
        a.recipe.cookMinutes -
        (b.recipe.prepMinutes + b.recipe.cookMinutes);
      if (timeDiff !== 0) return timeDiff;
      return a.recipe.title.localeCompare(b.recipe.title, 'pt-PT');
    }
    if (sortMode === 'name') {
      return a.recipe.title.localeCompare(b.recipe.title, 'pt-PT');
    }
    if (sortMode === 'cooked') {
      const cookedDiff = b.recipe.timesCooked - a.recipe.timesCooked;
      if (cookedDiff !== 0) return cookedDiff;
      return b.score - a.score;
    }
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    return a.recipe.title.localeCompare(b.recipe.title, 'pt-PT');
  });
}

function getMemberFilterLabel(memberFilter: string, members: HouseholdMember[]): string {
  if (memberFilter === 'safe_all') return 'Sem alergias';
  if (memberFilter === 'kids') return 'Crianças';
  const member = members.find((m) => m.id === memberFilter);
  return member ? `Fav. ${member.name}` : 'Pessoa';
}

function RecipeCardItem({
  match,
  detailed,
  onSelect,
}: {
  match: RecipeMatchResult;
  detailed: boolean;
  onSelect: (recipeId: string) => void;
}) {
  const { recipe } = match;
  const visual = getRecipeCategoryVisual(recipe.category);
  const badge = getStatusBadgeInfo(match);
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;

  return (
    <button
      type="button"
      onClick={() => onSelect(recipe.id)}
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-xs transition hover:border-teal-400 hover:shadow-sm"
    >
      {recipe.photoAttachmentId && (
        <AttachmentImage
          attachmentId={recipe.photoAttachmentId}
          alt={recipe.title}
          className={detailed ? 'h-36 w-full' : 'h-32 w-full'}
        />
      )}
      <div className={`flex flex-1 flex-col justify-between gap-2 ${detailed ? 'p-4' : 'p-3.5'}`}>
        <div>
          <div className="flex items-start gap-2.5">
            {(!recipe.photoAttachmentId || detailed) && (
              <TypeIconBadge visual={visual} size={detailed ? 'md' : 'sm'} />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${badge.pillClass}`}>
                  {badge.label}
                </span>
                {match.expiringSoonCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-800">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Aproveitar já
                  </span>
                )}
                {match.needsDefrost && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                    <Snowflake className="h-3 w-3" aria-hidden="true" />
                    Descongelar
                  </span>
                )}
                {detailed && recipe.kidFriendly && (
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                    Crianças
                  </span>
                )}
              </div>

              <h3 className="mt-1.5 font-bold text-slate-900">{recipe.title}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {RECIPE_CATEGORY_LABELS[recipe.category]} ·{' '}
                <Clock className="inline h-3 w-3" aria-hidden="true" />{' '}
                {detailed && recipe.prepMinutes > 0 && recipe.cookMinutes > 0
                  ? `${totalMinutes} min (${recipe.prepMinutes}+${recipe.cookMinutes})`
                  : `${totalMinutes} min`}{' '}
                · {recipe.baseServings} doses
              </p>
            </div>
          </div>

          {detailed && (
            <div className="mt-2.5 space-y-2 text-xs">
              <p className="text-[11px] text-slate-400">
                {recipe.timesCooked > 0
                  ? `Cozinhada ${recipe.timesCooked}x`
                  : 'Ainda não cozinhada'}
                {recipe.lastCookedAt ? ` · Última vez: ${formatDatePt(recipe.lastCookedAt)}` : ''}
              </p>

              {recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {recipe.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {recipe.notes && (
                <p className="whitespace-pre-wrap rounded-xl bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                  {recipe.notes}
                </p>
              )}

              {match.ingredientDetails.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {match.ingredientDetails.map((detail) => (
                    <span
                      key={detail.ingredient.id}
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                        detail.satisfied
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {detail.satisfied ? '✓ ' : 'Falta '}
                      {detail.catalogItemName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {!detailed && match.missingIngredients.length > 0 && match.status === 'almost' && (
          <p className="text-xs text-amber-800">
            Falta: {match.missingIngredients.map((i) => i.catalogItemName).join(', ')}
          </p>
        )}

        {match.allergenConflicts.length > 0 && (
          <p className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Atenção: {match.allergenConflicts.join(', ')}
          </p>
        )}
      </div>
    </button>
  );
}

function RecipeLineRow({
  match,
  onSelect,
}: {
  match: RecipeMatchResult;
  onSelect: (recipeId: string) => void;
}) {
  const { recipe } = match;
  const badge = getStatusBadgeInfo(match);
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;

  return (
    <button
      type="button"
      onClick={() => onSelect(recipe.id)}
      className="flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50/70"
    >
      <RecipeVisualThumb recipe={recipe} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-slate-900">{recipe.title}</span>
          {match.needsDefrost && (
            <Snowflake className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden="true" />
          )}
          {match.expiringSoonCount > 0 && (
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-orange-500" aria-hidden="true" />
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
          <span>{RECIPE_CATEGORY_LABELS[recipe.category]}</span>
          <span>· {totalMinutes} min</span>
          <span>· {recipe.baseServings} doses</span>
          {match.allergenConflicts.length > 0 && (
            <span className="font-semibold text-rose-600">Alergénio</span>
          )}
        </div>
      </div>

      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${badge.pillClass}`}>
        {badge.shortLabel}
      </span>
    </button>
  );
}

function RecipeGridTile({
  match,
  onSelect,
}: {
  match: RecipeMatchResult;
  onSelect: (recipeId: string) => void;
}) {
  const { recipe } = match;
  const badge = getStatusBadgeInfo(match);
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;

  const borderTone =
    match.status === 'ready'
      ? 'border-emerald-300 bg-emerald-50/35'
      : match.expiringSoonCount > 0
        ? 'border-orange-300 bg-orange-50/35'
        : 'border-slate-200 bg-white';

  return (
    <button
      type="button"
      onClick={() => onSelect(recipe.id)}
      aria-label={`${recipe.title}, ${badge.label}, ${totalMinutes} minutos`}
      className={`flex min-h-[124px] flex-col justify-between rounded-2xl border p-2.5 text-center shadow-xs transition hover:border-teal-400 hover:shadow-sm ${borderTone}`}
    >
      <div className="flex w-full items-center justify-between gap-1 text-[10px] font-semibold text-slate-500">
        <span>{totalMinutes}m</span>
        <span className="inline-flex items-center gap-0.5">
          {match.needsDefrost && (
            <Snowflake className="h-3 w-3 text-blue-500" aria-hidden="true" />
          )}
          {match.expiringSoonCount > 0 && (
            <Sparkles className="h-3 w-3 text-orange-500" aria-hidden="true" />
          )}
          {match.allergenConflicts.length > 0 && (
            <AlertTriangle className="h-3 w-3 text-rose-500" aria-hidden="true" />
          )}
        </span>
      </div>

      <div className="my-1.5 flex justify-center">
        <RecipeVisualThumb recipe={recipe} size="lg" />
      </div>

      <div className="w-full">
        <p className="line-clamp-2 min-h-[2rem] text-xs font-semibold leading-tight text-slate-900">
          {recipe.title}
        </p>
        <p className={`mt-1 truncate text-xs font-bold ${badge.textClass}`}>{badge.label}</p>
      </div>
    </button>
  );
}

export function RecipesView({
  recipes,
  stockLots,
  catalogItems,
  locations,
  members,
  shoppingItems,
  expiryWarningDays,
  deviceId,
}: RecipesViewProps) {
  const [search, setSearch] = useState('');
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<RecipeCategory | 'all'>('all');
  const [maxMinutes, setMaxMinutes] = useState<number>(0);
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 640 : true,
  );

  const [prefs, setPrefs] = useState<RecipeViewPreferences>(() => loadRecipeViewPreferences());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<RecipeCategory>>(
    () => new Set(),
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [detailRecipeId, setDetailRecipeId] = useState<string | null>(null);
  const [cookState, setCookState] = useState<{ recipe: Recipe; servings: number } | null>(null);

  const updatePrefs = (patch: Partial<RecipeViewPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveRecipeViewPreferences(next);
      return next;
    });
  };

  const today = todayDateString();
  const recipesMap = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const evaluatedAll = useMemo(() => {
    return recipes.map((recipe) =>
      evaluateRecipeMatch(
        recipe,
        recipe.baseServings,
        stockLots,
        catalogItems,
        locations,
        members,
        expiryWarningDays,
        today,
      ),
    );
  }, [recipes, stockLots, catalogItems, locations, members, expiryWarningDays, today]);

  const baseFiltered = useMemo(() => {
    const q = normalizeText(search);
    return evaluatedAll.filter((m) => {
      if (categoryFilter !== 'all' && m.recipe.category !== categoryFilter) return false;
      if (maxMinutes > 0 && m.recipe.prepMinutes + m.recipe.cookMinutes > maxMinutes) {
        return false;
      }
      if (memberFilter === 'safe_all' && m.allergenConflicts.length > 0) return false;
      if (memberFilter === 'kids' && !m.recipe.kidFriendly) return false;
      if (
        memberFilter !== 'all' &&
        memberFilter !== 'safe_all' &&
        memberFilter !== 'kids' &&
        !m.recipe.favoriteMemberIds.includes(memberFilter)
      ) {
        return false;
      }

      if (q) {
        const hitTitle = normalizeText(m.recipe.title).includes(q);
        const hitTag = m.recipe.tags.some((t) => normalizeText(t).includes(q));
        const hitIng = m.ingredientDetails.some((d) =>
          normalizeText(d.catalogItemName).includes(q),
        );
        if (!hitTitle && !hitTag && !hitIng) return false;
      }
      return true;
    });
  }, [evaluatedAll, categoryFilter, maxMinutes, memberFilter, search]);

  const matchCounts = useMemo<Record<MatchFilter, number>>(() => {
    let ready = 0;
    let almost = 0;
    let expiring = 0;
    for (const m of baseFiltered) {
      if (m.status === 'ready') ready += 1;
      if (m.status === 'almost') almost += 1;
      if (m.expiringSoonCount > 0) expiring += 1;
    }
    return {
      all: baseFiltered.length,
      ready,
      almost,
      expiring,
    };
  }, [baseFiltered]);

  const evaluated = useMemo(() => {
    const filtered = baseFiltered.filter((m) => {
      if (matchFilter === 'ready' && m.status !== 'ready') return false;
      if (matchFilter === 'almost' && m.status !== 'almost') return false;
      if (matchFilter === 'expiring' && m.expiringSoonCount === 0) return false;
      return true;
    });
    return sortRecipeMatches(filtered, prefs.sortMode);
  }, [baseFiltered, matchFilter, prefs.sortMode]);

  const groupedCategories = useMemo<RecipeCategoryGroup[]>(() => {
    if (!prefs.groupEnabled) return [];
    const byCat = new Map<RecipeCategory, RecipeMatchResult[]>();
    for (const match of evaluated) {
      const cat = match.recipe.category;
      const bucket = byCat.get(cat);
      if (bucket) {
        bucket.push(match);
      } else {
        byCat.set(cat, [match]);
      }
    }

    const groups: RecipeCategoryGroup[] = [];
    for (const cat of RECIPE_CATEGORY_ORDER) {
      const items = byCat.get(cat);
      if (items && items.length > 0) {
        groups.push({
          category: cat,
          label: RECIPE_CATEGORY_LABELS[cat],
          visual: getRecipeCategoryVisual(cat),
          items,
        });
      }
    }
    return groups;
  }, [prefs.groupEnabled, evaluated]);

  const readyTotalCount = useMemo(
    () => evaluatedAll.filter((e) => e.status === 'ready').length,
    [evaluatedAll],
  );
  const humanMembers = useMemo(() => members.filter((m) => m.role !== 'pet'), [members]);
  const activeFiltersCount =
    (categoryFilter !== 'all' ? 1 : 0) +
    (maxMinutes > 0 ? 1 : 0) +
    (memberFilter !== 'all' ? 1 : 0);

  const toggleCategoryCollapsed = (cat: RecipeCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const renderRecipeItems = (items: RecipeMatchResult[]) => {
    if (prefs.viewMode === 'grid') {
      return (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {items.map((match) => (
            <RecipeGridTile key={match.recipe.id} match={match} onSelect={setDetailRecipeId} />
          ))}
        </div>
      );
    }

    if (prefs.viewMode === 'line') {
      return (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          {items.map((match) => (
            <RecipeLineRow key={match.recipe.id} match={match} onSelect={setDetailRecipeId} />
          ))}
        </div>
      );
    }

    const isDetailed = prefs.viewMode === 'detailed';
    return (
      <div className={isDetailed ? 'grid gap-3 lg:grid-cols-2' : 'grid gap-2.5 sm:grid-cols-2'}>
        {items.map((match) => (
          <RecipeCardItem
            key={match.recipe.id}
            match={match}
            detailed={isDetailed}
            onSelect={setDetailRecipeId}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      {/* Compact single-row header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold leading-tight text-slate-900 sm:text-xl">
            As Nossas Receitas
          </h1>
          <p className="truncate text-[11px] text-slate-500">
            {recipes.length} {recipes.length === 1 ? 'receita' : 'receitas'} · {readyTotalCount}{' '}
            {readyTotalCount === 1 ? 'pronta' : 'prontas'} agora
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingRecipe(null);
            setFormOpen(true);
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-800 sm:px-3"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Nova Receita
        </button>
      </div>

      {/* Horizontal match status pills (no scrollbar, omits 0-count secondary pills) */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {MATCH_FILTER_OPTIONS.filter(
          ([key]) => key === 'all' || matchCounts[key] > 0 || matchFilter === key,
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMatchFilter(key)}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              matchFilter === key
                ? 'border-teal-700 bg-teal-700 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label} ({matchCounts[key]})
          </button>
        ))}
      </div>

      {/* Search + Collapsible Filters & View toggle */}
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar receita, ingrediente ou tag..."
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs sm:text-sm outline-none focus:border-teal-600"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpar pesquisa"
              className="absolute right-2 top-1.5 rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${
            filtersOpen || activeFiltersCount > 0
              ? 'border-teal-300 bg-teal-50 text-teal-900'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Filtros e vista</span>
          {activeFiltersCount > 0 && (
            <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-teal-700 px-1 text-[10px] font-bold text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Quick-clear chips when panel is closed and filters are active */}
      {!filtersOpen && activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {categoryFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-semibold text-teal-900 hover:bg-teal-200"
              aria-label={`Remover filtro ${RECIPE_CATEGORY_LABELS[categoryFilter]}`}
            >
              <span>{RECIPE_CATEGORY_LABELS[categoryFilter]}</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          {maxMinutes > 0 && (
            <button
              type="button"
              onClick={() => setMaxMinutes(0)}
              className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-semibold text-teal-900 hover:bg-teal-200"
              aria-label={`Remover filtro até ${maxMinutes} min`}
            >
              <span>≤ {maxMinutes} min</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          {memberFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setMemberFilter('all')}
              className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-semibold text-teal-900 hover:bg-teal-200"
              aria-label={`Remover filtro ${getMemberFilterLabel(memberFilter, members)}`}
            >
              <span>{getMemberFilterLabel(memberFilter, members)}</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Collapsible Filters & View options panel (open on PC, collapsed on mobile) */}
      {filtersOpen && (
        <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xs">
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as RecipeCategory | 'all')}
              aria-label="Filtrar por categoria"
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-teal-600"
            >
              <option value="all">Categoria: Todas</option>
              {Object.entries(RECIPE_CATEGORY_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>

            <select
              value={maxMinutes}
              onChange={(e) => setMaxMinutes(Number(e.target.value))}
              aria-label="Filtrar por tempo"
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-teal-600"
            >
              <option value={0}>Tempo: Qualquer</option>
              <option value={20}>Rápida (≤ 20 min)</option>
              <option value={35}>≤ 35 min</option>
              <option value={60}>≤ 60 min</option>
            </select>

            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              aria-label="Filtrar por pessoa"
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-teal-600"
            >
              <option value="all">Para quem: Todos</option>
              <option value="safe_all">Sem alergias da família</option>
              <option value="kids">Adequada a crianças</option>
              {humanMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  Favoritas de {m.name}
                </option>
              ))}
            </select>
          </div>

          <CollectionToolbar
            viewMode={prefs.viewMode}
            onChangeViewMode={(viewMode) => updatePrefs({ viewMode })}
            sortMode={prefs.sortMode}
            sortOptions={RECIPE_SORT_OPTIONS}
            sortAriaLabel="Ordenar receitas"
            onChangeSortMode={(sortMode) => updatePrefs({ sortMode })}
            groupActive={prefs.groupEnabled}
            groupTitle="Agrupar por categoria"
            onToggleGroup={() => updatePrefs({ groupEnabled: !prefs.groupEnabled })}
          />
        </div>
      )}

      {/* Recipes Collection */}
      {evaluated.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <ChefHat className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">
            {recipes.length === 0
              ? 'Ainda não adicionaste receitas próprias.'
              : 'Nenhuma receita corresponde aos filtros atuais.'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Adiciona as receitas da vossa família para a app cruzar automaticamente com o stock.
          </p>
        </div>
      ) : prefs.groupEnabled ? (
        <div className="space-y-3">
          {groupedCategories.map((group) => {
            const collapsed = collapsedCategories.has(group.category);
            const { Icon } = group.visual;
            return (
              <section key={group.category} className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleCategoryCollapsed(group.category)}
                  aria-expanded={!collapsed}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-xs transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${group.visual.bgClass} ${group.visual.textClass}`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-bold text-slate-900">{group.label}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {group.items.length}
                    </span>
                  </span>
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  )}
                </button>
                {!collapsed && renderRecipeItems(group.items)}
              </section>
            );
          })}
        </div>
      ) : (
        renderRecipeItems(evaluated)
      )}

      <RecipeFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editingRecipe={editingRecipe}
        catalogItems={catalogItems}
        locations={locations}
        members={members}
        deviceId={deviceId}
      />

      <RecipeDetailModal
        open={detailRecipeId !== null}
        onClose={() => setDetailRecipeId(null)}
        recipeId={detailRecipeId}
        recipesMap={recipesMap}
        stockLots={stockLots}
        catalogItems={catalogItems}
        locations={locations}
        members={members}
        shoppingItems={shoppingItems}
        expiryWarningDays={expiryWarningDays}
        deviceId={deviceId}
        onEdit={(r) => {
          setEditingRecipe(r);
          setFormOpen(true);
        }}
        onStartCook={(recipe, servings) => setCookState({ recipe, servings })}
      />

      <CookRecipeModal
        open={cookState !== null}
        onClose={() => setCookState(null)}
        recipe={cookState?.recipe ?? null}
        servings={cookState?.servings ?? 4}
        stockLots={stockLots}
        catalogItems={catalogItems}
        locations={locations}
        deviceId={deviceId}
      />
    </div>
  );
}
