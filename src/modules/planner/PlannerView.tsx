import { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { MEAL_SLOT_LABELS } from '../../constants/labels';
import { db } from '../../db/database';
import type {
  CatalogItem,
  HouseholdMember,
  MealPlanEntry,
  MealSlot,
  Recipe,
  ShoppingItem,
  StockLot,
  StorageLocation,
} from '../../types/domain';
import { createSyncMetadata, nowIso } from '../../utils/id';
import {
  addDaysToDateString,
  formatDatePt,
  formatQuantity,
  formatWeekdayShortPt,
  getWeekStartMonday,
  todayDateString,
} from '../../utils/units';
import { CookRecipeModal } from '../recipes/CookRecipeModal';
import { evaluateRecipeMatch } from '../recipes/matchingEngine';
import { buildShoppingItem, computeMealPlanMissingNeeds } from './plannerService';

interface PlannerViewProps {
  mealPlan: MealPlanEntry[];
  recipes: Recipe[];
  stockLots: StockLot[];
  catalogItems: CatalogItem[];
  locations: StorageLocation[];
  members: HouseholdMember[];
  shoppingItems: ShoppingItem[];
  expiryWarningDays: number;
  deviceId: string;
  weekStart?: string;
  onWeekStartChange?: (weekStart: string) => void;
}

const SLOTS: MealSlot[] = ['lunch', 'dinner', 'snack'];

export function PlannerView({
  mealPlan,
  recipes,
  stockLots,
  catalogItems,
  locations,
  members,
  shoppingItems,
  expiryWarningDays,
  deviceId,
  weekStart: controlledWeekStart,
  onWeekStartChange,
}: PlannerViewProps) {
  const [internalWeekStart, setInternalWeekStart] = useState(() => getWeekStartMonday());
  const weekStart = controlledWeekStart ?? internalWeekStart;
  const setWeekStart = (next: string) => {
    setInternalWeekStart(next);
    onWeekStartChange?.(next);
  };
  const [expandedEmptyDays, setExpandedEmptyDays] = useState<Set<string>>(() => new Set());
  const [addingTarget, setAddingTarget] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [plannedServings, setPlannedServings] = useState('4');
  const [customLabel, setCustomLabel] = useState('');
  const [needsModalOpen, setNeedsModalOpen] = useState(false);
  const [cookState, setCookState] = useState<{
    entry: MealPlanEntry;
    recipe: Recipe;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const today = todayDateString();
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysToDateString(weekStart, i)),
    [weekStart],
  );

  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const weekEntries = useMemo(() => {
    const daySet = new Set(weekDays);
    return mealPlan.filter((e) => daySet.has(e.date));
  }, [mealPlan, weekDays]);

  const missingNeeds = useMemo(
    () =>
      computeMealPlanMissingNeeds(
        weekEntries,
        recipes,
        catalogItems,
        stockLots,
        shoppingItems,
      ),
    [weekEntries, recipes, catalogItems, stockLots, shoppingItems],
  );

  const recipeMatches = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateRecipeMatch>>();
    for (const r of recipes) {
      map.set(
        r.id,
        evaluateRecipeMatch(
          r,
          r.baseServings,
          stockLots,
          catalogItems,
          locations,
          members,
          expiryWarningDays,
          today,
        ),
      );
    }
    return map;
  }, [recipes, stockLots, catalogItems, locations, members, expiryWarningDays, today]);

  const openSlotModal = (date: string, slot: MealSlot) => {
    setAddingTarget({ date, slot });
    const firstRecipe = recipes[0];
    setSelectedRecipeId(firstRecipe?.id ?? '');
    const adultChildCount = members.filter((m) => m.role !== 'pet').reduce((s, m) => s + m.defaultServingsWeight, 0);
    setPlannedServings(
      String(firstRecipe?.baseServings ?? (adultChildCount > 0 ? Math.ceil(adultChildCount) : 4)),
    );
    setCustomLabel('');
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingTarget) return;
    if (!selectedRecipeId && !customLabel.trim()) return;

    const entry: MealPlanEntry = {
      ...createSyncMetadata(deviceId),
      date: addingTarget.date,
      slot: addingTarget.slot,
      recipeId: selectedRecipeId || null,
      plannedServings: Math.max(1, Number(plannedServings) || 2),
      customLabel: customLabel.trim(),
      completed: false,
    };
    await db.mealPlan.put(entry);
    setAddingTarget(null);
  };

  const deleteEntry = async (entry: MealPlanEntry) => {
    const now = nowIso();
    await db.mealPlan.put({
      ...entry,
      deletedAt: now,
      updatedAt: now,
      lastModifiedBy: deviceId,
    });
  };

  const sendMissingToShopping = async () => {
    if (missingNeeds.length === 0) return;
    const newItems = missingNeeds.map((need) =>
      buildShoppingItem(
        {
          catalogItemId: need.catalogItemId,
          label: need.label,
          quantity: need.missingQuantity,
          unit: need.unit,
          section: need.section,
          targetLocationId: need.targetLocationId,
          source: 'meal_plan',
        },
        deviceId,
      ),
    );
    await db.shoppingItems.bulkPut(newItems);
    setNeedsModalOpen(false);
    setToast(`${newItems.length} ingrediente(s) enviado(s) para a Lista de Compras.`);
    setTimeout(() => setToast(null), 3000);
  };

  const toggleEmptyDay = (dayStr: string) => {
    setExpandedEmptyDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayStr)) {
        next.delete(dayStr);
      } else {
        next.add(dayStr);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2.5">
      {/* First row: week switcher + Em falta action button (no duplicate heading) */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center justify-between rounded-2xl border border-slate-200 bg-white px-2 py-1">
          <button
            type="button"
            onClick={() => setWeekStart(addDaysToDateString(weekStart, -7))}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(getWeekStartMonday())}
            className="inline-flex items-center gap-1.5 truncate rounded-lg px-2 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-50"
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Esta semana</span>
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(addDaysToDateString(weekStart, 7))}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setNeedsModalOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-800"
        >
          <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Em falta ({missingNeeds.length})</span>
        </button>
      </div>

      {toast && (
        <div className="rounded-xl bg-teal-900 px-3 py-1.5 text-xs font-medium text-white shadow">
          {toast}
        </div>
      )}

      {/* Days list (empty non-today days collapse to compact 1-line rows) */}
      <div className="space-y-2">
        {weekDays.map((dayStr) => {
          const isToday = dayStr === today;
          const dayEntries = weekEntries.filter((e) => e.date === dayStr);
          const isExpanded = isToday || dayEntries.length > 0 || expandedEmptyDays.has(dayStr);

          if (!isExpanded) {
            return (
              <div
                key={dayStr}
                className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => toggleEmptyDay(dayStr)}
                  aria-expanded="false"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="truncate text-sm font-semibold text-slate-800">
                    {formatWeekdayShortPt(dayStr)}, {formatDatePt(dayStr)}
                  </span>
                  <span className="text-[11px] text-slate-400">· Livre</span>
                </button>
                <button
                  type="button"
                  onClick={() => openSlotModal(dayStr, 'dinner')}
                  aria-label={`Planear ${formatWeekdayShortPt(dayStr)}, ${formatDatePt(dayStr)}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-teal-800 hover:border-teal-300 hover:bg-teal-50"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Planear
                </button>
              </div>
            );
          }

          return (
            <div
              key={dayStr}
              className={`rounded-2xl border bg-white p-3 shadow-xs ${
                isToday ? 'border-teal-500 ring-1 ring-teal-500/20' : 'border-slate-200'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!isToday && dayEntries.length === 0 && (
                    <button
                      type="button"
                      onClick={() => toggleEmptyDay(dayStr)}
                      aria-expanded="true"
                      aria-label={`Recolher ${formatWeekdayShortPt(dayStr)}, ${formatDatePt(dayStr)}`}
                      className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  <span className="text-sm font-bold text-slate-900">
                    {formatWeekdayShortPt(dayStr)}, {formatDatePt(dayStr)}
                  </span>
                  {isToday && (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                      Hoje
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {SLOTS.map((slot) => {
                  const slotEntries = dayEntries.filter((e) => e.slot === slot);
                  return (
                    <div
                      key={slot}
                      className="flex flex-col justify-between rounded-xl bg-slate-50/80 p-2.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          {MEAL_SLOT_LABELS[slot]}
                        </span>
                        <button
                          type="button"
                          onClick={() => openSlotModal(dayStr, slot)}
                          className="inline-flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-teal-700 hover:bg-teal-100"
                          title={`Planear ${MEAL_SLOT_LABELS[slot]}`}
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" />
                          {slotEntries.length === 0 && <span>Planear</span>}
                        </button>
                      </div>

                      {slotEntries.length > 0 && (
                        <div className="mt-1.5 space-y-1.5">
                          {slotEntries.map((entry) => {
                            const recipe = entry.recipeId
                              ? recipesById.get(entry.recipeId)
                              : undefined;
                            return (
                              <div
                                key={entry.id}
                                className={`rounded-lg border px-2.5 py-2 text-xs ${
                                  entry.completed
                                    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                                    : 'border-slate-200 bg-white text-slate-800'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold">
                                      {recipe ? recipe.title : entry.customLabel}
                                    </p>
                                    {recipe && (
                                      <p className="text-[11px] text-slate-500">
                                        {entry.plannedServings} doses
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => deleteEntry(entry)}
                                    aria-label={`Remover ${recipe ? recipe.title : entry.customLabel}`}
                                    className="text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                {!entry.completed && recipe && (
                                  <button
                                    type="button"
                                    onClick={() => setCookState({ entry, recipe })}
                                    className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 hover:bg-teal-100"
                                  >
                                    <ChefHat className="h-3 w-3" />
                                    Cozinhei
                                  </button>
                                )}
                                {entry.completed && (
                                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Feito
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add meal modal */}
      <Modal
        open={addingTarget !== null}
        onClose={() => setAddingTarget(null)}
        title={
          addingTarget
            ? `Planear refeição (${formatDatePt(addingTarget.date)})`
            : 'Planear refeição'
        }
      >
        <form onSubmit={handleSaveEntry} className="space-y-4">
          {addingTarget && (
            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Refeição</span>
              <div className="grid grid-cols-3 gap-1.5">
                {SLOTS.map((slot) => {
                  const active = addingTarget.slot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setAddingTarget({ ...addingTarget, slot })}
                      className={`rounded-xl border px-2 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'border-teal-700 bg-teal-700 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {MEAL_SLOT_LABELS[slot]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {recipes.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Escolher uma das vossas receitas
              </label>
              <select
                value={selectedRecipeId}
                onChange={(e) => {
                  setSelectedRecipeId(e.target.value);
                  const r = recipesById.get(e.target.value);
                  if (r) setPlannedServings(String(r.baseServings));
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">-- Nota livre (sem receita) --</option>
                {recipes.map((r) => {
                  const m = recipeMatches.get(r.id);
                  const tag =
                    m?.status === 'ready'
                      ? ' [Pronta]'
                      : m?.status === 'almost'
                        ? ` [Falta ${m.missingMandatoryCount}]`
                        : '';
                  return (
                    <option key={r.id} value={r.id}>
                      {r.title}
                      {tag}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {selectedRecipeId ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Nº de doses planeadas
              </label>
              <input
                type="number"
                min="1"
                value={plannedServings}
                onChange={(e) => setPlannedServings(e.target.value)}
                className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Descrição livre
              </label>
              <input
                type="text"
                required={!selectedRecipeId}
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Ex: Sobras de ontem, Pizza caseira, Jantar fora..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddingTarget(null)}
              className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Guardar na Ementa
            </button>
          </div>
        </form>
      </Modal>

      {/* Missing needs modal */}
      <Modal
        open={needsModalOpen}
        onClose={() => setNeedsModalOpen(false)}
        title="Ingredientes em falta para a semana"
        subtitle="Já descontando o stock atual e o que já está na Lista de Compras"
      >
        {missingNeeds.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-600">
            Já tens tudo em stock (ou na lista de compras) para as receitas desta semana!
          </p>
        ) : (
          <div className="space-y-4">
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {missingNeeds.map((n) => (
                <div
                  key={`${n.catalogItemId}-${n.unit}`}
                  className="flex items-center justify-between px-3.5 py-2.5 text-sm"
                >
                  <span className="font-medium text-slate-800">{n.label}</span>
                  <span className="font-semibold text-teal-800">
                    {formatQuantity(n.missingQuantity, n.unit)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNeedsModalOpen(false)}
                className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={sendMissingToShopping}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                <ShoppingCart className="h-4 w-4" />
                Adicionar todos à Lista
              </button>
            </div>
          </div>
        )}
      </Modal>

      <CookRecipeModal
        open={cookState !== null}
        onClose={() => setCookState(null)}
        recipe={cookState?.recipe ?? null}
        servings={cookState?.entry.plannedServings ?? 4}
        stockLots={stockLots}
        catalogItems={catalogItems}
        locations={locations}
        deviceId={deviceId}
        onCooked={async () => {
          if (!cookState) return;
          await db.mealPlan.put({
            ...cookState.entry,
            completed: true,
            updatedAt: nowIso(),
            lastModifiedBy: deviceId,
          });
        }}
      />
    </div>
  );
}
