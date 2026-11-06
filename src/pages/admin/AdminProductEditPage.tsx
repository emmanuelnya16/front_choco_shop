import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ImagePlus,
  Loader2,
  Palette,
  Plus,
  Ruler,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Price } from '@/components/ui/Primitives';
import { prepareProof } from '@/features/payment/proof/prepareProof';
import { useToastStore } from '@/stores/toastStore';
import {
  useAdminCategories,
  useAdminCreateProduct,
  useAdminDeleteProduct,
  useAdminProductDetail,
  useAdminUpdateProduct,
} from '@/features/admin/api/useAdminQueries';
import type {
  Category,
  Product,
  ProductColor,
  ProductImageEntry,
  ProductVariant,
  SizeGuideTable,
} from '@/types/domain';

interface ColorPreset {
  code: string;
  name: string;
  hex: string;
}

const DR_CHOCO_COLOR_PRESETS: ColorPreset[] = [
  { code: 'noir', name: 'Noir Charbon', hex: '#1A1A18' },
  { code: 'blanc', name: 'Blanc Craie', hex: '#F4F4F3' },
  { code: 'rouge', name: 'Rouge Incompris', hex: '#E31E24' },
  { code: 'gris', name: 'Gris Béton', hex: '#87888A' },
  { code: 'sienne', name: 'Terre de Sienne', hex: '#8B4513' },
  { code: 'olive', name: 'Olive Militaire', hex: '#556B2F' },
];

const SIZE_PRESETS: Record<'clothing' | 'footwear' | 'one-size', { label: string; sizes: string[] }> = {
  clothing: {
    label: 'Vêtements (S à XXL)',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  },
  footwear: {
    label: 'Chaussures & Babouches (39 à 45)',
    sizes: ['39', '40', '41', '42', '43', '44', '45'],
  },
  'one-size': {
    label: 'Taille unique',
    sizes: ['Unique'],
  },
};

const SIZE_GUIDE_TEMPLATES: Record<'clothing' | 'footwear' | 'one-size', SizeGuideTable> = {
  clothing: {
    type: 'clothing',
    title: 'Guide des tailles — Vêtements (coupe ample)',
    tip: 'Entre deux tailles\u00A0? Prenez la plus grande pour un rendu oversize assumé, ou la plus petite pour un tombé plus ajusté.',
    headers: ['Taille', 'Tour de poitrine (cm)', 'Longueur dos (cm)', 'Épaules (cm)'],
    rows: [
      ['S', '104 – 108', '69', '52'],
      ['M', '110 – 114', '72', '54'],
      ['L', '116 – 120', '74', '56'],
      ['XL', '122 – 126', '77', '58'],
      ['XXL', '128 – 134', '79', '61'],
    ],
  },
  footwear: {
    type: 'footwear',
    title: 'Guide des pointures — Chaussures & Babouches',
    tip: 'Nos babouches et chaussures en cuir véritable s’assouplissent légèrement après deux jours de port. Prenez votre pointure habituelle.',
    headers: ['Pointure EU', 'Longueur du pied (cm)'],
    rows: [
      ['39', '24,8 cm'],
      ['40', '25,4 cm'],
      ['41', '26,1 cm'],
      ['42', '26,7 cm'],
      ['43', '27,4 cm'],
      ['44', '28,0 cm'],
      ['45', '28,7 cm'],
    ],
  },
  'one-size': {
    type: 'one-size',
    title: 'Taille unique ajustable',
    tip: 'Coupe universelle pensée pour s’adapter confortablement à toutes les morphologies.',
    headers: ['Format', 'Détail des dimensions'],
    rows: [['Unique', 'Format ajustable universel DR Choco']],
  },
};

const DEMO_PHOTO_PRESETS = [
  {
    label: 'Portrait studio Noir',
    url: '/images/products/hoodie-barbele-noir-1.webp',
  },
  {
    label: 'Babouche cuir Royal',
    url: '/images/products/babouche-royale-akwa-cuir-1.webp',
  },
  {
    label: 'Sneaker bitume',
    url: '/images/products/sneaker-monolithe-v1-1.webp',
  },
];

function slugifyText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeVariantKey(colorCode: string, size: string): string {
  return `${colorCode}__${size}`;
}

interface ProductEditorFormProps {
  initialProduct?: Product;
  categories: Category[];
}

function ProductEditorForm({ initialProduct, categories }: ProductEditorFormProps) {
  const navigate = useNavigate();
  const isEditMode = Boolean(initialProduct);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const notifyToast = useToastStore((s) => s.show);
  const showToast = (message: string) => notifyToast({ message });

  const createMutation = useAdminCreateProduct();
  const updateMutation = useAdminUpdateProduct(initialProduct?.id ?? '');
  const deleteMutation = useAdminDeleteProduct();

  // 1. Informations générales
  const [name, setName] = useState(initialProduct?.name ?? '');
  const [slug, setSlug] = useState(initialProduct?.slug ?? '');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(initialProduct));
  const [categorySlug, setCategorySlug] = useState<string>(
    initialProduct?.categorySlug ?? 'vetements',
  );

  const selectedCategory = useMemo(
    () => categories.find((c) => c.slug === categorySlug) ?? categories[0],
    [categories, categorySlug],
  );

  const [subCategorySlug, setSubCategorySlug] = useState<string>(
    initialProduct?.subCategorySlug ??
      selectedCategory?.subCategories?.[0]?.slug ??
      't-shirts',
  );
  const [priceInput, setPriceInput] = useState<string>(
    initialProduct ? String(initialProduct.price) : '18000',
  );
  const [isNew, setIsNew] = useState<boolean>(initialProduct?.isNew ?? true);
  const [description, setDescription] = useState<string>(
    initialProduct?.description ?? '',
  );
  const [composition, setComposition] = useState<string>(
    initialProduct?.composition ?? 'Coton peigné 100 % haute densité',
  );
  const [careInstructionsText, setCareInstructionsText] = useState<string>(
    initialProduct?.careInstructions?.join('\n') ??
      'Lavage à 30 °C sur l’envers.\nSéchage à l’air libre à l’ombre.',
  );

  // 2. Couleurs
  const [colors, setColors] = useState<ProductColor[]>(
    initialProduct?.colors?.length
      ? initialProduct.colors
      : [{ code: 'noir', name: 'Noir Charbon', hex: '#1A1A18' }],
  );
  const [customColorName, setCustomColorName] = useState('');
  const [customColorHex, setCustomColorHex] = useState('#1A1A18');

  // 3. Galerie photos (SP-003)
  const [mediaGallery, setMediaGallery] = useState<ProductImageEntry[]>(
    initialProduct?.mediaGallery?.length
      ? initialProduct.mediaGallery
      : [
          {
            url: '/mocks/products/hoodie-manifeste-1.svg',
            fallbackUrl: '/mocks/products/hoodie-manifeste-1.svg',
            colorCode: 'noir',
            alt: 'Vue principale Noir Charbon',
          },
        ],
  );
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoColorCode, setNewPhotoColorCode] = useState<string>(
    colors[0]?.code ?? '',
  );
  const [newPhotoAlt, setNewPhotoAlt] = useState('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  // 4. Tailles & Stocks (matrice couleurs × tailles)
  const [sizes, setSizes] = useState<string[]>(
    initialProduct?.sizes?.length ? initialProduct.sizes : ['S', 'M', 'L', 'XL'],
  );
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [stockByVariantKey, setStockByVariantKey] = useState<Record<string, number>>(() => {
    const initialMap: Record<string, number> = {};
    if (initialProduct?.variants?.length) {
      for (const variant of initialProduct.variants) {
        initialMap[makeVariantKey(variant.colorCode, variant.size)] = variant.stock;
      }
    } else {
      for (const c of colors) {
        for (const s of ['S', 'M', 'L', 'XL']) {
          initialMap[makeVariantKey(c.code, s)] = 3;
        }
      }
    }
    return initialMap;
  });

  // 5. Guide des tailles (SP-004)
  const [sizeGuide, setSizeGuide] = useState<SizeGuideTable>(
    initialProduct?.sizeGuide ?? SIZE_GUIDE_TEMPLATES.clothing,
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Calcul des couleurs sans photo rattachée (SP-003)
  const colorsMissingPhotos = useMemo(() => {
    return colors.filter(
      (color) => !mediaGallery.some((entry) => entry.colorCode === color.code),
    );
  }, [colors, mediaGallery]);

  const totalComputedStock = useMemo(() => {
    let sum = 0;
    for (const color of colors) {
      for (const size of sizes) {
        sum += stockByVariantKey[makeVariantKey(color.code, size)] ?? 0;
      }
    }
    return sum;
  }, [colors, sizes, stockByVariantKey]);

  const parsedPrice = Math.max(0, Math.round(Number(priceInput) || 0));

  const handleNameChange = (nextName: string) => {
    setName(nextName);
    if (!slugManuallyEdited) {
      setSlug(slugifyText(nextName));
    }
  };

  const handleCategoryChange = (nextCategorySlug: string) => {
    setCategorySlug(nextCategorySlug);
    const cat = categories.find((c) => c.slug === nextCategorySlug);
    if (cat?.subCategories?.[0]) {
      setSubCategorySlug(cat.subCategories[0].slug);
    }
  };

  const handleAddColorPreset = (preset: ColorPreset) => {
    if (colors.some((c) => c.code === preset.code)) {
      showToast(`La couleur ${preset.name} est déjà présente`);
      return;
    }
    setColors((prev) => [...prev, { ...preset }]);
    setStockByVariantKey((prev) => {
      const next = { ...prev };
      for (const size of sizes) {
        const key = makeVariantKey(preset.code, size);
        if (next[key] === undefined) {
          next[key] = 2;
        }
      }
      return next;
    });
  };

  const handleAddCustomColor = () => {
    const cleanName = customColorName.trim();
    if (!cleanName) return;
    const code = slugifyText(cleanName) || `couleur-${colors.length + 1}`;
    if (colors.some((c) => c.code === code)) {
      showToast('Ce code couleur existe déjà sur ce produit');
      return;
    }
    const newColor: ProductColor = {
      code,
      name: cleanName,
      hex: customColorHex || '#1A1A18',
    };
    setColors((prev) => [...prev, newColor]);
    setCustomColorName('');
  };

  const handleRemoveColor = (code: string) => {
    if (colors.length <= 1) {
      showToast('Un produit doit conserver au moins une couleur');
      return;
    }
    setColors((prev) => prev.filter((c) => c.code !== code));
  };

  const handleAddPhotoByUrl = (urlToUse?: string) => {
    const cleanUrl = (urlToUse ?? newPhotoUrl).trim();
    if (!cleanUrl) return;
    const chosenColor = colors.find((c) => c.code === newPhotoColorCode);
    const entry: ProductImageEntry = {
      url: cleanUrl,
      fallbackUrl: cleanUrl,
      colorCode: newPhotoColorCode || undefined,
      alt:
        newPhotoAlt.trim() ||
        `${name || 'Produit'} — ${chosenColor?.name ?? 'Vue studio'}`,
    };
    setMediaGallery((prev) => [...prev, entry]);
    if (!urlToUse) {
      setNewPhotoUrl('');
      setNewPhotoAlt('');
    }
  };

  const handlePhotoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setIsCompressingPhoto(true);
    try {
      const nextEntries: ProductImageEntry[] = [];
      const chosenColor = colors.find((c) => c.code === newPhotoColorCode);
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        if (!file) continue;
        const compressed = await prepareProof(file);
        const previewUrl =
          typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
            ? URL.createObjectURL(compressed.blob)
            : '/mocks/products/hoodie-manifeste-1.svg';
        nextEntries.push({
          url: previewUrl,
          fallbackUrl: previewUrl,
          colorCode: newPhotoColorCode || undefined,
          alt: `${name || 'Produit'} — ${chosenColor?.name ?? 'Photo'}`,
        });
      }
      setMediaGallery((prev) => [...prev, ...nextEntries]);
      showToast('Photo compressée et ajoutée à la galerie');
    } catch {
      showToast('Impossible de traiter cette image');
    } finally {
      setIsCompressingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleMovePhoto = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= mediaGallery.length) return;
    setMediaGallery((prev) => {
      const copy = [...prev];
      const current = copy[index];
      const target = copy[targetIndex];
      if (!current || !target) return prev;
      copy[index] = target;
      copy[targetIndex] = current;
      return copy;
    });
  };

  const handleRemovePhoto = (index: number) => {
    if (mediaGallery.length <= 1) {
      showToast('Conservez au moins une photo pour la fiche produit');
      return;
    }
    setMediaGallery((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleApplySizePreset = (presetKey: 'clothing' | 'footwear' | 'one-size') => {
    const presetSizes = SIZE_PRESETS[presetKey].sizes;
    setSizes(presetSizes);
    setStockByVariantKey((prev) => {
      const next = { ...prev };
      for (const color of colors) {
        for (const size of presetSizes) {
          const key = makeVariantKey(color.code, size);
          if (next[key] === undefined) {
            next[key] = 2;
          }
        }
      }
      return next;
    });
  };

  const handleAddCustomSize = () => {
    const cleanSize = customSizeInput.trim().toUpperCase();
    if (!cleanSize) return;
    if (sizes.includes(cleanSize)) {
      showToast(`La taille ${cleanSize} est déjà présente`);
      return;
    }
    setSizes((prev) => [...prev, cleanSize]);
    setCustomSizeInput('');
  };

  const handleRemoveSize = (sizeToRemove: string) => {
    if (sizes.length <= 1) {
      showToast('Conservez au moins une taille');
      return;
    }
    setSizes((prev) => prev.filter((s) => s !== sizeToRemove));
  };

  const handleSetRowStock = (colorCode: string, stockValue: number) => {
    setStockByVariantKey((prev) => {
      const next = { ...prev };
      for (const size of sizes) {
        next[makeVariantKey(colorCode, size)] = stockValue;
      }
      return next;
    });
  };

  const handleSelectSizeGuideTemplate = (
    templateType: 'clothing' | 'footwear' | 'one-size',
  ) => {
    setSizeGuide({ ...SIZE_GUIDE_TEMPLATES[templateType] });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    const cleanSlug = (slug.trim() || slugifyText(cleanName)).trim();

    if (!cleanName) {
      setFormError('Veuillez saisir le nom du produit.');
      return;
    }
    if (!cleanSlug) {
      setFormError('Le slug URL du produit est obligatoire.');
      return;
    }
    if (parsedPrice <= 0) {
      setFormError('Le prix en FCFA doit être supérieur à 0.');
      return;
    }
    if (colors.length === 0) {
      setFormError('Ajoutez au moins une couleur.');
      return;
    }
    if (sizes.length === 0) {
      setFormError('Ajoutez au moins une taille.');
      return;
    }
    if (mediaGallery.length === 0) {
      setFormError('Ajoutez au moins une photo à la galerie.');
      return;
    }

    const builtVariants: ProductVariant[] = [];
    for (const color of colors) {
      for (const size of sizes) {
        const key = makeVariantKey(color.code, size);
        const stock = Math.max(0, Math.round(stockByVariantKey[key] ?? 0));
        builtVariants.push({
          id: `var-${cleanSlug}-${color.code}-${size.toLowerCase()}`,
          size,
          colorCode: color.code,
          stock,
        });
      }
    }

    const careInstructions = careInstructionsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const payload = {
      name: cleanName,
      slug: cleanSlug,
      categorySlug,
      subCategorySlug: subCategorySlug || undefined,
      price: parsedPrice,
      isNew,
      description:
        description.trim() ||
        `${cleanName} — pièce signature DR Choco L’Incompris.`,
      composition: composition.trim() || 'Sélection atelier DR Choco',
      careInstructions:
        careInstructions.length > 0
          ? careInstructions
          : ['Entretien délicat recommandé par l’atelier DR Choco.'],
      colors,
      sizes,
      variants: builtVariants,
      mediaGallery,
      sizeGuide,
    };

    if (isEditMode && initialProduct) {
      updateMutation.mutate(payload, {
        onSuccess: (res) => {
          showToast(`Produit « ${res.product.name} » mis à jour`);
          navigate('/admin/catalogue');
        },
        onError: (err) => {
          setFormError(
            err instanceof Error
              ? err.message
              : 'Impossible d’enregistrer les modifications.',
          );
        },
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: (res) => {
          showToast(`Produit « ${res.product.name} » créé avec succès`);
          navigate('/admin/catalogue');
        },
        onError: (err) => {
          setFormError(
            err instanceof Error
              ? err.message
              : 'Impossible de créer ce produit.',
          );
        },
      });
    }
  };

  const handleConfirmDelete = () => {
    if (!initialProduct) return;
    deleteMutation.mutate(initialProduct.id, {
      onSuccess: () => {
        showToast(`Produit « ${initialProduct.name} » supprimé`);
        navigate('/admin/catalogue');
      },
    });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-12" noValidate>
      {/* Barre supérieure */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/admin/catalogue"
            className="inline-flex items-center gap-1.5 font-body text-xs font-medium text-charcoal hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Retour au catalogue
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-tight text-ink">
            {isEditMode
              ? `Modifier : ${initialProduct?.name}`
              : 'Nouveau produit'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEditMode && initialProduct && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-error/30 bg-white px-3.5 py-2 font-body text-xs font-bold uppercase tracking-wider text-error transition-colors hover:bg-error/5"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Supprimer
            </button>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-ink px-5 py-2.5 font-body text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-charcoal disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            {isEditMode ? 'Enregistrer les modifications' : 'Créer le produit'}
          </button>
        </div>
      </div>

      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-sm border border-error/40 bg-error/5 p-3.5 text-error"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="font-body text-sm font-medium">{formError}</p>
        </div>
      )}

      {/* Confirmation de suppression */}
      {confirmDeleteOpen && initialProduct && (
        <div className="rounded-sm border border-error/40 bg-error/5 p-4">
          <p className="font-body text-sm font-bold text-ink">
            Supprimer définitivement «{'\u00A0'}
            {initialProduct.name}
            {'\u00A0'}» du catalogue{'\u00A0'}?
          </p>
          <p className="mt-1 font-body text-xs text-charcoal">
            Cette action retirera la fiche produit de la boutique client.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-sm bg-error px-4 py-2 font-body text-xs font-bold uppercase tracking-wider text-white"
            >
              Confirmer la suppression
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(false)}
              className="inline-flex min-h-11 items-center rounded-sm border border-silver/50 bg-white px-4 py-2 font-body text-xs font-medium text-ink"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1 — Informations générales */}
      <section className="rounded-sm border border-silver/40 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between border-b border-silver/30 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-red" aria-hidden="true" />
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-ink">
              1. Informations générales
            </h2>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 font-body text-xs font-semibold text-ink">
            <input
              type="checkbox"
              checked={isNew}
              onChange={(e) => setIsNew(e.target.checked)}
              className="h-4 w-4 accent-red"
            />
            Badge «{'\u00A0'}NOUVEAU{'\u00A0'}»
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="product-name-input"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Nom du produit *
            </label>
            <input
              id="product-name-input"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex. : Hoodie L’Incompris Édition Nuit"
              className="mt-1.5 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink focus:border-ink focus:bg-white focus:outline-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="product-slug-input"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Slug URL *
            </label>
            <input
              id="product-slug-input"
              type="text"
              value={slug}
              onChange={(e) => {
                setSlugManuallyEdited(true);
                setSlug(slugifyText(e.target.value));
              }}
              placeholder="hoodie-lincompris-edition-nuit"
              className="mt-1.5 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-mono text-xs text-ink focus:border-ink focus:bg-white focus:outline-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="product-category-select"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Catégorie *
            </label>
            <select
              id="product-category-select"
              value={categorySlug}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink focus:border-ink focus:bg-white focus:outline-none"
            >
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="product-subcategory-select"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Sous-catégorie
            </label>
            <select
              id="product-subcategory-select"
              value={subCategorySlug}
              onChange={(e) => setSubCategorySlug(e.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink focus:border-ink focus:bg-white focus:outline-none"
            >
              {(selectedCategory?.subCategories ?? []).map((sub) => (
                <option key={sub.slug} value={sub.slug}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="product-price-input"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Prix en FCFA *
            </label>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <input
                id="product-price-input"
                type="number"
                min={500}
                step={500}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="min-h-11 w-48 rounded-sm border border-silver/60 bg-surface px-3 font-mono text-sm font-bold text-ink focus:border-ink focus:bg-white focus:outline-none"
                required
              />
              <span className="rounded-sm bg-surface px-3 py-2 font-body text-xs text-charcoal">
                Aperçu client :{' '}
                <Price amount={parsedPrice} className="font-bold text-ink" />
              </span>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="product-description-input"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Description éditoriale
            </label>
            <textarea
              id="product-description-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez la coupe, l’esprit et la finition de la pièce..."
              className="mt-1.5 w-full rounded-sm border border-silver/60 bg-surface p-3 font-body text-sm text-ink focus:border-ink focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="product-composition-input"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Composition & Matière
            </label>
            <input
              id="product-composition-input"
              type="text"
              value={composition}
              onChange={(e) => setComposition(e.target.value)}
              placeholder="Coton peigné lourd 430 g/m² ou Cuir de veau pleine fleur"
              className="mt-1.5 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink focus:border-ink focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="product-care-input"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Conseils d’entretien (1 par ligne)
            </label>
            <textarea
              id="product-care-input"
              rows={2}
              value={careInstructionsText}
              onChange={(e) => setCareInstructionsText(e.target.value)}
              className="mt-1.5 w-full rounded-sm border border-silver/60 bg-surface p-2.5 font-body text-xs text-ink focus:border-ink focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* SECTION 2 — Couleurs */}
      <section className="rounded-sm border border-silver/40 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-silver/30 pb-3">
          <Palette className="h-4 w-4 text-red" aria-hidden="true" />
          <h2 className="font-display text-base font-bold uppercase tracking-wide text-ink">
            2. Couleurs disponibles ({colors.length})
          </h2>
        </div>

        {/* Couleurs actives */}
        <div className="flex flex-wrap gap-2.5">
          {colors.map((color) => (
            <div
              key={color.code}
              className="inline-flex items-center gap-2 rounded-sm border border-silver/50 bg-surface px-3 py-2"
            >
              <span
                className="h-5 w-5 rounded-full border border-silver/70"
                style={{ backgroundColor: color.hex }}
                aria-hidden="true"
              />
              <div>
                <p className="font-body text-xs font-bold text-ink">{color.name}</p>
                <p className="font-mono text-[10px] text-charcoal">
                  {color.code} · {color.hex}
                </p>
              </div>
              {colors.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveColor(color.code)}
                  aria-label={`Retirer la couleur ${color.name}`}
                  className="ml-1 rounded-sm p-1 text-charcoal hover:bg-error/10 hover:text-error"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Préréglages DR Choco */}
        <div className="mt-4">
          <p className="font-body text-xs font-semibold text-charcoal">
            Ajouter une nuance signature DR Choco :
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DR_CHOCO_COLOR_PRESETS.map((preset) => {
              const alreadyAdded = colors.some((c) => c.code === preset.code);
              return (
                <button
                  key={preset.code}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => handleAddColorPreset(preset)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-sm border border-silver/50 bg-white px-3 py-1.5 font-body text-xs font-medium text-ink transition-colors hover:border-ink disabled:opacity-40"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-silver/70"
                    style={{ backgroundColor: preset.hex }}
                    aria-hidden="true"
                  />
                  {preset.name}
                  {alreadyAdded && <Check className="h-3 w-3 text-success" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ajout couleur personnalisée */}
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-silver/30 pt-4">
          <div>
            <label
              htmlFor="custom-color-name"
              className="block font-body text-[11px] font-semibold text-charcoal"
            >
              Autre couleur (nom)
            </label>
            <input
              id="custom-color-name"
              type="text"
              value={customColorName}
              onChange={(e) => setCustomColorName(e.target.value)}
              placeholder="Ex. : Bordeaux Royal"
              className="mt-1 min-h-11 rounded-sm border border-silver/60 bg-surface px-3 font-body text-xs text-ink"
            />
          </div>
          <div>
            <label
              htmlFor="custom-color-hex"
              className="block font-body text-[11px] font-semibold text-charcoal"
            >
              Teinte Hex
            </label>
            <input
              id="custom-color-hex"
              type="color"
              value={customColorHex}
              onChange={(e) => setCustomColorHex(e.target.value)}
              className="mt-1 h-11 w-14 cursor-pointer rounded-sm border border-silver/60 bg-white p-1"
            />
          </div>
          <button
            type="button"
            onClick={handleAddCustomColor}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-ink bg-white px-3.5 py-2 font-body text-xs font-bold uppercase tracking-wider text-ink hover:bg-surface"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Ajouter la couleur
          </button>
        </div>
      </section>

      {/* SECTION 3 — Galerie photos & rattachement par couleur (SP-003) */}
      <section className="rounded-sm border border-silver/40 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between border-b border-silver/30 pb-3">
          <div className="flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-red" aria-hidden="true" />
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-ink">
              3. Galerie photos & rattachement couleur ({mediaGallery.length})
            </h2>
          </div>
          <span className="font-body text-xs text-charcoal">
            La 1ʳᵉ photo sert de couverture catalogue
          </span>
        </div>

        {/* Alerte douce SP-003 si une couleur n'a aucune photo rattachée */}
        {colorsMissingPhotos.length > 0 && (
          <div
            role="status"
            className="mb-4 flex items-start gap-2.5 rounded-sm border border-warning/40 bg-warning/10 p-3 text-ink"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-warning"
              aria-hidden="true"
            />
            <div className="font-body text-xs">
              <p className="font-bold">
                Couleur(s) sans photo rattachée :{' '}
                {colorsMissingPhotos.map((c) => c.name).join(', ')}
              </p>
              <p className="mt-0.5 text-charcoal">
                Rattachez au moins une photo à chaque couleur via le sélecteur{' '}
                <span className="font-mono">colorCode</span> pour que la galerie
                bascule automatiquement sur la fiche produit client.
              </p>
            </div>
          </div>
        )}

        {/* Grille des photos existantes */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mediaGallery.map((entry, index) => (
            <div
              key={`${entry.url}-${index}`}
              className="flex gap-3 rounded-sm border border-silver/50 bg-surface p-3"
            >
              <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-sm border border-silver/40 bg-white">
                <img
                  src={entry.url || entry.fallbackUrl}
                  alt={entry.alt || `Photo ${index + 1}`}
                  className="h-full w-full object-cover"
                />
                {index === 0 && (
                  <span className="absolute top-1 left-1 rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-white">
                    Principale
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <label className="block font-body text-[10px] font-bold uppercase text-charcoal">
                    Couleur rattachée (colorCode)
                  </label>
                  <select
                    aria-label={`Couleur de la photo ${index + 1}`}
                    value={entry.colorCode ?? ''}
                    onChange={(e) => {
                      const nextCode = e.target.value || undefined;
                      setMediaGallery((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, colorCode: nextCode } : item,
                        ),
                      );
                    }}
                    className="mt-0.5 min-h-9 w-full rounded-sm border border-silver/60 bg-white px-2 font-body text-xs text-ink"
                  >
                    <option value="">Toutes les couleurs</option>
                    {colors.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <input
                    type="text"
                    aria-label={`Légende de la photo ${index + 1}`}
                    value={entry.alt ?? ''}
                    onChange={(e) => {
                      const nextAlt = e.target.value;
                      setMediaGallery((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, alt: nextAlt } : item,
                        ),
                      );
                    }}
                    placeholder="Légende (alt)"
                    className="min-h-8 w-full rounded-sm border border-silver/60 bg-white px-2 font-body text-xs text-ink"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMovePhoto(index, -1)}
                      aria-label={`Monter la photo ${index + 1}`}
                      className="rounded-sm border border-silver/50 bg-white p-1 text-charcoal hover:text-ink disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={index === mediaGallery.length - 1}
                      onClick={() => handleMovePhoto(index, 1)}
                      aria-label={`Descendre la photo ${index + 1}`}
                      className="rounded-sm border border-silver/50 bg-white p-1 text-charcoal hover:text-ink disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(index)}
                    aria-label={`Supprimer la photo ${index + 1}`}
                    className="rounded-sm p-1 text-charcoal hover:bg-error/10 hover:text-error"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Ajout d'une nouvelle photo */}
        <div className="mt-4 rounded-sm border border-dashed border-silver/70 bg-surface/60 p-3.5">
          <p className="font-body text-xs font-bold text-ink">
            Ajouter une photo à la galerie
          </p>
          <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="new-photo-url"
                className="block font-body text-[11px] text-charcoal"
              >
                URL de l’image
              </label>
              <input
                id="new-photo-url"
                type="text"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="/mocks/products/hoodie-manifeste-1.svg"
                className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-white px-3 font-body text-xs text-ink"
              />
            </div>

            <div>
              <label
                htmlFor="new-photo-color"
                className="block font-body text-[11px] text-charcoal"
              >
                Couleur associée
              </label>
              <select
                id="new-photo-color"
                value={newPhotoColorCode}
                onChange={(e) => setNewPhotoColorCode(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-white px-2.5 font-body text-xs text-ink"
              >
                <option value="">Toutes les couleurs</option>
                {colors.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => handleAddPhotoByUrl()}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-sm bg-ink px-3 py-2 font-body text-xs font-bold uppercase tracking-wider text-white hover:bg-charcoal"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Ajouter URL
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-silver/30 pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-body text-[11px] text-charcoal">
                Visuels studio rapides :
              </span>
              {DEMO_PHOTO_PRESETS.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => handleAddPhotoByUrl(preset.url)}
                  className="rounded-sm border border-silver/50 bg-white px-2.5 py-1 font-body text-[11px] font-medium text-ink hover:border-ink"
                >
                  + {preset.label}
                </button>
              ))}
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={isCompressingPhoto}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-ink bg-white px-3 py-1.5 font-body text-xs font-semibold text-ink hover:bg-surface"
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                {isCompressingPhoto
                  ? 'Compression en cours...'
                  : 'Importer depuis le téléphone'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — Tailles & Grille de variantes (Couleurs × Tailles) */}
      <section className="rounded-sm border border-silver/40 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-silver/30 pb-3">
          <div>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-ink">
              4. Tailles & Grille des stocks ({colors.length} × {sizes.length} ={' '}
              {colors.length * sizes.length} variantes)
            </h2>
            <p className="font-body text-xs text-charcoal">
              Stock total cumulé :{' '}
              <span className="font-mono font-bold text-ink">
                {totalComputedStock}
              </span>{' '}
              pièce{totalComputedStock > 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              Object.keys(SIZE_PRESETS) as Array<
                'clothing' | 'footwear' | 'one-size'
              >
            ).map((presetKey) => (
              <button
                key={presetKey}
                type="button"
                onClick={() => handleApplySizePreset(presetKey)}
                className="rounded-sm border border-silver/60 bg-surface px-2.5 py-1.5 font-body text-xs font-medium text-ink hover:border-ink hover:bg-white"
              >
                {SIZE_PRESETS[presetKey].label}
              </button>
            ))}
          </div>
        </div>

        {/* Liste des tailles actives */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {sizes.map((size) => (
            <span
              key={size}
              className="inline-flex items-center gap-1.5 rounded-sm border border-ink/20 bg-surface px-2.5 py-1 font-mono text-xs font-bold text-ink"
            >
              {size}
              {sizes.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveSize(size)}
                  aria-label={`Retirer la taille ${size}`}
                  className="text-charcoal hover:text-error"
                >
                  ×
                </button>
              )}
            </span>
          ))}

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={customSizeInput}
              onChange={(e) => setCustomSizeInput(e.target.value)}
              placeholder="Autre taille (ex. 46)"
              className="min-h-9 w-36 rounded-sm border border-silver/60 bg-surface px-2.5 font-mono text-xs text-ink"
            />
            <button
              type="button"
              onClick={handleAddCustomSize}
              className="min-h-9 rounded-sm border border-ink bg-white px-2.5 font-body text-xs font-semibold text-ink hover:bg-surface"
            >
              + Taille
            </button>
          </div>
        </div>

        {/* Matrice croisée Couleurs × Tailles */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-silver/40 bg-surface font-body text-[11px] font-bold uppercase tracking-wider text-charcoal">
                <th className="py-2.5 pr-3 pl-3">Couleur</th>
                {sizes.map((size) => (
                  <th key={size} className="px-2 py-2.5 text-center font-mono">
                    {size}
                  </th>
                ))}
                <th className="py-2.5 pr-3 pl-3 text-right">Action ligne</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver/30 font-body text-sm">
              {colors.map((color) => (
                <tr key={color.code}>
                  <td className="py-3 pr-3 pl-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-silver/70"
                        style={{ backgroundColor: color.hex }}
                        aria-hidden="true"
                      />
                      <span className="font-body text-xs font-bold text-ink">
                        {color.name}
                      </span>
                    </div>
                  </td>
                  {sizes.map((size) => {
                    const key = makeVariantKey(color.code, size);
                    const stockVal = stockByVariantKey[key] ?? 0;
                    return (
                      <td key={size} className="px-1.5 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={999}
                          aria-label={`Stock ${color.name} taille ${size}`}
                          value={stockVal}
                          onChange={(e) => {
                            const parsed = Math.max(
                              0,
                              Math.round(Number(e.target.value) || 0),
                            );
                            setStockByVariantKey((prev) => ({
                              ...prev,
                              [key]: parsed,
                            }));
                          }}
                          className={`min-h-10 w-16 rounded-sm border text-center font-mono text-xs font-bold focus:border-ink focus:outline-none ${
                            stockVal === 0
                              ? 'border-error/40 bg-error/5 text-error'
                              : stockVal <= 2
                                ? 'border-warning/40 bg-warning/10 text-ink'
                                : 'border-silver/60 bg-surface text-ink'
                          }`}
                        />
                      </td>
                    );
                  })}
                  <td className="py-2 pr-3 pl-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSetRowStock(color.code, 5)}
                        className="rounded-sm border border-silver/50 bg-surface px-2 py-1 font-mono text-[11px] text-ink hover:border-ink"
                      >
                        Tout à 5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetRowStock(color.code, 0)}
                        className="rounded-sm border border-silver/50 bg-surface px-2 py-1 font-mono text-[11px] text-charcoal hover:border-error hover:text-error"
                      >
                        Tout à 0
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 5 — Guide des tailles (SP-004) */}
      <section className="rounded-sm border border-silver/40 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-silver/30 pb-3">
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-red" aria-hidden="true" />
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-ink">
              5. Guide des tailles associé
            </h2>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: 'clothing', label: 'Gabarit Vêtements' },
                { key: 'footwear', label: 'Gabarit Pointures EU' },
                { key: 'one-size', label: 'Gabarit Taille unique' },
              ] as const
            ).map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                onClick={() => handleSelectSizeGuideTemplate(tpl.key)}
                className={`rounded-sm border px-2.5 py-1.5 font-body text-xs font-medium transition-colors ${
                  sizeGuide.type === tpl.key
                    ? 'border-ink bg-ink text-white'
                    : 'border-silver/60 bg-surface text-ink hover:border-ink'
                }`}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="size-guide-title"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Titre du guide
            </label>
            <input
              id="size-guide-title"
              type="text"
              value={sizeGuide.title}
              onChange={(e) =>
                setSizeGuide((prev) => ({ ...prev, title: e.target.value }))
              }
              className="mt-1.5 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink"
            />
          </div>

          <div>
            <label
              htmlFor="size-guide-tip"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Conseil morphologie / coupe
            </label>
            <input
              id="size-guide-tip"
              type="text"
              value={sizeGuide.tip}
              onChange={(e) =>
                setSizeGuide((prev) => ({ ...prev, tip: e.target.value }))
              }
              className="mt-1.5 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink"
            />
          </div>
        </div>
      </section>
    </form>
  );
}

export default function AdminProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const isCreateMode = !id || id === 'nouveau';

  const productQuery = useAdminProductDetail(isCreateMode ? undefined : id);
  const categoriesQuery = useAdminCategories();

  const categories = categoriesQuery.data?.categories ?? [
    {
      id: 'cat-vetements',
      slug: 'vetements',
      name: 'Vêtements',
      description: '',
      image: '',
      coverImage: '',
      fallbackImage: '',
      productCount: 0,
      subCategories: [
        {
          id: 'sub-t-shirts',
          slug: 't-shirts',
          name: 'T-shirts',
          coverImage: '',
          fallbackImage: '',
          productCount: 0,
        },
        {
          id: 'sub-hoodies',
          slug: 'hoodies',
          name: 'Hoodies',
          coverImage: '',
          fallbackImage: '',
          productCount: 0,
        },
      ],
    },
    {
      id: 'cat-chaussures',
      slug: 'chaussures',
      name: 'Chaussures',
      description: '',
      image: '',
      coverImage: '',
      fallbackImage: '',
      productCount: 0,
      subCategories: [
        {
          id: 'sub-sneakers',
          slug: 'sneakers',
          name: 'Sneakers',
          coverImage: '',
          fallbackImage: '',
          productCount: 0,
        },
      ],
    },
    {
      id: 'cat-babouches',
      slug: 'babouches',
      name: 'Babouches',
      description: '',
      image: '',
      coverImage: '',
      fallbackImage: '',
      productCount: 0,
      subCategories: [
        {
          id: 'sub-babouches-classiques',
          slug: 'babouches-classiques',
          name: 'Classiques cuir',
          coverImage: '',
          fallbackImage: '',
          productCount: 0,
        },
      ],
    },
  ];

  if (!isCreateMode && productQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink" aria-label="Chargement du produit" />
      </div>
    );
  }

  if (!isCreateMode && (productQuery.isError || !productQuery.data?.product)) {
    return (
      <div className="rounded-sm border border-error/30 bg-white p-6 text-center">
        <p className="font-display text-lg font-bold uppercase text-ink">
          Produit introuvable
        </p>
        <p className="mt-1 font-body text-sm text-charcoal">
          Ce produit n’existe plus ou a été supprimé du catalogue.
        </p>
        <Link
          to="/admin/catalogue"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-sm bg-ink px-4 py-2 font-body text-xs font-bold uppercase tracking-wider text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour au catalogue
        </Link>
      </div>
    );
  }

  const product = isCreateMode ? undefined : productQuery.data?.product;

  return (
    <ProductEditorForm
      key={product?.id ?? 'new-product'}
      initialProduct={product}
      categories={categories}
    />
  );
}
