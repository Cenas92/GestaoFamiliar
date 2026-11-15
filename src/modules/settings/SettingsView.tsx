import { useState } from 'react';
import {
  Cloud,
  Download,
  FolderOpen,
  FolderPlus,
  HelpCircle,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import {
  COMMON_ALLERGENS,
  HOUSEHOLD_ROLE_LABELS,
  LOCATION_COLOR_CLASSES,
  LOCATION_TYPE_LABELS,
} from '../../constants/labels';
import { db } from '../../db/database';
import {
  clearCachedGoogleToken,
  ensureGoogleAccessToken,
  findOrCreateAppRootFolder,
  pickSharedFolderWithPicker,
} from '../../sync/googleDriveSync';
import { exportManualBackupJson, importManualBackupJson } from '../../sync/syncService';
import type {
  AppSettings,
  HouseholdMember,
  HouseholdRole,
  LocationColorToken,
  LocationType,
  StorageLocation,
} from '../../types/domain';
import { createSyncMetadata, nowIso } from '../../utils/id';

interface SettingsViewProps {
  settings: AppSettings;
  members: HouseholdMember[];
  locations: StorageLocation[];
  onSyncNow: () => Promise<void>;
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

export function SettingsView({
  settings,
  members,
  locations,
  onSyncNow,
}: SettingsViewProps) {
  const [clientId, setClientId] = useState(settings.googleClientId);
  const [pickerApiKey, setPickerApiKey] = useState(
    () => localStorage.getItem('gf_google_picker_key') ?? '',
  );
  const [manualFolderId, setManualFolderId] = useState(settings.googleDriveFolderId ?? '');
  const [warningDays, setWarningDays] = useState(String(settings.expiryWarningDays));
  const [showGuide, setShowGuide] = useState(false);

  // Member form
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<HouseholdRole>('adult');
  const [memberAllergies, setMemberAllergies] = useState<string[]>([]);
  const [memberNotes, setMemberNotes] = useState('');

  // Location form
  const [locName, setLocName] = useState('');
  const [locType, setLocType] = useState<LocationType>('other');
  const [locColor, setLocColor] = useState<LocationColorToken>('slate');

  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    localStorage.setItem('gf_google_picker_key', pickerApiKey.trim());
    await db.settings.update('singleton', {
      expiryWarningDays: parsedDays,
      googleClientId: clientId.trim(),
    });
    flashSuccess('Definições guardadas localmente.');
  };

  const handleCreateOrFindFolder = async () => {
    setBusy(true);
    try {
      await db.settings.update('singleton', { googleClientId: clientId.trim() });
      const token = await ensureGoogleAccessToken(clientId.trim(), true);
      const folder = await findOrCreateAppRootFolder(token);
      await db.settings.update('singleton', {
        googleDriveFolderId: folder.id,
        googleDriveFolderName: folder.name,
      });
      setManualFolderId(folder.id);
      flashSuccess(`Pasta "${folder.name}" ligada com sucesso.`);
    } catch (err) {
      flashError(err);
    } finally {
      setBusy(false);
    }
  };

  const handlePickSharedFolder = async () => {
    setBusy(true);
    try {
      await db.settings.update('singleton', { googleClientId: clientId.trim() });
      localStorage.setItem('gf_google_picker_key', pickerApiKey.trim());
      const token = await ensureGoogleAccessToken(clientId.trim(), true);
      const picked = await pickSharedFolderWithPicker(token, pickerApiKey);
      if (picked) {
        await db.settings.update('singleton', {
          googleDriveFolderId: picked.id,
          googleDriveFolderName: picked.name,
        });
        setManualFolderId(picked.id);
        flashSuccess(`Pasta partilhada "${picked.name}" selecionada.`);
      }
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

  const handleSync = async () => {
    setBusy(true);
    try {
      await db.settings.update('singleton', { googleClientId: clientId.trim() });
      await onSyncNow();
      flashSuccess('Sincronização com Google Drive concluída.');
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

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) return;
    const member: HouseholdMember = {
      ...createSyncMetadata(settings.deviceId),
      name: memberName.trim(),
      role: memberRole,
      dietaryNotes: memberNotes.trim(),
      allergies: memberAllergies,
      defaultServingsWeight: memberRole === 'adult' ? 1 : memberRole === 'child' ? 0.5 : 0,
      avatarColor: '#0f766e',
    };
    await db.members.put(member);
    setMemberName('');
    setMemberAllergies([]);
    setMemberNotes('');
  };

  const deleteMember = async (m: HouseholdMember) => {
    const now = nowIso();
    await db.members.put({
      ...m,
      deletedAt: now,
      updatedAt: now,
      lastModifiedBy: settings.deviceId,
    });
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Definições e Família</h1>
        <p className="text-xs text-slate-500">
          Perfis do agregado, locais de armazenamento, backups e sincronização Google Drive
        </p>
      </div>

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

      {/* Household Members */}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Users className="h-4 w-4 text-teal-700" />
          Agregado Familiar (Casal, Filhos e Animais)
        </h2>

        {members.length > 0 && (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold text-slate-800">
                    {m.name}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      ({HOUSEHOLD_ROLE_LABELS[m.role]})
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {m.allergies.length > 0 && `Alergias: ${m.allergies.join(', ')}`}
                    {m.allergies.length > 0 && m.dietaryNotes ? ' · ' : ''}
                    {m.dietaryNotes}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMember(m)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddMember} className="space-y-2.5 rounded-xl bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              type="text"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="Nome (ex: André, Maria, Max...)"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:col-span-2"
            />
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as HouseholdRole)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
            >
              <option value="adult">Adulto</option>
              <option value="child">Criança</option>
              <option value="pet">Animal de Estimação</option>
            </select>
          </div>

          <input
            type="text"
            value={memberNotes}
            onChange={(e) => setMemberNotes(e.target.value)}
            placeholder="Preferências / notas (ex: Não gosta de coentros, Ração sénior...)"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
          />

          {memberRole !== 'pet' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Restrições:</span>
              {COMMON_ALLERGENS.map((al) => (
                <button
                  key={al}
                  type="button"
                  onClick={() =>
                    setMemberAllergies((prev) =>
                      prev.includes(al) ? prev.filter((x) => x !== al) : [...prev, al],
                    )
                  }
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    memberAllergies.includes(al)
                      ? 'bg-rose-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {al}
                </button>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar membro
          </button>
        </form>
      </section>

      {/* Storage Locations */}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <MapPin className="h-4 w-4 text-teal-700" />
          Locais de Armazenamento
        </h2>

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
      </section>

      {/* Google Drive Sync & Preferences */}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Cloud className="h-4 w-4 text-teal-700" />
            Sincronização Privada (Google Drive) e Alertas
          </h2>
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
          <div className="space-y-2 rounded-xl border border-teal-200 bg-teal-50/70 p-3.5 text-xs text-teal-950">
            <p className="font-bold">Guia rápido (100% gratuito, sem servidores terceiros):</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                Acede a <strong>console.cloud.google.com</strong> e cria um projeto (ex:
                "GestaoFamiliar").
              </li>
              <li>
                Em <strong>APIs &amp; Services → Library</strong>, ativa{' '}
                <strong>Google Drive API</strong> e <strong>Google Picker API</strong>.
              </li>
              <li>
                Em <strong>OAuth consent screen</strong>, escolhe <em>External</em> (em modo{' '}
                <em>Testing</em>) e adiciona os 2 emails Gmail (teu e da tua mulher) em{' '}
                <strong>Test users</strong>.
              </li>
              <li>
                Em <strong>Credentials → Create Credentials → OAuth Client ID</strong> (Web
                application), adiciona em <em>Authorized JavaScript origins</em>:{' '}
                <code className="rounded bg-white px-1 py-0.5">{window.location.origin}</code>
              </li>
              <li>
                Cria também uma <strong>API Key</strong> (opcional, usada apenas no Google Picker do
                2.º telemóvel para escolher a pasta partilhada).
              </li>
              <li>
                <strong>No 1.º telemóvel:</strong> cola o Client ID e clica em{' '}
                <em>Criar / Ligar pasta GestaoFamiliar</em>. Depois partilha essa pasta no Google
                Drive com a tua mulher (como <em>Editor</em>).
              </li>
              <li>
                <strong>No 2.º telemóvel:</strong> cola o mesmo Client ID (+ API Key) e clica em{' '}
                <em>Escolher pasta partilhada (Picker)</em> para selecionar a pasta partilhada.
              </li>
            </ol>
          </div>
        )}

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
            <button
              type="button"
              onClick={() => {
                clearCachedGoogleToken();
                flashSuccess('Sessão Google limpa neste dispositivo.');
              }}
              className="rounded-xl px-3 py-2 text-xs text-slate-500 hover:bg-slate-100"
            >
              Terminar sessão Google
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>
            Última sync:{' '}
            {settings.lastSyncAt
              ? new Date(settings.lastSyncAt).toLocaleString('pt-PT')
              : 'Nunca sincronizado'}
          </span>
          <span>ID do dispositivo: {settings.deviceId}</span>
        </div>
      </section>

      {/* Offline Manual JSON Backup */}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900">
          Backup Manual Offline (Exportar / Importar JSON)
        </h2>
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
      </section>
    </div>
  );
}
