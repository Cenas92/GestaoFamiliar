import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  PackageCheck,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { CatalogPicker } from '../../components/CatalogPicker';
import { Modal } from '../../components/Modal';
import {
  SUPERMARKET_SECTION_LABELS,
  SUPERMARKET_SECTION_ORDER,
  UNITS,
} from '../../constants/labels';
import { db } from '../../db/database';
import type {
  CatalogItem,
  ShoppingItem,
  StockLot,
  StorageLocation,
  SupermarketSection,
  Unit,
} from '../../types/domain';
import { nowIso } from '../../utils/id';
import { formatQuantity, todayDateString } from '../../utils/units';
import { buildShoppingItem } from '../planner/plannerService';
import { buildNewStockLot, summarizeCatalogStock } from '../stock/stockService';

interface ShoppingViewProps {
  shoppingItems: ShoppingItem[];
  catalogItems: CatalogItem[];
  stockLots: StockLot[];
  locations: StorageLocation[];
  expiryWarningDays: number;
  deviceId: string;
}

interface PutAwayRow {
  shoppingItem: ShoppingItem;
  locationId: string;
  quantity: number;
  unit: Unit;
  expiresAt: string;
  include: boolean;
}

export function ShoppingView({
  shoppingItems,
  catalogItems,
  stockLots,
  locations,
  expiryWarningDays,
  deviceId,
}: ShoppingViewProps) {
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogItem | null>(null);
  const [freeText, setFreeText] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState<Unit>('un');
  const [section, setSection] = useState<SupermarketSection>('pantry');
  const [showCatalogInput, setShowCatalogInput] = useState(true);

  const [putAwayOpen, setPutAwayOpen] = useState(false);
  const [putAwayRows, setPutAwayRows] = useState<PutAwayRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const today = todayDateString();
  const catalogById = useMemo(
    () => new Map(catalogItems.map((c) => [c.id, c])),
    [catalogItems],
  );

  const lowStockMissing = useMemo(() => {
    const queuedIds = new Set(
      shoppingItems.filter((s) => !s.checked && s.catalogItemId).map((s) => s.catalogItemId!),
    );
    return catalogItems
      .map((cat) => summarizeCatalogStock(cat, stockLots, expiryWarningDays, today))
      .filter((s) => s.isLowStock && !queuedIds.has(s.catalogItem.id));
  }, [catalogItems, stockLots, shoppingItems, expiryWarningDays, today]);

  const checkedItems = useMemo(
    () => shoppingItems.filter((s) => s.checked),
    [shoppingItems],
  );
  const uncheckedCount = shoppingItems.length - checkedItems.length;

  const groupedBySection = useMemo(() => {
    const groups = new Map<SupermarketSection, ShoppingItem[]>();
    for (const sec of SUPERMARKET_SECTION_ORDER) {
      groups.set(sec, []);
    }
    for (const item of shoppingItems) {
      const list = groups.get(item.section) ?? [];
      list.push(item);
      groups.set(item.section, list);
    }
    for (const [, list] of groups) {
      list.sort((a, b) => Number(a.checked) - Number(b.checked));
    }
    return groups;
  }, [shoppingItems]);

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = selectedCatalog ? selectedCatalog.name : freeText.trim();
    if (!label) return;

    const item = buildShoppingItem(
      {
        catalogItemId: selectedCatalog?.id ?? null,
        label,
        quantity: Number(qty.replace(',', '.')) || 1,
        unit,
        section: selectedCatalog ? selectedCatalog.supermarketSection : section,
        targetLocationId: selectedCatalog?.defaultLocationId ?? locations[0]?.id ?? null,
        source: 'manual',
      },
      deviceId,
    );
    await db.shoppingItems.put(item);
    setSelectedCatalog(null);
    setFreeText('');
    setQty('1');
  };

  const handleImportLowStock = async () => {
    if (lowStockMissing.length === 0) return;
    const items = lowStockMissing.map((s) =>
      buildShoppingItem(
        {
          catalogItemId: s.catalogItem.id,
          label: s.catalogItem.name,
          quantity:
            s.catalogItem.minStockQty && s.catalogItem.trackingMode === 'exact'
              ? Math.max(1, s.catalogItem.minStockQty - s.totalExactInDefaultUnit)
              : 1,
          unit:
            s.catalogItem.trackingMode === 'qualitative'
              ? 'un'
              : s.catalogItem.defaultUnit,
          section: s.catalogItem.supermarketSection,
          targetLocationId: s.catalogItem.defaultLocationId,
          source: 'low_stock',
        },
        deviceId,
      ),
    );
    await db.shoppingItems.bulkPut(items);
    showNotice(`${items.length} item(ns) com stock baixo adicionado(s).`);
  };

  const toggleChecked = async (item: ShoppingItem) => {
    await db.shoppingItems.put({
      ...item,
      checked: !item.checked,
      updatedAt: nowIso(),
      lastModifiedBy: deviceId,
    });
  };

  const deleteItem = async (item: ShoppingItem) => {
    const now = nowIso();
    await db.shoppingItems.put({
      ...item,
      deletedAt: now,
      updatedAt: now,
      lastModifiedBy: deviceId,
    });
  };

  const openPutAwayModal = () => {
    const rows: PutAwayRow[] = checkedItems.map((item) => {
      const cat = item.catalogItemId ? catalogById.get(item.catalogItemId) : undefined;
      return {
        shoppingItem: item,
        locationId: item.targetLocationId || cat?.defaultLocationId || locations[0]?.id || '',
        quantity: item.quantity ?? 1,
        unit: item.unit ?? cat?.defaultUnit ?? 'un',
        expiresAt: '',
        include: Boolean(item.catalogItemId),
      };
    });
    setPutAwayRows(rows);
    setPutAwayOpen(true);
  };

  const handleConfirmPutAway = async () => {
    const now = nowIso();
    const lotsToCreate: StockLot[] = [];
    const itemsToDelete: ShoppingItem[] = [];

    for (const row of putAwayRows) {
      itemsToDelete.push({
        ...row.shoppingItem,
        deletedAt: now,
        updatedAt: now,
        lastModifiedBy: deviceId,
      });

      if (!row.include || !row.locationId) continue;
      const cat = row.shoppingItem.catalogItemId
        ? catalogById.get(row.shoppingItem.catalogItemId)
        : undefined;
      if (!cat) continue;

      lotsToCreate.push(
        buildNewStockLot(
          {
            catalogItemId: cat.id,
            productLabel: row.shoppingItem.label,
            locationId: row.locationId,
            quantity: cat.trackingMode === 'qualitative' ? null : row.quantity,
            unit: cat.trackingMode === 'qualitative' ? null : row.unit,
            qualitativeLevel: cat.trackingMode === 'qualitative' ? 'full' : null,
            expiresAt: row.expiresAt || null,
          },
          deviceId,
        ),
      );
    }

    await db.transaction('rw', [db.stockLots, db.shoppingItems], async () => {
      if (lotsToCreate.length) await db.stockLots.bulkPut(lotsToCreate);
      if (itemsToDelete.length) await db.shoppingItems.bulkPut(itemsToDelete);
    });

    setPutAwayOpen(false);
    showNotice(`${lotsToCreate.length} produto(s) arrumado(s) no stock!`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Lista de Compras</h1>
          <p className="text-xs text-slate-500">
            {uncheckedCount} por comprar · {checkedItems.length} no carrinho
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {lowStockMissing.length > 0 && (
            <button
              type="button"
              onClick={handleImportLowStock}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Importar stock baixo ({lowStockMissing.length})
            </button>
          )}
          {checkedItems.length > 0 && (
            <button
              type="button"
              onClick={openPutAwayModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-800"
            >
              <PackageCheck className="h-4 w-4" />
              Arrumar no Stock ({checkedItems.length})
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="rounded-xl bg-teal-900 px-3.5 py-2 text-xs font-medium text-white">
          {toast}
        </div>
      )}

      {/* Quick Add form */}
      <form
        onSubmit={handleAdd}
        className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Adicionar à lista
          </span>
          <button
            type="button"
            onClick={() => {
              setShowCatalogInput(!showCatalogInput);
              setSelectedCatalog(null);
            }}
            className="text-xs font-medium text-teal-700 hover:underline"
          >
            {showCatalogInput ? 'Escrever texto livre' : 'Usar catálogo'}
          </button>
        </div>

        {showCatalogInput ? (
          <CatalogPicker
            key={selectedCatalog?.id ?? 'empty'}
            catalogItems={catalogItems}
            locations={locations}
            deviceId={deviceId}
            selectedId={selectedCatalog?.id ?? null}
            onSelect={(cat) => {
              setSelectedCatalog(cat);
              setUnit(cat.trackingMode === 'qualitative' ? 'un' : cat.defaultUnit);
              setSection(cat.supermarketSection);
            }}
            placeholder="Procurar produto para comprar..."
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Ex: Pilhas AA, Guardanapos..."
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as SupermarketSection)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {SUPERMARKET_SECTION_ORDER.map((s) => (
                <option key={s} value={s}>
                  {SUPERMARKET_SECTION_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="number"
            step="any"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as Unit)}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm"
          >
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.value === 'tbsp' ? 'c. sopa' : u.value === 'tsp' ? 'c. chá' : u.value}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>
      </form>

      {/* Sections list */}
      {shoppingItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <ShoppingBag className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">Lista de compras vazia.</p>
          <p className="mt-1 text-xs text-slate-500">
            Adiciona itens acima, importa do stock baixo ou envia da ementa semanal.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {SUPERMARKET_SECTION_ORDER.map((sec) => {
            const list = groupedBySection.get(sec) ?? [];
            if (list.length === 0) return null;

            return (
              <div
                key={sec}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
              >
                <div className="border-b border-slate-100 bg-slate-50 px-3.5 py-2">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    {SUPERMARKET_SECTION_LABELS[sec]} ({list.filter((i) => !i.checked).length})
                  </h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {list.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 px-3.5 py-2.5 transition ${
                        item.checked ? 'bg-slate-50/70' : 'bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleChecked(item)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition ${
                          item.checked
                            ? 'border-teal-700 bg-teal-700 text-white'
                            : 'border-slate-300 bg-white hover:border-teal-500'
                        }`}
                        aria-label={`Marcar ${item.label}`}
                      >
                        {item.checked && <Check className="h-4 w-4" />}
                      </button>

                      <div
                        onClick={() => toggleChecked(item)}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <p
                          className={`text-sm font-medium ${
                            item.checked ? 'text-slate-400 line-through' : 'text-slate-900'
                          }`}
                        >
                          {item.label}
                        </p>
                      </div>

                      <span className="shrink-0 text-xs font-semibold text-slate-600">
                        {formatQuantity(item.quantity, item.unit)}
                      </span>

                      <button
                        type="button"
                        onClick={() => deleteItem(item)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Put Away Modal */}
      <Modal
        open={putAwayOpen}
        onClose={() => setPutAwayOpen(false)}
        title="Arrumar compras no Stock"
        subtitle="Os itens marcados serão removidos da lista e adicionados ao stock"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-3">
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {putAwayRows.map((row, idx) => (
              <div key={row.shoppingItem.id} className="space-y-2 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 font-semibold text-slate-900">
                    <input
                      type="checkbox"
                      checked={row.include}
                      disabled={!row.shoppingItem.catalogItemId}
                      onChange={(e) =>
                        setPutAwayRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, include: e.target.checked } : r,
                          ),
                        )
                      }
                      className="h-4 w-4 rounded accent-teal-700"
                    />
                    {row.shoppingItem.label}
                  </label>
                  {!row.shoppingItem.catalogItemId && (
                    <span className="text-[11px] text-slate-400">
                      Item livre (só limpa da lista)
                    </span>
                  )}
                </div>

                {row.include && (
                  <div className="grid grid-cols-3 gap-2 pl-6">
                    <select
                      value={row.locationId}
                      onChange={(e) =>
                        setPutAwayRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, locationId: e.target.value } : r,
                          ),
                        )
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={row.quantity}
                        onChange={(e) =>
                          setPutAwayRows((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, quantity: Number(e.target.value) || 0 } : r,
                            ),
                          )
                        }
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      />
                      <select
                        value={row.unit}
                        onChange={(e) =>
                          setPutAwayRows((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, unit: e.target.value as Unit } : r,
                            ),
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-xs"
                      >
                        {UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="date"
                      value={row.expiresAt}
                      onChange={(e) =>
                        setPutAwayRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, expiresAt: e.target.value } : r,
                          ),
                        )
                      }
                      title="Data de validade opcional"
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPutAwayOpen(false)}
              className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmPutAway}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <PackageCheck className="h-4 w-4" />
              Confirmar arrumação
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
