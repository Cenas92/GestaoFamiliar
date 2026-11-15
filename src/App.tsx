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
  WifiOff,
  X,
} from 'lucide-react';
import { APP_INFO } from './appInfo';
import { useFamilyData } from './hooks/useFamilyData';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { PlannerView } from './modules/planner/PlannerView';
import { evaluateRecipeMatch } from './modules/recipes/matchingEngine';
import { RecipesView } from './modules/recipes/RecipesView';
import { SettingsView } from './modules/settings/SettingsView';
import { ShoppingView } from './modules/shopping/ShoppingView';
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

const HASH_TO_TAB: Record<string, AppTab> = {
  '#today': 'today',
  '#stock': 'stock',
  '#recipes': 'recipes',
  '#planner': 'planner',
  '#shopping': 'shopping',
  '#settings': 'settings',
};

function readInitialTab(): AppTab {
  return HASH_TO_TAB[window.location.hash] ?? 'today';
}

export function App() {
  const data = useFamilyData();
  const [activeTab, setActiveTab] = useState<AppTab>(readInitialTab);
  const [plannerWeekStart, setPlannerWeekStart] = useState(() => getWeekStartMonday());
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [headerNotice, setHeaderNotice] = useState<{ text: string; isError: boolean } | null>(null);
  const [dismissedAuthBanner, setDismissedAuthBanner] = useState(false);

  const autoSync = useAutoSync(data.settings);

  useEffect(() => {
    if (autoSync.phase === 'ok') {
      setDismissedAuthBanner(false);
    }
  }, [autoSync.phase]);

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
    const onHashChange = () => setActiveTab(readInitialTab());

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
    setActiveTab(tab);
    window.location.hash = `#${tab}`;
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
  const readyRecipesCount = useMemo(() => {
    if (!data.ready || !data.settings || activeTab !== 'recipes') return 0;
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
          subtitle: formatDatePt(today),
          Icon: Home,
          badgeClass: 'bg-teal-100 text-teal-700',
        };
      case 'stock': {
        const count = data.stockLots.length;
        return {
          title: 'Stock da Casa',
          subtitle: `${count} ${count === 1 ? 'produto em casa' : 'produtos em casa'}`,
          Icon: Package,
          badgeClass: 'bg-cyan-100 text-cyan-700',
        };
      }
      case 'recipes': {
        const count = data.recipes.length;
        return {
          title: 'As Nossas Receitas',
          subtitle: `${count} ${count === 1 ? 'receita' : 'receitas'} · ${readyRecipesCount} ${
            readyRecipesCount === 1 ? 'pronta' : 'prontas'
          }`,
          Icon: ChefHat,
          badgeClass: 'bg-amber-100 text-amber-700',
        };
      }
      case 'planner': {
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
      case 'settings':
        return {
          title: 'Definições e Família',
          subtitle: 'Família, locais, catálogo e sincronização',
          Icon: Settings,
          badgeClass: 'bg-slate-200 text-slate-700',
        };
    }
  })();
  const HeaderIcon = headerMeta.Icon;

  const navItems: { id: AppTab; label: string; icon: typeof Home; badge?: number }[] = [
    { id: 'today', label: 'Hoje', icon: Home },
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'recipes', label: 'Receitas', icon: ChefHat },
    { id: 'planner', label: 'Ementa', icon: CalendarDays },
    {
      id: 'shopping',
      label: 'Compras',
      icon: ShoppingCart,
      badge: pendingShoppingCount > 0 ? pendingShoppingCount : undefined,
    },
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

        {isOnline &&
          autoSync.isConfigured &&
          autoSync.phase === 'needs_auth' &&
          !dismissedAuthBanner &&
          !headerNotice && (
            <div className="flex items-center justify-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
              <button
                type="button"
                onClick={handleHeaderSyncClick}
                className="inline-flex items-center gap-1.5 text-left underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
              >
                <CloudAlert className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                <span>Sessão Google por atualizar — toca aqui para sincronizar a conta.</span>
              </button>
              <button
                type="button"
                onClick={() => setDismissedAuthBanner(true)}
                aria-label="Fechar aviso"
                className="rounded p-0.5 text-amber-700 hover:bg-amber-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

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
            members={data.members}
            onNavigate={navigate}
          />
        )}

        {activeTab === 'stock' && (
          <StockView
            locations={data.locations}
            catalogItems={data.catalogItems}
            stockLots={data.stockLots}
            shoppingItems={data.shoppingItems}
            recipes={data.recipes}
            expiryWarningDays={data.settings.expiryWarningDays}
            deviceId={data.settings.deviceId}
          />
        )}

        {activeTab === 'recipes' && (
          <RecipesView
            recipes={data.recipes}
            stockLots={data.stockLots}
            catalogItems={data.catalogItems}
            locations={data.locations}
            members={data.members}
            shoppingItems={data.shoppingItems}
            expiryWarningDays={data.settings.expiryWarningDays}
            deviceId={data.settings.deviceId}
          />
        )}

        {activeTab === 'planner' && (
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

        {activeTab === 'shopping' && (
          <ShoppingView
            shoppingItems={data.shoppingItems}
            catalogItems={data.catalogItems}
            stockLots={data.stockLots}
            locations={data.locations}
            expiryWarningDays={data.settings.expiryWarningDays}
            deviceId={data.settings.deviceId}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={data.settings}
            members={data.members}
            locations={data.locations}
            catalogItems={data.catalogItems}
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
