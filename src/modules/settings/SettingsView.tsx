import { useEffect, useState, type ReactNode } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  Cloud,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  FolderPlus,
  HardDrive,
  HelpCircle,
  Info,
  KeyRound,
  Landmark,
  Layers,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShoppingBasket,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';
import { APP_INFO } from '../../appInfo';
import {
  COMMON_ALLERGENS,
  HOUSEHOLD_ROLE_LABELS,
  LOCATION_COLOR_CLASSES,
  LOCATION_TYPE_LABELS,
} from '../../constants/labels';
import { db } from '../../db/database';
import { checkForPwaUpdate } from '../../pwaUpdate';
import {
  clearCachedGoogleToken,
  ensureGoogleAccessToken,
  findOrCreateAppRootFolder,
  getConnectedGoogleAccount,
  getStoredGoogleClientSecret,
  hasPersistentGoogleSession,
  hasValidCachedGoogleToken,
  pickSharedFolderWithPicker,
  sanitizeGoogleClientId,
  setStoredGoogleClientSecret,
} from '../../sync/googleDriveSync';
import { exportManualBackupJson, importManualBackupJson } from '../../sync/syncService';
import { clearGoogleSyncLinked, markGoogleSyncLinked } from '../../sync/useAutoSync';
import type {
  AppSettings,
  CatalogItem,
  FinanceAccount,
  FinanceCategoryConfig,
  FinanceRecurringRule,
  FinanceTransaction,
  HouseholdMember,
  HouseholdRole,
  LocationColorToken,
  LocationType,
  ShoppingItem,
  StockLot,
  StorageLocation,
  SupermarketSectionConfig,
} from '../../types/domain';
import { createSyncMetadata, nowIso } from '../../utils/id';
import type { UiDensityMode } from '../../utils/viewPrefs';
import { CatalogManagerModal } from '../stock/CatalogManagerModal';
import { FinanceAccountsEditor } from './FinanceAccountsEditor';
import { FinanceCategoriesEditor } from './FinanceCategoriesEditor';
import { MinimumAndSurvivalStockEditor } from './MinimumAndSurvivalStockEditor';
import { SupermarketSectionsEditor } from './SupermarketSectionsEditor';

interface SettingsViewProps {
  settings: AppSettings;
  members: HouseholdMember[];
  locations: StorageLocation[];
  supermarketSections?: SupermarketSectionConfig[];
  catalogItems?: CatalogItem[];
  stockLots?: StockLot[];
  shoppingItems?: ShoppingItem[];
  financeAccounts?: FinanceAccount[];
  financeCategories?: FinanceCategoryConfig[];
  financeRecurring?: FinanceRecurringRule[];
  financeTransactions?: FinanceTransaction[];
  uiDensity?: UiDensityMode;
  initialOpenSection?: SettingsSectionId | null;
  onConsumeInitialSection?: () => void;
  onChangeUiDensity?: (mode: UiDensityMode) => void;
  onSyncNow: () => Promise<string>;
}

const COLOR_OPTIONS: LocationColorToken[] = [
  'cyan',
  'blue',
  'amber',
  'emerald',
  'violet',
  'rose',
  'slate',
];

interface MemberDraft {
  name: string;
  role: HouseholdRole;
  notes: string;
  allergies: string[];
  servingsWeight: string;
}

function defaultWeightForRole(role: HouseholdRole): number {
  return role === 'adult' ? 1 : role === 'child' ? 0.5 : 0;
}

function createEmptyMemberDraft(): MemberDraft {
  return {
    name: '',
    role: 'adult',
    notes: '',
    allergies: [],
    servingsWeight: '1',
  };
}

function MemberFormFields({
  draft,
  onChange,
}: {
  draft: MemberDraft;
  onChange: (next: MemberDraft) => void;
}) {
  const handleRoleChange = (nextRole: HouseholdRole) => {
    onChange({
      ...draft,
      role: nextRole,
      allergies: nextRole === 'pet' ? [] : draft.allergies,
      servingsWeight: String(defaultWeightForRole(nextRole)),
    });
  };

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="Nome (ex: André, Maria, Max...)"
          aria-label="Nome do membro"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:col-span-2"
        />
        <select
          value={draft.role}
          onChange={(e) => handleRoleChange(e.target.value as HouseholdRole)}
          aria-label="Papel no agregado"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
        >
          <option value="adult">Adulto</option>
          <option value="child">Criança</option>
          <option value="pet">Animal de Estimação</option>
        </select>
        {draft.role !== 'pet' && (
          <input
            type="number"
            min="0"
            max="5"
            step="0.25"
            value={draft.servingsWeight}
            onChange={(e) => onChange({ ...draft, servingsWeight: e.target.value })}
            aria-label="Peso na ementa (doses)"
            title="Peso na ementa (doses)"
            placeholder="Doses (ex: 1)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
          />
        )}
      </div>

      <input
        type="text"
        value={draft.notes}
        onChange={(e) => onChange({ ...draft, notes: e.target.value })}
        placeholder="Preferências / notas (ex: Não gosta de coentros, Ração sénior...)"
        aria-label="Preferências ou notas"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
      />

      {draft.role !== 'pet' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Restrições:</span>
          {COMMON_ALLERGENS.map((al) => (
            <button
              key={al}
              type="button"
              onClick={() =>
                onChange({
                  ...draft,
                  allergies: draft.allergies.includes(al)
                    ? draft.allergies.filter((x) => x !== al)
                    : [...draft.allergies, al],
                })
              }
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                draft.allergies.includes(al)
                  ? 'bg-rose-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {al}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export type SettingsSectionId =
  | 'interface'
  | 'members'
  | 'locations'
  | 'min_stock'
  | 'sections'
  | 'finance_accounts'
  | 'finance_categories'
  | 'catalog'
  | 'sync'
  | 'backup'
  | 'about';

function AccordionSection({
  title,
  icon,
  badge,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  badge?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/80"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-900">
          {icon}
          <span className="truncate">{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              {badge}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-teal-700' : ''
            }`}
          />
        </span>
      </button>
      {isOpen && <div className="space-y-3 border-t border-slate-100 p-4">{children}</div>}
    </section>
  );
}

export function SettingsView({
  settings,
  members,
  locations,
  supermarketSections = [],
  catalogItems = [],
  stockLots = [],
  shoppingItems = [],
  financeAccounts = [],
  financeCategories = [],
  financeRecurring = [],
  financeTransactions = [],
  uiDensity = 'clean',
  initialOpenSection = null,
  onConsumeInitialSection,
  onChangeUiDensity,
  onSyncNow,
}: SettingsViewProps) {
  const [openSection, setOpenSection] = useState<SettingsSectionId | null>(initialOpenSection);
  useEffect(() => {
    if (initialOpenSection) {
      setOpenSection(initialOpenSection);
      onConsumeInitialSection?.();
    }
  }, [initialOpenSection, onConsumeInitialSection]);
  const toggleSection = (id: SettingsSectionId) =>
    setOpenSection((prev) => (prev === id ? null : id));
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [clientId, setClientId] = useState(settings.googleClientId);
  const [clientSecret, setClientSecret] = useState(() => getStoredGoogleClientSecret());
  const [showSecret, setShowSecret] = useState(false);
  const [, setSessionRev] = useState(0);
  const [pickerApiKey, setPickerApiKey] = useState(
    () => localStorage.getItem('gf_google_picker_key') ?? '',
  );
  const [manualFolderId, setManualFolderId] = useState(settings.googleDriveFolderId ?? '');
  const [warningDays, setWarningDays] = useState(String(settings.expiryWarningDays));
  const [showGuide, setShowGuide] = useState(false);

  // Member form (create + inline edit)
  const [newMember, setNewMember] = useState<MemberDraft>(createEmptyMemberDraft);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberDraft, setEditMemberDraft] = useState<MemberDraft>(createEmptyMemberDraft);

  // Location form
  const [locName, setLocName] = useState('');
  const [locType, setLocType] = useState<LocationType>('other');
  const [locColor, setLocColor] = useState<LocationColorToken>('slate');

  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateMsg(null);
    try {
      const result = await checkForPwaUpdate();
      if (result === 'updated') {
        setUpdateMsg('Nova versão encontrada! A app vai atualizar em instantes…');
      } else if (result === 'up-to-date') {
        setUpdateMsg(`Já estás na versão mais recente (v${APP_INFO.version}).`);
      } else if (result === 'offline') {
        setUpdateMsg('Sem ligação à internet para verificar atualizações.');
      } else {
        setUpdateMsg('Atualizações automáticas indisponíveis neste modo de execução.');
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  const flashSuccess = (msg: string) => {
    setErrorMsg(null);
    setStatusMsg(msg);
  };

  const flashError = (err: unknown) => {
    setStatusMsg(null);
    setErrorMsg(err instanceof Error ? err.message : 'Ocorreu um erro.');
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedDays = Math.max(1, Math.min(60, Number(warningDays) || 5));
    const cleanClientId = sanitizeGoogleClientId(clientId);
    setClientId(cleanClientId);
    setStoredGoogleClientSecret(clientSecret);
    localStorage.setItem('gf_google_picker_key', pickerApiKey.trim());
    await db.settings.update('singleton', {
      expiryWarningDays: parsedDays,
      googleClientId: cleanClientId,
    });
    setSessionRev((n) => n + 1);
    flashSuccess('Definições guardadas localmente.');
  };

  const handleCreateOrFindFolder = async () => {
    const cleanClientId = sanitizeGoogleClientId(clientId);
    setClientId(cleanClientId);
    setStoredGoogleClientSecret(clientSecret);
    setBusy(true);
    try {
      // Obtain token first to preserve mobile browser user-gesture activation
      const token = await ensureGoogleAccessToken(cleanClientId, true);
      const folder = await findOrCreateAppRootFolder(token);
      await db.settings.update('singleton', {
        googleClientId: cleanClientId,
        googleDriveFolderId: folder.id,
        googleDriveFolderName: folder.name,
      });
      markGoogleSyncLinked();
      setManualFolderId(folder.id);
      setSessionRev((n) => n + 1);
      flashSuccess(`Pasta "${folder.name}" ligada (ID: ${folder.id.slice(0, 10)}…).`);
    } catch (err) {
      flashError(err);
    } finally {
      setBusy(false);
    }
  };

  const handlePickSharedFolder = async () => {
    const cleanClientId = sanitizeGoogleClientId(clientId);
    setClientId(cleanClientId);
    setStoredGoogleClientSecret(clientSecret);
    localStorage.setItem('gf_google_picker_key', pickerApiKey.trim());
    setBusy(true);
    try {
      const token = await ensureGoogleAccessToken(cleanClientId, true);
      const picked = await pickSharedFolderWithPicker(token, pickerApiKey);
      if (picked) {
        await db.settings.update('singleton', {
          googleClientId: cleanClientId,
          googleDriveFolderId: picked.id,
          googleDriveFolderName: picked.name,
        });
        markGoogleSyncLinked();
        setManualFolderId(picked.id);
        flashSuccess(`Pasta partilhada "${picked.name}" selecionada.`);
      }
      setSessionRev((n) => n + 1);
    } catch (err) {
      flashError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveManualFolderId = async () => {
    const clean = manualFolderId.trim();
    await db.settings.update('singleton', {
      googleDriveFolderId: clean || null,
      googleDriveFolderName: clean ? 'Pasta Drive (ID manual)' : null,
    });
    flashSuccess('ID da pasta atualizado.');
  };

  const handleActivatePermanentSession = async () => {
    const cleanClientId = sanitizeGoogleClientId(clientId);
    setClientId(cleanClientId);
    setStoredGoogleClientSecret(clientSecret);
    setBusy(true);
    try {
      if (cleanClientId !== settings.googleClientId) {
        await db.settings.update('singleton', { googleClientId: cleanClientId });
      }
      await ensureGoogleAccessToken(cleanClientId, true, { forceReauth: true });
      markGoogleSyncLinked();
      setSessionRev((n) => n + 1);
      if (hasPersistentGoogleSession(cleanClientId)) {
        const account = getConnectedGoogleAccount();
        flashSuccess(
          `Ligação permanente ativada${account ? ` para ${account.email}` : ''}! Já não precisas de relogar a cada hora.`,
        );
      } else {
        flashSuccess(
          'Conta ligada, mas a Google não devolveu token permanente (autorização antiga sem offline). Clica em "Terminar sessão Google" e volta a ativar.',
        );
      }
    } catch (err) {
      flashError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    const cleanClientId = sanitizeGoogleClientId(clientId);
    setClientId(cleanClientId);
    setStoredGoogleClientSecret(clientSecret);
    setBusy(true);
    try {
      if (cleanClientId !== settings.googleClientId) {
        await db.settings.update('singleton', { googleClientId: cleanClientId });
      }
      const summary = await onSyncNow();
      setSessionRev((n) => n + 1);
      flashSuccess(summary);
    } catch (err) {
      flashError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleExportJson = async () => {
    setBusy(true);
    try {
      const json = await exportManualBackupJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gestao-familiar-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flashSuccess('Backup exportado em JSON.');
    } catch (err) {
      flashError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleImportJson = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const res = await importManualBackupJson(text);
      flashSuccess(`Backup importado (+${res.added} novos, ${res.updated} atualizados).`);
    } catch (err) {
      flashError(err);
    } finally {
      setBusy(false);
    }
  };

  const parseServingsWeight = (raw: string, role: HouseholdRole): number => {
    if (role === 'pet') return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultWeightForRole(role);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.name.trim()) return;
    const member: HouseholdMember = {
      ...createSyncMetadata(settings.deviceId),
      name: newMember.name.trim(),
      role: newMember.role,
      dietaryNotes: newMember.notes.trim(),
      allergies: newMember.role === 'pet' ? [] : newMember.allergies,
      defaultServingsWeight: parseServingsWeight(newMember.servingsWeight, newMember.role),
      avatarColor: '#0f766e',
    };
    await db.members.put(member);
    setNewMember(createEmptyMemberDraft());
  };

  const startEditMember = (m: HouseholdMember) => {
    setEditingMemberId(m.id);
    setEditMemberDraft({
      name: m.name,
      role: m.role,
      notes: m.dietaryNotes,
      allergies: [...m.allergies],
      servingsWeight: String(m.defaultServingsWeight),
    });
  };

  const handleSaveEditMember = async (e: React.FormEvent, original: HouseholdMember) => {
    e.preventDefault();
    if (!editMemberDraft.name.trim()) return;
    await db.members.put({
      ...original,
      name: editMemberDraft.name.trim(),
      role: editMemberDraft.role,
      dietaryNotes: editMemberDraft.notes.trim(),
      allergies: editMemberDraft.role === 'pet' ? [] : editMemberDraft.allergies,
      defaultServingsWeight: parseServingsWeight(
        editMemberDraft.servingsWeight,
        editMemberDraft.role,
      ),
      updatedAt: nowIso(),
      lastModifiedBy: settings.deviceId,
    });
    setEditingMemberId(null);
  };

  const deleteMember = async (m: HouseholdMember) => {
    const now = nowIso();
    await db.members.put({
      ...m,
      deletedAt: now,
      updatedAt: now,
      lastModifiedBy: settings.deviceId,
    });
    if (editingMemberId === m.id) {
      setEditingMemberId(null);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locName.trim()) return;
    const maxOrder = locations.reduce((m, l) => Math.max(m, l.sortOrder), 0);
    const loc: StorageLocation = {
      ...createSyncMetadata(settings.deviceId),
      name: locName.trim(),
      locationType: locType,
      colorToken: locColor,
      icon: 'box',
      sortOrder: maxOrder + 1,
    };
    await db.locations.put(loc);
    setLocName('');
  };

  const deleteLocation = async (loc: StorageLocation) => {
    const now = nowIso();
    await db.locations.put({
      ...loc,
      deletedAt: now,
      updatedAt: now,
      lastModifiedBy: settings.deviceId,
    });
  };

  const connectedAccount = getConnectedGoogleAccount();
  const cleanCurrentClientId = sanitizeGoogleClientId(clientId);
  const hasPersistentSession = hasPersistentGoogleSession(cleanCurrentClientId);
  const hasActiveAccessToken = hasValidCachedGoogleToken();

  return (
    <div className="space-y-3.5">
      {statusMsg && (
        <div className="rounded-xl bg-teal-900 px-3.5 py-2.5 text-xs font-medium text-white">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* Interface Mode (Clean vs Complete pre-1.2.0) */}
      <AccordionSection
        title="Aspeto e Vista da App"
        icon={
          uiDensity === 'complete' ? (
            <Layers className="h-4 w-4 shrink-0 text-indigo-700" />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0 text-teal-700" />
          )
        }
        badge={uiDensity === 'complete' ? 'Completa' : 'Clean'}
        isOpen={openSection === 'interface'}
        onToggle={() => toggleSection('interface')}
      >
        <p className="text-xs text-slate-500">
          Escolhe como queres ver a aplicação neste dispositivo. Podes também alternar rapidamente
          no botão do cabeçalho superior.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onChangeUiDensity?.('clean')}
            aria-pressed={uiDensity === 'clean'}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
              uiDensity === 'clean'
                ? 'border-teal-600 bg-teal-50/70 ring-1 ring-teal-600'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Sparkles className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                Vista Clean (predefinida)
              </span>
              {uiDensity === 'clean' && (
                <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold text-white">
                  Ativa
                </span>
              )}
            </div>
            <p className="text-[11px] leading-snug text-slate-600">
              Menos ruído visual: Hoje calmo, listas em linha por defeito e filtros recolhidos no
              telemóvel.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChangeUiDensity?.('complete')}
            aria-pressed={uiDensity === 'complete'}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
              uiDensity === 'complete'
                ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Layers className="h-3.5 w-3.5 text-indigo-700" aria-hidden="true" />
                Vista Completa (pré-1.2.0)
              </span>
              {uiDensity === 'complete' && (
                <span className="rounded-full bg-indigo-700 px-2 py-0.5 text-[10px] font-bold text-white">
                  Ativa
                </span>
              )}
            </div>
            <p className="text-[11px] leading-snug text-slate-600">
              Atalhos rápidos e stock mínimo em Hoje, filtros visíveis por defeito, Catálogo direto
              e cartões padrão.
            </p>
          </button>
        </div>
      </AccordionSection>

      {/* Household Members */}
      <AccordionSection
        title="Agregado Familiar (Casal, Filhos e Animais)"
        icon={<Users className="h-4 w-4 shrink-0 text-teal-700" />}
        badge={`${members.length}`}
        isOpen={openSection === 'members'}
        onToggle={() => toggleSection('members')}
      >
        {members.length > 0 && (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {members.map((m) =>
              editingMemberId === m.id ? (
                <form
                  key={m.id}
                  onSubmit={(e) => handleSaveEditMember(e, m)}
                  className="space-y-2.5 bg-teal-50/40 p-3"
                >
                  <MemberFormFields draft={editMemberDraft} onChange={setEditMemberDraft} />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Guardar alterações
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMemberId(null)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {m.name}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        ({HOUSEHOLD_ROLE_LABELS[m.role]}
                        {m.role !== 'pet' ? ` · ${m.defaultServingsWeight} dose(s)` : ''})
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {m.allergies.length > 0 && `Alergias: ${m.allergies.join(', ')}`}
                      {m.allergies.length > 0 && m.dietaryNotes ? ' · ' : ''}
                      {m.dietaryNotes}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEditMember(m)}
                      aria-label={`Editar ${m.name}`}
                      title="Editar membro"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMember(m)}
                      aria-label={`Remover ${m.name}`}
                      title="Remover membro"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        <form onSubmit={handleAddMember} className="space-y-2.5 rounded-xl bg-slate-50 p-3">
          <MemberFormFields draft={newMember} onChange={setNewMember} />

          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar membro
          </button>
        </form>
      </AccordionSection>

      {/* Storage Locations */}
      <AccordionSection
        title="Locais de Armazenamento"
        icon={<MapPin className="h-4 w-4 shrink-0 text-teal-700" />}
        badge={`${locations.length}`}
        isOpen={openSection === 'locations'}
        onToggle={() => toggleSection('locations')}
      >
        <div className="flex flex-wrap gap-2">
          {locations.map((loc) => {
            const colors = LOCATION_COLOR_CLASSES[loc.colorToken];
            return (
              <div
                key={loc.id}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${colors.badge}`}
              >
                <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                <span>{loc.name}</span>
                {locations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteLocation(loc)}
                    className="opacity-60 hover:text-rose-700 hover:opacity-100"
                    title="Remover local"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddLocation} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
          <input
            type="text"
            value={locName}
            onChange={(e) => setLocName(e.target.value)}
            placeholder="Novo local (ex: Arca, Garrafeira...)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:col-span-2"
          />
          <select
            value={locType}
            onChange={(e) => setLocType(e.target.value as LocationType)}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
          >
            {Object.entries(LOCATION_TYPE_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <select
              value={locColor}
              onChange={(e) => setLocColor(e.target.value as LocationColorToken)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs"
            >
              {COLOR_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  Cor: {c}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Criar
            </button>
          </div>
        </form>
      </AccordionSection>

      {/* Minimum Stock & Survival Reserve */}
      <AccordionSection
        title="Stocks Mínimos e Sobrevivência"
        icon={<ShieldAlert className="h-4 w-4 shrink-0 text-teal-700" />}
        badge={`${
          catalogItems.filter(
            (c) =>
              (c.minStockQty !== null && c.minStockQty > 0) ||
              (c.survivalTargetQty !== undefined &&
                c.survivalTargetQty !== null &&
                c.survivalTargetQty > 0),
          ).length
        }`}
        isOpen={openSection === 'min_stock'}
        onToggle={() => toggleSection('min_stock')}
      >
        <MinimumAndSurvivalStockEditor
          catalogItems={catalogItems}
          stockLots={stockLots}
          locations={locations}
          shoppingItems={shoppingItems}
          expiryWarningDays={settings.expiryWarningDays}
          deviceId={settings.deviceId}
          onNotify={(msg) => setStatusMsg(msg)}
        />
      </AccordionSection>

      {/* Supermarket Sections / Aisles */}
      <AccordionSection
        title="Corredores do Supermercado"
        icon={<ShoppingBasket className="h-4 w-4 shrink-0 text-teal-700" />}
        badge={`${supermarketSections.length || 12}`}
        isOpen={openSection === 'sections'}
        onToggle={() => toggleSection('sections')}
      >
        <SupermarketSectionsEditor
          sections={supermarketSections}
          catalogItems={catalogItems}
          shoppingItems={shoppingItems}
          deviceId={settings.deviceId}
          onNotify={(msg) => setStatusMsg(msg)}
        />
      </AccordionSection>

      {/* Finance Accounts (Joint + Personal + Transfers) */}
      <AccordionSection
        title="Contas Financeiras"
        icon={<Landmark className="h-4 w-4 shrink-0 text-teal-700" />}
        badge={`${financeAccounts.filter((a) => !a.isArchived).length || 1}`}
        isOpen={openSection === 'finance_accounts'}
        onToggle={() => toggleSection('finance_accounts')}
      >
        <FinanceAccountsEditor
          accounts={financeAccounts}
          members={members}
          deviceId={settings.deviceId}
          onNotify={(msg) => setStatusMsg(msg)}
        />
      </AccordionSection>

      {/* Finance Categories */}
      <AccordionSection
        title="Categorias Financeiras"
        icon={<Wallet className="h-4 w-4 shrink-0 text-teal-700" />}
        badge={`${financeCategories.length || 20}`}
        isOpen={openSection === 'finance_categories'}
        onToggle={() => toggleSection('finance_categories')}
      >
        <FinanceCategoriesEditor
          categories={financeCategories}
          recurringRules={financeRecurring}
          transactions={financeTransactions}
          deviceId={settings.deviceId}
          onNotify={(msg) => setStatusMsg(msg)}
        />
      </AccordionSection>

      {/* Product Catalog & Minimum Stock Settings */}
      <AccordionSection
        title="Catálogo de Produtos Base"
        icon={<BookOpen className="h-4 w-4 shrink-0 text-teal-700" />}
        badge={`${catalogItems.length}`}
        isOpen={openSection === 'catalog'}
        onToggle={() => toggleSection('catalog')}
      >
        <p className="text-xs text-slate-500">
          Gere os produtos base da casa, a secção habitual no supermercado e os alertas de stock
          mínimo.
        </p>
        <button
          type="button"
          onClick={() => setCatalogModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <BookOpen className="h-4 w-4 text-teal-700" aria-hidden="true" />
          Gerir catálogo de produtos ({catalogItems.length})
        </button>
      </AccordionSection>

      {/* Google Drive Sync & Preferences */}
      <AccordionSection
        title="Sincronização Privada (Google Drive) e Alertas"
        icon={<Cloud className="h-4 w-4 shrink-0 text-teal-700" />}
        badge={settings.googleDriveFolderId ? 'Ligada' : `${settings.expiryWarningDays}d`}
        isOpen={openSection === 'sync'}
        onToggle={() => toggleSection('sync')}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Sincronização privada por pasta Google Drive e dias de aviso de validade.
          </p>
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            <HelpCircle className="h-3.5 w-3.5 text-teal-700" />
            {showGuide ? 'Ocultar guia' : 'Como configurar?'}
          </button>
        </div>

        {showGuide && (
          <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/70 p-3.5 text-xs text-teal-950">
            <p className="font-bold">
              Configurar Sincronização Google Drive (Casal / Multi-dispositivo)
            </p>

            <ol className="list-decimal space-y-1.5 pl-4">
              <li>
                Acede a <strong>console.cloud.google.com</strong> e seleciona ou cria um projeto
                gratuito.
              </li>
              <li>
                Na pesquisa de topo, ativa <strong>Google Drive API</strong> (e opcionalmente{' '}
                <strong>Google Picker API</strong>).
              </li>
              <li>
                No menu <strong>Google Auth Platform → Visão geral → Vamos começar</strong> (ou{' '}
                <em>Branding</em> e <em>Público-alvo</em>): escolhe <em>Externo</em>. Para evitar que
                o login expire aos <strong>7 dias</strong>, muda o estado em{' '}
                <strong>Público-alvo → Publicar aplicativo</strong> para{' '}
                <strong>Em produção</strong> (não precisa de verificação da Google para uso
                familiar privado; no 1.º login basta tocar em{' '}
                <em>Avançadas → Aceder a Gestão Familiar</em>). Se preferires manter{' '}
                <em>Em teste</em>, adiciona os emails em <em>Utilizadores de teste</em>.
              </li>
              <li>
                Em <strong>Google Auth Platform → Clientes → Criar cliente</strong> (
                <em>Aplicativo da Web</em>), adiciona em <em>Origens JavaScript autorizadas</em> e{' '}
                <em>URIs de redirecionamento autorizados</em> exatamente:{' '}
                <code className="rounded bg-white px-1 py-0.5">{window.location.origin}</code>{' '}
                (<strong>sem</strong> <code>/GestaoFamiliar/</code> nem barra final).
              </li>
              <li>
                Copia o <strong>ID do cliente</strong> (termina em{' '}
                <code>.apps.googleusercontent.com</code>) e a{' '}
                <strong>Chave secreta do cliente (Client Secret)</strong> (<code>GOCSPX-...</code>)
                e cola ambos abaixo → <em>Guardar definições</em>. O{' '}
                <em>Client Secret</em> permite renovar o acesso automaticamente sem pedir login a
                cada hora.
              </li>
              <li>
                <strong>1.º dispositivo:</strong> clica em{' '}
                <em>Criar / Ligar pasta GestaoFamiliar</em>; no ecrã da Google clica{' '}
                <em>Continuar</em> e <strong>marca a caixa de permissão do Google Drive</strong>.
                Depois clica em <em>Sincronizar agora</em>.
              </li>
              <li>
                <strong>Casal (outra conta Google):</strong> no Google Drive do 1.º dispositivo,
                partilha a pasta <code>GestaoFamiliar</code> com o outro Gmail como{' '}
                <strong>Editor</strong>.
              </li>
              <li>
                <strong>2.º dispositivo (mesma conta ou Casal):</strong> cola o mesmo{' '}
                <em>ID do cliente</em>, guarda e clica em{' '}
                <em>Criar / Ligar pasta GestaoFamiliar</em> (ou cola o mesmo{' '}
                <em>ID da Pasta Drive → Fixar</em>), autoriza marcando a caixa do Drive e clica{' '}
                <em>Sincronizar agora</em>.
              </li>
            </ol>

            <p className="rounded-lg bg-white/80 px-2.5 py-1.5 text-[11px] text-teal-900">
              <strong>Dica:</strong> depois de ligado, a app sincroniza automaticamente ~3,5 s após
              editar, ao abrir ou ao voltar à internet. No telemóvel também podes{' '}
              <strong>arrastar o ecrã para baixo</strong> no topo para atualizar.
            </p>
          </div>
        )}

        {/* Connected Google account status */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800">
              {connectedAccount
                ? `Conta ligada: ${connectedAccount.email}`
                : 'Conta Google ainda não ligada neste dispositivo'}
            </p>
            <p className="text-[11px] text-slate-500">
              {hasPersistentSession
                ? 'Renovação automática ativa em segundo plano (sem relogar a cada hora).'
                : hasActiveAccessToken
                  ? clientSecret.trim()
                    ? 'Sessão temporária (~1h). Toca em "Ativar ligação permanente" para não voltar a pedir login.'
                    : 'Sessão temporária (~1h). Adiciona o Client Secret abaixo para login automático permanente.'
                  : 'Toca em Sincronizar ou Ativar ligação permanente para autenticar.'}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              hasPersistentSession
                ? 'bg-emerald-100 text-emerald-800'
                : hasActiveAccessToken
                  ? 'bg-sky-100 text-sky-800'
                  : 'bg-slate-200 text-slate-600'
            }`}
          >
            {hasPersistentSession ? 'Permanente' : hasActiveAccessToken ? 'Temporária (1h)' : 'Desligada'}
          </span>
        </div>

        <form onSubmit={handleSaveGeneral} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Avisar validade com antecedência (dias)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={warningDays}
                onChange={(e) => setWarningDays(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Google OAuth Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="123456789-xxxxx.apps.googleusercontent.com"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="google-client-secret"
              className="mb-1 block text-xs font-semibold text-slate-600"
            >
              Google OAuth Client Secret{' '}
              <span className="font-normal text-slate-400">
                (opcional, recomendado para login automático permanente)
              </span>
            </label>
            <div className="flex gap-1.5">
              <input
                id="google-client-secret"
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="GOCSPX-... (guardado apenas neste dispositivo)"
                autoComplete="off"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSecret((prev) => !prev)}
                aria-label={showSecret ? 'Ocultar Client Secret' : 'Mostrar Client Secret'}
                className="rounded-xl border border-slate-200 bg-white px-2.5 text-slate-500 hover:bg-slate-50"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Google API Key (para Picker no 2.º dispositivo)
              </label>
              <input
                type="text"
                value={pickerApiKey}
                onChange={(e) => setPickerApiKey(e.target.value)}
                placeholder="AIzaSy... (opcional)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                ID da Pasta Drive ({settings.googleDriveFolderName ?? 'nenhuma'})
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={manualFolderId}
                  onChange={(e) => setManualFolderId(e.target.value)}
                  placeholder="ID da pasta partilhada"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={handleSaveManualFolderId}
                  className="rounded-xl border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Fixar
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Guardar definições
            </button>
            <button
              type="button"
              disabled={busy || !clientId.trim()}
              onClick={handleCreateOrFindFolder}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FolderPlus className="h-4 w-4 text-teal-700" />
              Criar / Ligar pasta GestaoFamiliar
            </button>
            <button
              type="button"
              disabled={busy || !clientId.trim()}
              onClick={handlePickSharedFolder}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FolderOpen className="h-4 w-4 text-teal-700" />
              Escolher pasta partilhada (Picker)
            </button>
            <button
              type="button"
              disabled={busy || !clientId.trim() || !settings.googleDriveFolderId}
              onClick={handleSync}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              Sincronizar agora
            </button>
            {clientId.trim() && clientSecret.trim() && !hasPersistentSession && (
              <button
                type="button"
                disabled={busy}
                onClick={handleActivatePermanentSession}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4 text-emerald-700" />
                Ativar ligação permanente
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                clearCachedGoogleToken();
                clearGoogleSyncLinked();
                setSessionRev((n) => n + 1);
                flashSuccess('Sessão Google limpa neste dispositivo.');
              }}
              className="rounded-xl px-3 py-2 text-xs text-slate-500 hover:bg-slate-100"
            >
              Terminar sessão Google
            </button>
          </div>

          {statusMsg && (
            <div className="rounded-xl bg-teal-900 px-3 py-2 text-xs font-medium text-white">
              {statusMsg}
            </div>
          )}
          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
              {errorMsg}
            </div>
          )}
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>
            Última sync:{' '}
            {settings.lastSyncAt
              ? new Date(settings.lastSyncAt).toLocaleString('pt-PT')
              : 'Nunca sincronizado'}
            {settings.googleDriveFolderId
              ? ` · Pasta: ${settings.googleDriveFolderId.slice(0, 12)}…`
              : ''}
          </span>
          <span>ID do dispositivo: {settings.deviceId}</span>
        </div>
      </AccordionSection>

      {/* Offline Manual JSON Backup */}
      <AccordionSection
        title="Backup Manual Offline (Exportar / Importar JSON)"
        icon={<HardDrive className="h-4 w-4 shrink-0 text-teal-700" />}
        badge="JSON"
        isOpen={openSection === 'backup'}
        onToggle={() => toggleSection('backup')}
      >
        <p className="text-xs text-slate-500">
          Permite guardar uma cópia completa (incluindo fotos e anexos) ou sincronizar por ficheiro
          sem usar a API do Google Drive.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-teal-700" />
            Exportar Backup (.json)
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Upload className="h-4 w-4 text-teal-700" />
            Importar / Fundir Backup (.json)
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => handleImportJson(e.target.files?.[0])}
            />
          </label>
        </div>
      </AccordionSection>

      {/* About / Acerca */}
      <AccordionSection
        title="Acerca"
        icon={<Info className="h-4 w-4 shrink-0 text-teal-700" />}
        badge={`v${APP_INFO.version}`}
        isOpen={openSection === 'about'}
        onToggle={() => toggleSection('about')}
      >
        <dl className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-medium text-slate-500">Aplicação</dt>
            <dd className="font-semibold text-slate-900">{APP_INFO.name}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-slate-500">Criador</dt>
            <dd className="font-semibold text-slate-900">{APP_INFO.creator}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-slate-500">Versão</dt>
            <dd className="font-semibold text-slate-900">
              v{APP_INFO.version}
              {APP_INFO.buildDate
                ? ` · ${new Date(APP_INFO.buildDate).toLocaleDateString('pt-PT')}`
                : ''}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={checkingUpdate}
            onClick={handleCheckUpdate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-teal-700 ${checkingUpdate ? 'animate-spin' : ''}`} />
            {checkingUpdate ? 'A verificar…' : 'Procurar atualização'}
          </button>

          <a
            href={APP_INFO.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
          >
            GitHub
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {updateMsg && (
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">
            {updateMsg}
          </p>
        )}
      </AccordionSection>

      <CatalogManagerModal
        open={catalogModalOpen}
        onClose={() => setCatalogModalOpen(false)}
        catalogItems={catalogItems}
        locations={locations}
        supermarketSections={supermarketSections}
        deviceId={settings.deviceId}
      />
    </div>
  );
}
