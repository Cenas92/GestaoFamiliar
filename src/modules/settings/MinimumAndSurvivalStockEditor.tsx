import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  Plus,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  X,
} from 'lucide-react';
import { SearchInput } from '../../components/SearchInput';
import { UNITS } from '../../constants/labels';
import { db } from '../../db/database';
import type {
  CatalogItem,
  ShoppingItem,
  StockLot,
  StorageLocation,
  Unit,
} from '../../types/domain';
import { createSyncMetadata, nowIso } from '../../utils/id';
import {
  formatDatePt,
  formatQuantity,
  normalizeText,
  todayDateString,
} from '../../utils/units';
import { buildShoppingItem } from '../planner/plannerService';
import {
  SURVIVAL_KIT_PRESETS,
  summarizeCatalogStock,
  summarizeSurvivalStock,
  type SurvivalKitPreset,
} from '../stock/stockService';

type EditorTab = 'daily' | 'survival';

interface MinimumAndSurvivalStockEditorProps {
  catalogItems: CatalogItem[];
  stockLots: StockLot[];
  locations: StorageLocation[];
  shoppingItems: ShoppingItem[];
  expiryWarningDays: number;
  deviceId: string;
  onNotify?: (msg: string) => void;
}

function parsePositiveNumberOrNull(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100) / 100;
}

export function MinimumAndSurvivalStockEditor({
  catalogItems,
  stockLots,
  locations,
  shoppingItems,
  expiryWarningDays,
  deviceId,
  onNotify,
}: MinimumAndSurvivalStockEditorProps) {
  const today = todayDateString();
  const [activeTab, setActiveTab] = useState<EditorTab>('daily');
  const [dailySearch, setDailySearch] = useState('');
  const [onlyConfiguredDaily, setOnlyConfiguredDaily] = useState(true);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  // Add to survival kit form
  const [survivalSearch, setSurvivalSearch] = useState('');
  const [selectedSurvivalCatId, setSelectedSurvivalCatId] = useState('');
  const [newSurvivalQty, setNewSurvivalQty] = useState('4');
  const [newSurvivalUnit, setNewSurvivalUnit] = useState<Unit>('un');

  const catalogSummaries = useMemo(() => {
    const map = new Map<string, ReturnType<typeof summarizeCatalogStock>>();
    for (const cat of catalogItems) {
      map.set(cat.id, summarizeCatalogStock(cat, stockLots, expiryWarningDays, today));
    }
    return map;
  }, [catalogItems, stockLots, expiryWarningDays, today]);

  const configuredDailyCount = useMemo(
    () => catalogItems.filter((c) => c.minStockQty !== null && c.minStockQty > 0).length,
    [catalogItems],
  );

  const lowDailyItems = useMemo(() => {
    return catalogItems.filter((cat) => {
      if (cat.minStockQty === null || cat.minStockQty <= 0) return false;
      return catalogSummaries.get(cat.id)?.isLowStock ?? false;
    });
  }, [catalogItems, catalogSummaries]);

  const visibleDailyItems = useMemo(() => {
    const q = normalizeText(dailySearch);
    const shouldFilterOnlyConfigured = onlyConfiguredDaily && !q && configuredDailyCount > 0;
    return catalogItems
      .filter((cat) => {
        if (shouldFilterOnlyConfigured && !(cat.minStockQty !== null && cat.minStockQty > 0)) {
          return false;
        }
        if (q) {
          const matchesName = normalizeText(cat.name).includes(q);
          const matchesAlias = cat.aliases.some((a) => normalizeText(a).includes(q));
          if (!matchesName && !matchesAlias) return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => {
        const aLow = catalogSummaries.get(a.id)?.isLowStock ? 0 : 1;
        const bLow = catalogSummaries.get(b.id)?.isLowStock ? 0 : 1;
        if (aLow !== bLow) return aLow - bLow;
        const aHas = a.minStockQty && a.minStockQty > 0 ? 0 : 1;
        const bHas = b.minStockQty && b.minStockQty > 0 ? 0 : 1;
        if (aHas !== bHas) return aHas - bHas;
        return a.name.localeCompare(b.name, 'pt-PT');
      });
  }, [catalogItems, dailySearch, onlyConfiguredDaily, configuredDailyCount, catalogSummaries]);

  const survivalOverview = useMemo(
    () => summarizeSurvivalStock(catalogItems, stockLots, expiryWarningDays, today),
    [catalogItems, stockLots, expiryWarningDays, today],
  );

  const survivalCatalogCandidates = useMemo(() => {
    const q = normalizeText(survivalSearch);
    return catalogItems
      .filter((c) => !(c.survivalTargetQty && c.survivalTargetQty > 0))
      .filter((c) => {
        if (!q) return true;
        return (
          normalizeText(c.name).includes(q) ||
          c.aliases.some((a) => normalizeText(a).includes(q))
        );
      })
      .slice(0, 40);
  }, [catalogItems, survivalSearch]);

  const availablePresets = useMemo(() => {
    return SURVIVAL_KIT_PRESETS.filter((preset) => {
      const existing = catalogItems.find(
        (c) =>
          (preset.matchCatalogId && c.id === preset.matchCatalogId) ||
          normalizeText(c.name) === normalizeText(preset.name),
      );
      return !(existing?.survivalTargetQty && existing.survivalTargetQty > 0);
    });
  }, [catalogItems]);

  const getDraft = (key: string, currentVal: number | null | undefined): string => {
    if (key in draftValues) return draftValues[key];
    return currentVal !== null && currentVal !== undefined && currentVal > 0
      ? String(currentVal).replace('.', ',')
      : '';
  };

  const setDraft = (key: string, val: string) => {
    setDraftValues((prev) => ({ ...prev, [key]: val }));
  };

  const clearDraft = (key: string) => {
    setDraftValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const saveDailyMin = async (cat: CatalogItem, rawValue: string) => {
    const nextMin = parsePositiveNumberOrNull(rawValue);
    clearDraft(`daily:${cat.id}`);
    if (nextMin === (cat.minStockQty ?? null)) return;
    await db.catalogItems.put({
      ...cat,
      minStockQty: nextMin,
      updatedAt: nowIso(),
      lastModifiedBy: deviceId,
    });
    onNotify?.(
      nextMin !== null
        ? `Stock mínimo de "${cat.name}" definido para ${formatQuantity(nextMin, cat.defaultUnit)}.`
        : `Stock mínimo de "${cat.name}" removido.`,
    );
  };

  const saveSurvivalTarget = async (cat: CatalogItem, rawValue: string) => {
    const nextTarget = parsePositiveNumberOrNull(rawValue);
    clearDraft(`surv:${cat.id}`);
    if (nextTarget === (cat.survivalTargetQty ?? null)) return;
    await db.catalogItems.put({
      ...cat,
      survivalTargetQty: nextTarget,
      updatedAt: nowIso(),
      lastModifiedBy: deviceId,
    });
    onNotify?.(
      nextTarget !== null
        ? `Alvo de sobrevivência de "${cat.name}" atualizado para ${formatQuantity(nextTarget, cat.defaultUnit)}.`
        : `"${cat.name}" removido do Stock de Sobrevivência.`,
    );
  };

  const resolveLocationId = (preferredType: SurvivalKitPreset['preferredLocationType']): string => {
    const match = locations.find((l) => l.locationType === preferredType);
    return match?.id ?? locations[0]?.id ?? 'starter-loc-pantry';
  };

  const handleApplySurvivalPreset = async (preset: SurvivalKitPreset) => {
    const existing = catalogItems.find(
      (c) =>
        (preset.matchCatalogId && c.id === preset.matchCatalogId) ||
        normalizeText(c.name) === normalizeText(preset.name),
    );
    const now = nowIso();
    if (existing) {
      await db.catalogItems.put({
        ...existing,
        survivalTargetQty: preset.targetQty,
        updatedAt: now,
        lastModifiedBy: deviceId,
      });
    } else {
      const created: CatalogItem = {
        ...createSyncMetadata(deviceId),
        name: preset.name,
        aliases: [],
        category: preset.category,
        trackingMode: 'exact',
        defaultUnit: preset.unit,
        defaultLocationId: resolveLocationId(preset.preferredLocationType),
        minStockQty: null,
        survivalTargetQty: preset.targetQty,
        supermarketSection: preset.supermarketSection,
      };
      await db.catalogItems.put(created);
    }
    onNotify?.(`"${preset.name}" adicionado ao Stock de Sobrevivência.`);
  };

  const handleAddSurvivalItem = async (e: FormEvent) => {
    e.preventDefault();
    const qty = parsePositiveNumberOrNull(newSurvivalQty);
    if (!qty) {
      onNotify?.('Indica uma quantidade alvo maior que 0.');
      return;
    }

    const now = nowIso();
    if (selectedSurvivalCatId) {
      const existing = catalogItems.find((c) => c.id === selectedSurvivalCatId);
      if (existing) {
        await db.catalogItems.put({
          ...existing,
          survivalTargetQty: qty,
          updatedAt: now,
          lastModifiedBy: deviceId,
        });
        setSelectedSurvivalCatId('');
        setSurvivalSearch('');
        onNotify?.(`"${existing.name}" adicionado ao Stock de Sobrevivência.`);
        return;
      }
    }

    const customName = survivalSearch.trim();
    if (!customName) {
      onNotify?.('Escolhe um produto da lista ou escreve um nome novo.');
      return;
    }

    const byName = catalogItems.find((c) => normalizeText(c.name) === normalizeText(customName));
    if (byName) {
      await db.catalogItems.put({
        ...byName,
        survivalTargetQty: qty,
        updatedAt: now,
        lastModifiedBy: deviceId,
      });
    } else {
      const created: CatalogItem = {
        ...createSyncMetadata(deviceId),
        name: customName,
        aliases: [],
        category: 'food',
        trackingMode: 'exact',
        defaultUnit: newSurvivalUnit,
        defaultLocationId: resolveLocationId('pantry'),
        minStockQty: null,
        survivalTargetQty: qty,
        supermarketSection: 'pantry',
      };
      await db.catalogItems.put(created);
    }
    setSurvivalSearch('');
    setSelectedSurvivalCatId('');
    onNotify?.(`"${customName}" adicionado ao Stock de Sobrevivência.`);
  };

  const handleSendMissingToShopping = async (mode: 'daily' | 'survival') => {
    const activeShoppingIds = new Set(
      shoppingItems.filter((s) => !s.checked && s.catalogItemId).map((s) => s.catalogItemId!),
    );

    const toAdd: ShoppingItem[] = [];
    if (mode === 'survival') {
      for (const item of survivalOverview.missingItems) {
        if (activeShoppingIds.has(item.catalogItem.id)) continue;
        toAdd.push(
          buildShoppingItem(
            {
              catalogItemId: item.catalogItem.id,
              label: item.catalogItem.name,
              quantity: Math.max(1, item.missingQty),
              unit: item.catalogItem.defaultUnit,
              packageSize: item.catalogItem.defaultPackageSize ?? null,
              packageUnit: item.catalogItem.defaultPackageUnit ?? null,
              section: item.catalogItem.supermarketSection,
              targetLocationId: item.catalogItem.defaultLocationId,
              source: 'low_stock',
              notes: 'Stock de sobrevivência',
            },
            deviceId,
          ),
        );
      }
    } else {
      for (const cat of lowDailyItems) {
        if (activeShoppingIds.has(cat.id)) continue;
        const summary = catalogSummaries.get(cat.id);
        const missing =
          cat.trackingMode === 'qualitative'
            ? 1
            : Math.max(
                1,
                Math.round(((cat.minStockQty ?? 1) - (summary?.totalExactInDefaultUnit ?? 0)) * 100) /
                  100,
              );
        toAdd.push(
          buildShoppingItem(
            {
              catalogItemId: cat.id,
              label: cat.name,
              quantity: missing,
              unit: cat.trackingMode === 'qualitative' ? 'un' : cat.defaultUnit,
              packageSize: cat.defaultPackageSize ?? null,
              packageUnit: cat.defaultPackageUnit ?? null,
              section: cat.supermarketSection,
              targetLocationId: cat.defaultLocationId,
              source: 'low_stock',
              notes: 'Repor stock mínimo',
            },
            deviceId,
          ),
        );
      }
    }

    if (toAdd.length === 0) {
      onNotify?.('Os itens em falta já estão todos na Lista de Compras.');
      return;
    }

    await db.shoppingItems.bulkPut(toAdd);
    onNotify?.(
      `${toAdd.length} ${toAdd.length === 1 ? 'item enviado' : 'itens enviados'} para a Lista de Compras.`,
    );
  };

  return (
    <div className="space-y-3">
      {/* Seletor segmentado: Mínimos Diários | Stock de Sobrevivência */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'daily'}
          onClick={() => setActiveTab('daily')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
            activeTab === 'daily'
              ? 'bg-white text-teal-800 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Mínimos Diários ({configuredDailyCount})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'survival'}
          onClick={() => setActiveTab('survival')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
            activeTab === 'survival'
              ? 'bg-white text-amber-800 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Sobrevivência ({survivalOverview.totalCount})</span>
        </button>
      </div>

      {/* ================= TAB 1: MÍNIMOS DIÁRIOS ================= */}
      {activeTab === 'daily' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={dailySearch}
              onChange={setDailySearch}
              placeholder="Pesquisar produto para definir mínimo..."
              size="sm"
            />
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setOnlyConfiguredDaily(true)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  onlyConfiguredDaily
                    ? 'bg-teal-700 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Só configurados ({configuredDailyCount})
              </button>
              <button
                type="button"
                onClick={() => setOnlyConfiguredDaily(false)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  !onlyConfiguredDaily
                    ? 'bg-teal-700 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Todos ({catalogItems.length})
              </button>
            </div>
          </div>

          {lowDailyItems.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
                {lowDailyItems.length}{' '}
                {lowDailyItems.length === 1
                  ? 'produto abaixo do mínimo'
                  : 'produtos abaixo do mínimo'}
              </span>
              <button
                type="button"
                onClick={() => handleSendMissingToShopping('daily')}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-800"
              >
                <ShoppingCart className="h-3 w-3" aria-hidden="true" />
                Enviar em falta p/ Compras
              </button>
            </div>
          )}

          {visibleDailyItems.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center text-xs text-slate-500">
              {configuredDailyCount === 0 && onlyConfiguredDaily
                ? 'Ainda não tens stocks mínimos definidos. Muda para «Todos» ou pesquisa um produto acima.'
                : 'Nenhum produto encontrado.'}
            </p>
          ) : (
            <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
              {visibleDailyItems.map((cat) => {
                const summary = catalogSummaries.get(cat.id);
                const draftKey = `daily:${cat.id}`;
                const value = getDraft(draftKey, cat.minStockQty);
                const hasMin = cat.minStockQty !== null && cat.minStockQty > 0;
                const isLow = hasMin && Boolean(summary?.isLowStock);

                return (
                  <div
                    key={cat.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 ${
                      isLow ? 'bg-amber-50/35' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">{cat.name}</p>
                      <p
                        className={`text-[10px] font-medium ${
                          isLow ? 'text-amber-700' : 'text-slate-400'
                        }`}
                      >
                        Em casa:{' '}
                        {cat.trackingMode === 'qualitative'
                          ? summary?.bestQualitativeLevel === 'full'
                            ? 'Tem'
                            : summary?.bestQualitativeLevel === 'low'
                              ? 'Pouco'
                              : 'Acabou'
                          : formatQuantity(
                              summary?.totalExactInDefaultUnit ?? 0,
                              cat.defaultUnit,
                            )}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={value}
                        onChange={(e) => setDraft(draftKey, e.target.value)}
                        onBlur={() => void saveDailyMin(cat, value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void saveDailyMin(cat, value);
                          }
                        }}
                        placeholder="—"
                        aria-label={`Stock mínimo de ${cat.name}`}
                        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs font-semibold focus:border-teal-500 focus:outline-none"
                      />
                      <span className="w-7 text-[11px] text-slate-400">{cat.defaultUnit}</span>
                      {hasMin && (
                        <button
                          type="button"
                          onClick={() => void saveDailyMin(cat, '')}
                          aria-label={`Remover mínimo de ${cat.name}`}
                          className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: STOCK DE SOBREVIVÊNCIA ================= */}
      {activeTab === 'survival' && (
        <div className="space-y-3">
          {/* Cartão de Prontidão */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Prontidão da Reserva Familiar:{' '}
                  <span
                    className={
                      survivalOverview.overallPercent >= 80
                        ? 'text-emerald-700'
                        : survivalOverview.overallPercent >= 40
                          ? 'text-amber-700'
                          : 'text-rose-700'
                    }
                  >
                    {survivalOverview.overallPercent}%
                  </span>
                </p>
                <p className="text-[11px] text-slate-500">
                  {survivalOverview.totalCount === 0
                    ? 'Ainda sem itens no Stock de Sobrevivência.'
                    : `${survivalOverview.metCount} de ${survivalOverview.totalCount} itens completos (conta todo o stock em casa).`}
                </p>
              </div>
              {survivalOverview.missingItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleSendMissingToShopping('survival')}
                  className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                  Enviar em falta ({survivalOverview.missingItems.length})
                </button>
              )}
            </div>

            {survivalOverview.totalCount > 0 && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    survivalOverview.overallPercent >= 80
                      ? 'bg-emerald-500'
                      : survivalOverview.overallPercent >= 40
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.max(4, survivalOverview.overallPercent)}%` }}
                />
              </div>
            )}
          </div>

          {/* Lista de itens do Kit de Sobrevivência */}
          {survivalOverview.items.length > 0 && (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {survivalOverview.items.map((item) => {
                const cat = item.catalogItem;
                const draftKey = `surv:${cat.id}`;
                const value = getDraft(draftKey, item.targetQty);
                return (
                  <div key={cat.id} className="space-y-1.5 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {item.isMet ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                          )}
                          <span className="truncate text-xs font-semibold text-slate-900">
                            {cat.name}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Em casa:{' '}
                          <strong className="text-slate-700">
                            {formatQuantity(item.currentQty, cat.defaultUnit)}
                          </strong>
                          {!item.isMet && (
                            <>
                              {' '}
                              · Falta:{' '}
                              <strong className="text-amber-700">
                                {formatQuantity(item.missingQty, cat.defaultUnit)}
                              </strong>
                            </>
                          )}
                          {item.earliestExpiry && (
                            <>
                              {' '}
                              ·{' '}
                              <span
                                className={
                                  item.hasExpired
                                    ? 'font-semibold text-rose-700'
                                    : item.hasExpiringSoon
                                      ? 'font-semibold text-amber-700'
                                      : ''
                                }
                              >
                                Val: {formatDatePt(item.earliestExpiry)}
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={value}
                          onChange={(e) => setDraft(draftKey, e.target.value)}
                          onBlur={() => void saveSurvivalTarget(cat, value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void saveSurvivalTarget(cat, value);
                            }
                          }}
                          aria-label={`Alvo de sobrevivência de ${cat.name}`}
                          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs font-semibold focus:border-teal-500 focus:outline-none"
                        />
                        <span className="w-7 text-[11px] text-slate-400">{cat.defaultUnit}</span>
                        <button
                          type="button"
                          onClick={() => void saveSurvivalTarget(cat, '')}
                          aria-label={`Remover ${cat.name} do stock de sobrevivência`}
                          className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          item.isMet ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.max(4, item.percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Adicionar produto personalizado ao Stock de Sobrevivência */}
          <form onSubmit={handleAddSurvivalItem} className="space-y-2 rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">
              Adicionar item ao Stock de Sobrevivência
            </p>
            <div className="grid gap-2 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={survivalSearch}
                  onChange={(e) => {
                    setSurvivalSearch(e.target.value);
                    setSelectedSurvivalCatId('');
                  }}
                  placeholder="Pesquisar ou escrever produto novo..."
                  aria-label="Produto para stock de sobrevivência"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none"
                />
                {survivalSearch.trim().length > 0 &&
                  !selectedSurvivalCatId &&
                  survivalCatalogCandidates.length > 0 && (
                    <div className="mt-1 max-h-28 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                      {survivalCatalogCandidates.slice(0, 6).map((cand) => (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() => {
                            setSelectedSurvivalCatId(cand.id);
                            setSurvivalSearch(cand.name);
                            setNewSurvivalUnit(cand.defaultUnit);
                          }}
                          className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs hover:bg-teal-50"
                        >
                          <span className="truncate font-medium text-slate-800">{cand.name}</span>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {cand.defaultUnit}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={newSurvivalQty}
                  onChange={(e) => setNewSurvivalQty(e.target.value)}
                  placeholder="Alvo"
                  aria-label="Quantidade alvo de sobrevivência"
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold"
                />
                <select
                  value={newSurvivalUnit}
                  disabled={Boolean(selectedSurvivalCatId)}
                  onChange={(e) => setNewSurvivalUnit(e.target.value as Unit)}
                  aria-label="Unidade do item de sobrevivência"
                  className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:opacity-60"
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.value}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Adicionar
              </button>
            </div>
          </form>

          {/* Sugestões rápidas de Kit de Sobrevivência (72h) */}
          {availablePresets.length > 0 && (
            <div className="space-y-1.5">
              <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                Sugestões rápidas de Kit de Sobrevivência (1 toque)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availablePresets.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => void handleApplySurvivalPreset(preset)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-teal-400 hover:bg-teal-50 hover:text-teal-900"
                  >
                    <Plus className="h-3 w-3 text-teal-700" aria-hidden="true" />
                    <span>{preset.name}</span>
                    <span className="text-[10px] text-slate-400">
                      ({formatQuantity(preset.targetQty, preset.unit)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
