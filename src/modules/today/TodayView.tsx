import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChefHat,
  Clock,
  Package,
  RefreshCw,
  ShoppingCart,
  Snowflake,
  Sparkles,
} from 'lucide-react';
import { MEAL_SLOT_LABELS } from '../../constants/labels';
import { db } from '../../db/database';
import type {
  AppSettings,
  AppTab,
  CatalogItem,
  HouseholdMember,
  MealPlanEntry,
  Recipe,
  ShoppingItem,
  StockLot,
  StorageLocation,
} from '../../types/domain';
import { formatQuantity, todayDateString } from '../../utils/units';
import type { UiDensityMode } from '../../utils/viewPrefs';
import { buildShoppingItem, getTomorrowDefrostReminders } from '../planner/plannerService';
import { evaluateRecipeMatch } from '../recipes/matchingEngine';
import { getLotExpiryInfo, summarizeCatalogStock } from '../stock/stockService';

interface TodayViewProps {
  settings: AppSettings;
  locations: StorageLocation[];
  catalogItems: CatalogItem[];
  stockLots: StockLot[];
  recipes: Recipe[];
  mealPlan: MealPlanEntry[];
  shoppingItems?: ShoppingItem[];
  members: HouseholdMember[];
  uiDensity?: UiDensityMode;
  onNavigate: (tab: AppTab) => void;
  onQuickAddStock?: () => void;
  onQuickNewRecipe?: () => void;
  onSyncNow?: () => Promise<string>;
}

export function TodayView({
  settings,
  locations,
  catalogItems,
  stockLots,
  recipes,
  mealPlan,
  shoppingItems = [],
  members,
  uiDensity = 'clean',
  onNavigate,
  onQuickAddStock,
  onQuickNewRecipe,
  onSyncNow,
}: TodayViewProps) {
  const isComplete = uiDensity === 'complete';
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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

  const lowStockAlerts = useMemo(() => {
    if (!isComplete) return [];
    return catalogItems
      .map((cat) => summarizeCatalogStock(cat, stockLots, settings.expiryWarningDays, today))
      .filter((s) => s.isLowStock);
  }, [isComplete, catalogItems, stockLots, settings.expiryWarningDays, today]);

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
    const limit = isComplete ? 5 : 3;
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
      .slice(0, limit);
  }, [
    isComplete,
    recipes,
    stockLots,
    catalogItems,
    locations,
    members,
    settings.expiryWarningDays,
    today,
  ]);

  const showToastMessage = (msg: string, ms = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  };

  const handleSync = async () => {
    if (!onSyncNow) return;
    setSyncing(true);
    try {
      const summary = await onSyncNow();
      showToastMessage(summary, 3500);
    } catch (err) {
      showToastMessage(err instanceof Error ? err.message : 'Falha na sincronização.', 4000);
    } finally {
      setSyncing(false);
    }
  };

  const quickSendToShopping = async (cat: CatalogItem) => {
    const already = shoppingItems.some((s) => !s.checked && s.catalogItemId === cat.id);
    if (already) {
      showToastMessage(`${cat.name} já está na lista.`);
      return;
    }
    await db.shoppingItems.put(
      buildShoppingItem(
        {
          catalogItemId: cat.id,
          label: cat.name,
          quantity: cat.minStockQty ?? 1,
          unit: cat.trackingMode === 'qualitative' ? 'un' : cat.defaultUnit,
          section: cat.supermarketSection,
          targetLocationId: cat.defaultLocationId,
          source: 'low_stock',
        },
        settings.deviceId,
      ),
    );
    showToastMessage(`${cat.name} enviado para a Lista de Compras.`);
  };

  const pendingShoppingCount = useMemo(
    () => shoppingItems.filter((s) => !s.checked).length,
    [shoppingItems],
  );
  const syncConfigured = Boolean(settings.googleClientId && settings.googleDriveFolderId);

  return (
    <div className="space-y-3.5">
      {isComplete && toast && (
        <div className="rounded-xl bg-teal-900 px-3.5 py-2 text-xs font-medium text-white shadow">
          {toast}
        </div>
      )}

      {/* Quick Shortcuts (Complete mode only) */}
      {isComplete && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => (onQuickAddStock ? onQuickAddStock() : onNavigate('stock'))}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-teal-200 bg-teal-50/80 px-3 py-2.5 text-xs font-bold text-teal-900 transition hover:bg-teal-100"
          >
            <Package className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span>+ Produto</span>
          </button>
          <button
            type="button"
            onClick={() => (onQuickNewRecipe ? onQuickNewRecipe() : onNavigate('recipes'))}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-slate-50"
          >
            <ChefHat className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span>+ Receita</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('shopping')}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-slate-50"
          >
            <ShoppingCart className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span>Compras ({pendingShoppingCount})</span>
          </button>
          {syncConfigured && onSyncNow ? (
            <button
              type="button"
              disabled={syncing}
              onClick={handleSync}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 shrink-0 text-teal-700 ${syncing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{syncing ? 'A sincronizar…' : 'Sincronizar Drive'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span>Configurar Drive</span>
            </button>
          )}
        </div>
      )}

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

      {/* Alerts: Priority Alerts (Expiring + Low Stock) in Complete mode vs Calm Expiries in Clean */}
      {isComplete
        ? (expiryAlerts.length > 0 || lowStockAlerts.length > 0) && (
            <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
                  Alertas Prioritários
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('stock')}
                  className="text-xs font-semibold text-amber-900 hover:underline"
                >
                  Ver stock
                </button>
              </div>

              {expiryAlerts.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-amber-800">
                    Validades ({expiryAlerts.length}):
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {expiryAlerts.slice(0, 6).map(({ lot, info }) => (
                      <button
                        key={lot.id}
                        type="button"
                        onClick={() => onNavigate('stock')}
                        className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-xs shadow-2xs transition hover:bg-amber-50/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {lot.productLabel}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {locationsById.get(lot.locationId)?.name}
                            {lot.quantity ? ` · ${formatQuantity(lot.quantity, lot.unit)}` : ''}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-lg px-2 py-0.5 font-bold ${
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
                </div>
              )}

              {lowStockAlerts.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-amber-800">
                    Stock abaixo do mínimo ({lowStockAlerts.length}) — tocar para pôr nas compras:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {lowStockAlerts.slice(0, 8).map((s) => (
                      <button
                        key={s.catalogItem.id}
                        type="button"
                        onClick={() => quickSendToShopping(s.catalogItem)}
                        className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100"
                      >
                        <ShoppingCart className="h-3 w-3 text-amber-700" aria-hidden="true" />
                        {s.catalogItem.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )
        : expiryAlerts.length > 0 && (
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

      {/* What can we cook now */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Sparkles className="h-4 w-4 text-teal-700" aria-hidden="true" />
            {isComplete ? 'O que podemos cozinhar agora' : 'O que cozinhar agora'}
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
                    {!isComplete && m.expiringSoonCount > 0 ? ' · Aproveitar validade' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {isComplete && m.expiringSoonCount > 0 && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                      Aproveitar já
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      m.status === 'ready'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {m.status === 'ready'
                      ? isComplete
                        ? '100%'
                        : 'Pronta'
                      : `Falta ${m.missingMandatoryCount}`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
