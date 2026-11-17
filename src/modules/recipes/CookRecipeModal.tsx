import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Refrigerator } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { db } from '../../db/database';
import type {
  CatalogItem,
  QualitativeLevel,
  Recipe,
  StockLot,
  StorageLocation,
  Unit,
} from '../../types/domain';
import { nowIso } from '../../utils/id';
import { formatQuantity, todayDateString } from '../../utils/units';
import {
  applyLotDeductions,
  buildNewStockLot,
  planLotDeduction,
} from '../stock/stockService';

interface CookRecipeModalProps {
  open: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  servings: number;
  stockLots: StockLot[];
  catalogItems: CatalogItem[];
  locations: StorageLocation[];
  deviceId: string;
  onCooked?: () => void;
}

interface PlannedDeductionRow {
  ingredientId: string;
  catalogItemId: string;
  name: string;
  enabled: boolean;
  deductQty: number;
  unit: Unit;
  affectedLotSummary: string;
}

export function CookRecipeModal({
  open,
  onClose,
  recipe,
  servings,
  stockLots,
  catalogItems,
  locations,
  deviceId,
  onCooked,
}: CookRecipeModalProps) {
  const [rows, setRows] = useState<PlannedDeductionRow[]>([]);
  const [saveLeftover, setSaveLeftover] = useState(false);
  const [leftoverLocationId, setLeftoverLocationId] = useState('');
  const [leftoverServings, setLeftoverServings] = useState('2');
  const [leftoverNotes, setLeftoverNotes] = useState('');

  const [qualitativeLowCatalogIds, setQualitativeLowCatalogIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const catalogById = useMemo(
    () => new Map(catalogItems.map((c) => [c.id, c])),
    [catalogItems],
  );
  const locationsById = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations],
  );

  useEffect(() => {
    if (!open || !recipe) return;
    const ratio = Math.max(0.25, servings) / Math.max(1, recipe.baseServings);
    const nextRows: PlannedDeductionRow[] = [];

    for (const ing of recipe.ingredients) {
      const cat = catalogById.get(ing.catalogItemId);
      if (!cat || cat.trackingMode === 'qualitative' || ing.toTaste || ing.quantity === null || !ing.unit) {
        continue;
      }
      const scaled = Math.round(ing.quantity * ratio * 100) / 100;
      const catLots = stockLots.filter((l) => l.catalogItemId === ing.catalogItemId);
      const { plan } = planLotDeduction(catLots, locationsById, scaled, ing.unit);

      nextRows.push({
        ingredientId: ing.id,
        catalogItemId: ing.catalogItemId,
        name: ing.customLabel.trim() || cat.name,
        enabled: plan.length > 0,
        deductQty: scaled,
        unit: ing.unit,
        affectedLotSummary:
          plan.length > 0
            ? plan
                .map((p) => {
                  const qtyText = p.deductEquivalent
                    ? `${p.deductInLotUnit} ${p.currentUnit} (${p.deductEquivalent})`
                    : `${p.deductInLotUnit} ${p.currentUnit}`;
                  return `${qtyText} · ${p.locationName}`;
                })
                .join(' + ')
            : 'Sem stock registado',
      });
    }

    setRows(nextRows);
    setQualitativeLowCatalogIds([]);
    setSaveLeftover(false);
    const fridge = locations.find((l) => l.locationType === 'fridge') ?? locations[0];
    setLeftoverLocationId(fridge?.id ?? '');
    setLeftoverServings('2');
    setLeftoverNotes('');
  }, [open, recipe, servings, stockLots, catalogById, locationsById, locations]);

  if (!recipe) return null;

  const qualitativeIngredients = recipe.ingredients
    .map((ing) => ({
      ing,
      cat: catalogById.get(ing.catalogItemId),
    }))
    .filter(({ cat }) => cat?.trackingMode === 'qualitative');

  const handleConfirmCook = async () => {
    setSaving(true);
    try {
      let workingLots = [...stockLots];
      const updatedLotsToSave = new Map<string, StockLot>();

      for (const row of rows) {
        if (!row.enabled || row.deductQty <= 0) continue;
        const catLots = workingLots.filter((l) => l.catalogItemId === row.catalogItemId);
        const { plan } = planLotDeduction(catLots, locationsById, row.deductQty, row.unit);
        const modified = applyLotDeductions(catLots, plan, deviceId);
        for (const lot of modified) {
          updatedLotsToSave.set(lot.id, lot);
          workingLots = workingLots.map((w) => (w.id === lot.id ? lot : w));
        }
      }

      // Mark selected qualitative items as 'low'
      const now = nowIso();
      for (const catId of qualitativeLowCatalogIds) {
        const lot = workingLots.find((l) => l.catalogItemId === catId && l.qualitativeLevel === 'full');
        if (lot) {
          const updated: StockLot = {
            ...lot,
            qualitativeLevel: 'low' as QualitativeLevel,
            updatedAt: now,
            lastModifiedBy: deviceId,
          };
          updatedLotsToSave.set(updated.id, updated);
        }
      }

      if (updatedLotsToSave.size > 0) {
        await db.stockLots.bulkPut(Array.from(updatedLotsToSave.values()));
      }

      // Save leftovers into stock if requested
      if (saveLeftover && leftoverLocationId) {
        let leftoverCatalog = catalogItems.find((c) => c.id === 'starter-cat-sobras-caseiras');
        if (!leftoverCatalog) {
          leftoverCatalog = {
            id: 'starter-cat-sobras-caseiras',
            name: 'Refeição / Sobras caseiras',
            aliases: ['tupperware', 'sobras'],
            category: 'food',
            trackingMode: 'exact',
            defaultUnit: 'un',
            defaultLocationId: leftoverLocationId,
            minStockQty: null,
            supermarketSection: 'other',
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            lastModifiedBy: deviceId,
          };
          await db.catalogItems.put(leftoverCatalog);
        }

        const leftoverLot = buildNewStockLot(
          {
            catalogItemId: leftoverCatalog.id,
            productLabel: `Sobras: ${recipe.title}`,
            locationId: leftoverLocationId,
            quantity: Math.max(1, Number(leftoverServings) || 1),
            unit: 'un',
            qualitativeLevel: null,
            frozenOrCookedAt: todayDateString(),
            isLeftover: true,
            sourceRecipeId: recipe.id,
            notes: leftoverNotes.trim() || `${leftoverServings} doses guardadas`,
          },
          deviceId,
        );
        await db.stockLots.put(leftoverLot);
      }

      // Update recipe history
      await db.recipes.put({
        ...recipe,
        timesCooked: recipe.timesCooked + 1,
        lastCookedAt: todayDateString(),
        updatedAt: now,
        lastModifiedBy: deviceId,
      });

      onCooked?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Cozinhar: ${recipe.title}`}
      subtitle={`Confirmar abate no stock para ${servings} dose(s)`}
    >
      <div className="space-y-4">
        {rows.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ingredientes a abater (ordem FEFO — validade mais curta primeiro)
            </p>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {rows.map((row) => (
                <div key={row.ingredientId} className="flex items-center gap-2.5 p-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.ingredientId === row.ingredientId
                            ? { ...r, enabled: e.target.checked }
                            : r,
                        ),
                      )
                    }
                    className="h-4 w-4 rounded accent-teal-700"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{row.name}</p>
                    <p className="text-xs text-slate-500">{row.affectedLotSummary}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      disabled={!row.enabled}
                      value={row.deductQty}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.ingredientId === row.ingredientId
                              ? { ...r, deductQty: Number(e.target.value) || 0 }
                              : r,
                          ),
                        )
                      }
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs disabled:bg-slate-100"
                    />
                    <span className="text-xs text-slate-500">
                      {formatQuantity(null, row.unit) || row.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Esta receita não tem ingredientes com quantidade exata para abater automaticamente.
          </p>
        )}

        {qualitativeIngredients.length > 0 && (
          <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">
              Algum destes básicos ficou "Pouco"? (Opcional)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {qualitativeIngredients.map(({ ing, cat }) => {
                if (!cat) return null;
                const active = qualitativeLowCatalogIds.includes(cat.id);
                return (
                  <button
                    key={ing.id}
                    type="button"
                    onClick={() =>
                      setQualitativeLowCatalogIds((prev) =>
                        prev.includes(cat.id)
                          ? prev.filter((x) => x !== cat.id)
                          : [...prev, cat.id],
                      )
                    }
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      active
                        ? 'bg-amber-500 text-white'
                        : 'border border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {cat.name} → Pouco
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Leftovers section */}
        <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-3.5">
          <label className="flex items-center gap-2.5 text-sm font-semibold text-teal-900">
            <input
              type="checkbox"
              checked={saveLeftover}
              onChange={(e) => setSaveLeftover(e.target.checked)}
              className="h-4 w-4 rounded accent-teal-700"
            />
            <Refrigerator className="h-4 w-4 text-teal-700" />
            Ficaram sobras? Guardar no stock (tupperware)
          </label>

          {saveLeftover && (
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-teal-800">
                  Onde guardar?
                </label>
                <select
                  value={leftoverLocationId}
                  onChange={(e) => setLeftoverLocationId(e.target.value)}
                  className="w-full rounded-lg border border-teal-200 bg-white px-2.5 py-1.5 text-xs"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-teal-800">
                  Doses / Tupperwares
                </label>
                <input
                  type="number"
                  min="1"
                  value={leftoverServings}
                  onChange={(e) => setLeftoverServings(e.target.value)}
                  className="w-full rounded-lg border border-teal-200 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-teal-800">Nota</label>
                <input
                  type="text"
                  value={leftoverNotes}
                  onChange={(e) => setLeftoverNotes(e.target.value)}
                  placeholder="Ex: Sem arroz"
                  className="w-full rounded-lg border border-teal-200 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirmCook}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {saving ? 'A registar...' : 'Confirmar e Abater'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
