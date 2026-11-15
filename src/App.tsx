import { useEffect, useState } from 'react';
import {
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
} from 'lucide-react';
import { useFamilyData } from './hooks/useFamilyData';
import { PlannerView } from './modules/planner/PlannerView';
import { RecipesView } from './modules/recipes/RecipesView';
import { SettingsView } from './modules/settings/SettingsView';
import { ShoppingView } from './modules/shopping/ShoppingView';
import { StockView } from './modules/stock/StockView';
import { TodayView } from './modules/today/TodayView';
import { useAutoSync } from './sync/useAutoSync';
import type { AppTab } from './types/domain';

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
  const [openRecipeCreate, setOpenRecipeCreate] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [headerNotice, setHeaderNotice] = useState<{ text: string; isError: boolean } | null>(null);

  const autoSync = useAutoSync(data.settings);

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

  if (!data.ready || !data.settings) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">
        A preparar a base de dados local...
      </div>
    );
  }

  const pendingShoppingCount = data.shoppingItems.filter((s) => !s.checked).length;

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
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => navigate('today')}
            className="flex items-center gap-2 text-left"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-700 text-sm font-black text-white">
              GF
            </span>
            <div>
              <span className="block text-sm font-bold leading-tight text-slate-900">
                Gestão Familiar
              </span>
              <span className="block text-[11px] text-slate-500">Casa, Stock &amp; Receitas</span>
            </div>
          </button>

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
            members={data.members}
            onNavigate={navigate}
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
            catalogItems={data.catalogItems}
            stockLots={data.stockLots}
            shoppingItems={data.shoppingItems}
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
            openCreateInitially={openRecipeCreate}
            onConsumeCreateInitial={() => setOpenRecipeCreate(false)}
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
