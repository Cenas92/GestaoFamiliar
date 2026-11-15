import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChefHat,
  Plus,
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
import { formatDatePt, formatQuantity, todayDateString } from '../../utils/units';
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
  shoppingItems: ShoppingItem[];
  members: HouseholdMember[];
  onNavigate: (tab: AppTab) => void;
  onQuickNewRecipe: () => void;
  onSyncNow: () => Promise<string>;
}

export function TodayView({
  settings,
  locations,
  catalogItems,
  stockLots,
  recipes,
  mealPlan,
  shoppingItems,
  members,
  onNavigate,
  onQuickNewRecipe,
  onSyncNow,
}: TodayViewProps) {
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
    return catalogItems
      .map((cat) => summarizeCatalogStock(cat, stockLots, settings.expiryWarningDays, today))
      .filter((s) => s.isLowStock);
  }, [catalogItems, stockLots, settings.expiryWarningDays, today]);

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
      .slice(0, 5);
  }, [recipes, stockLots, catalogItems, locations, members, settings.expiryWarningDays, today]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const summary = await onSyncNow();
      setToast(summary);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Falha na sincronização.');
    } finally {
      setSyncing(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const quickSendToShopping = async (cat: CatalogItem) => {
    const already = shoppingItems.some((s) => !s.checked && s.catalogItemId === cat.id);
    if (already) {
      setToast(`${cat.name} já está na lista.`);
      setTimeout(() => setToast(null), 2200);
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
    setToast(`${cat.name} enviado para a Lista de Compras.`);
    setTimeout(() => setToast(null), 2200);
  };

  const syncConfigured = Boolean(settings.googleClientId && settings.googleDriveFolderId);

  return (
    <div className="space-y-4">
      {/* Header + Sync badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Hoje em Casa</h1>
          <p className="text-xs text-slate-500">
            {formatDatePt(today)} · {stockLots.length} itens em stock ·{' '}
            {shoppingItems.filter((s) => !s.checked).length} por comprar
          </p>
        </div>

        {syncConfigured ? (
          <button
            type="button"
            disabled={syncing}
            onClick={handleSync}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-teal-700 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'A sincronizar...' : 'Sincronizar Drive'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Modo Local (configurar Drive)
          </button>
        )}
      </div>

      {toast && (
        <div className="rounded-xl bg-teal-900 px-3.5 py-2 text-xs font-medium text-white shadow">
          {toast}
        </div>
      )}

      {/* Quick Shortcuts */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onNavigate('stock')}
          className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-teal-200 bg-teal-50/80 px-2 py-3 text-xs font-bold text-teal-900 hover:bg-teal-100"
        >
          <Plus className="h-5 w-5 text-teal-700" />
          Gerir Stock
        </button>
        <button
          type="button"
          onClick={() => onNavigate('shopping')}
          className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-3 text-xs font-bold text-slate-800 hover:bg-slate-50"
        >
          <ShoppingCart className="h-5 w-5 text-teal-700" />
          Compras ({shoppingItems.filter((s) => !s.checked).length})
        </button>
        <button
          type="button"
          onClick={onQuickNewRecipe}
          className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-3 text-xs font-bold text-slate-800 hover:bg-slate-50"
        >
          <ChefHat className="h-5 w-5 text-teal-700" />
          Nova Receita
        </button>
      </div>

      {/* Defrost reminder for tomorrow */}
      {defrostReminders.length > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3.5">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-900">
            <Snowflake className="h-4 w-4 text-blue-700" />
            Lembrar de descongelar hoje para amanhã
          </h2>
          <div className="mt-2 space-y-1.5">
            {defrostReminders.map((rem) => (
              <div
                key={rem.entry.id}
                className="rounded-xl bg-white/90 px-3 py-2 text-xs text-blue-950"
              >
                <span className="font-bold">
                  {MEAL_SLOT_LABELS[rem.entry.slot]} — {rem.recipeTitle}:
                </span>{' '}
                tirar do congelador {rem.ingredientNames.join(', ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority Alerts: Expiring & Low Stock */}
      {(expiryAlerts.length > 0 || lowStockAlerts.length > 0) && (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            Alertas Prioritários
          </h2>

          {expiryAlerts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-amber-800">
                Validades ({expiryAlerts.length}):
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {expiryAlerts.slice(0, 6).map(({ lot, info }) => (
                  <div
                    key={lot.id}
                    className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs shadow-2xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{lot.productLabel}</p>
                      <p className="text-[11px] text-slate-500">
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
                  </div>
                ))}
              </div>
            </div>
          )}

          {lowStockAlerts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-amber-800">
                Stock abaixo do mínimo ({lowStockAlerts.length}):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {lowStockAlerts.slice(0, 8).map((s) => (
                  <button
                    key={s.catalogItem.id}
                    type="button"
                    onClick={() => quickSendToShopping(s.catalogItem)}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100"
                  >
                    <ShoppingCart className="h-3 w-3 text-amber-700" />
                    {s.catalogItem.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Today's Meal Plan */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <CalendarDays className="h-4 w-4 text-teal-700" />
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
          <p className="text-xs text-slate-500">
            Nada planeado para hoje. Clica em "Ver semana" para organizar as refeições.
          </p>
        ) : (
          <div className="space-y-1.5">
            {todayMeals.map((entry) => {
              const recipe = entry.recipeId ? recipesById.get(entry.recipeId) : null;
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs"
                >
                  <div>
                    <span className="font-bold text-teal-800">
                      {MEAL_SLOT_LABELS[entry.slot]}:{' '}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {recipe ? recipe.title : entry.customLabel}
                    </span>
                  </div>
                  {recipe && (
                    <span className="text-slate-500">{entry.plannedServings} doses</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* What can we cook now */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Sparkles className="h-4 w-4 text-teal-700" />
            O que podemos cozinhar agora
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
          <p className="text-xs text-slate-500">
            Adiciona receitas próprias e regista o teu stock para veres aqui sugestões prontas a
            fazer!
          </p>
        ) : (
          <div className="space-y-2">
            {topCookableRecipes.map((m) => (
              <button
                key={m.recipe.id}
                type="button"
                onClick={() => onNavigate('recipes')}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-left transition hover:border-teal-300 hover:bg-teal-50/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{m.recipe.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {m.recipe.prepMinutes + m.recipe.cookMinutes} min · {m.recipe.baseServings}{' '}
                    doses
                    {m.needsDefrost ? ' · Precisa descongelar' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {m.expiringSoonCount > 0 && (
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
                    {m.status === 'ready' ? '100%' : `Falta ${m.missingMandatoryCount}`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
