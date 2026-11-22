import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  CalendarDays,
  ChefHat,
  Check,
  Cloud,
  CloudAlert,
  Home,
  Package,
  RefreshCw,
  Settings,
  ShoppingCart,
  UtensilsCrossed,
  Wallet,
  WifiOff,
} from 'lucide-react';
import { APP_INFO } from './appInfo';
import { useFamilyData } from './hooks/useFamilyData';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { FinancesView } from './modules/finances/FinancesView';
import {
  currentMonthString,
  ensureRecurringTransactionsForMonth,
  formatMonthShortPt,
  summarizeMonthFinances,
} from './modules/finances/financeService';
import { formatEur } from './modules/finances/financeVisuals';
import { PlannerView } from './modules/planner/PlannerView';
import { evaluateRecipeMatch } from './modules/recipes/matchingEngine';
import { RecipesView } from './modules/recipes/RecipesView';
import { SettingsView } from './modules/settings/SettingsView';
import { ShoppingView } from './modules/shopping/ShoppingView';
import { summarizeCatalogStock } from './modules/stock/stockService';
import { StockView } from './modules/stock/StockView';
import { TodayView } from './modules/today/TodayView';
import { checkForPwaUpdate } from './pwaUpdate';
import { useAutoSync } from './sync/useAutoSync';
import type { AppTab } from './types/domain';
import {
  addDaysToDateString,
  formatDatePt,
  getWeekStartMonday,
  todayDateString,
} from './utils/units';
import {
  loadUiDensityMode,
  switchUiDensityMode,
  type UiDensityMode,
} from './utils/viewPrefs';

type PrimaryTab = 'today' | 'stock' | 'meals' | 'shopping' | 'finances' | 'settings';
type MealsSubTab = 'planner' | 'recipes';

const HASH_TO_ROUTE: Record<string, { tab: PrimaryTab; mealsSubTab?: MealsSubTab }> = {
  '#today': { tab: 'today' },
  '#stock': { tab: 'stock' },
  '#meals': { tab: 'meals' },
  '#recipes': { tab: 'meals', mealsSubTab: 'recipes' },
  '#planner': { tab: 'meals', mealsSubTab: 'planner' },
  '#shopping': { tab: 'shopping' },
  '#finances': { tab: 'finances' },
  '#settings': { tab: 'settings' },
};

function readInitialRoute(): { tab: PrimaryTab; mealsSubTab: MealsSubTab } {
  const match = HASH_TO_ROUTE[window.location.hash];
  return {
    tab: match?.tab ?? 'today',
    mealsSubTab: match?.mealsSubTab ?? 'planner',
  };
}

export function App() {
  const data = useFamilyData();
  const initialRoute = readInitialRoute();
  const [activeTab, setActiveTab] = useState<PrimaryTab>(initialRoute.tab);
  const [mealsSubTab, setMealsSubTab] = useState<MealsSubTab>(initialRoute.mealsSubTab);
  const [uiDensity, setUiDensity] = useState<UiDensityMode>(() => loadUiDensityMode());
  const [openStockCreate, setOpenStockCreate] = useState(false);
  const [openRecipeCreate, setOpenRecipeCreate] = useState(false);
  const [plannerWeekStart, setPlannerWeekStart] = useState(() => getWeekStartMonday());
  const [financeMonth, setFinanceMonth] = useState(() => currentMonthString());
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [headerNotice, setHeaderNotice] = useState<{ text: string; isError: boolean } | null>(null);

  const handleChangeUiDensity = (nextMode: UiDensityMode) => {
    switchUiDensityMode(nextMode);
    setUiDensity(nextMode);
  };

  const autoSync = useAutoSync(data.settings);

  const handlePullRefresh = async () => {
    setHeaderNotice(null);
    // Start Drive sync synchronously while user gesture is still active
    const syncPromise =
      navigator.onLine && autoSync.isConfigured ? autoSync.triggerManualSync() : null;
    const pwaResult = await checkForPwaUpdate();

    if (pwaResult === 'updated') {
      setHeaderNotice({ text: 'Nova versão encontrada! A atualizar…', isError: false });
    }

    if (syncPromise) {
      try {
        const summary = await syncPromise;
        setHeaderNotice({ text: summary, isError: false });
        setTimeout(() => setHeaderNotice(null), 3500);
      } catch (err) {
        setHeaderNotice({
          text: err instanceof Error ? err.message : 'Erro ao sincronizar.',
          isError: true,
        });
      }
    } else if (pwaResult !== 'updated') {
      setHeaderNotice({
        text:
          pwaResult === 'offline'
            ? 'Sem ligação à internet (modo offline).'
            : `App atualizada (v${APP_INFO.version}).`,
        isError: false,
      });
      setTimeout(() => setHeaderNotice(null), 2500);
    }
  };

  const pullState = usePullToRefresh(handlePullRefresh);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onHashChange = () => {
      const route = readInitialRoute();
      setActiveTab(route.tab);
      if (HASH_TO_ROUTE[window.location.hash]?.mealsSubTab) {
        setMealsSubTab(route.mealsSubTab);
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  const navigate = (tab: AppTab) => {
    if (tab === 'recipes' || tab === 'planner') {
      setActiveTab('meals');
      setMealsSubTab(tab);
      window.location.hash = `#${tab}`;
      return;
    }
    setActiveTab(tab);
    window.location.hash = `#${tab}`;
  };

  const selectMealsSubTab = (sub: MealsSubTab) => {
    setMealsSubTab(sub);
    window.location.hash = `#${sub}`;
  };

  const handleSyncNow = async (): Promise<string> => {
    const summary = await autoSync.triggerManualSync();
    return summary;
  };

  const handleHeaderSyncClick = async () => {
    setHeaderNotice(null);
    try {
      const summary = await handleSyncNow();
      setHeaderNotice({ text: summary, isError: false });
      setTimeout(() => setHeaderNotice(null), 3500);
    } catch (err) {
      setHeaderNotice({
        text: err instanceof Error ? err.message : 'Erro ao sincronizar.',
        isError: true,
      });
    }
  };

  const today = todayDateString();
  const currentMonth = currentMonthString(today);
  const financeRecurringSignature = useMemo(
    () => data.financeRecurring.map((r) => `${r.id}:${r.updatedAt}:${r.isActive ? 1 : 0}`).join('|'),
    [data.financeRecurring],
  );

  useEffect(() => {
    if (!data.ready || !data.settings?.deviceId || data.financeRecurring.length === 0) return;
    void ensureRecurringTransactionsForMonth(currentMonth, data.settings.deviceId);
  }, [data.ready, data.settings?.deviceId, currentMonth, financeRecurringSignature, data.financeRecurring.length]);
  const readyRecipesCount = useMemo(() => {
    if (!data.ready || !data.settings || !(activeTab === 'meals' && mealsSubTab === 'recipes')) {
      return 0;
    }
    const expiryWarningDays = data.settings.expiryWarningDays;
    return data.recipes.filter(
      (r) =>
        evaluateRecipeMatch(
          r,
          r.baseServings,
          data.stockLots,
          data.catalogItems,
          data.locations,
          data.members,
          expiryWarningDays,
          today,
        ).status === 'ready',
    ).length;
  }, [
    data.ready,
    data.settings,
    data.recipes,
    data.stockLots,
    data.catalogItems,
    data.locations,
    data.members,
    activeTab,
    mealsSubTab,
    today,
  ]);

  const financeHeaderSummary = useMemo(() => {
    if (!data.ready || activeTab !== 'finances') return null;
    return summarizeMonthFinances(
      financeMonth,
      data.financeTransactions,
      data.financeCategories,
    );
  }, [data.ready, activeTab, financeMonth, data.financeTransactions, data.financeCategories]);

  const lowStockCount = useMemo(() => {
    if (!data.ready || !data.settings || uiDensity !== 'complete' || activeTab !== 'stock') {
      return 0;
    }
    const expiryWarningDays = data.settings.expiryWarningDays;
    return data.catalogItems.filter(
      (cat) => summarizeCatalogStock(cat, data.stockLots, expiryWarningDays, today).isLowStock,
    ).length;
  }, [
    data.ready,
    data.settings,
    data.catalogItems,
    data.stockLots,
    uiDensity,
    activeTab,
    today,
  ]);

  if (!data.ready || !data.settings) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">
        A preparar a base de dados local...
      </div>
    );
  }

  const pendingShoppingCount = data.shoppingItems.filter((s) => !s.checked).length;
  const checkedShoppingCount = data.shoppingItems.length - pendingShoppingCount;

  const headerMeta = (() => {
    switch (activeTab) {
      case 'today':
        return {
          title: 'Hoje em Casa',
          subtitle:
            uiDensity === 'complete'
              ? `${formatDatePt(today)} · ${data.stockLots.length} em stock · ${pendingShoppingCount} por comprar`
              : formatDatePt(today),
          Icon: Home,
          badgeClass: 'bg-teal-100 text-teal-700',
        };
      case 'stock': {
        const count = data.stockLots.length;
        return {
          title: 'Stock da Casa',
          subtitle:
            uiDensity === 'complete'
              ? `${count} ${count === 1 ? 'registo ativo' : 'registos ativos'} · ${lowStockCount} abaixo do mínimo`
              : `${count} ${count === 1 ? 'produto em casa' : 'produtos em casa'}`,
          Icon: Package,
          badgeClass: 'bg-cyan-100 text-cyan-700',
        };
      }
      case 'meals': {
        if (mealsSubTab === 'recipes') {
          const count = data.recipes.length;
          return {
            title: 'As Nossas Receitas',
            subtitle:
              uiDensity === 'complete'
                ? `${count} ${count === 1 ? 'receita' : 'receitas'} · ${readyRecipesCount} ${
                    readyRecipesCount === 1 ? 'pronta 100%' : 'prontas 100%'
                  }`
                : `${count} ${count === 1 ? 'receita' : 'receitas'} · ${readyRecipesCount} ${
                    readyRecipesCount === 1 ? 'pronta' : 'prontas'
                  }`,
            Icon: ChefHat,
            badgeClass: 'bg-amber-100 text-amber-700',
          };
        }
        const weekEnd = addDaysToDateString(plannerWeekStart, 6);
        return {
          title: 'Ementa Semanal',
          subtitle: `${formatDatePt(plannerWeekStart)} a ${formatDatePt(weekEnd)}`,
          Icon: CalendarDays,
          badgeClass: 'bg-indigo-100 text-indigo-700',
        };
      }
      case 'shopping':
        return {
          title: 'Lista de Compras',
          subtitle:
            checkedShoppingCount > 0
              ? `${pendingShoppingCount} por comprar · ${checkedShoppingCount} no carrinho`
              : `${pendingShoppingCount} ${
                  pendingShoppingCount === 1 ? 'item por comprar' : 'itens por comprar'
                }`,
          Icon: ShoppingCart,
          badgeClass: 'bg-emerald-100 text-emerald-700',
        };
      case 'finances':
        return {
          title: 'Finanças da Casa',
          subtitle: financeHeaderSummary
            ? `${formatMonthShortPt(financeMonth)} · Saldo ${formatEur(financeHeaderSummary.balanceTotal)}`
            : formatMonthShortPt(financeMonth),
          Icon: Wallet,
          badgeClass: 'bg-violet-100 text-violet-700',
        };
      case 'settings':
        return {
          title: 'Definições e Família',
          subtitle: 'Família, locais, finanças e sincronização',
          Icon: Settings,
          badgeClass: 'bg-slate-200 text-slate-700',
        };
    }
  })();
  const HeaderIcon = headerMeta.Icon;

  const navItems: { id: PrimaryTab; label: string; icon: typeof Home; badge?: number }[] = [
    { id: 'today', label: 'Hoje', icon: Home },
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'meals', label: 'Refeições', icon: UtensilsCrossed },
    {
      id: 'shopping',
      label: 'Compras',
      icon: ShoppingCart,
      badge: pendingShoppingCount > 0 ? pendingShoppingCount : undefined,
    },
    { id: 'finances', label: 'Finanças', icon: Wallet },
  ];

  return (
    <div className="min-h-dvh bg-slate-50 pb-24 sm:pb-8">
      {/* Dynamic Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5 text-left">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${headerMeta.badgeClass}`}
              aria-hidden="true"
            >
              <HeaderIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900">
                {headerMeta.title}
              </h1>
              <p className="truncate text-[11px] text-slate-500">{headerMeta.subtitle}</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Navegação principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? 'bg-teal-50 text-teal-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.badge !== undefined && (
                    <span className="rounded-full bg-teal-700 px-1.5 py-0.2 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            {!isOnline ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                <WifiOff className="h-3.5 w-3.5" />
                Offline
              </span>
            ) : (
              autoSync.isConfigured && (
                <button
                  type="button"
                  onClick={handleHeaderSyncClick}
                  disabled={autoSync.phase === 'syncing'}
                  title={autoSync.message ?? 'Sincronizar com Google Drive'}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    autoSync.phase === 'needs_auth' || autoSync.phase === 'error'
                      ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : autoSync.phase === 'syncing'
                        ? 'border-teal-200 bg-teal-50 text-teal-800'
                        : autoSync.hasPendingLocalEdits
                          ? 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  {autoSync.phase === 'syncing' ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>A sincronizar…</span>
                    </>
                  ) : autoSync.phase === 'needs_auth' ? (
                    <>
                      <CloudAlert className="h-3.5 w-3.5" />
                      <span>Tocar p/ Sync</span>
                    </>
                  ) : autoSync.phase === 'error' ? (
                    <>
                      <CloudAlert className="h-3.5 w-3.5" />
                      <span>Erro Sync</span>
                    </>
                  ) : autoSync.hasPendingLocalEdits ? (
                    <>
                      <Cloud className="h-3.5 w-3.5" />
                      <span>A enviar…</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Sync</span>
                    </>
                  )}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => navigate('settings')}
              className={`rounded-xl p-2 transition ${
                activeTab === 'settings'
                  ? 'bg-teal-50 text-teal-800'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
              aria-label="Definições e Família"
              title="Definições e Família"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {headerNotice && (
          <div
            className={`border-t px-4 py-2 text-center text-xs font-medium ${
              headerNotice.isError
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-teal-200 bg-teal-50 text-teal-900'
            }`}
          >
            <span>{headerNotice.text}</span>
            {headerNotice.isError && (
              <button
                type="button"
                onClick={() => setHeaderNotice(null)}
                className="ml-2 underline"
              >
                Fechar
              </button>
            )}
          </div>
        )}
      </header>

      {/* Pull-to-refresh indicator */}
      {(pullState.pullDistance > 0 || pullState.isRefreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden bg-slate-100/80 transition-[height] duration-150"
          style={{
            height: pullState.isRefreshing ? 44 : Math.max(28, Math.round(pullState.pullDistance)),
          }}
          aria-live="polite"
        >
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-xs ${
              pullState.isRefreshing || pullState.isReadyToRelease
                ? 'bg-teal-700 text-white'
                : 'bg-white text-slate-600'
            }`}
          >
            {pullState.isRefreshing ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>A atualizar…</span>
              </>
            ) : pullState.isReadyToRelease ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Larga para atualizar</span>
              </>
            ) : (
              <>
                <ArrowDown className="h-3.5 w-3.5" />
                <span>Arrasta para atualizar</span>
              </>
            )}
          </span>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
        {activeTab === 'today' && (
          <TodayView
            settings={data.settings}
            locations={data.locations}
            catalogItems={data.catalogItems}
            stockLots={data.stockLots}
            recipes={data.recipes}
            mealPlan={data.mealPlan}
            shoppingItems={data.shoppingItems}
            financeCategories={data.financeCategories}
            financeTransactions={data.financeTransactions}
            members={data.members}
            uiDensity={uiDensity}
            onNavigate={navigate}
            onQuickAddStock={() => {
              setOpenStockCreate(true);
              navigate('stock');
            }}
            onQuickNewRecipe={() => {
              setOpenRecipeCreate(true);
              navigate('recipes');
            }}
            onSyncNow={handleSyncNow}
          />
        )}

        {activeTab === 'stock' && (
          <StockView
            locations={data.locations}
            supermarketSections={data.supermarketSections}
            catalogItems={data.catalogItems}
            stockLots={data.stockLots}
            shoppingItems={data.shoppingItems}
            recipes={data.recipes}
            expiryWarningDays={data.settings.expiryWarningDays}
            deviceId={data.settings.deviceId}
            uiDensity={uiDensity}
            openCreateInitially={openStockCreate}
            onConsumeCreateInitial={() => setOpenStockCreate(false)}
          />
        )}

        {activeTab === 'meals' && (
          <div className="space-y-3">
            <div
              className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs"
              role="tablist"
              aria-label="Secções de Refeições"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mealsSubTab === 'planner'}
                onClick={() => selectMealsSubTab('planner')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                  mealsSubTab === 'planner'
                    ? 'bg-indigo-50 text-indigo-800 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Ementa</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mealsSubTab === 'recipes'}
                onClick={() => selectMealsSubTab('recipes')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                  mealsSubTab === 'recipes'
                    ? 'bg-amber-50 text-amber-800 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <ChefHat className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Receitas ({data.recipes.length})</span>
              </button>
            </div>

            {mealsSubTab === 'recipes' ? (
              <RecipesView
                recipes={data.recipes}
                stockLots={data.stockLots}
                catalogItems={data.catalogItems}
                locations={data.locations}
                supermarketSections={data.supermarketSections}
                members={data.members}
                shoppingItems={data.shoppingItems}
                expiryWarningDays={data.settings.expiryWarningDays}
                deviceId={data.settings.deviceId}
                uiDensity={uiDensity}
                openCreateInitially={openRecipeCreate}
                onConsumeCreateInitial={() => setOpenRecipeCreate(false)}
              />
            ) : (
              <PlannerView
                mealPlan={data.mealPlan}
                recipes={data.recipes}
                stockLots={data.stockLots}
                catalogItems={data.catalogItems}
                locations={data.locations}
                members={data.members}
                shoppingItems={data.shoppingItems}
                expiryWarningDays={data.settings.expiryWarningDays}
                deviceId={data.settings.deviceId}
                weekStart={plannerWeekStart}
                onWeekStartChange={setPlannerWeekStart}
              />
            )}
          </div>
        )}

        {activeTab === 'shopping' && (
          <ShoppingView
            shoppingItems={data.shoppingItems}
            catalogItems={data.catalogItems}
            stockLots={data.stockLots}
            locations={data.locations}
            supermarketSections={data.supermarketSections}
            financeCategories={data.financeCategories}
            expiryWarningDays={data.settings.expiryWarningDays}
            deviceId={data.settings.deviceId}
            uiDensity={uiDensity}
          />
        )}

        {activeTab === 'finances' && (
          <FinancesView
            categories={data.financeCategories}
            recurringRules={data.financeRecurring}
            transactions={data.financeTransactions}
            members={data.members}
            deviceId={data.settings.deviceId}
            uiDensity={uiDensity}
            activeMonth={financeMonth}
            onActiveMonthChange={setFinanceMonth}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={data.settings}
            members={data.members}
            locations={data.locations}
            supermarketSections={data.supermarketSections}
            catalogItems={data.catalogItems}
            shoppingItems={data.shoppingItems}
            financeCategories={data.financeCategories}
            financeRecurring={data.financeRecurring}
            financeTransactions={data.financeTransactions}
            uiDensity={uiDensity}
            onChangeUiDensity={handleChangeUiDensity}
            onSyncNow={handleSyncNow}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden"
        aria-label="Navegação inferior"
      >
        <div className="grid grid-cols-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                  active ? 'text-teal-700' : 'text-slate-500'
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {item.badge !== undefined && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-700 px-1 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default App;
