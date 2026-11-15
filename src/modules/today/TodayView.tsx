import { useMemo } from 'react';
import { CalendarDays, Clock, Snowflake, Sparkles } from 'lucide-react';
import { MEAL_SLOT_LABELS } from '../../constants/labels';
import type {
  AppSettings,
  AppTab,
  CatalogItem,
  HouseholdMember,
  MealPlanEntry,
  Recipe,
  StockLot,
  StorageLocation,
} from '../../types/domain';
import { formatQuantity, todayDateString } from '../../utils/units';
import { getTomorrowDefrostReminders } from '../planner/plannerService';
import { evaluateRecipeMatch } from '../recipes/matchingEngine';
import { getLotExpiryInfo } from '../stock/stockService';

interface TodayViewProps {
  settings: AppSettings;
  locations: StorageLocation[];
  catalogItems: CatalogItem[];
  stockLots: StockLot[];
  recipes: Recipe[];
  mealPlan: MealPlanEntry[];
  members: HouseholdMember[];
  onNavigate: (tab: AppTab) => void;
}

export function TodayView({
  settings,
  locations,
  catalogItems,
  stockLots,
  recipes,
  mealPlan,
  members,
  onNavigate,
}: TodayViewProps) {
  const today = todayDateString();
  const locationsById = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations],
  );
  const recipesById = useMemo(
    () => new Map(recipes.map((r) => [r.id, r])),
    [recipes],
  );

  const expiryAlerts = useMemo(() => {
    return stockLots
      .map((lot) => ({
        lot,
        info: getLotExpiryInfo(lot, settings.expiryWarningDays, today),
      }))
      .filter((x) => x.info.status === 'expired' || x.info.status === 'expiring_soon')
      .sort((a, b) => (a.info.daysRemaining ?? 0) - (b.info.daysRemaining ?? 0));
  }, [stockLots, settings.expiryWarningDays, today]);

  const todayMeals = useMemo(
    () => mealPlan.filter((e) => e.date === today && !e.completed),
    [mealPlan, today],
  );

  const defrostReminders = useMemo(
    () =>
      getTomorrowDefrostReminders(
        mealPlan,
        recipes,
        stockLots,
        catalogItems,
        locations,
        settings.expiryWarningDays,
        today,
      ),
    [mealPlan, recipes, stockLots, catalogItems, locations, settings.expiryWarningDays, today],
  );

  const topCookableRecipes = useMemo(() => {
    return recipes
      .map((r) =>
        evaluateRecipeMatch(
          r,
          r.baseServings,
          stockLots,
          catalogItems,
          locations,
          members,
          settings.expiryWarningDays,
          today,
        ),
      )
      .filter((m) => m.status === 'ready' || m.status === 'almost')
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [recipes, stockLots, catalogItems, locations, members, settings.expiryWarningDays, today]);

  return (
    <div className="space-y-3.5">
      {/* Defrost reminder for tomorrow */}
      {defrostReminders.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/70">
          <div className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-blue-900">
            <Snowflake className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <span>Descongelar hoje para amanhã</span>
          </div>
          <div className="divide-y divide-blue-100 border-t border-blue-100 bg-white/80">
            {defrostReminders.map((rem) => (
              <div key={rem.entry.id} className="px-3.5 py-2 text-xs text-slate-700">
                <span className="font-semibold text-blue-950">
                  {MEAL_SLOT_LABELS[rem.entry.slot]} · {rem.recipeTitle}:
                </span>{' '}
                {rem.ingredientNames.join(', ')}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Urgent expiry alerts only (clean, no low-stock pill wall) */}
      {expiryAlerts.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60">
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <Clock className="h-4 w-4 text-amber-700" aria-hidden="true" />
              Validades a verificar ({expiryAlerts.length})
            </span>
            <button
              type="button"
              onClick={() => onNavigate('stock')}
              className="text-xs font-semibold text-amber-900 hover:underline"
            >
              Ver stock
            </button>
          </div>
          <div className="divide-y divide-amber-100/80 border-t border-amber-100 bg-white/90">
            {expiryAlerts.slice(0, 5).map(({ lot, info }) => (
              <button
                key={lot.id}
                type="button"
                onClick={() => onNavigate('stock')}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-xs transition hover:bg-amber-50/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{lot.productLabel}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {locationsById.get(lot.locationId)?.name}
                    {lot.quantity ? ` · ${formatQuantity(lot.quantity, lot.unit)}` : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    info.status === 'expired'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {info.status === 'expired'
                    ? 'Expirado'
                    : info.daysRemaining === 0
                      ? 'Hoje'
                      : `${info.daysRemaining}d`}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Today's Meal Plan */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <CalendarDays className="h-4 w-4 text-teal-700" aria-hidden="true" />
            Ementa de Hoje
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('planner')}
            className="text-xs font-semibold text-teal-700 hover:underline"
          >
            Ver semana
          </button>
        </div>

        {todayMeals.length === 0 ? (
          <p className="border-t border-slate-100 px-3.5 py-3 text-xs text-slate-500">
            Nada planeado para hoje.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {todayMeals.map((entry) => {
              const recipe = entry.recipeId ? recipesById.get(entry.recipeId) : null;
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-teal-800">
                      {MEAL_SLOT_LABELS[entry.slot]} ·{' '}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {recipe ? recipe.title : entry.customLabel}
                    </span>
                  </div>
                  {recipe && (
                    <span className="shrink-0 text-slate-500">{entry.plannedServings} doses</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* What can we cook now (up to 3 clean suggestions) */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Sparkles className="h-4 w-4 text-teal-700" aria-hidden="true" />
            O que cozinhar agora
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('recipes')}
            className="text-xs font-semibold text-teal-700 hover:underline"
          >
            Todas ({recipes.length})
          </button>
        </div>

        {topCookableRecipes.length === 0 ? (
          <p className="border-t border-slate-100 px-3.5 py-3 text-xs text-slate-500">
            Adiciona receitas e regista o que tens em casa para ver sugestões aqui.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {topCookableRecipes.map((m) => (
              <button
                key={m.recipe.id}
                type="button"
                onClick={() => onNavigate('recipes')}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{m.recipe.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {m.recipe.prepMinutes + m.recipe.cookMinutes} min · {m.recipe.baseServings}{' '}
                    doses
                    {m.needsDefrost ? ' · Descongelar antes' : ''}
                    {m.expiringSoonCount > 0 ? ' · Aproveitar validade' : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    m.status === 'ready'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {m.status === 'ready' ? 'Pronta' : `Falta ${m.missingMandatoryCount}`}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
