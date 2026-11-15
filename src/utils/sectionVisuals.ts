import {
  Apple,
  Baby,
  Beef,
  Croissant,
  CupSoda,
  Milk,
  Package,
  PawPrint,
  Pill,
  Snowflake,
  SprayCan,
  Wheat,
} from 'lucide-react';
import type { TypeVisualMeta } from '../components/TypeIconBadge';
import type { SupermarketSection } from '../types/domain';

export const SUPERMARKET_SECTION_VISUALS: Record<SupermarketSection, TypeVisualMeta> = {
  produce: {
    Icon: Apple,
    label: 'Fruta e Legumes',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-700',
  },
  bakery: {
    Icon: Croissant,
    label: 'Padaria e Pastelaria',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
  },
  meat_fish: {
    Icon: Beef,
    label: 'Talho e Peixaria',
    bgClass: 'bg-rose-100',
    textClass: 'text-rose-700',
  },
  dairy: {
    Icon: Milk,
    label: 'Lacticínios e Ovos',
    bgClass: 'bg-sky-100',
    textClass: 'text-sky-700',
  },
  pantry: {
    Icon: Wheat,
    label: 'Mercearia',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
  },
  frozen: {
    Icon: Snowflake,
    label: 'Congelados',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700',
  },
  beverages: {
    Icon: CupSoda,
    label: 'Bebidas',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
  },
  cleaning: {
    Icon: SprayCan,
    label: 'Limpeza e Casa',
    bgClass: 'bg-teal-100',
    textClass: 'text-teal-700',
  },
  hygiene_baby: {
    Icon: Baby,
    label: 'Higiene / Bebé',
    bgClass: 'bg-pink-100',
    textClass: 'text-pink-700',
  },
  pets: {
    Icon: PawPrint,
    label: 'Animais',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-800',
  },
  pharmacy: {
    Icon: Pill,
    label: 'Farmácia / Saúde',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
  },
  other: {
    Icon: Package,
    label: 'Outros',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-600',
  },
};

export function getSupermarketSectionVisual(section: SupermarketSection): TypeVisualMeta {
  return SUPERMARKET_SECTION_VISUALS[section] ?? SUPERMARKET_SECTION_VISUALS.other;
}
