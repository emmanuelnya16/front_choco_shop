import type { Address, Agency, DeliveryCity, PublicSettings } from '@/types/domain';

export const mockPublicSettings: PublicSettings = {
  // HYPOTHÈSE: Les codes USSD réels, codes marchands, QR codes et instructions sont fournis par le client
  // et modifiables dans l'administration. Les valeurs ci-dessous sont strictement fictives (// FICTIF).
  operators: [
    {
      code: 'orange',
      name: 'Orange Money',
      merchantCode: '000111', // FICTIF
      ussdTemplate: '#000*1*{code}*{amount}#', // FICTIF
      accountName: 'ETS DR CHOCO LINCOMPRIS',
      qrCodeUrl: '/mock/qr-orange.svg',
    },
    {
      code: 'mtn',
      name: 'MTN Mobile Money',
      merchantCode: '000222', // FICTIF
      ussdTemplate: '*000*2*{code}*{amount}#', // FICTIF
      accountName: 'DR CHOCO BOUTIQUE SARL',
      qrCodeUrl: '/mock/qr-mtn.svg',
    },
  ],
  payment: {
    operators: [
      {
        id: 'orange',
        label: 'Orange Money',
        merchantName: 'ETS DR CHOCO LINCOMPRIS',
        merchantCode: '000111', // FICTIF
        ussdTemplate: '#000*1*{code}*{amount}#', // FICTIF
        qrImageUrl: '/mock/qr-orange.svg',
        steps: [
          'Appuyez sur «\u00A0Composer le code de paiement\u00A0» ou ouvrez Orange Money.',
          'Vérifiez que le destinataire affiché est bien «\u00A0ETS DR CHOCO LINCOMPRIS\u00A0» (code 000111).',
          'Confirmez le montant exact avec votre code secret Orange Money.',
        ],
        enabled: true,
      },
      {
        id: 'mtn',
        label: 'MTN MoMo',
        merchantName: 'DR CHOCO BOUTIQUE SARL',
        merchantCode: '000222', // FICTIF
        ussdTemplate: '*000*2*{code}*{amount}#', // FICTIF
        qrImageUrl: '/mock/qr-mtn.svg',
        steps: [
          'Appuyez sur «\u00A0Composer le code de paiement\u00A0» ou ouvrez l’application MTN MoMo.',
          'Vérifiez que le nom du marchand est «\u00A0DR CHOCO BOUTIQUE SARL\u00A0» (code 000222).',
          'Validez le montant exact avec votre code PIN MTN Mobile Money.',
        ],
        enabled: true,
      },
    ],
    exactAmountRequired: true,
    validationDelayText: "en général en moins d’une heure, de 8\u00A0h à 20\u00A0h",
    proofMaxSizeMb: 10,
  },
  whatsappNumber: '+237690000000',
  reservationExpiryHours: 24,
  reservationHoldHours: 24,
  // HYPOTHÈSE: Par défaut 'upfront' (les frais de livraison sont inclus dans le total Mobile Money).
  deliveryFeePayment: 'upfront',
  shop: {
    name: "Flagship DR Choco L’Incompris",
    address:
      'Akwa, Boulevard de la Liberté — À 100\u00A0m de la Cathédrale, immeuble anthracite rez-de-chaussée',
    city: 'Douala',
    openingHours: 'Lun – Sam · 9\u00A0h\u00A030 à 19\u00A0h\u00A030',
    mapsUrl:
      'https://maps.google.com/?q=Boulevard+de+la+Liberte+Akwa+Douala+Cameroun',
  },
  pickupAddress: {
    name: "Flagship DR Choco L’Incompris",
    city: 'Douala',
    quarter: 'Akwa, Boulevard de la Liberté',
    landmark: 'À 100\u00A0m de la Cathédrale, immeuble anthracite rez-de-chaussée',
    openingHours: 'Lun – Sam · 9\u00A0h\u00A030 à 19\u00A0h\u00A030',
  },
};

// HYPOTHÈSE: Boutique principale située à Douala (livraison locale à domicile à 1 500 FCFA)
// et expédition par agence vers 14 autres villes du Cameroun (entre 2 000 et 5 000 FCFA).
export const mockDeliveryCities: DeliveryCity[] = [
  {
    id: 'city-dla',
    name: 'Douala',
    fee: 1500,
    isLocal: true,
    hasAgencies: false,
    estimatedDelay: "Aujourd’hui ou demain",
  },
  {
    id: 'city-baf',
    name: 'Bafoussam',
    fee: 3000,
    isLocal: false,
    hasAgencies: true,
    estimatedDelay: '1 à 3\u00A0jours',
  },
  {
    id: 'city-bam',
    name: 'Bamenda',
    fee: 3500,
    isLocal: false,
    hasAgencies: true,
    estimatedDelay: '1 à 3\u00A0jours',
  },
  {
    id: 'city-ber',
    name: 'Bertoua',
    fee: 3500,
    isLocal: false,
    hasAgencies: true,
    estimatedDelay: '1 à 3\u00A0jours',
  },
  {
    id: 'city-bue',
    name: 'Buea',
    fee: 2000,
    isLocal: false,
    hasAgencies: true,
    estimatedDelay: '1 à 2\u00A0jours',
  },
  {
    id: 'city-dsc',
    name: 'Dschang',
    fee: 3000,
    isLocal: false,
    hasAgencies: true,
    estimatedDelay: '1 à 3\u00A0jours',
  },
  {
    id: 'city-ebo',
    name: 'Ebolowa',
    fee: 3000,
    isLocal: false,
    hasAgencies: true,
    estimatedDelay: '1 à 3\u00A0jours',
  },
  {
    id: 'city-ede',
    name: 'Edéa',
    fee: 2000,
    isLocal: false,
    hasAgencies: true,
    estimatedDelay: '1 à 2\u00A0jours',
  },
  {
    id: 'city-gar',
    name: 'Garoua',
    fee: 4500,
    isLocal: false,
    hasAgencies: true,
    estimatedDelay: '2 à 3\u00A0jours',
  },
  {
    id: 'city-kri',
    name: 'Kribi',
    fee: 2500,
    isLocal: false,
    hasAgencies: true,
    estimatedDelay: '1 à 2\u00A0jours',
  },
  {
    id: 'city-lim',
    name: 'Limbé',
    fee: 2000,
    isLocal: false,
    hasAgencies: true,
    estimatedDelay: '1 à 2\u00A0jours',
  },
  {
    id: 'city-mar',
    name: 'Maroua',
    fee: 5000,
    isLocal: false,
    hasAgencies: true,
    estimatedDelay: '2 à 3\u00A0jours',
  },
  {
    id: 'city-nga',
    name: 'Ngaoundéré',
    fee: 4000,
    isLocal: false,
    hasAgencies: true,
    estimatedDelay: '2 à 3\u00A0jours',
  },
  {
    id: 'city-nko',
    name: 'Nkongsamba',
    fee: 2000,
    isLocal: false,
    hasAgencies: true,
    estimatedDelay: '1 à 2\u00A0jours',
  },
  {
    id: 'city-yde',
    name: 'Yaoundé',
    fee: 2500,
    isLocal: false,
    hasAgencies: true,
    estimatedDelay: '1 à 2\u00A0jours',
  },
];

// Agences de transport 100 % fictives (2 par ville interurbaine, §3.2)
export const mockAgencies: Agency[] = [
  {
    id: 'ag-yde-1',
    cityId: 'city-yde',
    city: 'Yaoundé',
    name: 'Agence Express Centre',
    address: 'Mvan, Avenue du Sud face station-service',
    phone: '+237 690 10 11 01',
    openingHours: 'Tous les jours · 6\u00A0h\u00A030 à 21\u00A0h',
  },
  {
    id: 'ag-yde-2',
    cityId: 'city-yde',
    city: 'Yaoundé',
    name: 'Relais des Sept Collines',
    address: 'Biymassi, Carrefour Acacias',
    phone: '+237 677 10 11 02',
    openingHours: 'Lun – Sam · 7\u00A0h à 20\u00A0h',
  },
  {
    id: 'ag-yde-3',
    cityId: 'city-yde',
    city: 'Yaoundé',
    name: 'Transports du Littoral — Terminus Mvan',
    address: 'Mvan, Terminus principal porte B',
    phone: '+237 699 10 11 03',
    openingHours: 'Tous les jours · 6\u00A0h à 22\u00A0h',
  },
  {
    id: 'ag-baf-1',
    cityId: 'city-baf',
    city: 'Bafoussam',
    name: 'Messagerie des Hauts-Plateaux',
    address: 'Entrée de la ville, Route Nationale 4',
    phone: '+237 690 20 21 01',
    openingHours: 'Tous les jours · 7\u00A0h à 20\u00A0h\u00A030',
  },
  {
    id: 'ag-baf-2',
    cityId: 'city-baf',
    city: 'Bafoussam',
    name: 'Agence Express Ouest',
    address: 'Carrefour Marché A, Immeuble Central',
    phone: '+237 677 20 21 02',
    openingHours: 'Lun – Sam · 7\u00A0h\u00A030 à 19\u00A0h\u00A030',
  },
  {
    id: 'ag-bam-1',
    cityId: 'city-bam',
    city: 'Bamenda',
    name: 'Relais Nord-Ouest Express',
    address: 'Commercial Avenue, Secteur Central',
    phone: '+237 677 30 31 01',
    openingHours: 'Lun – Sam · 7\u00A0h\u00A030 à 18\u00A0h\u00A030',
  },
  {
    id: 'ag-bam-2',
    cityId: 'city-bam',
    city: 'Bamenda',
    name: 'Messagerie des Collines',
    address: 'City Chemist Roundabout',
    phone: '+237 690 30 31 02',
    openingHours: 'Lun – Sam · 8\u00A0h à 18\u00A0h',
  },
  {
    id: 'ag-bue-1',
    cityId: 'city-bue',
    city: 'Buea',
    name: 'Navette du Mont-Cameroun',
    address: 'Mile 17, Gare routière principale',
    phone: '+237 677 40 41 01',
    openingHours: 'Tous les jours · 7\u00A0h à 20\u00A0h',
  },
  {
    id: 'ag-bue-2',
    cityId: 'city-bue',
    city: 'Buea',
    name: 'Transports du Littoral — Molyko',
    address: 'Molyko, face Stade Omnisports',
    phone: '+237 690 40 41 02',
    openingHours: 'Lun – Sam · 7\u00A0h\u00A030 à 19\u00A0h\u00A030',
  },
  {
    id: 'ag-lim-1',
    cityId: 'city-lim',
    city: 'Limbé',
    name: 'Rapide Atlantique Limbé',
    address: 'Mile 4, Carrefour principal',
    phone: '+237 677 50 51 01',
    openingHours: 'Tous les jours · 7\u00A0h à 20\u00A0h',
  },
  {
    id: 'ag-lim-2',
    cityId: 'city-lim',
    city: 'Limbé',
    name: 'Navette Côtière Express',
    address: 'Down Beach, Avenue du Port',
    phone: '+237 690 50 51 02',
    openingHours: 'Lun – Sam · 8\u00A0h à 19\u00A0h',
  },
  {
    id: 'ag-kri-1',
    cityId: 'city-kri',
    city: 'Kribi',
    name: 'Rapide Atlantique Kribi',
    address: 'Centre-ville, face Marché Central',
    phone: '+237 690 60 61 01',
    openingHours: 'Tous les jours · 7\u00A0h à 20\u00A0h\u00A030',
  },
  {
    id: 'ag-kri-2',
    cityId: 'city-kri',
    city: 'Kribi',
    name: 'Transports du Littoral — Océan',
    address: 'Carrefour Afan-Mabé, Route de Douala',
    phone: '+237 677 60 61 02',
    openingHours: 'Tous les jours · 7\u00A0h\u00A030 à 20\u00A0h',
  },
  {
    id: 'ag-ede-1',
    cityId: 'city-ede',
    city: 'Edéa',
    name: 'Relais de la Sanaga',
    address: 'Avenue des Banques, Centre commercial',
    phone: '+237 690 70 71 01',
    openingHours: 'Lun – Sam · 7\u00A0h\u00A030 à 19\u00A0h\u00A030',
  },
  {
    id: 'ag-ede-2',
    cityId: 'city-ede',
    city: 'Edéa',
    name: 'Transports du Littoral — Edéa',
    address: 'Gare routière du Pont',
    phone: '+237 677 70 71 02',
    openingHours: 'Tous les jours · 7\u00A0h à 20\u00A0h',
  },
  {
    id: 'ag-nko-1',
    cityId: 'city-nko',
    city: 'Nkongsamba',
    name: 'Messagerie du Moungo',
    address: 'Boulevard de la Gare, Centre-ville',
    phone: '+237 690 80 81 01',
    openingHours: 'Lun – Sam · 7\u00A0h\u00A030 à 19\u00A0h\u00A030',
  },
  {
    id: 'ag-nko-2',
    cityId: 'city-nko',
    city: 'Nkongsamba',
    name: 'Agence Express Moungo',
    address: 'Carrefour Ekelé, Route Nationale 5',
    phone: '+237 677 80 81 02',
    openingHours: 'Tous les jours · 7\u00A0h à 20\u00A0h',
  },
  {
    id: 'ag-dsc-1',
    cityId: 'city-dsc',
    city: 'Dschang',
    name: 'Messagerie des Hauts-Plateaux — Dschang',
    address: 'Foto, Route de l’Université',
    phone: '+237 690 90 91 01',
    openingHours: 'Tous les jours · 7\u00A0h\u00A030 à 20\u00A0h',
  },
  {
    id: 'ag-dsc-2',
    cityId: 'city-dsc',
    city: 'Dschang',
    name: 'Relais Menoua Express',
    address: 'Marché B, Entrée principale',
    phone: '+237 677 90 91 02',
    openingHours: 'Lun – Sam · 7\u00A0h\u00A030 à 19\u00A0h\u00A030',
  },
  {
    id: 'ag-nga-1',
    cityId: 'city-nga',
    city: 'Ngaoundéré',
    name: 'Courrier du Septentrion — Adamaoua',
    address: 'Quartier Baladji, Avenue de la Gare',
    phone: '+237 691 10 12 01',
    openingHours: 'Tous les jours · 7\u00A0h à 20\u00A0h',
  },
  {
    id: 'ag-nga-2',
    cityId: 'city-nga',
    city: 'Ngaoundéré',
    name: 'Agence Express Grand Nord',
    address: 'Carrefour Petit Marché',
    phone: '+237 678 10 12 02',
    openingHours: 'Lun – Sam · 7\u00A0h\u00A030 à 19\u00A0h\u00A030',
  },
  {
    id: 'ag-gar-1',
    cityId: 'city-gar',
    city: 'Garoua',
    name: 'Courrier du Septentrion — Bénoué',
    address: 'Plateau, Avenue du Port Fluvial',
    phone: '+237 691 20 22 01',
    openingHours: 'Tous les jours · 7\u00A0h à 20\u00A0h',
  },
  {
    id: 'ag-gar-2',
    cityId: 'city-gar',
    city: 'Garoua',
    name: 'Agence Express Grand Nord — Garoua',
    address: 'Yelwa, Carrefour Central',
    phone: '+237 678 20 22 02',
    openingHours: 'Lun – Sam · 7\u00A0h\u00A030 à 19\u00A0h\u00A030',
  },
  {
    id: 'ag-mar-1',
    cityId: 'city-mar',
    city: 'Maroua',
    name: 'Courrier du Septentrion — Diamaré',
    address: 'Domayo, Boulevard du Kaliao',
    phone: '+237 691 30 32 01',
    openingHours: 'Tous les jours · 7\u00A0h à 19\u00A0h\u00A030',
  },
  {
    id: 'ag-mar-2',
    cityId: 'city-mar',
    city: 'Maroua',
    name: 'Agence Express Grand Nord — Maroua',
    address: 'Kakataré, face Grand Marché',
    phone: '+237 678 30 32 02',
    openingHours: 'Lun – Sam · 7\u00A0h\u00A030 à 19\u00A0h',
  },
  {
    id: 'ag-ber-1',
    cityId: 'city-ber',
    city: 'Bertoua',
    name: 'Messagerie du Soleil Levant',
    address: 'Enia, Avenue Principale',
    phone: '+237 691 40 42 01',
    openingHours: 'Tous les jours · 7\u00A0h à 20\u00A0h',
  },
  {
    id: 'ag-ber-2',
    cityId: 'city-ber',
    city: 'Bertoua',
    name: 'Agence Express Est',
    address: 'Mokolo I, Carrefour Central',
    phone: '+237 678 40 42 02',
    openingHours: 'Lun – Sam · 7\u00A0h\u00A030 à 19\u00A0h\u00A030',
  },
  {
    id: 'ag-ebo-1',
    cityId: 'city-ebo',
    city: 'Ebolowa',
    name: 'Agence Express Sud',
    address: 'Angalé, Route Nationale 2',
    phone: '+237 691 50 52 01',
    openingHours: 'Tous les jours · 7\u00A0h à 20\u00A0h',
  },
  {
    id: 'ag-ebo-2',
    cityId: 'city-ebo',
    city: 'Ebolowa',
    name: 'Relais Méridional',
    address: 'Centre commercial Nko’ovos',
    phone: '+237 678 50 52 02',
    openingHours: 'Lun – Sam · 7\u00A0h\u00A030 à 19\u00A0h\u00A030',
  },
];

// Adresses initiales du client existant 690000001 (« Junior Mbarga », §3.2)
export const mockJuniorAddresses: Address[] = [
  {
    id: 'addr-junior-1',
    label: 'Maison',
    city: 'Douala',
    district: 'Bonamoussadi',
    quarter: 'Bonamoussadi',
    landmark:
      'Après la pharmacie du carrefour Eto’o, portail noir en face du glacier',
    details:
      'Après la pharmacie du carrefour Eto’o, portail noir en face du glacier',
    receptionMode: 'delivery',
    recipientName: 'Junior Mbarga',
    recipientPhone: '+237690000001',
    phone: '+237690000001',
    isDefault: true,
  },
  {
    id: 'addr-junior-2',
    label: 'Bureau',
    city: 'Douala',
    district: 'Akwa',
    quarter: 'Akwa',
    landmark: 'Immeuble Mirage 3e étage, à côté de la boulangerie du boulevard',
    details: 'Immeuble Mirage 3e étage, à côté de la boulangerie du boulevard',
    receptionMode: 'delivery',
    recipientName: 'Junior Mbarga',
    recipientPhone: '+237690000001',
    phone: '+237690000001',
    isDefault: false,
  },
];

const INITIAL_PUBLIC_SETTINGS_JSON = JSON.stringify(mockPublicSettings);
const INITIAL_DELIVERY_CITIES_JSON = JSON.stringify(mockDeliveryCities);
const INITIAL_AGENCIES_JSON = JSON.stringify(mockAgencies);

export function resetMockSettings(): void {
  const restoredSettings = JSON.parse(INITIAL_PUBLIC_SETTINGS_JSON) as PublicSettings;
  Object.assign(mockPublicSettings, restoredSettings);

  const restoredCities = JSON.parse(INITIAL_DELIVERY_CITIES_JSON) as DeliveryCity[];
  mockDeliveryCities.splice(0, mockDeliveryCities.length, ...restoredCities);

  const restoredAgencies = JSON.parse(INITIAL_AGENCIES_JSON) as Agency[];
  mockAgencies.splice(0, mockAgencies.length, ...restoredAgencies);
}

export interface DesignTokenSwatch {
  token: string;
  cssVar: string;
  hex: string;
  role: string;
  group: 'brand' | 'derived';
  sampleTextHex: string;
  sampleTextLabel: string;
  bgClass: string;
  textClass: string;
}

/**
 * Référentiel des jetons de couleur utilisé par la page de contrôle `/_dev`.
 * Placé dans `src/mocks/` afin de respecter la règle stricte d'absence de `#`
 * en dur dans le reste de `src/` hors `styles/` et `mocks/`.
 */
export const DESIGN_COLOR_SWATCHES: DesignTokenSwatch[] = [
  {
    token: '--color-ink',
    cssVar: 'var(--color-ink)',
    hex: '#1A1A18',
    role: 'Anthracite\u00A0: texte principal, header, hero, tuiles catégories, boutons secondaires',
    group: 'brand',
    sampleTextHex: '#FFFFFF',
    sampleTextLabel: 'Texte blanc dessus',
    bgClass: 'bg-ink',
    textClass: 'text-white',
  },
  {
    token: '--color-red',
    cssVar: 'var(--color-red)',
    hex: '#E31E24',
    role: 'Rouge vif\u00A0: bouton «\u00A0Réserver\u00A0», badge panier, onglet actif, focus',
    group: 'brand',
    sampleTextHex: '#FFFFFF',
    sampleTextLabel: 'Texte blanc dessus',
    bgClass: 'bg-red',
    textClass: 'text-white',
  },
  {
    token: '--color-grey',
    cssVar: 'var(--color-grey)',
    hex: '#87888A',
    role: 'Gris moyen\u00A0: texte secondaire et icônes sur fond anthracite uniquement',
    group: 'brand',
    sampleTextHex: '#1A1A18',
    sampleTextLabel: 'Anthracite (réf. fond sombre)',
    bgClass: 'bg-grey',
    textClass: 'text-ink',
  },
  {
    token: '--color-silver',
    cssVar: 'var(--color-silver)',
    hex: '#C6C7C8',
    role: 'Gris clair\u00A0: bordures, séparateurs, squelettes, texte sur fond sombre',
    group: 'brand',
    sampleTextHex: '#1A1A18',
    sampleTextLabel: 'Texte anthracite dessus',
    bgClass: 'bg-silver',
    textClass: 'text-ink',
  },
  {
    token: '--color-white',
    cssVar: 'var(--color-white)',
    hex: '#FFFFFF',
    role: 'Blanc pur\u00A0: fond principal de l’application',
    group: 'brand',
    sampleTextHex: '#1A1A18',
    sampleTextLabel: 'Texte anthracite dessus',
    bgClass: 'bg-white',
    textClass: 'text-ink',
  },
  {
    token: '--color-surface',
    cssVar: 'var(--color-surface)',
    hex: '#F4F4F3',
    role: 'Surface claire\u00A0: fond des photos produits et zones groupées',
    group: 'derived',
    sampleTextHex: '#1A1A18',
    sampleTextLabel: 'Texte anthracite dessus',
    bgClass: 'bg-surface',
    textClass: 'text-ink',
  },
  {
    token: '--color-ink-2',
    cssVar: 'var(--color-ink-2)',
    hex: '#2A2A27',
    role: 'Anthracite élevé\u00A0: cartes et feuilles posées sur fond anthracite',
    group: 'derived',
    sampleTextHex: '#C6C7C8',
    sampleTextLabel: 'Gris clair (silver) dessus',
    bgClass: 'bg-ink-2',
    textClass: 'text-silver',
  },
  {
    token: '--color-text-2',
    cssVar: 'var(--color-text-2)',
    hex: '#6B6C6E',
    role: 'Gris texte 2\u00A0: texte secondaire lisible sur fond blanc ou surface',
    group: 'derived',
    sampleTextHex: '#FFFFFF',
    sampleTextLabel: 'Contraste mesuré sur blanc',
    bgClass: 'bg-text-2',
    textClass: 'text-white',
  },
  {
    token: '--color-success',
    cssVar: 'var(--color-success)',
    hex: '#17733F',
    role: 'Vert validation\u00A0: réservation confirmée, prête ou livrée',
    group: 'derived',
    sampleTextHex: '#FFFFFF',
    sampleTextLabel: 'Texte blanc / sur blanc',
    bgClass: 'bg-success',
    textClass: 'text-white',
  },
  {
    token: '--color-warning',
    cssVar: 'var(--color-warning)',
    hex: '#9A5B00',
    role: 'Ambre alerte\u00A0: preuve de paiement en attente de validation',
    group: 'derived',
    sampleTextHex: '#FFFFFF',
    sampleTextLabel: 'Texte blanc / sur blanc',
    bgClass: 'bg-warning',
    textClass: 'text-white',
  },
  {
    token: '--color-danger',
    cssVar: 'var(--color-danger)',
    hex: '#E31E24',
    role: 'Rouge erreur\u00A0: paiement rejeté, réservation expirée (toujours avec icône + texte)',
    group: 'derived',
    sampleTextHex: '#FFFFFF',
    sampleTextLabel: 'Texte blanc / sur blanc',
    bgClass: 'bg-danger',
    textClass: 'text-white',
  },
];
