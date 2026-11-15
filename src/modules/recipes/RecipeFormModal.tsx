import { useEffect, useState } from 'react';
import { Bot, FileUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { CatalogPicker } from '../../components/CatalogPicker';
import { Modal } from '../../components/Modal';
import {
  COMMON_ALLERGENS,
  RECIPE_CATEGORY_LABELS,
  SUGGESTED_RECIPE_TAGS,
  UNITS,
} from '../../constants/labels';
import { db } from '../../db/database';
import type {
  AttachmentRecord,
  CatalogItem,
  HouseholdMember,
  Recipe,
  RecipeCategory,
  RecipeIngredient,
  RecipeStep,
  StorageLocation,
  Unit,
} from '../../types/domain';
import { createId, createSyncMetadata, nowIso } from '../../utils/id';
import { prepareAttachmentBlob } from '../../utils/imageCompression';

interface RecipeFormModalProps {
  open: boolean;
  onClose: () => void;
  editingRecipe: Recipe | null;
  catalogItems: CatalogItem[];
  locations: StorageLocation[];
  members: HouseholdMember[];
  deviceId: string;
}

export function RecipeFormModal({
  open,
  onClose,
  editingRecipe,
  catalogItems,
  locations,
  members,
  deviceId,
}: RecipeFormModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RecipeCategory>('meat');
  const [prepMinutes, setPrepMinutes] = useState('15');
  const [cookMinutes, setCookMinutes] = useState('25');
  const [baseServings, setBaseServings] = useState('4');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [containsAllergens, setContainsAllergens] = useState<string[]>([]);
  const [favoriteMemberIds, setFavoriteMemberIds] = useState<string[]>([]);
  const [kidFriendly, setKidFriendly] = useState(true);
  const [notes, setNotes] = useState('');

  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [showRobotFields, setShowRobotFields] = useState(false);

  const [photoAttachmentId, setPhotoAttachmentId] = useState<string | null>(null);
  const [docAttachmentId, setDocAttachmentId] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState('');
  const [docFileName, setDocFileName] = useState('');

  const [subPickerIngId, setSubPickerIngId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setSubPickerIngId(null);
    if (editingRecipe) {
      setTitle(editingRecipe.title);
      setCategory(editingRecipe.category);
      setPrepMinutes(String(editingRecipe.prepMinutes));
      setCookMinutes(String(editingRecipe.cookMinutes));
      setBaseServings(String(editingRecipe.baseServings));
      setTags(editingRecipe.tags);
      setContainsAllergens(editingRecipe.containsAllergens);
      setFavoriteMemberIds(editingRecipe.favoriteMemberIds);
      setKidFriendly(editingRecipe.kidFriendly);
      setNotes(editingRecipe.notes);
      setIngredients(editingRecipe.ingredients);
      setSteps(editingRecipe.steps);
      setShowRobotFields(
        editingRecipe.steps.some((s) => s.robotTime || s.robotTemp || s.robotSpeed),
      );
      setPhotoAttachmentId(editingRecipe.photoAttachmentId);
      setDocAttachmentId(editingRecipe.docAttachmentId);
      setPhotoFileName(editingRecipe.photoAttachmentId ? 'Foto atual guardada' : '');
      setDocFileName(editingRecipe.docAttachmentId ? 'Anexo atual guardado' : '');
    } else {
      setTitle('');
      setCategory('meat');
      setPrepMinutes('15');
      setCookMinutes('25');
      setBaseServings('4');
      setTags([]);
      setCustomTag('');
      setContainsAllergens([]);
      setFavoriteMemberIds([]);
      setKidFriendly(true);
      setNotes('');
      setIngredients([]);
      setSteps([{ id: createId(), order: 1, instruction: '', robotTime: '', robotTemp: '', robotSpeed: '' }]);
      setShowRobotFields(false);
      setPhotoAttachmentId(null);
      setDocAttachmentId(null);
      setPhotoFileName('');
      setDocFileName('');
    }
  }, [open, editingRecipe]);

  const handlePhotoUpload = async (file: File | undefined) => {
    if (!file) return;
    const prepared = await prepareAttachmentBlob(file);
    const id = createId();
    const record: AttachmentRecord = {
      id,
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      sizeBytes: prepared.blob.size,
      blob: prepared.blob,
      driveFileId: null,
      uploadedToDrive: false,
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await db.attachments.put(record);
    setPhotoAttachmentId(id);
    setPhotoFileName(`${prepared.fileName} (${Math.round(prepared.blob.size / 1024)} KB)`);
  };

  const handleDocUpload = async (file: File | undefined) => {
    if (!file) return;
    const prepared = file.type.startsWith('image/')
      ? await prepareAttachmentBlob(file)
      : { blob: file, mimeType: file.type || 'application/pdf', fileName: file.name };
    const id = createId();
    const record: AttachmentRecord = {
      id,
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      sizeBytes: prepared.blob.size,
      blob: prepared.blob,
      driveFileId: null,
      uploadedToDrive: false,
      updatedAt: nowIso(),
      deletedAt: null,
    };
    await db.attachments.put(record);
    setDocAttachmentId(id);
    setDocFileName(`${prepared.fileName} (${Math.round(prepared.blob.size / 1024)} KB)`);
  };

  const addIngredientRow = () => {
    setIngredients((prev) => [
      ...prev,
      {
        id: createId(),
        catalogItemId: '',
        customLabel: '',
        quantity: 1,
        unit: 'un',
        toTaste: false,
        isOptional: false,
        substituteCatalogIds: [],
      },
    ]);
  };

  const updateIngredient = (id: string, patch: Partial<RecipeIngredient>) => {
    setIngredients((prev) => prev.map((ing) => (ing.id === id ? { ...ing, ...patch } : ing)));
  };

  const removeIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((ing) => ing.id !== id));
  };

  const addStepRow = () => {
    setSteps((prev) => [
      ...prev,
      {
        id: createId(),
        order: prev.length + 1,
        instruction: '',
        robotTime: '',
        robotTemp: '',
        robotSpeed: '',
      },
    ]);
  };

  const updateStep = (id: string, patch: Partial<RecipeStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStep = (id: string) => {
    setSteps((prev) =>
      prev.filter((s) => s.id !== id).map((s, idx) => ({ ...s, order: idx + 1 })),
    );
  };

  const toggleStringItem = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const addCustomTag = () => {
    const clean = customTag.trim();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setCustomTag('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Dá um nome à receita.');
      return;
    }

    const validIngredients = ingredients.filter((i) => i.catalogItemId);
    if (validIngredients.length === 0) {
      setError('Adiciona pelo menos 1 ingrediente ligado ao catálogo.');
      return;
    }

    setSaving(true);
    try {
      const cleanSteps = steps
        .filter((s) => s.instruction.trim() || s.robotTime || s.robotTemp || s.robotSpeed)
        .map((s, idx) => ({ ...s, order: idx + 1 }));

      const baseMeta = editingRecipe
        ? {
            id: editingRecipe.id,
            createdAt: editingRecipe.createdAt,
            updatedAt: nowIso(),
            deletedAt: null,
            lastModifiedBy: deviceId,
            timesCooked: editingRecipe.timesCooked,
            lastCookedAt: editingRecipe.lastCookedAt,
          }
        : {
            ...createSyncMetadata(deviceId),
            timesCooked: 0,
            lastCookedAt: null,
          };

      const recipe: Recipe = {
        ...baseMeta,
        title: title.trim(),
        category,
        prepMinutes: Math.max(0, Number(prepMinutes) || 0),
        cookMinutes: Math.max(0, Number(cookMinutes) || 0),
        baseServings: Math.max(1, Number(baseServings) || 1),
        tags,
        containsAllergens,
        favoriteMemberIds,
        kidFriendly,
        notes: notes.trim(),
        photoAttachmentId,
        docAttachmentId,
        ingredients: validIngredients,
        steps: cleanSteps,
      };

      await db.recipes.put(recipe);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const humanMembers = members.filter((m) => m.role !== 'pet');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingRecipe ? 'Editar receita' : 'Nova receita própria'}
      subtitle="Fica guardada localmente e no teu Google Drive"
      maxWidthClass="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nome da receita *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Bacalhau à Brás da Casa"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RecipeCategory)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {Object.entries(RECIPE_CATEGORY_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                Prep (min)
              </label>
              <input
                type="number"
                min="0"
                value={prepMinutes}
                onChange={(e) => setPrepMinutes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                Cozinha (min)
              </label>
              <input
                type="number"
                min="0"
                value={cookMinutes}
                onChange={(e) => setCookMinutes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Doses</label>
              <input
                type="number"
                min="1"
                value={baseServings}
                onChange={(e) => setBaseServings(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Media uploads */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs font-medium text-slate-700 hover:bg-slate-100">
            <ImagePlus className="h-5 w-5 text-teal-700" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Foto da receita (comprimida auto)</p>
              <p className="truncate text-slate-500">{photoFileName || 'Selecionar foto...'}</p>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs font-medium text-slate-700 hover:bg-slate-100">
            <FileUp className="h-5 w-5 text-teal-700" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Anexo (PDF / Foto de livro / Notas)</p>
              <p className="truncate text-slate-500">{docFileName || 'Selecionar PDF ou foto...'}</p>
            </div>
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => handleDocUpload(e.target.files?.[0])}
            />
          </label>
        </div>

        {/* Ingredients */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Ingredientes</h3>
            <button
              type="button"
              onClick={addIngredientRow}
              className="inline-flex items-center gap-1 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Ingrediente
            </button>
          </div>

          {ingredients.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
              Clica em "+ Ingrediente" para adicionar ingredientes ligados ao teu catálogo.
            </p>
          )}

          <div className="space-y-3">
            {ingredients.map((ing) => (
              <div
                key={ing.id}
                className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <CatalogPicker
                      key={`${ing.id}-${ing.catalogItemId}`}
                      catalogItems={catalogItems}
                      locations={locations}
                      deviceId={deviceId}
                      selectedId={ing.catalogItemId || null}
                      onSelect={(item) =>
                        updateIngredient(ing.id, {
                          catalogItemId: item.id,
                          unit: item.trackingMode === 'qualitative' ? null : item.defaultUnit,
                          toTaste: item.trackingMode === 'qualitative',
                          quantity: item.trackingMode === 'qualitative' ? null : (ing.quantity ?? 1),
                        })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeIngredient(ing.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Remover ingrediente"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!ing.toTaste && (
                    <>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={ing.quantity ?? ''}
                        onChange={(e) =>
                          updateIngredient(ing.id, {
                            quantity: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        placeholder="Qtd"
                        className="w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                      />
                      <select
                        value={ing.unit ?? 'un'}
                        onChange={(e) => updateIngredient(ing.id, { unit: e.target.value as Unit })}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      >
                        {UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.value === 'tbsp' ? 'c. sopa' : u.value === 'tsp' ? 'c. chá' : u.value}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  <label className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-700 border border-slate-200">
                    <input
                      type="checkbox"
                      checked={ing.toTaste}
                      onChange={(e) =>
                        updateIngredient(ing.id, {
                          toTaste: e.target.checked,
                          quantity: e.target.checked ? null : (ing.quantity ?? 1),
                        })
                      }
                    />
                    q.b. / A gosto
                  </label>

                  <label className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-700 border border-slate-200">
                    <input
                      type="checkbox"
                      checked={ing.isOptional}
                      onChange={(e) => updateIngredient(ing.id, { isOptional: e.target.checked })}
                    />
                    Opcional
                  </label>

                  <button
                    type="button"
                    onClick={() => setSubPickerIngId(subPickerIngId === ing.id ? null : ing.id)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-50"
                  >
                    Substitutos ({ing.substituteCatalogIds.length})
                  </button>
                </div>

                {ing.substituteCatalogIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {ing.substituteCatalogIds.map((subId) => {
                      const sub = catalogItems.find((c) => c.id === subId);
                      return (
                        <span
                          key={subId}
                          className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-medium text-teal-900"
                        >
                          ou {sub?.name ?? subId}
                          <button
                            type="button"
                            onClick={() =>
                              updateIngredient(ing.id, {
                                substituteCatalogIds: ing.substituteCatalogIds.filter(
                                  (x) => x !== subId,
                                ),
                              })
                            }
                            className="ml-1 text-teal-700 hover:text-rose-600"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {subPickerIngId === ing.id && (
                  <div className="rounded-xl border border-teal-200 bg-white p-2">
                    <p className="mb-1 text-[11px] font-semibold text-teal-800">
                      Adicionar ingrediente substituto aceite:
                    </p>
                    <CatalogPicker
                      catalogItems={catalogItems.filter(
                        (c) => c.id !== ing.catalogItemId && !ing.substituteCatalogIds.includes(c.id),
                      )}
                      locations={locations}
                      deviceId={deviceId}
                      selectedId={null}
                      placeholder="Procurar substituto (ex: Iogurte natural)..."
                      onSelect={(sub) => {
                        updateIngredient(ing.id, {
                          substituteCatalogIds: [...ing.substituteCatalogIds, sub.id],
                        });
                        setSubPickerIngId(null);
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800">Modo de Preparação</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRobotFields(!showRobotFields)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${
                  showRobotFields
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Bot className="h-3.5 w-3.5" />
                Campos Robô (Bimby/MC)
              </button>
              <button
                type="button"
                onClick={addStepRow}
                className="inline-flex items-center gap-1 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Passo
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <textarea
                    rows={2}
                    value={step.instruction}
                    onChange={(e) => updateStep(step.id, { instruction: e.target.value })}
                    placeholder={`Descreve o passo ${index + 1}...`}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
                  />
                  <button
                    type="button"
                    onClick={() => removeStep(step.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {showRobotFields && (
                  <div className="grid grid-cols-3 gap-2 pl-8">
                    <input
                      type="text"
                      value={step.robotTime}
                      onChange={(e) => updateStep(step.id, { robotTime: e.target.value })}
                      placeholder="Tempo (ex: 5 min)"
                      className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={step.robotTemp}
                      onChange={(e) => updateStep(step.id, { robotTemp: e.target.value })}
                      placeholder="Temp (ex: 100°C)"
                      className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={step.robotSpeed}
                      onChange={(e) => updateStep(step.id, { robotSpeed: e.target.value })}
                      placeholder="Vel (ex: Vel. 2)"
                      className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tags, Allergens, Household Preferences */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-700">Etiquetas (Tags)</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_RECIPE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleStringItem(tags, tag, setTags)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    tags.includes(tag)
                      ? 'bg-teal-700 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tag}
                </button>
              ))}
              {tags
                .filter((t) => !SUGGESTED_RECIPE_TAGS.includes(t))
                .map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleStringItem(tags, tag, setTags)}
                    className="rounded-full bg-teal-700 px-2.5 py-1 text-xs font-medium text-white"
                  >
                    {tag} ×
                  </button>
                ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomTag();
                  }
                }}
                placeholder="Outra etiqueta..."
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={addCustomTag}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Adicionar
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-700">
              Alergénios / Restrições presentes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_ALLERGENS.map((allergen) => (
                <button
                  key={allergen}
                  type="button"
                  onClick={() =>
                    toggleStringItem(containsAllergens, allergen, setContainsAllergens)
                  }
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    containsAllergens.includes(allergen)
                      ? 'bg-rose-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {allergen}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={kidFriendly}
                onChange={(e) => setKidFriendly(e.target.checked)}
                className="h-4 w-4 rounded accent-teal-700"
              />
              Adequada para crianças
            </label>

            {humanMembers.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-600">Favorita de:</span>
                {humanMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      toggleStringItem(favoriteMemberIds, m.id, setFavoriteMemberIds)
                    }
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      favoriteMemberIds.includes(m.id)
                        ? 'bg-amber-500 text-white'
                        : 'border border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    ★ {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Notas pessoais
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Pôr menos sal para os miúdos; rende 4 tupperwares..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
          >
            {saving ? 'A guardar...' : editingRecipe ? 'Guardar alterações' : 'Criar receita'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
