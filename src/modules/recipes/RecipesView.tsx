import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChefHat,
  Clock,
  Plus,
  Search,
  Snowflake,
  Sparkles,
} from 'lucide-react';
import { AttachmentImage } from '../../components/AttachmentPreview';
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
import { normalizeText, todayDateString } from '../../utils/units';
import { CookRecipeModal } from './CookRecipeModal';
import { evaluateRecipeMatch } from './matchingEngine';
import { RecipeDetailModal } from './RecipeDetailModal';
import { RecipeFormModal } from './RecipeFormModal';

interface RecipesViewProps {
  recipes: Recipe[];
  stockLots: StockLot[];
  catalogItems: CatalogItem[];
  locations: StorageLocation[];
  members: HouseholdMember[];
  shoppingItems: ShoppingItem[];
  expiryWarningDays: number;
  deviceId: string;
  openCreateInitially?: boolean;
  onConsumeCreateInitial?: () => void;
}

type MatchFilter = 'all' | 'ready' | 'almost' | 'expiring';

export function RecipesView({
  recipes,
  stockLots,
  catalogItems,
  locations,
  members,
  shoppingItems,
  expiryWarningDays,
  deviceId,
  openCreateInitially,
  onConsumeCreateInitial,
}: RecipesViewProps) {
  const [search, setSearch] = useState('');
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<RecipeCategory | 'all'>('all');
  const [maxMinutes, setMaxMinutes] = useState<number>(0);
  const [memberFilter, setMemberFilter] = useState<string>('all');

  const [formOpen, setFormOpen] = useState(Boolean(openCreateInitially));
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [detailRecipeId, setDetailRecipeId] = useState<string | null>(null);
  const [cookState, setCookState] = useState<{ recipe: Recipe; servings: number } | null>(null);

  if (openCreateInitially && !formOpen) {
    setFormOpen(true);
    onConsumeCreateInitial?.();
  }

  const today = todayDateString();
  const recipesMap = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const evaluated = useMemo(() => {
    const q = normalizeText(search);
    return recipes
      .map((recipe) =>
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
      )
      .filter((m) => {
        if (matchFilter === 'ready' && m.status !== 'ready') return false;
        if (matchFilter === 'almost' && m.status !== 'almost') return false;
        if (matchFilter === 'expiring' && m.expiringSoonCount === 0) return false;
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
      })
      .sort((a, b) => b.score - a.score);
  }, [
    recipes,
    stockLots,
    catalogItems,
    locations,
    members,
    expiryWarningDays,
    today,
    search,
    matchFilter,
    categoryFilter,
    maxMinutes,
    memberFilter,
  ]);

  const readyCount = evaluated.filter((e) => e.status === 'ready').length;
  const humanMembers = members.filter((m) => m.role !== 'pet');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">As Nossas Receitas</h1>
          <p className="text-xs text-slate-500">
            {recipes.length} receitas guardadas · {readyCount} prontas a fazer agora
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingRecipe(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
        >
          <Plus className="h-4 w-4" />
          Nova Receita
        </button>
      </div>

      {/* Search and filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar receita, ingrediente ou tag..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-600"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Todas'],
              ['ready', 'Prontas 100%'],
              ['almost', 'Quase lá (1-2)'],
              ['expiring', 'Aproveitar já'],
            ] as [MatchFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMatchFilter(key)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                matchFilter === key
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as RecipeCategory | 'all')}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
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
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
          >
            <option value={0}>Tempo: Qualquer</option>
            <option value={20}>Rápida (≤ 20 min)</option>
            <option value={35}>≤ 35 min</option>
            <option value={60}>≤ 60 min</option>
          </select>

          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
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
      </div>

      {/* Recipes Grid */}
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
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {evaluated.map((m) => (
            <button
              key={m.recipe.id}
              type="button"
              onClick={() => setDetailRecipeId(m.recipe.id)}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-xs transition hover:border-teal-400 hover:shadow-sm"
            >
              {m.recipe.photoAttachmentId && (
                <AttachmentImage
                  attachmentId={m.recipe.photoAttachmentId}
                  alt={m.recipe.title}
                  className="h-36 w-full"
                />
              )}
              <div className="flex flex-1 flex-col justify-between gap-2 p-3.5">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {m.status === 'ready' && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                        Pronta 100%
                      </span>
                    )}
                    {m.status === 'almost' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        Falta {m.missingMandatoryCount}
                      </span>
                    )}
                    {m.status === 'missing' && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        Faltam {m.missingMandatoryCount}
                      </span>
                    )}
                    {m.expiringSoonCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-800">
                        <Sparkles className="h-3 w-3" />
                        Aproveitar já
                      </span>
                    )}
                    {m.needsDefrost && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                        <Snowflake className="h-3 w-3" />
                        Descongelar
                      </span>
                    )}
                  </div>

                  <h3 className="mt-1.5 font-bold text-slate-900">{m.recipe.title}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {RECIPE_CATEGORY_LABELS[m.recipe.category]} ·{' '}
                    <Clock className="inline h-3 w-3" />{' '}
                    {m.recipe.prepMinutes + m.recipe.cookMinutes} min · {m.recipe.baseServings} doses
                  </p>
                </div>

                {m.missingIngredients.length > 0 && m.status === 'almost' && (
                  <p className="text-xs text-amber-800">
                    Falta: {m.missingIngredients.map((i) => i.catalogItemName).join(', ')}
                  </p>
                )}

                {m.allergenConflicts.length > 0 && (
                  <p className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Atenção: {m.allergenConflicts.join(', ')}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
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
