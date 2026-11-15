import type {
  CatalogCategory,
  HouseholdRole,
  LocationColorToken,
  LocationType,
  MealSlot,
  QualitativeLevel,
  RecipeCategory,
  SupermarketSection,
  Unit,
} from '../types/domain';

export const UNITS: { value: Unit; label: string }[] = [
  { value: 'un', label: 'un (unidades)' },
  { value: 'g', label: 'g (gramas)' },
  { value: 'kg', label: 'kg (quilogramas)' },
  { value: 'ml', label: 'ml (mililitros)' },
  { value: 'L', label: 'L (litros)' },
  { value: 'tbsp', label: 'c. sopa (~15 ml)' },
  { value: 'tsp', label: 'c. chá (~5 ml)' },
];

export const QUALITATIVE_LABELS: Record<QualitativeLevel, string> = {
  full: 'Tem',
  low: 'Pouco',
  empty: 'Acabou',
};

export const CATALOG_CATEGORY_LABELS: Record<CatalogCategory, string> = {
  food: 'Alimentos',
  beverages: 'Bebidas',
  cleaning: 'Limpeza e Casa',
  hygiene_baby: 'Higiene / Crianças',
  pets: 'Animais',
  pharmacy: 'Farmácia Caseira',
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  fridge: 'Frigorífico',
  freezer: 'Congelador (avisa descongelar)',
  pantry: 'Despensa',
  household: 'Limpeza / Casa',
  pharmacy: 'Farmácia / Medicamentos',
  pets: 'Animais',
  other: 'Outro',
};

export const LOCATION_COLOR_CLASSES: Record<
  LocationColorToken,
  { badge: string; border: string; bg: string; text: string; dot: string }
> = {
  cyan: {
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    border: 'border-cyan-200',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    dot: 'bg-cyan-500',
  },
  blue: {
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
  amber: {
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  emerald: {
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  rose: {
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    border: 'border-rose-200',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
  },
  violet: {
    badge: 'bg-violet-100 text-violet-800 border-violet-200',
    border: 'border-violet-200',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
  },
  slate: {
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    border: 'border-slate-200',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    dot: 'bg-slate-500',
  },
};

export const SUPERMARKET_SECTION_ORDER: SupermarketSection[] = [
  'produce',
  'bakery',
  'meat_fish',
  'dairy',
  'pantry',
  'frozen',
  'beverages',
  'cleaning',
  'hygiene_baby',
  'pets',
  'pharmacy',
  'other',
];

export const SUPERMARKET_SECTION_LABELS: Record<SupermarketSection, string> = {
  produce: 'Fruta e Legumes',
  bakery: 'Padaria e Pastelaria',
  meat_fish: 'Talho e Peixaria',
  dairy: 'Lacticínios e Ovos',
  pantry: 'Mercearia',
  frozen: 'Congelados',
  beverages: 'Bebidas',
  cleaning: 'Limpeza e Casa',
  hygiene_baby: 'Higiene / Bebé',
  pets: 'Animais',
  pharmacy: 'Farmácia / Saúde',
  other: 'Outros',
};

export const RECIPE_CATEGORY_LABELS: Record<RecipeCategory, string> = {
  meat: 'Carne',
  fish: 'Peixe',
  vegetarian: 'Vegetariano',
  soup: 'Sopas',
  pasta_rice: 'Massas e Arroz',
  breakfast_snack: 'Peq. Almoço / Lanche',
  dessert: 'Sobremesas',
  sauce_base: 'Molhos e Bases',
  other: 'Outros',
};

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Lanche',
};

export const HOUSEHOLD_ROLE_LABELS: Record<HouseholdRole, string> = {
  adult: 'Adulto',
  child: 'Criança',
  pet: 'Animal de Estimação',
};

export const COMMON_ALLERGENS = [
  'Lactose',
  'Glúten',
  'Ovo',
  'Peixe',
  'Marisco',
  'Frutos secos',
  'Amendoim',
  'Soja',
  'Picante',
];

export const SUGGESTED_RECIPE_TAGS = [
  'Rápida (< 25 min)',
  'Para congelar',
  'Airfryer',
  'Robô de cozinha',
  'Forno',
  'Marmita',
  'Economia',
  'Dia de semana',
  'Fim de semana',
];
