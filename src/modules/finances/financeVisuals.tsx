import {
  Baby,
  Briefcase,
  Car,
  CreditCard,
  Droplets,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  type LucideIcon,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  Shield,
  ShoppingCart,
  Tag,
  Tv,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import type { TypeVisualMeta } from '../../components/TypeIconBadge';
import type {
  FinanceAccountType,
  FinanceCategoryConfig,
  FinanceCategoryIconKey,
  FinanceKind,
  FinanceRecurringFrequency,
  FinanceSplitMode,
  SectionColorToken,
} from '../../types/domain';
import { getSectionColorStyle } from '../../utils/sectionVisuals';

export interface FinanceIconOption {
  key: FinanceCategoryIconKey;
  label: string;
  Icon: LucideIcon;
}

export const FINANCE_ICON_OPTIONS: FinanceIconOption[] = [
  { key: 'wallet', label: 'Carteira', Icon: Wallet },
  { key: 'briefcase', label: 'Ordenado', Icon: Briefcase },
  { key: 'piggy_bank', label: 'Poupança', Icon: PiggyBank },
  { key: 'home', label: 'Casa', Icon: Home },
  { key: 'zap', label: 'Energia', Icon: Zap },
  { key: 'droplets', label: 'Água', Icon: Droplets },
  { key: 'wifi', label: 'Telecom', Icon: Wifi },
  { key: 'shield', label: 'Seguros', Icon: Shield },
  { key: 'car', label: 'Carro', Icon: Car },
  { key: 'shopping_cart', label: 'Supermercado', Icon: ShoppingCart },
  { key: 'utensils', label: 'Restaurantes', Icon: Utensils },
  { key: 'heart_pulse', label: 'Saúde', Icon: HeartPulse },
  { key: 'graduation_cap', label: 'Educação', Icon: GraduationCap },
  { key: 'baby', label: 'Crianças', Icon: Baby },
  { key: 'paw_print', label: 'Animais', Icon: PawPrint },
  { key: 'plane', label: 'Viagens', Icon: Plane },
  { key: 'gift', label: 'Lazer / Presentes', Icon: Gift },
  { key: 'tv', label: 'Subscrições', Icon: Tv },
  { key: 'wrench', label: 'Manutenção', Icon: Wrench },
  { key: 'credit_card', label: 'Cartão', Icon: CreditCard },
  { key: 'receipt', label: 'Fatura', Icon: Receipt },
  { key: 'tag', label: 'Outros', Icon: Tag },
];

export const FINANCE_KIND_LABELS: Record<FinanceKind, string> = {
  income: 'Receita',
  fixed: 'Despesa fixa',
  variable: 'Despesa variável',
  transfer: 'Transferência',
};

export const FINANCE_KIND_PLURAL_LABELS: Record<'income' | 'fixed' | 'variable', string> = {
  income: 'Receitas',
  fixed: 'Despesas fixas',
  variable: 'Despesas variáveis',
};

export const FINANCE_ACCOUNT_TYPE_LABELS: Record<FinanceAccountType, string> = {
  joint: 'Conta Conjunta',
  personal: 'Conta Pessoal',
  savings: 'Poupança',
  meal_card: 'Cartão Refeição',
  cash: 'Dinheiro',
  other: 'Outra',
};

export const FINANCE_SPLIT_MODE_LABELS: Record<FinanceSplitMode, string> = {
  equal: '50% / 50% (igual)',
  proportional: 'Proporcional aos ordenados',
  fixed: 'Quota fixa por pessoa',
};

export const FINANCE_FREQUENCY_LABELS: Record<FinanceRecurringFrequency, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

export interface DefaultFinanceCategorySpec {
  id: string;
  name: string;
  kind: 'income' | 'fixed' | 'variable';
  colorToken: SectionColorToken;
  icon: FinanceCategoryIconKey;
  sortOrder: number;
}

export const DEFAULT_FINANCE_CATEGORY_SPECS: DefaultFinanceCategorySpec[] = [
  // Receitas
  { id: 'fin-cat-salary', name: 'Ordenado', kind: 'income', colorToken: 'emerald', icon: 'briefcase', sortOrder: 1 },
  { id: 'fin-cat-allowances', name: 'Subsídios / Apoios', kind: 'income', colorToken: 'teal', icon: 'piggy_bank', sortOrder: 2 },
  { id: 'fin-cat-other-income', name: 'Outras receitas', kind: 'income', colorToken: 'cyan', icon: 'wallet', sortOrder: 3 },

  // Despesas Fixas
  { id: 'fin-cat-housing', name: 'Casa / Renda / Prestação', kind: 'fixed', colorToken: 'blue', icon: 'home', sortOrder: 10 },
  { id: 'fin-cat-utilities', name: 'Luz / Gás / Água', kind: 'fixed', colorToken: 'amber', icon: 'zap', sortOrder: 11 },
  { id: 'fin-cat-telecom', name: 'Telecomunicações', kind: 'fixed', colorToken: 'sky', icon: 'wifi', sortOrder: 12 },
  { id: 'fin-cat-insurance', name: 'Seguros', kind: 'fixed', colorToken: 'violet', icon: 'shield', sortOrder: 13 },
  { id: 'fin-cat-car-fixed', name: 'Carro / IUC / Portagens', kind: 'fixed', colorToken: 'slate', icon: 'car', sortOrder: 14 },
  { id: 'fin-cat-education', name: 'Educação / Creche', kind: 'fixed', colorToken: 'pink', icon: 'graduation_cap', sortOrder: 15 },
  { id: 'fin-cat-subscriptions', name: 'Subscrições', kind: 'fixed', colorToken: 'orange', icon: 'tv', sortOrder: 16 },
  { id: 'fin-cat-other-fixed', name: 'Outras fixas', kind: 'fixed', colorToken: 'slate', icon: 'receipt', sortOrder: 17 },

  // Despesas Variáveis
  { id: 'fin-cat-groceries', name: 'Supermercado', kind: 'variable', colorToken: 'emerald', icon: 'shopping_cart', sortOrder: 20 },
  { id: 'fin-cat-dining', name: 'Restaurantes / Cafés', kind: 'variable', colorToken: 'orange', icon: 'utensils', sortOrder: 21 },
  { id: 'fin-cat-fuel', name: 'Combustível / Transportes', kind: 'variable', colorToken: 'amber', icon: 'car', sortOrder: 22 },
  { id: 'fin-cat-health', name: 'Saúde / Farmácia', kind: 'variable', colorToken: 'rose', icon: 'heart_pulse', sortOrder: 23 },
  { id: 'fin-cat-home-tech', name: 'Casa / Eletrodomésticos', kind: 'variable', colorToken: 'teal', icon: 'wrench', sortOrder: 24 },
  { id: 'fin-cat-shopping', name: 'Compras / Roupa', kind: 'variable', colorToken: 'pink', icon: 'credit_card', sortOrder: 25 },
  { id: 'fin-cat-leisure', name: 'Lazer / Viagens', kind: 'variable', colorToken: 'sky', icon: 'plane', sortOrder: 26 },
  { id: 'fin-cat-pets', name: 'Animais', kind: 'variable', colorToken: 'yellow', icon: 'paw_print', sortOrder: 27 },
  { id: 'fin-cat-other-variable', name: 'Outras variáveis', kind: 'variable', colorToken: 'slate', icon: 'tag', sortOrder: 28 },
];

export function getFinanceIconComponent(iconKey?: string | null): LucideIcon {
  const match = FINANCE_ICON_OPTIONS.find((opt) => opt.key === iconKey);
  return match?.Icon ?? Tag;
}

export function getFinanceCategoryVisual(category?: FinanceCategoryConfig | null): TypeVisualMeta {
  const colorStyle = getSectionColorStyle(category?.colorToken ?? 'slate');
  const Icon = getFinanceIconComponent(category?.icon);
  return {
    Icon,
    bgClass: colorStyle.bgClass,
    textClass: colorStyle.textClass,
    label: category?.name ?? 'Sem categoria',
  };
}

export function formatEur(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatSignedEur(amount: number, kind: FinanceKind): string {
  const formatted = formatEur(Math.abs(amount));
  if (kind === 'income') return `+${formatted}`;
  if (kind === 'transfer') return `⇄ ${formatted}`;
  return `−${formatted}`;
}
