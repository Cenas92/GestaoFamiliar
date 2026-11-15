import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  ChefHat,
  Clock,
  Minus,
  Pencil,
  Plus,
  ShoppingCart,
  Snowflake,
  Trash2,
} from 'lucide-react';
import { AttachmentDocumentLink, AttachmentImage } from '../../components/AttachmentPreview';
import { Modal } from '../../components/Modal';
import { RECIPE_CATEGORY_LABELS } from '../../constants/labels';
import { db } from '../../db/database';
import type {
  CatalogItem,
  HouseholdMember,
  ShoppingItem,
  StockLot,
  StorageLocation,
} from '../../types/domain';
import { nowIso } from '../../utils/id';
import { formatDatePt, formatQuantity } from '../../utils/units';
import { buildShoppingItem } from '../planner/plannerService';
import { evaluateRecipeMatch } from './matchingEngine';

interface RecipeDetailModalProps {
  open: boolean;
  onClose: () => void;
  recipeId: string | null;
  recipesMap: Map<string, import('../../types/domain').Recipe>;
  stockLots: StockLot[];
  catalogItems: CatalogItem[];
  locations: StorageLocation[];
  members: HouseholdMember[];
  shoppingItems: ShoppingItem[];
  expiryWarningDays: number;
  deviceId: string;
  onEdit: (recipe: import('../../types/domain').Recipe) => void;
  onStartCook: (recipe: import('../../types/domain').Recipe, desiredServings: number) => void;
}

export function RecipeDetailModal({
  open,
  onClose,
  recipeId,
  recipesMap,
  stockLots,
  catalogItems,
  locations,
  members,
  shoppingItems,
  expiryWarningDays,
  deviceId,
  onEdit,
  onStartCook,
}: RecipeDetailModalProps) {
  const recipe = recipeId ? (recipesMap.get(recipeId) ?? null) : null;
  const [servings, setServings] = useState(4);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (recipe) {
      setServings(recipe.baseServings);
      setToast(null);
    }
  }, [recipe?.id, recipe?.baseServings]);

  if (!recipe) return null;

  const match = evaluateRecipeMatch(
    recipe,
    servings,
    stockLots,
    catalogItems,
    locations,
    members,
    expiryWarningDays,
  );

  const catalogMap = new Map(catalogItems.map((c) => [c.id, c]));

  const addMissingToShopping = async () => {
    let addedCount = 0;
    for (const detail of match.missingIngredients) {
      const cat = catalogMap.get(detail.ingredient.catalogItemId);
      const alreadyQueued = shoppingItems.some(
        (s) => !s.checked && s.catalogItemId === detail.ingredient.catalogItemId,
      );
      if (alreadyQueued) continue;

      const item = buildShoppingItem(
        {
          catalogItemId: detail.ingredient.catalogItemId,
          label: detail.catalogItemName,
          quantity: detail.missingQuantity ?? 1,
          unit: detail.requiredUnit ?? cat?.defaultUnit ?? 'un',
          section: cat?.supermarketSection ?? 'pantry',
          targetLocationId: cat?.defaultLocationId ?? null,
          source: 'recipe',
        },
        deviceId,
      );
      await db.shoppingItems.put(item);
      addedCount += 1;
    }
    setToast(
      addedCount > 0
        ? `${addedCount} ingrediente(s) enviado(s) para a Lista de Compras.`
        : 'Os ingredientes em falta já estavam na Lista de Compras.',
    );
  };

  const handleDelete = async () => {
    const now = nowIso();
    await db.recipes.put({
      ...recipe,
      deletedAt: now,
      updatedAt: now,
      lastModifiedBy: deviceId,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={recipe.title}
      subtitle={`${RECIPE_CATEGORY_LABELS[recipe.category]} · ${recipe.prepMinutes + recipe.cookMinutes} min`}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-4">
        {recipe.photoAttachmentId && (
          <AttachmentImage
            attachmentId={recipe.photoAttachmentId}
            alt={recipe.title}
            className="h-48 w-full rounded-2xl border border-slate-200"
          />
        )}

        {/* Badges & Status */}
        <div className="flex flex-wrap items-center gap-2">
          {match.status === 'ready' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              <Check className="h-3.5 w-3.5" />
              Pronta a fazer (100%)
            </span>
          )}
          {match.status === 'almost' && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              Quase lá (falta {match.missingMandatoryCount})
            </span>
          )}
          {match.needsDefrost && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
              <Snowflake className="h-3.5 w-3.5" />
              Precisa descongelar: {match.defrostIngredientNames.join(', ')}
            </span>
          )}
          {match.expiringSoonCount > 0 && (
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">
              Aproveitar já ({match.expiringSoonCount} a expirar)
            </span>
          )}
          {match.allergenConflicts.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              Alergénio: {match.allergenConflicts.join(', ')}
            </span>
          )}
        </div>

        {/* Portion scaler */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4 text-slate-400" />
              Prep {recipe.prepMinutes}m + Coz {recipe.cookMinutes}m
            </span>
            <span>· Cozinhada {recipe.timesCooked}x</span>
            {recipe.lastCookedAt && <span>(última: {formatDatePt(recipe.lastCookedAt)})</span>}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Doses:</span>
            <button
              type="button"
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-6 text-center text-sm font-bold text-slate-900">{servings}</span>
            <button
              type="button"
              onClick={() => setServings((s) => s + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {toast && (
          <div className="rounded-xl bg-teal-900 px-3 py-2 text-xs font-medium text-white">
            {toast}
          </div>
        )}

        {/* Ingredients list */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Ingredientes</h3>
            {match.missingIngredients.length > 0 && (
              <button
                type="button"
                onClick={addMissingToShopping}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Enviar em falta para Compras ({match.missingIngredients.length})
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {match.ingredientDetails.map((d) => (
              <div
                key={d.ingredient.id}
                className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">
                    {d.catalogItemName}
                    {d.ingredient.isOptional && (
                      <span className="ml-1.5 text-xs font-normal text-slate-400">
                        (opcional)
                      </span>
                    )}
                  </p>
                  {d.usedSubstituteName && (
                    <p className="text-xs text-teal-700">
                      Substituto em stock: {d.usedSubstituteName}
                    </p>
                  )}
                  {d.usedFreezer && (
                    <p className="text-xs text-blue-600">No congelador (descongelar)</p>
                  )}
                  {d.unitMismatchNote && (
                    <p className="text-xs text-slate-500">{d.unitMismatchNote}</p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-semibold text-slate-900">
                    {d.ingredient.toTaste
                      ? 'q.b.'
                      : formatQuantity(d.requiredQuantity, d.requiredUnit)}
                  </p>
                  {d.satisfied ? (
                    <span className="text-[11px] font-semibold text-emerald-700">Em stock</span>
                  ) : d.ingredient.isOptional ? (
                    <span className="text-[11px] text-slate-400">Opcional</span>
                  ) : (
                    <span className="text-[11px] font-semibold text-rose-600">
                      Falta{' '}
                      {d.missingQuantity && d.requiredUnit
                        ? formatQuantity(d.missingQuantity, d.requiredUnit)
                        : 'stock'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        {recipe.steps.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold text-slate-900">Preparação</h3>
            <ol className="space-y-2">
              {recipe.steps.map((step) => (
                <li
                  key={step.id}
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
                >
                  <div className="flex gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                      {step.order}
                    </span>
                    <div className="flex-1 space-y-1.5">
                      <p className="leading-relaxed">{step.instruction}</p>
                      {(step.robotTime || step.robotTemp || step.robotSpeed) && (
                        <div className="inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          <Bot className="h-3.5 w-3.5" />
                          {[step.robotTime, step.robotTemp, step.robotSpeed]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {recipe.docAttachmentId && (
          <div>
            <AttachmentDocumentLink attachmentId={recipe.docAttachmentId} />
          </div>
        )}

        {recipe.notes && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
            <span className="font-bold">Notas pessoais:</span> {recipe.notes}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(recipe);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Apagar
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onStartCook(recipe, servings);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
          >
            <ChefHat className="h-4 w-4" />
            Cozinhei isto!
          </button>
        </div>
      </div>
    </Modal>
  );
}
