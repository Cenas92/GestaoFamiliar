import {
  Apple,
  Baby,
  Beef,
  Carrot,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Fish,
  type LucideIcon,
  Milk,
  Package,
  PawPrint,
  Pill,
  ShoppingBasket,
  Snowflake,
  Sparkles,
  SprayCan,
  Wheat,
} from 'lucide-react';
import type { TypeVisualMeta } from '../components/TypeIconBadge';
import type {
  SectionColorToken,
  SectionIconKey,
  SupermarketSection,
  SupermarketSectionConfig,
} from '../types/domain';

export interface SectionColorOption {
  token: SectionColorToken;
  label: string;
  bgClass: string;
  textClass: string;
  swatchClass: string;
}

export const SECTION_COLOR_OPTIONS: SectionColorOption[] = [
  { token: 'emerald', label: 'Verde', bgClass: 'bg-emerald-100', textClass: 'text-emerald-700', swatchClass: 'bg-emerald-500' },
  { token: 'amber', label: 'Âmbar', bgClass: 'bg-amber-100', textClass: 'text-amber-700', swatchClass: 'bg-amber-500' },
  { token: 'rose', label: 'Rosa forte', bgClass: 'bg-rose-100', textClass: 'text-rose-700', swatchClass: 'bg-rose-500' },
  { token: 'sky', label: 'Azul claro', bgClass: 'bg-sky-100', textClass: 'text-sky-700', swatchClass: 'bg-sky-500' },
  { token: 'orange', label: 'Laranja', bgClass: 'bg-orange-100', textClass: 'text-orange-700', swatchClass: 'bg-orange-500' },
  { token: 'cyan', label: 'Ciano', bgClass: 'bg-cyan-100', textClass: 'text-cyan-700', swatchClass: 'bg-cyan-500' },
  { token: 'blue', label: 'Azul', bgClass: 'bg-blue-100', textClass: 'text-blue-700', swatchClass: 'bg-blue-500' },
  { token: 'teal', label: 'Turquesa', bgClass: 'bg-teal-100', textClass: 'text-teal-700', swatchClass: 'bg-teal-500' },
  { token: 'pink', label: 'Cor-de-rosa', bgClass: 'bg-pink-100', textClass: 'text-pink-700', swatchClass: 'bg-pink-500' },
  { token: 'yellow', label: 'Amarelo', bgClass: 'bg-yellow-100', textClass: 'text-yellow-800', swatchClass: 'bg-yellow-500' },
  { token: 'red', label: 'Vermelho', bgClass: 'bg-red-100', textClass: 'text-red-700', swatchClass: 'bg-red-500' },
  { token: 'violet', label: 'Violeta', bgClass: 'bg-violet-100', textClass: 'text-violet-700', swatchClass: 'bg-violet-500' },
  { token: 'slate', label: 'Cinza', bgClass: 'bg-slate-100', textClass: 'text-slate-600', swatchClass: 'bg-slate-500' },
];

export interface SectionIconOption {
  key: SectionIconKey;
  label: string;
  Icon: LucideIcon;
}

export const SECTION_ICON_OPTIONS: SectionIconOption[] = [
  { key: 'apple', label: 'Fruta', Icon: Apple },
  { key: 'carrot', label: 'Legumes', Icon: Carrot },
  { key: 'croissant', label: 'Padaria', Icon: Croissant },
  { key: 'beef', label: 'Talho', Icon: Beef },
  { key: 'fish', label: 'Peixaria', Icon: Fish },
  { key: 'milk', label: 'Lacticínios', Icon: Milk },
  { key: 'wheat', label: 'Mercearia', Icon: Wheat },
  { key: 'cookie', label: 'Bolachas/Snacks', Icon: Cookie },
  { key: 'snowflake', label: 'Congelados', Icon: Snowflake },
  { key: 'cup_soda', label: 'Bebidas', Icon: CupSoda },
  { key: 'coffee', label: 'Café/Chá', Icon: Coffee },
  { key: 'spray_can', label: 'Limpeza', Icon: SprayCan },
  { key: 'sparkles', label: 'Casa/Extra', Icon: Sparkles },
  { key: 'baby', label: 'Higiene/Bebé', Icon: Baby },
  { key: 'paw_print', label: 'Animais', Icon: PawPrint },
  { key: 'pill', label: 'Farmácia', Icon: Pill },
  { key: 'shopping_basket', label: 'Cesto', Icon: ShoppingBasket },
  { key: 'package', label: 'Outros', Icon: Package },
];

export interface DefaultSupermarketSectionSpec {
  id: string;
  name: string;
  colorToken: SectionColorToken;
  icon: SectionIconKey;
  sortOrder: number;
}

export const DEFAULT_SUPERMARKET_SECTION_SPECS: DefaultSupermarketSectionSpec[] = [
  { id: 'produce', name: 'Fruta e Legumes', colorToken: 'emerald', icon: 'apple', sortOrder: 1 },
  { id: 'bakery', name: 'Padaria e Pastelaria', colorToken: 'amber', icon: 'croissant', sortOrder: 2 },
  { id: 'meat_fish', name: 'Talho e Peixaria', colorToken: 'rose', icon: 'beef', sortOrder: 3 },
  { id: 'dairy', name: 'Lacticínios e Ovos', colorToken: 'sky', icon: 'milk', sortOrder: 4 },
  { id: 'pantry', name: 'Mercearia', colorToken: 'orange', icon: 'wheat', sortOrder: 5 },
  { id: 'frozen', name: 'Congelados', colorToken: 'cyan', icon: 'snowflake', sortOrder: 6 },
  { id: 'beverages', name: 'Bebidas', colorToken: 'blue', icon: 'cup_soda', sortOrder: 7 },
  { id: 'cleaning', name: 'Limpeza e Casa', colorToken: 'teal', icon: 'spray_can', sortOrder: 8 },
  { id: 'hygiene_baby', name: 'Higiene / Bebé', colorToken: 'pink', icon: 'baby', sortOrder: 9 },
  { id: 'pets', name: 'Animais', colorToken: 'yellow', icon: 'paw_print', sortOrder: 10 },
  { id: 'pharmacy', name: 'Farmácia / Saúde', colorToken: 'red', icon: 'pill', sortOrder: 11 },
  { id: 'other', name: 'Outros', colorToken: 'slate', icon: 'package', sortOrder: 12 },
];

const COLOR_MAP = new Map<string, SectionColorOption>(
  SECTION_COLOR_OPTIONS.map((option) => [option.token, option]),
);
const ICON_MAP = new Map<string, SectionIconOption>(
  SECTION_ICON_OPTIONS.map((option) => [option.key, option]),
);

export function getSectionColorStyle(colorToken: string): SectionColorOption {
  return COLOR_MAP.get(colorToken) ?? SECTION_COLOR_OPTIONS[SECTION_COLOR_OPTIONS.length - 1];
}

export function getSectionIconComponent(iconKey: string): LucideIcon {
  return ICON_MAP.get(iconKey)?.Icon ?? Package;
}

export const SUPERMARKET_SECTION_VISUALS: Record<SupermarketSection, TypeVisualMeta> = Object.fromEntries(
  DEFAULT_SUPERMARKET_SECTION_SPECS.map((spec) => {
    const color = getSectionColorStyle(spec.colorToken);
    return [
      spec.id,
      {
        Icon: getSectionIconComponent(spec.icon),
        label: spec.name,
        bgClass: color.bgClass,
        textClass: color.textClass,
      },
    ];
  }),
);

export type OrderedSectionItem = Pick<
  SupermarketSectionConfig,
  'id' | 'name' | 'colorToken' | 'icon' | 'sortOrder'
>;

export function getOrderedSupermarketSections(
  customSections?: SupermarketSectionConfig[],
): OrderedSectionItem[] {
  if (customSections && customSections.length > 0) {
    return customSections
      .filter((section) => !section.deletedAt)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt'));
  }
  return DEFAULT_SUPERMARKET_SECTION_SPECS;
}

export function getSupermarketSectionLabel(
  sectionId: SupermarketSection,
  customSections?: SupermarketSectionConfig[],
): string {
  const custom = customSections?.find((section) => section.id === sectionId && !section.deletedAt);
  if (custom) {
    return custom.name;
  }
  return DEFAULT_SUPERMARKET_SECTION_SPECS.find((spec) => spec.id === sectionId)?.name ?? 'Outros';
}

export function getSupermarketSectionVisual(
  section: SupermarketSection,
  customSections?: SupermarketSectionConfig[],
): TypeVisualMeta {
  const custom = customSections?.find((item) => item.id === section && !item.deletedAt);
  if (custom) {
    const color = getSectionColorStyle(custom.colorToken);
    return {
      Icon: getSectionIconComponent(custom.icon),
      label: custom.name,
      bgClass: color.bgClass,
      textClass: color.textClass,
    };
  }
  return SUPERMARKET_SECTION_VISUALS[section] ?? SUPERMARKET_SECTION_VISUALS.other;
}
