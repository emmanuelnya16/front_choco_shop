import type {
  Product,
  ProductBadgeType,
  ProductColor,
  ProductImageEntry,
  SizeGuideTable,
} from '@/types/domain';

const COLOR_INK: ProductColor = { code: 'noir', name: 'Noir Charbon', hex: '#1A1A18' };
const COLOR_WHITE: ProductColor = { code: 'blanc', name: 'Blanc Craie', hex: '#F4F4F3' };
const COLOR_RED: ProductColor = { code: 'rouge', name: 'Rouge Incompris', hex: '#E31E24' };
const COLOR_GREY: ProductColor = { code: 'gris', name: 'Gris Béton', hex: '#87888A' };

const CLOTHING_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const SHOE_SIZES = ['39', '40', '41', '42', '43', '44', '45', '46'];
const ONE_SIZE = ['Unique'];

const CLOTHING_SIZE_GUIDE: SizeGuideTable = {
  type: 'clothing',
  title: 'Guide des tailles — Vêtements (coupe ample)',
  tip: 'Entre deux tailles ? Prenez la plus grande pour un rendu oversize assumé, ou la plus petite pour un tombé plus ajusté.',
  headers: ['Taille', 'Tour de poitrine (cm)', 'Longueur dos (cm)', 'Épaules (cm)'],
  rows: [
    ['S', '104 – 108', '69', '52'],
    ['M', '110 – 114', '72', '54'],
    ['L', '116 – 120', '74', '56'],
    ['XL', '122 – 126', '77', '58'],
    ['XXL', '128 – 134', '79', '61'],
  ],
};

const FOOTWEAR_SIZE_GUIDE: SizeGuideTable = {
  type: 'footwear',
  title: 'Guide des pointures — Chaussures & Babouches',
  tip: 'Nos babouches en cuir véritable s’assouplissent légèrement après deux jours de port. Prenez votre pointure habituelle.',
  headers: ['Pointure EU', 'Longueur du pied (cm)'],
  rows: [
    ['39', '24,8 cm'],
    ['40', '25,4 cm'],
    ['41', '26,1 cm'],
    ['42', '26,7 cm'],
    ['43', '27,4 cm'],
    ['44', '28,0 cm'],
    ['45', '28,7 cm'],
    ['46', '29,4 cm'],
  ],
};

const ONE_SIZE_GUIDE: SizeGuideTable = {
  type: 'one-size',
  title: 'Taille unique ajustable',
  tip: 'Ce coffret est conçu en coupe universelle adaptable à toutes les morphologies masculines.',
  headers: ['Format', 'Détail des dimensions'],
  rows: [['Taille unique', 'Équivalent L/XL ample (poitrine 116 cm) + foulard 65 × 65 cm']],
};

interface RawProductSeed {
  id: string;
  slug: string;
  name: string;
  description: string;
  composition: string;
  careInstructions?: string[];
  categorySlug: 'vetements' | 'chaussures' | 'babouches';
  subCategorySlug: string;
  price: number;
  fallbackImages: string[];
  colors: ProductColor[];
  sizes: string[];
  stockPattern: number[];
  colorStockOverrides?: Record<string, number[]>;
  isNew: boolean;
  reservationsCount: number;
  createdAt: string;
}

const DEFAULT_CLOTHING_CARE = [
  'Lavage en machine à 30 °C sur l’envers avec des couleurs similaires.',
  'Séchage à l’air libre à l’ombre pour préserver la densité du coton et de la sérigraphie.',
  'Repassage doux sur l’envers uniquement, sans passer le fer sur les motifs.',
];

const DEFAULT_LEATHER_CARE = [
  'Dépoussiérer après chaque port avec un chiffon doux légèrement humide.',
  'Nourrir le cuir une fois par mois avec un baume incolore ou cirage adapté.',
  'Éviter l’exposition prolongée au soleil direct et conserver sur embauchoir.',
];

const SEEDS: RawProductSeed[] = [
  {
    id: 'prod-01',
    slug: 'hoodie-barbele-noir',
    name: 'Hoodie Barbelé Noir',
    description:
      'Molleton lourd 480 g/m² à la coupe boxy et aux épaules tombantes. Sa broderie poitrine haute densité et sa capuche doublée sans cordon signent l’allure brute de L’Incompris. Conçu pour garder son volume lavage après lavage.',
    composition: '100 % coton peigné lourd, 480 g/m²',
    categorySlug: 'vetements',
    subCategorySlug: 'hoodies',
    price: 45000,
    fallbackImages: ['/mock/product-hoodie.svg', '/mock/product-tee.svg', '/mock/product-pants.svg'],
    colors: [COLOR_INK, COLOR_GREY],
    sizes: CLOTHING_SIZES,
    stockPattern: [4, 6, 2, 1, 0],
    // Couleur Gris Béton entièrement épuisée (§3.2 : au moins 1 produit dont une couleur entière est épuisée)
    colorStockOverrides: {
      noir: [4, 6, 2, 1, 0],
      gris: [0, 0, 0, 0, 0],
    },
    isNew: true,
    reservationsCount: 142,
    createdAt: '2026-10-28T10:00:00.000Z',
  },
  {
    id: 'prod-02',
    slug: 'tshirt-lincompris-oversize',
    name: "T-shirt L'Incompris Oversize",
    description:
      'Coton peigné 280 g/m² au tombé lourd et respirant, idéal sous le climat de Douala et Yaoundé. Son col côtelé épais de 3 cm ne se détend jamais. La sérigraphie dorsale grand format est cuite en atelier pour une tenue irréprochable.',
    composition: '100 % coton peigné, 280 g/m²',
    categorySlug: 'vetements',
    subCategorySlug: 't-shirts',
    price: 18000,
    fallbackImages: ['/mock/product-tee.svg', '/mock/product-hoodie.svg'],
    colors: [COLOR_INK, COLOR_WHITE, COLOR_RED, COLOR_GREY],
    sizes: CLOTHING_SIZES,
    stockPattern: [8, 5, 2, 0, 1],
    colorStockOverrides: {
      noir: [8, 5, 2, 0, 1],
      blanc: [4, 0, 1, 2, 0],
      rouge: [0, 2, 1, 0, 0],
      gris: [3, 3, 0, 1, 0],
    },
    isNew: true,
    reservationsCount: 128,
    createdAt: '2026-10-27T14:30:00.000Z',
  },
  {
    id: 'prod-03',
    slug: 'babouche-royale-akwa-cuir',
    name: 'Babouche Royale Akwa Cuir',
    description:
      'Façonnée à la main dans un cuir de veau pleine fleur souple et résistant. Sa semelle intérieure ergonomique à mémoire de forme assure un maintien parfait du matin au soir. Elle accompagne aussi bien un ensemble traditionnel qu’un pantalon large contemporain.',
    composition: '100 % cuir de veau pleine fleur, semelle cuir et gomme antidérapante',
    careInstructions: DEFAULT_LEATHER_CARE,
    categorySlug: 'babouches',
    subCategorySlug: 'cuir-lisse',
    price: 35000,
    fallbackImages: ['/mock/product-babouches.svg', '/mock/product-shoes.svg'],
    colors: [COLOR_INK, COLOR_RED],
    sizes: SHOE_SIZES,
    stockPattern: [2, 4, 5, 3, 2, 1, 0, 0],
    colorStockOverrides: {
      noir: [2, 4, 5, 3, 2, 1, 0, 0],
      rouge: [0, 1, 2, 2, 0, 0, 0, 0],
    },
    isNew: true,
    reservationsCount: 119,
    createdAt: '2026-10-26T09:15:00.000Z',
  },
  {
    id: 'prod-04',
    slug: 'sneaker-monolithe-v1',
    name: 'Sneaker Monolithe V1',
    description:
      'Architecture urbaine massive associant cuir mat pleine fleur et empiècements en nubuck. Sa semelle sculptée de 4,5 cm offre un amorti franc et une adhérence tout-terrain. Une pièce signature produite en série très limitée.',
    composition: 'Tige 80 % cuir pleine fleur, 20 % nubuck · Semelle caoutchouc haute densité',
    careInstructions: DEFAULT_LEATHER_CARE,
    categorySlug: 'chaussures',
    subCategorySlug: 'sneakers',
    price: 65000,
    fallbackImages: ['/mock/product-shoes.svg', '/mock/product-babouches.svg'],
    colors: [COLOR_INK, COLOR_WHITE],
    sizes: SHOE_SIZES,
    // Une seule taille restante (42) en noir, et couleur blanc épuisée (§3.2)
    stockPattern: [0, 0, 0, 2, 0, 0, 0, 0],
    colorStockOverrides: {
      noir: [0, 0, 0, 2, 0, 0, 0, 0],
      blanc: [0, 0, 0, 0, 0, 0, 0, 0],
    },
    isNew: true,
    reservationsCount: 105,
    createdAt: '2026-10-25T16:00:00.000Z',
  },
  {
    id: 'prod-05',
    slug: 'cargo-tactique-bitume',
    name: 'Cargo Tactique Bitume',
    description:
      'Taillé dans une toile ripstop de coton armuré indéchirable. Il dispose de six poches à soufflet sécurisées et de sangles de serrage aux chevilles pour ajuster le tombé sur vos sneakers ou vos boots. Pensé pour un usage quotidien intensif.',
    composition: '100 % coton ripstop armuré, 340 g/m²',
    categorySlug: 'vetements',
    subCategorySlug: 'pantalons',
    price: 38000,
    fallbackImages: ['/mock/product-pants.svg', '/mock/product-hoodie.svg'],
    colors: [COLOR_INK, COLOR_GREY],
    sizes: CLOTHING_SIZES,
    stockPattern: [3, 5, 4, 2, 0],
    isNew: false,
    reservationsCount: 96,
    createdAt: '2026-10-24T11:20:00.000Z',
  },
  {
    id: 'prod-06',
    slug: 'babouche-croco-nocturne',
    name: 'Babouche Croco Nocturne',
    description:
      'Cuir embossé motif écailles de crocodile au relief franc et lumineux. Sa bride large est entièrement doublée de peau souple pour éviter tout frottement sur le cou-de-pied. Talon renforcé par une double surpiqûre sellier.',
    composition: '100 % cuir de bovin embossé croco, doublure chèvre souple',
    careInstructions: DEFAULT_LEATHER_CARE,
    categorySlug: 'babouches',
    subCategorySlug: 'croco-embosse',
    price: 42000,
    fallbackImages: ['/mock/product-babouches.svg', '/mock/product-shoes.svg'],
    colors: [COLOR_INK],
    sizes: SHOE_SIZES,
    // Une seule taille restante (41) avec 2 pièces (§3.2)
    stockPattern: [0, 0, 2, 0, 0, 0, 0, 0],
    isNew: true,
    reservationsCount: 88,
    createdAt: '2026-10-23T08:45:00.000Z',
  },
  {
    id: 'prod-07',
    slug: 'tshirt-manifeste-237',
    name: 'T-shirt Manifeste 237',
    description:
      'Hommage graphique à l’indicatif 237 avec une typographie condensée sur la poitrine. Sa coupe ample à manches descendues assure une silhouette nette et confortable. Le jersey de coton peigné résiste aux lavages répétés sans vriller.',
    composition: '100 % coton biologique peigné, 260 g/m²',
    categorySlug: 'vetements',
    subCategorySlug: 't-shirts',
    price: 15000,
    fallbackImages: ['/mock/product-tee.svg', '/mock/product-hoodie.svg'],
    colors: [COLOR_WHITE, COLOR_INK],
    sizes: CLOTHING_SIZES,
    stockPattern: [6, 8, 5, 3, 2],
    isNew: false,
    reservationsCount: 84,
    createdAt: '2026-10-22T12:00:00.000Z',
  },
  {
    id: 'prod-08',
    slug: 'derby-commando-douala',
    name: 'Derby Commando Douala',
    description:
      'L’alliance d’une derby habillée en cuir glacé épais et d’une semelle commando crantée. La trépointe surpiquée protège de l’humidité tout en affirmant un caractère résolument urbain. Parfaite avec un pantalon à plis ou un cargo.',
    composition: '100 % cuir glacé pleine fleur, semelle gomme crantée cousue Blake',
    careInstructions: DEFAULT_LEATHER_CARE,
    categorySlug: 'chaussures',
    subCategorySlug: 'derbies',
    price: 58000,
    fallbackImages: ['/mock/product-shoes.svg', '/mock/product-babouches.svg'],
    colors: [COLOR_INK],
    sizes: SHOE_SIZES,
    stockPattern: [1, 2, 2, 3, 2, 1, 0, 0],
    isNew: false,
    reservationsCount: 79,
    createdAt: '2026-10-21T15:10:00.000Z',
  },
  {
    id: 'prod-09',
    slug: 'hoodie-sans-manches-forge',
    name: 'Hoodie Sans Manches Forge',
    description:
      'Pièce de superposition taillée dans un french terry de 420 g/m² aux emmanchures à bords francs. Sa capuche structurée et sa poche kangourou profonde dessinent une carrure athlétique. Se porte seul par temps chaud ou sur un t-shirt manches longues.',
    composition: '100 % coton French Terry non gratté, 420 g/m²',
    categorySlug: 'vetements',
    subCategorySlug: 'hoodies',
    price: 32000,
    fallbackImages: ['/mock/product-hoodie.svg', '/mock/product-tee.svg'],
    colors: [COLOR_INK, COLOR_RED],
    sizes: CLOTHING_SIZES,
    // Entièrement épuisé n°1 (§3.2)
    stockPattern: [0, 0, 0, 0, 0],
    isNew: false,
    reservationsCount: 67,
    createdAt: '2026-10-20T10:00:00.000Z',
  },
  {
    id: 'prod-10',
    slug: 'babouche-minimal-sable',
    name: 'Babouche Minimaliste',
    description:
      'Une empeigne d’une seule pièce sans couture apparente pour une pureté visuelle absolue. Le cuir souple épouse immédiatement la forme du pied dès le premier essayage. Sa semelle fine avec insert élastomère garantit un pas souple et silencieux.',
    composition: '100 % cuir nappa souple, semelle cuir et insert caoutchouc',
    careInstructions: DEFAULT_LEATHER_CARE,
    categorySlug: 'babouches',
    subCategorySlug: 'cuir-lisse',
    price: 28000,
    fallbackImages: ['/mock/product-babouches.svg', '/mock/product-shoes.svg'],
    colors: [COLOR_INK, COLOR_GREY],
    sizes: SHOE_SIZES,
    stockPattern: [3, 4, 4, 3, 2, 2, 1, 0],
    isNew: false,
    reservationsCount: 74,
    createdAt: '2026-10-19T10:00:00.000Z',
  },
  {
    id: 'prod-11',
    slug: 'pantalon-large-atelier',
    name: 'Pantalon Large Atelier',
    description:
      'Sergé de coton lourd 360 g/m² doté de doubles plis profonds à la taille. Sa jambe large tombe avec aplomb sur la chaussure sans casser la silhouette. Équipé de poches italiennes profondes et d’une boucle de serrage au dos.',
    composition: '100 % sergé de coton lourd, 360 g/m²',
    categorySlug: 'vetements',
    subCategorySlug: 'pantalons',
    price: 36000,
    fallbackImages: ['/mock/product-pants.svg', '/mock/product-tee.svg'],
    colors: [COLOR_INK, COLOR_WHITE],
    sizes: CLOTHING_SIZES,
    stockPattern: [2, 4, 3, 2, 1],
    isNew: true,
    reservationsCount: 62,
    createdAt: '2026-10-18T10:00:00.000Z',
  },
  {
    id: 'prod-12',
    slug: 'tshirt-essentiel-lourd',
    name: 'T-shirt Essentiel Lourd',
    description:
      'Le pilier du vestiaire quotidien en jersey lourd indéformable. Finition minimaliste avec une étiquette tissée ton sur ton au bas du vêtement et des coutures épaules renforcées. Une coupe droite équilibrée qui traverse les saisons.',
    composition: '100 % coton cardé sec, 270 g/m²',
    categorySlug: 'vetements',
    subCategorySlug: 't-shirts',
    price: 12000,
    fallbackImages: ['/mock/product-tee.svg', '/mock/product-hoodie.svg'],
    colors: [COLOR_INK, COLOR_WHITE, COLOR_GREY],
    sizes: CLOTHING_SIZES,
    stockPattern: [10, 12, 8, 6, 4],
    isNew: false,
    reservationsCount: 91,
    createdAt: '2026-10-17T10:00:00.000Z',
  },
  {
    id: 'prod-13',
    slug: 'sneaker-basse-asphalte',
    name: 'Sneaker Basse Asphalte',
    description:
      'Inspirée des chaussures de skate des années 90, revisitée en cuir grainé pleine fleur. Sa languette généreusement matelassée et son col doublé maintiennent la cheville tout en douceur. Semelle cuvette cousue sur tout le pourtour.',
    composition: 'Tige 100 % cuir grainé · Doublure textile respirant · Semelle gomme cousue',
    careInstructions: DEFAULT_LEATHER_CARE,
    categorySlug: 'chaussures',
    subCategorySlug: 'sneakers',
    price: 48000,
    fallbackImages: ['/mock/product-shoes.svg', '/mock/product-babouches.svg'],
    colors: [COLOR_WHITE, COLOR_INK],
    sizes: SHOE_SIZES,
    stockPattern: [2, 3, 4, 4, 3, 2, 1, 1],
    isNew: false,
    reservationsCount: 54,
    createdAt: '2026-10-16T10:00:00.000Z',
  },
  {
    id: 'prod-14',
    slug: 'hoodie-zip-armure',
    name: 'Hoodie Zippé Armure',
    description:
      'Équipé d’une fermeture métallique lourde à double curseur permettant d’ajuster l’ouverture par le haut ou par le bas. Ses poches plaquées à rivets métalliques et son molleton dense en font une véritable veste d’extérieur.',
    composition: '100 % coton lourd brossé, 490 g/m² · Zip métallique YKK',
    categorySlug: 'vetements',
    subCategorySlug: 'hoodies',
    price: 49000,
    fallbackImages: ['/mock/product-hoodie.svg', '/mock/product-pants.svg'],
    colors: [COLOR_INK],
    sizes: CLOTHING_SIZES,
    // Une seule taille restante (L) avec 1 pièce (§3.2)
    stockPattern: [0, 0, 1, 0, 0],
    isNew: true,
    reservationsCount: 71,
    createdAt: '2026-10-15T10:00:00.000Z',
  },
  {
    id: 'prod-15',
    slug: 'babouche-sultan-brodee',
    name: 'Babouche Sultan Brodée',
    description:
      'Empeigne à bout légèrement relevé, soulignée d’une broderie géométrique en fil rouge contrasté. La doublure intégrale en cuir naturel régule la température du pied. Une création artisanale qui signe chaque tenue de cérémonie ou de sortie.',
    composition: '100 % cuir de veau lisse, broderie fil polyester haute ténacité',
    careInstructions: DEFAULT_LEATHER_CARE,
    categorySlug: 'babouches',
    subCategorySlug: 'cuir-lisse',
    price: 39000,
    fallbackImages: ['/mock/product-babouches.svg', '/mock/product-shoes.svg'],
    colors: [COLOR_INK, COLOR_RED],
    sizes: SHOE_SIZES,
    // Une seule taille restante (43) avec 2 pièces (§3.2)
    stockPattern: [0, 0, 0, 0, 2, 0, 0, 0],
    isNew: false,
    reservationsCount: 65,
    createdAt: '2026-10-14T10:00:00.000Z',
  },
  {
    id: 'prod-16',
    slug: 'short-cargo-beton',
    name: 'Short Cargo Béton',
    description:
      'Coupe ample s’arrêtant juste sous le genou pour une allure streetwear maîtrisée. Deux larges poches latérales à rabat aimanté et une taille élastiquée à cordon tressé. Toile de coton lavée aux enzymes pour un toucher doux immédiat.',
    composition: '100 % sergé de coton lavé, 310 g/m²',
    categorySlug: 'vetements',
    subCategorySlug: 'pantalons',
    price: 24000,
    fallbackImages: ['/mock/product-pants.svg', '/mock/product-tee.svg'],
    colors: [COLOR_GREY, COLOR_INK],
    sizes: CLOTHING_SIZES,
    stockPattern: [4, 5, 4, 2, 1],
    isNew: false,
    reservationsCount: 49,
    createdAt: '2026-10-13T10:00:00.000Z',
  },
  {
    id: 'prod-17',
    slug: 'tshirt-archive-01',
    name: 'T-shirt Archive N°01',
    description:
      'Réédition collector de la toute première série imprimée par DR Choco L’Incompris. Le lavage enzymatique confère au coton un aspect patiné unique et un toucher peau de pêche. Numéroté à l’intérieur de l’ourlet.',
    composition: '100 % coton peigné lavé aux enzymes, 290 g/m²',
    categorySlug: 'vetements',
    subCategorySlug: 't-shirts',
    price: 20000,
    fallbackImages: ['/mock/product-tee.svg', '/mock/product-hoodie.svg'],
    colors: [COLOR_INK, COLOR_RED],
    sizes: CLOTHING_SIZES,
    // Entièrement épuisé n°2 (§3.2)
    stockPattern: [0, 0, 0, 0, 0],
    isNew: false,
    reservationsCount: 112,
    createdAt: '2026-10-12T10:00:00.000Z',
  },
  {
    id: 'prod-18',
    slug: 'boots-montantes-kotto',
    name: 'Boots Montantes Kotto',
    description:
      'Tige montante à 7 œillets métalliques pensée pour affronter toutes les routes et la saison des pluies. Le cuir traité hydrofuge repousse l’eau tout en laissant le pied respirer. Zip latéral intérieur discret pour un chaussage rapide.',
    composition: '100 % cuir gras hydrofuge, semelle crantée caoutchouc vulcanisé',
    careInstructions: DEFAULT_LEATHER_CARE,
    categorySlug: 'chaussures',
    subCategorySlug: 'derbies',
    price: 62000,
    fallbackImages: ['/mock/product-shoes.svg', '/mock/product-babouches.svg'],
    colors: [COLOR_INK],
    sizes: SHOE_SIZES,
    stockPattern: [1, 1, 2, 2, 1, 1, 0, 0],
    isNew: true,
    reservationsCount: 58,
    createdAt: '2026-10-11T10:00:00.000Z',
  },
  {
    id: 'prod-19',
    slug: 'babouche-croco-imperiale',
    name: 'Babouche Croco Impériale',
    description:
      'Édition prestige en cuir embossé profond montée sur une semelle double épaisseur cousue main. Le contraste entre la texture croco brillante et le passepoil mat souligne la finesse de la découpe. Livrée dans sa housse de protection en coton.',
    composition: '100 % cuir véritable embossé croco, semelle double cuir',
    careInstructions: DEFAULT_LEATHER_CARE,
    categorySlug: 'babouches',
    subCategorySlug: 'croco-embosse',
    price: 45000,
    fallbackImages: ['/mock/product-babouches.svg', '/mock/product-shoes.svg'],
    colors: [COLOR_INK, COLOR_WHITE],
    sizes: SHOE_SIZES,
    stockPattern: [2, 2, 3, 3, 2, 1, 1, 0],
    isNew: false,
    reservationsCount: 61,
    createdAt: '2026-10-10T10:00:00.000Z',
  },
  {
    id: 'prod-20',
    slug: 'jogger-lourd-incompris',
    name: 'Jogger Lourd Incompris',
    description:
      'Molleton 460 g/m² assorti au Hoodie Barbelé avec une coupe droite à ourlet ouvert en bas de jambe. Les coutures nervurées sur le devant allongent la ligne et maintiennent la tenue du vêtement. Poche arrière zippée invisible.',
    composition: '100 % coton peigné molletonné, 460 g/m²',
    categorySlug: 'vetements',
    subCategorySlug: 'pantalons',
    price: 34000,
    fallbackImages: ['/mock/product-pants.svg', '/mock/product-hoodie.svg'],
    colors: [COLOR_INK, COLOR_GREY],
    sizes: CLOTHING_SIZES,
    stockPattern: [3, 4, 3, 2, 1],
    isNew: false,
    reservationsCount: 44,
    createdAt: '2026-10-09T10:00:00.000Z',
  },
  {
    id: 'prod-21',
    slug: 'tshirt-manches-longues-brut',
    name: 'Manches Longues Brut',
    description:
      'T-shirt à manches longues doté de poignets en bords-côtes serrés et d’une sérigraphie graphique le long des avant-bras. Le coton de 280 g/m² offre une tenue intermédiaire idéale entre le t-shirt et le sweatshirt léger.',
    composition: '100 % coton peigné, 280 g/m²',
    categorySlug: 'vetements',
    subCategorySlug: 't-shirts',
    price: 22000,
    fallbackImages: ['/mock/product-tee.svg', '/mock/product-hoodie.svg'],
    colors: [COLOR_INK, COLOR_WHITE],
    sizes: CLOTHING_SIZES,
    stockPattern: [3, 5, 4, 2, 1],
    isNew: false,
    reservationsCount: 39,
    createdAt: '2026-10-08T10:00:00.000Z',
  },
  {
    id: 'prod-22',
    slug: 'sneaker-runner-bonapriso',
    name: 'Runner Bonapriso',
    description:
      'Association dynamique de mesh alvéolé ultra-respirant et d’empiècements en suède anthracite. Sa semelle intermédiaire profilée absorbe les chocs pour un confort de marche exceptionnel toute la journée. Détails réfléchissants au talon.',
    composition: 'Tige 55 % cuir suède, 45 % mesh technique · Semelle EVA et caoutchouc',
    careInstructions: DEFAULT_LEATHER_CARE,
    categorySlug: 'chaussures',
    subCategorySlug: 'sneakers',
    price: 54000,
    fallbackImages: ['/mock/product-shoes.svg', '/mock/product-babouches.svg'],
    colors: [COLOR_INK, COLOR_GREY, COLOR_RED],
    sizes: SHOE_SIZES,
    stockPattern: [2, 3, 4, 3, 2, 1, 0, 0],
    isNew: false,
    reservationsCount: 51,
    createdAt: '2026-10-07T10:00:00.000Z',
  },
  {
    id: 'prod-23',
    slug: 'babouche-quotidienne-souple',
    name: 'Babouche Souple Studio',
    description:
      'Modèle quotidien en cuir lisse léger au chaussant immédiat. Sa souplesse permet de la glisser facilement dans un sac de voyage sans jamais déformer l’empeigne. Un classique accessible façonné avec le même soin artisanal.',
    composition: '100 % cuir de chèvre souple, semelle élastomère cousue',
    careInstructions: DEFAULT_LEATHER_CARE,
    categorySlug: 'babouches',
    subCategorySlug: 'cuir-lisse',
    price: 19000,
    fallbackImages: ['/mock/product-babouches.svg', '/mock/product-shoes.svg'],
    colors: [COLOR_INK],
    sizes: SHOE_SIZES,
    stockPattern: [4, 6, 6, 5, 4, 2, 1, 0],
    isNew: false,
    reservationsCount: 47,
    createdAt: '2026-10-06T10:00:00.000Z',
  },
  {
    id: 'prod-24',
    slug: 'bandana-pack-signature',
    name: 'Pack T-shirt & Foulard Signature',
    description:
      'Coffret découverte associant un t-shirt coupe ample universelle et un grand foulard en coton imprimé au motif barbelé DR Choco. Idéal pour offrir ou compléter sa silhouette avec une touche graphique.',
    composition: '100 % coton peigné (t-shirt 270 g/m² + foulard popeline 120 g/m²)',
    categorySlug: 'vetements',
    subCategorySlug: 't-shirts',
    price: 8000,
    fallbackImages: ['/mock/product-tee.svg', '/mock/product-hoodie.svg'],
    colors: [COLOR_INK, COLOR_RED],
    // Taille unique pour tester la sélection automatique (§7.5)
    sizes: ONE_SIZE,
    stockPattern: [5],
    isNew: false,
    reservationsCount: 33,
    createdAt: '2026-10-05T10:00:00.000Z',
  },
];

export const mockProducts: Product[] = SEEDS.map((seed) => {
  const variants = seed.colors.flatMap((color) => {
    const patternForColor = seed.colorStockOverrides?.[color.code] ?? seed.stockPattern;
    return seed.sizes.map((size, sizeIndex) => ({
      id: `${seed.id}-${color.code}-${size.toLowerCase()}`,
      size,
      colorCode: color.code,
      stock: patternForColor[sizeIndex] ?? 0,
    }));
  });

  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
  const badges: ProductBadgeType[] = [];
  if (totalStock === 0) {
    badges.push('sold-out');
  } else if (totalStock >= 1 && totalStock <= 3) {
    badges.push('low-stock');
  }
  if (seed.isNew) {
    badges.push('new');
  }

  // HYPOTHÈSE: Chaque couleur possède au moins une vue associée dans `mediaGallery` via `colorCode`.
  const mediaGallery: ProductImageEntry[] = [];
  seed.colors.forEach((color, colorIdx) => {
    const fallback = seed.fallbackImages[colorIdx % seed.fallbackImages.length] ?? '/mock/product-tee.svg';
    mediaGallery.push({
      url: `/images/products/${seed.slug}-${colorIdx + 1}.webp`,
      fallbackUrl: fallback,
      colorCode: color.code,
      alt: `${seed.name} — ${color.name}`,
    });
  });
  // Ajout de vues de détail supplémentaires pour la galerie (minimum 3 vues par produit)
  while (mediaGallery.length < 3) {
    const idx = mediaGallery.length;
    const fallback = seed.fallbackImages[idx % seed.fallbackImages.length] ?? '/mock/product-tee.svg';
    mediaGallery.push({
      url: `/images/products/${seed.slug}-${idx + 1}.webp`,
      fallbackUrl: fallback,
      colorCode: seed.colors[0]?.code,
      alt: `${seed.name} — Vue ${idx + 1}`,
    });
  }

  const images = mediaGallery.map((entry) => entry.url);
  const fallbackImages = mediaGallery.map((entry) => entry.fallbackUrl);

  const sizeGuide =
    seed.sizes.length === 1 && seed.sizes[0] === 'Unique'
      ? ONE_SIZE_GUIDE
      : seed.categorySlug === 'vetements'
        ? CLOTHING_SIZE_GUIDE
        : FOOTWEAR_SIZE_GUIDE;

  return {
    id: seed.id,
    slug: seed.slug,
    name: seed.name,
    description: seed.description,
    composition: seed.composition,
    careInstructions: seed.careInstructions ?? DEFAULT_CLOTHING_CARE,
    sizeGuide,
    categorySlug: seed.categorySlug,
    subCategorySlug: seed.subCategorySlug,
    price: seed.price,
    images,
    fallbackImages,
    mediaGallery,
    colors: seed.colors,
    sizes: seed.sizes,
    variants,
    isNew: seed.isNew,
    reservationsCount: seed.reservationsCount,
    badges,
    createdAt: seed.createdAt,
  };
});
