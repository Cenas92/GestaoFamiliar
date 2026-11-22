import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Landmark,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  buildStarterFinanceAccounts,
  DEFAULT_JOINT_ACCOUNT_ID,
} from '../../data/starterCatalog';
import { db } from '../../db/database';
import type {
  FinanceAccount,
  FinanceAccountType,
  FinanceSplitMode,
  HouseholdMember,
  SectionColorToken,
} from '../../types/domain';
import { createSyncMetadata, nowIso } from '../../utils/id';
import { getSectionColorStyle, SECTION_COLOR_OPTIONS } from '../../utils/sectionVisuals';
import {
  FINANCE_ACCOUNT_TYPE_LABELS,
  FINANCE_SPLIT_MODE_LABELS,
  formatEur,
} from '../finances/financeVisuals';

interface FinanceAccountsEditorProps {
  accounts: FinanceAccount[];
  members: HouseholdMember[];
  deviceId: string;
  onNotify?: (msg: string) => void;
}

interface AccountDraft {
  name: string;
  accountType: FinanceAccountType;
  memberId: string;
  colorToken: SectionColorToken | string;
  initialBalance: string;
  splitMode: FinanceSplitMode;
  fixedQuota: string;
}

const ACCOUNT_TYPES: FinanceAccountType[] = [
  'joint',
  'personal',
  'savings',
  'meal_card',
  'cash',
  'other',
];

const SPLIT_MODES: FinanceSplitMode[] = ['equal', 'proportional', 'fixed'];

function parseOptionalNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100) / 100;
}

function ColorSwatchPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (token: SectionColorToken) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SECTION_COLOR_OPTIONS.map((opt) => {
        const active = value === opt.token;
        return (
          <button
            key={opt.token}
            type="button"
            onClick={() => onChange(opt.token)}
            title={opt.label}
            aria-label={`Cor ${opt.label}`}
            aria-pressed={active}
            className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
              active
                ? 'scale-110 border-slate-900 ring-2 ring-slate-900/20'
                : 'border-white shadow-xs hover:scale-105'
            } ${opt.swatchClass}`}
          >
            {active && <Check className="h-3 w-3 text-white" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

export function FinanceAccountsEditor({
  accounts,
  members,
  deviceId,
  onNotify,
}: FinanceAccountsEditorProps) {
  const orderedAccounts = useMemo(() => {
    const source = accounts.length > 0 ? accounts : buildStarterFinanceAccounts(deviceId);
    return source
      .filter((a) => !a.deletedAt && !a.isArchived)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-PT'));
  }, [accounts, deviceId]);

  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const jointAccount = orderedAccounts.find((a) => a.accountType === 'joint');
  const hasPersonalAccounts = orderedAccounts.some((a) => a.accountType === 'personal');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<AccountDraft>({
    name: '',
    accountType: 'personal',
    memberId: '',
    colorToken: 'blue',
    initialBalance: '',
    splitMode: 'equal',
    fixedQuota: '',
  });
  const [newDraft, setNewDraft] = useState<AccountDraft>({
    name: '',
    accountType: 'personal',
    memberId: '',
    colorToken: 'blue',
    initialBalance: '',
    splitMode: 'equal',
    fixedQuota: '',
  });
  const [error, setError] = useState<string | null>(null);

  const ensureSeeded = async () => {
    const count = await db.financeAccounts.count();
    if (count === 0) {
      await db.financeAccounts.bulkPut(buildStarterFinanceAccounts(deviceId));
    }
  };

  const handleQuickCoupleSetup = async () => {
    await ensureSeeded();
    const adults = members.filter((m) => m.role === 'adult');
    const maxSort = orderedAccounts.reduce((acc, a) => Math.max(acc, a.sortOrder), 0);

    const p1Name = adults[0] ? `Conta ${adults[0].name}` : 'Conta Pessoal 1';
    const p2Name = adults[1] ? `Conta ${adults[1].name}` : 'Conta Pessoal 2';

    const toCreate: FinanceAccount[] = [
      {
        ...createSyncMetadata(deviceId),
        name: p1Name,
        accountType: 'personal',
        memberId: adults[0]?.id ?? null,
        colorToken: 'blue',
        initialBalance: null,
        fixedQuota: null,
        sortOrder: maxSort + 1,
        isArchived: false,
      },
      {
        ...createSyncMetadata(deviceId),
        name: p2Name,
        accountType: 'personal',
        memberId: adults[1]?.id ?? null,
        colorToken: 'violet',
        initialBalance: null,
        fixedQuota: null,
        sortOrder: maxSort + 2,
        isArchived: false,
      },
    ];

    await db.financeAccounts.bulkPut(toCreate);
    onNotify?.(`Contas "${p1Name}" e "${p2Name}" criadas! Já podes atribuir ordenados e transferências.`);
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = newDraft.name.trim();
    if (!name) {
      setError('Indica um nome para a conta (ex.: Conta André, Poupança, Cartão Refeição).');
      return;
    }

    await ensureSeeded();
    const maxSort = orderedAccounts.reduce((acc, a) => Math.max(acc, a.sortOrder), 0);
    const created: FinanceAccount = {
      ...createSyncMetadata(deviceId),
      name,
      accountType: newDraft.accountType,
      memberId: newDraft.accountType === 'personal' ? newDraft.memberId || null : null,
      colorToken: newDraft.colorToken,
      initialBalance: parseOptionalNumber(newDraft.initialBalance),
      splitMode: newDraft.accountType === 'joint' ? newDraft.splitMode : undefined,
      fixedQuota:
        newDraft.accountType === 'personal' ? parseOptionalNumber(newDraft.fixedQuota) : null,
      sortOrder: maxSort + 1,
      isArchived: false,
    };

    await db.financeAccounts.put(created);
    setNewDraft({
      name: '',
      accountType: 'personal',
      memberId: '',
      colorToken: 'blue',
      initialBalance: '',
      splitMode: 'equal',
      fixedQuota: '',
    });
    onNotify?.(`Conta "${name}" criada.`);
  };

  const startEdit = (acc: FinanceAccount) => {
    setEditingId(acc.id);
    setEditDraft({
      name: acc.name,
      accountType: acc.accountType,
      memberId: acc.memberId ?? '',
      colorToken: acc.colorToken,
      initialBalance:
        acc.initialBalance !== null ? String(acc.initialBalance).replace('.', ',') : '',
      splitMode: acc.splitMode ?? 'equal',
      fixedQuota: acc.fixedQuota ? String(acc.fixedQuota).replace('.', ',') : '',
    });
  };

  const saveEdit = async (acc: FinanceAccount) => {
    const name = editDraft.name.trim();
    if (!name) return;
    await ensureSeeded();
    await db.financeAccounts.put({
      ...acc,
      name,
      accountType: editDraft.accountType,
      memberId: editDraft.accountType === 'personal' ? editDraft.memberId || null : null,
      colorToken: editDraft.colorToken,
      initialBalance: parseOptionalNumber(editDraft.initialBalance),
      splitMode: editDraft.accountType === 'joint' ? editDraft.splitMode : undefined,
      fixedQuota:
        editDraft.accountType === 'personal' ? parseOptionalNumber(editDraft.fixedQuota) : null,
      updatedAt: nowIso(),
      lastModifiedBy: deviceId,
    });
    setEditingId(null);
    onNotify?.(`Conta "${name}" atualizada.`);
  };

  const moveAccount = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= orderedAccounts.length) return;
    await ensureSeeded();
    const list = orderedAccounts.slice();
    const [moved] = list.splice(index, 1);
    list.splice(target, 0, moved);
    const now = nowIso();
    await db.financeAccounts.bulkPut(
      list.map((a, idx) => ({
        ...a,
        sortOrder: idx + 1,
        updatedAt: now,
        lastModifiedBy: deviceId,
      })),
    );
  };

  const removeAccount = async (acc: FinanceAccount) => {
    if (orderedAccounts.length <= 1) return;
    const fallbackId =
      orderedAccounts.find((a) => a.id !== acc.id && a.accountType === 'joint')?.id ??
      orderedAccounts.find((a) => a.id !== acc.id)?.id ??
      DEFAULT_JOINT_ACCOUNT_ID;

    const now = nowIso();
    const [allTx, allRules] = await Promise.all([
      db.financeTransactions.toArray(),
      db.financeRecurring.toArray(),
    ]);
    const txUpdates = allTx
      .filter((t) => !t.deletedAt && (t.accountId === acc.id || t.toAccountId === acc.id))
      .map((t) => ({
        ...t,
        accountId: t.accountId === acc.id ? fallbackId : t.accountId,
        toAccountId: t.toAccountId === acc.id ? fallbackId : t.toAccountId,
        updatedAt: now,
        lastModifiedBy: deviceId,
      }));
    const ruleUpdates = allRules
      .filter((r) => !r.deletedAt && r.accountId === acc.id)
      .map((r) => ({
        ...r,
        accountId: fallbackId,
        updatedAt: now,
        lastModifiedBy: deviceId,
      }));

    await db.transaction(
      'rw',
      [db.financeAccounts, db.financeTransactions, db.financeRecurring],
      async () => {
        if (txUpdates.length) await db.financeTransactions.bulkPut(txUpdates);
        if (ruleUpdates.length) await db.financeRecurring.bulkPut(ruleUpdates);
        await db.financeAccounts.put({
          ...acc,
          deletedAt: now,
          updatedAt: now,
          lastModifiedBy: deviceId,
        });
      },
    );
    onNotify?.(`Conta "${acc.name}" removida.`);
  };

  const jointUsesFixedMode = jointAccount?.splitMode === 'fixed';

  return (
    <div className="space-y-3">
      {!hasPersonalAccounts && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50/70 p-3">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-950">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden="true" />
              Modelo Casal (3 contas)
            </p>
            <p className="mt-0.5 text-[11px] text-teal-900/80">
              Cria automaticamente 2 contas pessoais além da Conta Conjunta para acompanhar saldos,
              transferências e o acerto mensal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleQuickCoupleSetup()}
            className="shrink-0 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
          >
            Criar 2 contas pessoais
          </button>
        </div>
      )}

      {/* Lista de contas */}
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {orderedAccounts.map((acc, idx) => {
          const color = getSectionColorStyle(acc.colorToken);
          const member = acc.memberId ? membersById.get(acc.memberId) : null;
          const isEditing = editingId === acc.id;

          if (isEditing) {
            return (
              <div key={acc.id} className="space-y-2.5 bg-slate-50/80 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                    aria-label="Nome da conta"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold"
                  />
                  <select
                    value={editDraft.accountType}
                    onChange={(e) =>
                      setEditDraft({
                        ...editDraft,
                        accountType: e.target.value as FinanceAccountType,
                      })
                    }
                    aria-label="Tipo de conta"
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {FINANCE_ACCOUNT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editDraft.initialBalance}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, initialBalance: e.target.value })
                    }
                    placeholder="Saldo inicial € (opcional)"
                    aria-label="Saldo inicial da conta"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
                  />

                  {editDraft.accountType === 'joint' && (
                    <select
                      value={editDraft.splitMode}
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft,
                          splitMode: e.target.value as FinanceSplitMode,
                        })
                      }
                      aria-label="Regra de divisão da conta conjunta"
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    >
                      {SPLIT_MODES.map((m) => (
                        <option key={m} value={m}>
                          Divisão: {FINANCE_SPLIT_MODE_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  )}

                  {editDraft.accountType === 'personal' && members.length > 0 && (
                    <select
                      value={editDraft.memberId}
                      onChange={(e) => setEditDraft({ ...editDraft, memberId: e.target.value })}
                      aria-label="Titular da conta"
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="">Sem membro associado</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          Titular: {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {editDraft.accountType === 'personal' && jointUsesFixedMode && (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editDraft.fixedQuota}
                    onChange={(e) => setEditDraft({ ...editDraft, fixedQuota: e.target.value })}
                    placeholder="Quota fixa mensal p/ Conjunta (€)"
                    aria-label="Quota fixa mensal para conta conjunta"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
                  />
                )}

                <ColorSwatchPicker
                  value={editDraft.colorToken}
                  onChange={(token) => setEditDraft({ ...editDraft, colorToken: token })}
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void saveEdit(acc)}
                    className="rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={acc.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${color.bgClass} ${color.textClass}`}
                >
                  <Landmark className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-xs font-bold text-slate-900">{acc.name}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {FINANCE_ACCOUNT_TYPE_LABELS[acc.accountType]}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-slate-500">
                    {member ? `Titular: ${member.name}` : ''}
                    {acc.accountType === 'joint'
                      ? `Divisão: ${FINANCE_SPLIT_MODE_LABELS[acc.splitMode ?? 'equal']}`
                      : ''}
                    {acc.initialBalance !== null
                      ? `${member || acc.accountType === 'joint' ? ' · ' : ''}Saldo inicial: ${formatEur(acc.initialBalance)}`
                      : ''}
                    {acc.accountType === 'personal' && jointUsesFixedMode && acc.fixedQuota
                      ? ` · Quota fixa: ${formatEur(acc.fixedQuota)}`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => void moveAccount(idx, -1)}
                  disabled={idx === 0}
                  aria-label={`Subir ${acc.name}`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void moveAccount(idx, 1)}
                  disabled={idx === orderedAccounts.length - 1}
                  aria-label={`Descer ${acc.name}`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(acc)}
                  aria-label={`Editar ${acc.name}`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {orderedAccounts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void removeAccount(acc)}
                    aria-label={`Remover ${acc.name}`}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Nova Conta */}
      <form onSubmit={handleAdd} className="space-y-2.5 rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-700">Adicionar conta financeira</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            value={newDraft.name}
            onChange={(e) => setNewDraft({ ...newDraft, name: e.target.value })}
            placeholder="Ex.: Conta André, Poupança, Cartão Refeição..."
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
          />
          <select
            value={newDraft.accountType}
            onChange={(e) =>
              setNewDraft({ ...newDraft, accountType: e.target.value as FinanceAccountType })
            }
            aria-label="Tipo da nova conta"
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {FINANCE_ACCOUNT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            inputMode="decimal"
            value={newDraft.initialBalance}
            onChange={(e) => setNewDraft({ ...newDraft, initialBalance: e.target.value })}
            placeholder="Saldo inicial € (opcional)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
          />
          {newDraft.accountType === 'personal' && members.length > 0 && (
            <select
              value={newDraft.memberId}
              onChange={(e) => setNewDraft({ ...newDraft, memberId: e.target.value })}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="">Titular (opcional)</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <ColorSwatchPicker
          value={newDraft.colorToken}
          onChange={(token) => setNewDraft({ ...newDraft, colorToken: token })}
        />

        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar conta
        </button>
      </form>
    </div>
  );
}
