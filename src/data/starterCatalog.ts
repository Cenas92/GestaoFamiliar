import type {
  CatalogCategory,
  CatalogItem,
  FinanceAccount,
  FinanceCategoryConfig,
  LocationColorToken,
  LocationType,
  StorageLocation,
  SupermarketSection,
  SupermarketSectionConfig,
  TrackingMode,
  Unit,
} from '../types/domain';
import { DEFAULT_FINANCE_CATEGORY_SPECS } from '../modules/finances/financeVisuals';
import { DEFAULT_SUPERMARKET_SECTION_SPECS } from '../utils/sectionVisuals';

const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

interface LocationSeed {
  id: string;
  name: string;
  locationType: LocationType;
  colorToken: LocationColorToken;
  icon: string;
  sortOrder: number;
}

export const STARTER_LOCATIONS: LocationSeed[] = [
  {
    id: 'starter-loc-fridge',
    name: 'Frigorífico',
    locationType: 'fridge',
    colorToken: 'cyan',
    icon: 'refrigerator',
    sortOrder: 1,
  },
  {
    id: 'starter-loc-freezer',
    name: 'Congelador',
    locationType: 'freezer',
    colorToken: 'blue',
    icon: 'snowflake',
    sortOrder: 2,
  },
  {
    id: 'starter-loc-pantry',
    name: 'Despensa',
    locationType: 'pantry',
    colorToken: 'amber',
    icon: 'archive',
    sortOrder: 3,
  },
  {
    id: 'starter-loc-household',
    name: 'Casa e Higiene',
    locationType: 'household',
    colorToken: 'emerald',
    icon: 'sparkles',
    sortOrder: 4,
  },
  {
    id: 'starter-loc-pets',
    name: 'Animais',
    locationType: 'pets',
    colorToken: 'violet',
    icon: 'paw-print',
    sortOrder: 5,
  },
  {
    id: 'starter-loc-pharmacy',
    name: 'Farmácia Caseira',
    locationType: 'pharmacy',
    colorToken: 'rose',
    icon: 'cross',
    sortOrder: 6,
  },
];

interface CatalogSeed {
  slug: string;
  name: string;
  aliases?: string[];
  category: CatalogCategory;
  trackingMode: TrackingMode;
  defaultUnit: Unit;
  defaultLocationId: string;
  supermarketSection: SupermarketSection;
  minStockQty?: number | null;
}

const RAW_CATALOG: CatalogSeed[] = [
  // Fruta e Legumes
  { slug: 'tomate', name: 'Tomate', aliases: ['tomate chucha', 'tomate coracao', 'tomate cereja'], category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'cebola', name: 'Cebola', aliases: ['cebola roxa'], category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'produce' },
  { slug: 'alho', name: 'Alho', aliases: ['dentes de alho'], category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'produce' },
  { slug: 'batata', name: 'Batata', aliases: ['batata branca', 'batata vermelha'], category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'produce' },
  { slug: 'batata-doce', name: 'Batata-doce', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'produce' },
  { slug: 'cenoura', name: 'Cenoura', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'curgete', name: 'Curgete', aliases: ['courgette'], category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'alface', name: 'Alface', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'espinafres', name: 'Espinafres', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'brocolos', name: 'Brócolos', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'couve-flor', name: 'Couve-flor', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'couve-portuguesa', name: 'Couve portuguesa / lombarda', aliases: ['couve caldo verde'], category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'abobora', name: 'Abóbora', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'pimento', name: 'Pimento', aliases: ['pimento vermelho', 'pimento verde'], category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'pepino', name: 'Pepino', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'cogumelos', name: 'Cogumelos', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'alho-frances', name: 'Alho-francês', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'coentros', name: 'Coentros', category: 'food', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'salsa', name: 'Salsa', category: 'food', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'limao', name: 'Limão', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'laranja', name: 'Laranja', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'produce' },
  { slug: 'maca', name: 'Maçã', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'produce' },
  { slug: 'banana', name: 'Banana', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'produce' },
  { slug: 'pera', name: 'Pera', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'produce' },
  { slug: 'morangos', name: 'Morangos / Frutos vermelhos', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },

  // Talho e Peixaria
  { slug: 'peito-frango', name: 'Frango (peito / coxas)', aliases: ['peito de frango', 'frango'], category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-freezer', supermarketSection: 'meat_fish' },
  { slug: 'bifes-peru', name: 'Peru (bifes / peito)', aliases: ['peru'], category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-freezer', supermarketSection: 'meat_fish' },
  { slug: 'carne-picada', name: 'Carne picada', aliases: ['vaca picada', 'porco picado'], category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-freezer', supermarketSection: 'meat_fish' },
  { slug: 'lombo-porco', name: 'Carne de porco (bifes / lombo)', aliases: ['febras'], category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-freezer', supermarketSection: 'meat_fish' },
  { slug: 'carne-vaca-estufar', name: 'Carne de vaca (estufar / bifes)', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-freezer', supermarketSection: 'meat_fish' },
  { slug: 'bacon', name: 'Bacon / Toucinho', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'meat_fish' },
  { slug: 'chourico', name: 'Chouriço / Alheira', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'meat_fish' },
  { slug: 'fiambre', name: 'Fiambre', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'meat_fish' },
  { slug: 'bacalhau', name: 'Bacalhau (postas / desfiado)', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-freezer', supermarketSection: 'meat_fish' },
  { slug: 'salmao', name: 'Salmão', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-freezer', supermarketSection: 'meat_fish' },
  { slug: 'pescada', name: 'Pescada (lombos / filetes)', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-freezer', supermarketSection: 'frozen' },
  { slug: 'dourada-robalo', name: 'Dourada / Robalo', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-freezer', supermarketSection: 'meat_fish' },
  { slug: 'camarao', name: 'Camarão / Miolo de camarão', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-freezer', supermarketSection: 'frozen' },

  // Lacticínios e Ovos
  { slug: 'leite', name: 'Leite', aliases: ['leite meio-gordo', 'leite magro', 'leite gordo'], category: 'food', trackingMode: 'exact', defaultUnit: 'L', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'dairy', minStockQty: 2 },
  { slug: 'ovos', name: 'Ovos', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'dairy', minStockQty: 6 },
  { slug: 'manteiga', name: 'Manteiga', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'dairy' },
  { slug: 'queijo-fatiado', name: 'Queijo fatiado', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'dairy' },
  { slug: 'queijo-ralado', name: 'Queijo ralado / Mozzarella', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'dairy' },
  { slug: 'queijo-fresco', name: 'Requeijão / Queijo fresco', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'dairy' },
  { slug: 'iogurte-natural', name: 'Iogurte natural', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'dairy' },
  { slug: 'iogurtes-criancas', name: 'Iogurtes (aromas / líquidos)', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'dairy' },
  { slug: 'natas', name: 'Natas', aliases: ['natas culinaria'], category: 'food', trackingMode: 'exact', defaultUnit: 'ml', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'dairy' },
  { slug: 'bebida-vegetal', name: 'Bebida vegetal (aveia / amêndoa)', category: 'food', trackingMode: 'exact', defaultUnit: 'L', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'dairy' },

  // Congelados
  { slug: 'ervilhas-congeladas', name: 'Ervilhas congeladas', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-freezer', supermarketSection: 'frozen' },
  { slug: 'milho-congelado', name: 'Milho doce', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'feijao-verde', name: 'Feijão-verde', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'produce' },
  { slug: 'pao-forma-congelado', name: 'Pão / Broa / Carcaças', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'bakery' },
  { slug: 'massa-folhada', name: 'Massa folhada / quebrada', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'dairy' },

  // Mercearia Base e Conservas
  { slug: 'arroz', name: 'Arroz', aliases: ['arroz agulha', 'arroz carolino', 'arroz basmati'], category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry', minStockQty: 500 },
  { slug: 'massa-esparguete', name: 'Massa (esparguete / penne / macarrão)', aliases: ['esparguete', 'penne', 'fusilli'], category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry', minStockQty: 500 },
  { slug: 'farinha-trigo', name: 'Farinha de trigo', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'amido-milho', name: 'Amido de milho (Maizena)', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'aveia', name: 'Flocos de aveia', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'acucar', name: 'Açúcar', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'mel', name: 'Mel', category: 'food', trackingMode: 'qualitative', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'fermento-po', name: 'Fermento em pó', category: 'food', trackingMode: 'qualitative', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'pao-ralado', name: 'Pão ralado', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'polpa-tomate', name: 'Polpa de tomate / Tomate pelado', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'atum-lata', name: 'Atum em lata', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry', minStockQty: 3 },
  { slug: 'sardinhas-lata', name: 'Sardinhas / Cavalas em conserva', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'grao-bico', name: 'Grão-de-bico (cozido / seco)', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'feijao', name: 'Feijão (encarnado / preto / manteiga)', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'lentilhas', name: 'Lentilhas', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'azeite', name: 'Azeite', category: 'food', trackingMode: 'qualitative', defaultUnit: 'ml', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry', minStockQty: 1 },
  { slug: 'oleo-vegetal', name: 'Óleo alimentar', category: 'food', trackingMode: 'qualitative', defaultUnit: 'ml', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'vinagre', name: 'Vinagre / Vinagre balsâmico', category: 'food', trackingMode: 'qualitative', defaultUnit: 'ml', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'vinho-branco-culinaria', name: 'Vinho branco para cozinhar', category: 'food', trackingMode: 'qualitative', defaultUnit: 'ml', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'beverages' },
  { slug: 'molho-soja', name: 'Molho de soja', category: 'food', trackingMode: 'qualitative', defaultUnit: 'ml', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'mostarda', name: 'Mostarda / Maionese / Ketchup', category: 'food', trackingMode: 'qualitative', defaultUnit: 'g', defaultLocationId: 'starter-loc-fridge', supermarketSection: 'pantry' },
  { slug: 'chocolate-tablete', name: 'Chocolate de culinária / Cacau', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'bolachas', name: 'Bolachas / Tostas', category: 'food', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'cereais', name: 'Cereais pequeno-almoço', category: 'food', trackingMode: 'exact', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'cafe', name: 'Café (cápsulas / moído)', category: 'beverages', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'beverages' },
  { slug: 'agua-engarrafada', name: 'Água engarrafada', category: 'beverages', trackingMode: 'exact', defaultUnit: 'L', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'beverages' },

  // Temperos e Especiarias (qualitativos)
  { slug: 'sal', name: 'Sal fino / Sal grosso', category: 'food', trackingMode: 'qualitative', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'pimenta-preta', name: 'Pimenta preta', category: 'food', trackingMode: 'qualitative', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'louro', name: 'Folha de louro', category: 'food', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'oregãos', name: 'Orégãos', category: 'food', trackingMode: 'qualitative', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'colorau', name: 'Colorau / Paprika', category: 'food', trackingMode: 'qualitative', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'cominhos', name: 'Cominhos', category: 'food', trackingMode: 'qualitative', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'caril', name: 'Caril / Açafrão', category: 'food', trackingMode: 'qualitative', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'canela', name: 'Canela em pó / pau', category: 'food', trackingMode: 'qualitative', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },
  { slug: 'noz-moscada', name: 'Noz-moscada', category: 'food', trackingMode: 'qualitative', defaultUnit: 'g', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'pantry' },

  // Casa e Limpeza
  { slug: 'detergente-roupa', name: 'Detergente da roupa', category: 'cleaning', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'cleaning', minStockQty: 1 },
  { slug: 'amaciador-roupa', name: 'Amaciador da roupa', category: 'cleaning', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'cleaning' },
  { slug: 'pastilhas-maquina-loica', name: 'Pastilhas máquina da loiça', category: 'cleaning', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'cleaning', minStockQty: 10 },
  { slug: 'detergente-loica-manual', name: 'Detergente loiça manual', category: 'cleaning', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'cleaning' },
  { slug: 'lixivia-multiusos', name: 'Lixívia / Spray multiusos', category: 'cleaning', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'cleaning' },
  { slug: 'detergente-chao', name: 'Detergente para o chão', category: 'cleaning', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'cleaning' },
  { slug: 'sacos-lixo', name: 'Sacos do lixo', category: 'cleaning', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'cleaning', minStockQty: 1 },
  { slug: 'rolo-cozinha', name: 'Rolo de cozinha', category: 'cleaning', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'cleaning', minStockQty: 2 },
  { slug: 'papel-aluminio-pelicula', name: 'Papel alumínio / Película / Vegetal', category: 'cleaning', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-pantry', supermarketSection: 'cleaning' },

  // Higiene Pessoal e Crianças / Bebé
  { slug: 'papel-higienico', name: 'Papel higiénico', category: 'hygiene_baby', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'hygiene_baby', minStockQty: 6 },
  { slug: 'gel-banho', name: 'Gel de banho / Champô', category: 'hygiene_baby', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'hygiene_baby' },
  { slug: 'pasta-dentes', name: 'Pasta de dentes (adulto / criança)', category: 'hygiene_baby', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'hygiene_baby', minStockQty: 1 },
  { slug: 'sabonete-maos', name: 'Sabonete líquido mãos', category: 'hygiene_baby', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'hygiene_baby' },
  { slug: 'toalhitas', name: 'Toalhitas húmidas', category: 'hygiene_baby', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'hygiene_baby', minStockQty: 2 },
  { slug: 'fraldas', name: 'Fraldas', category: 'hygiene_baby', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'hygiene_baby' },
  { slug: 'lencos-papel', name: 'Lenços de papel', category: 'hygiene_baby', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-household', supermarketSection: 'hygiene_baby' },

  // Animais
  { slug: 'racao-seca', name: 'Ração seca', category: 'pets', trackingMode: 'exact', defaultUnit: 'kg', defaultLocationId: 'starter-loc-pets', supermarketSection: 'pets', minStockQty: 2 },
  { slug: 'comida-humida-animal', name: 'Saquetas / Latas comida húmida', category: 'pets', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pets', supermarketSection: 'pets', minStockQty: 4 },
  { slug: 'areia-gato', name: 'Areia sanitária', category: 'pets', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pets', supermarketSection: 'pets', minStockQty: 1 },
  { slug: 'snacks-animais', name: 'Biscoitos / Snacks animais', category: 'pets', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-pets', supermarketSection: 'pets' },
  { slug: 'desparasitante-animal', name: 'Desparasitante interno/externo', category: 'pets', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pets', supermarketSection: 'pets' },

  // Farmácia Caseira
  { slug: 'paracetamol', name: 'Paracetamol (adulto / xarope)', category: 'pharmacy', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pharmacy', supermarketSection: 'pharmacy' },
  { slug: 'ibuprofeno', name: 'Ibuprofeno (adulto / xarope)', category: 'pharmacy', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pharmacy', supermarketSection: 'pharmacy' },
  { slug: 'soro-fisiologico', name: 'Soro fisiológico (unidoses)', category: 'pharmacy', trackingMode: 'exact', defaultUnit: 'un', defaultLocationId: 'starter-loc-pharmacy', supermarketSection: 'pharmacy', minStockQty: 5 },
  { slug: 'desinfetante-feridas', name: 'Antissético / Betadine', category: 'pharmacy', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-pharmacy', supermarketSection: 'pharmacy' },
  { slug: 'pensos-rapidos', name: 'Pensos rápidos e compressas', category: 'pharmacy', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-pharmacy', supermarketSection: 'pharmacy' },
  { slug: 'termometro-pilhas', name: 'Anti-histamínico / Pomada picadas', category: 'pharmacy', trackingMode: 'qualitative', defaultUnit: 'un', defaultLocationId: 'starter-loc-pharmacy', supermarketSection: 'pharmacy' },
];

export function buildStarterLocations(deviceId: string): StorageLocation[] {
  return STARTER_LOCATIONS.map((loc) => ({
    ...loc,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    deletedAt: null,
    lastModifiedBy: deviceId,
  }));
}

export function buildStarterSupermarketSections(deviceId: string): SupermarketSectionConfig[] {
  return DEFAULT_SUPERMARKET_SECTION_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    colorToken: spec.colorToken,
    icon: spec.icon,
    sortOrder: spec.sortOrder,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    deletedAt: null,
    lastModifiedBy: deviceId,
  }));
}

export const DEFAULT_JOINT_ACCOUNT_ID = 'fin-acc-joint';

export function buildStarterFinanceAccounts(deviceId: string): FinanceAccount[] {
  return [
    {
      id: DEFAULT_JOINT_ACCOUNT_ID,
      name: 'Conta Conjunta',
      accountType: 'joint',
      memberId: null,
      colorToken: 'teal',
      initialBalance: null,
      splitMode: 'equal',
      fixedQuota: null,
      sortOrder: 1,
      isArchived: false,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
      deletedAt: null,
      lastModifiedBy: deviceId,
    },
  ];
}

export function buildStarterFinanceCategories(deviceId: string): FinanceCategoryConfig[] {
  return DEFAULT_FINANCE_CATEGORY_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    kind: spec.kind,
    colorToken: spec.colorToken,
    icon: spec.icon,
    sortOrder: spec.sortOrder,
    monthlyBudget: null,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    deletedAt: null,
    lastModifiedBy: deviceId,
  }));
}

export function buildStarterCatalog(deviceId: string): CatalogItem[] {
  return RAW_CATALOG.map((item) => ({
    id: `starter-cat-${item.slug}`,
    name: item.name,
    aliases: item.aliases ?? [],
    category: item.category,
    trackingMode: item.trackingMode,
    defaultUnit: item.defaultUnit,
    defaultLocationId: item.defaultLocationId,
    minStockQty: item.minStockQty ?? null,
    supermarketSection: item.supermarketSection,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    deletedAt: null,
    lastModifiedBy: deviceId,
  }));
}
