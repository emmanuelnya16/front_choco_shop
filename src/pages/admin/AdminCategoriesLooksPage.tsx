import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  Check,
  FolderTree,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Price } from '@/components/ui/Primitives';
import { prepareProof } from '@/features/payment/proof/prepareProof';
import { useToastStore } from '@/stores/toastStore';
import {
  useAdminCategories,
  useAdminCreateLook,
  useAdminDeleteLook,
  useAdminLooks,
  useAdminProductsList,
  useAdminUpdateCategory,
  useAdminUpdateLook,
} from '@/features/admin/api/useAdminQueries';
import type { Category, LookbookItem, Product, SubCategory } from '@/types/domain';

function slugifySubCategory(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface CategoryEditorCardProps {
  category: Category;
}

function CategoryEditorCard({ category }: CategoryEditorCardProps) {
  const updateCategoryMutation = useAdminUpdateCategory();
  const notifyToast = useToastStore((s) => s.show);
  const showToast = (message: string) => notifyToast({ message });

  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description);
  const [coverImage, setCoverImage] = useState(
    category.coverImage || category.image || category.fallbackImage,
  );
  const [subCategories, setSubCategories] = useState<SubCategory[]>(
    category.subCategories ?? [],
  );
  const [newSubName, setNewSubName] = useState('');

  const handleAddSubCategory = () => {
    const cleanName = newSubName.trim();
    if (!cleanName) return;
    const slug = slugifySubCategory(cleanName);
    if (subCategories.some((s) => s.slug === slug)) {
      showToast('Cette sous-catégorie existe déjà');
      return;
    }
    const nextSub: SubCategory = {
      id: `sub-${slug}`,
      slug,
      name: cleanName,
      coverImage: coverImage,
      fallbackImage: coverImage,
      productCount: 0,
    };
    setSubCategories((prev) => [...prev, nextSub]);
    setNewSubName('');
  };

  const handleRemoveSubCategory = (slug: string) => {
    setSubCategories((prev) => prev.filter((s) => s.slug !== slug));
  };

  const handleSaveCategory = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      showToast('Le nom de la catégorie est requis');
      return;
    }

    updateCategoryMutation.mutate(
      {
        id: category.id,
        payload: {
          name: cleanName,
          description: description.trim(),
          coverImage: coverImage.trim(),
          subCategories,
        },
      },
      {
        onSuccess: (res) => {
          showToast(`Catégorie « ${res.category.name} » enregistrée`);
        },
        onError: () => {
          showToast('Impossible de mettre à jour la catégorie');
        },
      },
    );
  };

  return (
    <form
      onSubmit={handleSaveCategory}
      className="flex flex-col justify-between rounded-sm border border-silver/40 bg-white p-4 sm:p-5"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 border-b border-silver/30 pb-3">
          <div className="h-14 w-12 shrink-0 overflow-hidden rounded-sm border border-silver/40 bg-surface">
            <img
              src={coverImage || category.fallbackImage}
              alt={name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-charcoal">
              /{category.slug} · {category.productCount} produit
              {category.productCount > 1 ? 's' : ''}
            </span>
            <h3 className="font-display text-lg font-bold uppercase text-ink">
              {category.name}
            </h3>
          </div>
        </div>

        <div>
          <label
            htmlFor={`cat-name-${category.slug}`}
            className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
          >
            Nom affiché
          </label>
          <input
            id={`cat-name-${category.slug}`}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink focus:border-ink focus:bg-white focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor={`cat-desc-${category.slug}`}
            className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
          >
            Description
          </label>
          <textarea
            id={`cat-desc-${category.slug}`}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-sm border border-silver/60 bg-surface p-2.5 font-body text-xs text-ink focus:border-ink focus:bg-white focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor={`cat-cover-${category.slug}`}
            className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
          >
            Image de couverture (URL)
          </label>
          <input
            id={`cat-cover-${category.slug}`}
            type="text"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            className="mt-1 min-h-10 w-full rounded-sm border border-silver/60 bg-surface px-3 font-mono text-xs text-ink focus:border-ink focus:bg-white focus:outline-none"
          />
        </div>

        {/* Sous-catégories */}
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-charcoal">
            Sous-catégories ({subCategories.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {subCategories.map((sub) => (
              <span
                key={sub.slug}
                className="inline-flex items-center gap-1.5 rounded-sm border border-silver/50 bg-surface px-2.5 py-1 font-body text-xs text-ink"
              >
                {sub.name}
                <button
                  type="button"
                  onClick={() => handleRemoveSubCategory(sub.slug)}
                  aria-label={`Retirer la sous-catégorie ${sub.name}`}
                  className="text-charcoal hover:text-error"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <input
              type="text"
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              placeholder="Nouvelle sous-catégorie..."
              aria-label={`Nouvelle sous-catégorie pour ${category.name}`}
              className="min-h-10 flex-1 rounded-sm border border-silver/60 bg-surface px-2.5 font-body text-xs text-ink"
            />
            <button
              type="button"
              onClick={handleAddSubCategory}
              className="inline-flex min-h-10 items-center gap-1 rounded-sm border border-ink bg-white px-3 font-body text-xs font-semibold text-ink hover:bg-surface"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Ajouter
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-silver/30 pt-3">
        <button
          type="submit"
          disabled={updateCategoryMutation.isPending}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-ink px-4 py-2 font-body text-xs font-bold uppercase tracking-wider text-white hover:bg-charcoal disabled:opacity-50"
        >
          {updateCategoryMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          Enregistrer {category.name}
        </button>
      </div>
    </form>
  );
}

interface LookEditorPanelProps {
  initialLook: LookbookItem | null;
  products: Product[];
  onClose: () => void;
}

function LookEditorPanel({ initialLook, products, onClose }: LookEditorPanelProps) {
  const isEditing = Boolean(initialLook);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const notifyToast = useToastStore((s) => s.show);
  const showToast = (message: string) => notifyToast({ message });

  const createLookMutation = useAdminCreateLook();
  const updateLookMutation = useAdminUpdateLook();

  const [title, setTitle] = useState(initialLook?.title ?? '');
  const [subtitle, setSubtitle] = useState(initialLook?.subtitle ?? '');
  const [image, setImage] = useState(
    initialLook?.image ?? '/mocks/looks/look-bitume-royal.svg',
  );
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(
    initialLook?.productSlugs ?? [],
  );
  const [isCompressing, setIsCompressing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleProductSlug = (slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      const compressed = await prepareProof(file);
      const previewUrl =
        typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(compressed.blob)
          : '/mocks/looks/look-bitume-royal.svg';
      setImage(previewUrl);
      showToast('Photo 4:5 chargée et optimisée');
    } catch {
      showToast('Impossible de traiter cette image');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Le titre du look est obligatoire.');
      return;
    }
    if (selectedSlugs.length === 0) {
      setErrorMsg('Sélectionnez au moins un produit du catalogue pour ce look.');
      return;
    }

    const payload = {
      title: cleanTitle,
      subtitle: subtitle.trim() || 'Silhouette signature DR Choco',
      image: image.trim() || '/mocks/looks/look-bitume-royal.svg',
      productSlugs: selectedSlugs,
    };

    if (isEditing && initialLook) {
      updateLookMutation.mutate(
        { id: initialLook.id, payload },
        {
          onSuccess: (res) => {
            showToast(`Look « ${res.look.title} » mis à jour`);
            onClose();
          },
          onError: (err) => {
            setErrorMsg(
              err instanceof Error
                ? err.message
                : 'Impossible de mettre à jour ce look.',
            );
          },
        },
      );
    } else {
      createLookMutation.mutate(payload, {
        onSuccess: (res) => {
          showToast(`Look « ${res.look.title} » publié`);
          onClose();
        },
        onError: (err) => {
          setErrorMsg(
            err instanceof Error ? err.message : 'Impossible de créer ce look.',
          );
        },
      });
    }
  };

  const isSaving = createLookMutation.isPending || updateLookMutation.isPending;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-sm border border-ink bg-white p-4 shadow-sm sm:p-5"
      noValidate
    >
      <div className="mb-4 flex items-center justify-between border-b border-silver/30 pb-3">
        <h3 className="font-display text-base font-bold uppercase tracking-wide text-ink">
          {isEditing
            ? `Modifier le look : ${initialLook?.title}`
            : 'Nouveau look « Portés par L’Incompris »'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le formulaire de look"
          className="rounded-sm p-1.5 text-charcoal hover:bg-surface hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mb-4 rounded-sm border border-error/40 bg-error/5 p-3 font-body text-xs font-medium text-error"
        >
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Champs texte + photo */}
        <div className="space-y-3 lg:col-span-1">
          <div>
            <label
              htmlFor="look-title-input"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Titre du look *
            </label>
            <input
              id="look-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. : Silhouette Bitume Royal"
              className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink"
              required
            />
          </div>

          <div>
            <label
              htmlFor="look-subtitle-input"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Sous-titre / ambiance
            </label>
            <input
              id="look-subtitle-input"
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Ex. : Hoodie lourd + Babouches cuir noir"
              className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink"
            />
          </div>

          <div>
            <label
              htmlFor="look-image-input"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Visuel 4:5 (URL ou photo)
            </label>
            <input
              id="look-image-input"
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-sm border border-silver/60 bg-surface px-3 font-mono text-xs text-ink"
            />
            <div className="mt-2 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={isCompressing}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-silver/60 bg-surface px-3 py-1 font-body text-xs font-medium text-ink hover:border-ink"
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                {isCompressing ? 'Compression...' : 'Choisir une photo'}
              </button>
            </div>
          </div>
        </div>

        {/* Sélecteur multi-produits visuel */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="font-body text-xs font-bold uppercase tracking-wider text-charcoal">
              Articles associés au look ({selectedSlugs.length} sélectionné
              {selectedSlugs.length > 1 ? 's' : ''}) *
            </p>
          </div>

          <div className="mt-2 grid max-h-72 grid-cols-1 gap-2 overflow-y-auto rounded-sm border border-silver/40 bg-surface p-2.5 sm:grid-cols-2">
            {products.map((product) => {
              const isSelected = selectedSlugs.includes(product.slug);
              const thumb =
                product.mediaGallery?.[0]?.url ||
                product.images?.[0] ||
                product.fallbackImages?.[0];
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => toggleProductSlug(product.slug)}
                  aria-pressed={isSelected}
                  className={`flex items-center gap-2.5 rounded-sm border p-2 text-left transition-colors ${
                    isSelected
                      ? 'border-ink bg-ink text-white'
                      : 'border-silver/50 bg-white text-ink hover:border-ink'
                  }`}
                >
                  <div className="h-11 w-9 shrink-0 overflow-hidden rounded-sm bg-surface">
                    {thumb && (
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-xs font-bold">
                      {product.name}
                    </p>
                    <Price
                      amount={product.price}
                      className={`text-[11px] ${
                        isSelected ? 'text-silver' : 'text-charcoal'
                      }`}
                    />
                  </div>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border ${
                      isSelected
                        ? 'border-white bg-red text-white'
                        : 'border-silver/70 bg-surface'
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-silver/30 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center rounded-sm border border-silver/60 bg-white px-4 py-2 font-body text-xs font-semibold text-ink"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-ink px-5 py-2 font-body text-xs font-bold uppercase tracking-wider text-white hover:bg-charcoal disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {isEditing ? 'Enregistrer le look' : 'Publier le look'}
        </button>
      </div>
    </form>
  );
}

export default function AdminCategoriesLooksPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const notifyToast = useToastStore((s) => s.show);
  const showToast = (message: string) => notifyToast({ message });

  const activeTab: 'categories' | 'looks' = location.pathname.includes('/looks')
    ? 'looks'
    : 'categories';

  const categoriesQuery = useAdminCategories();
  const looksQuery = useAdminLooks();
  const productsQuery = useAdminProductsList({ pageSize: 50 });
  const deleteLookMutation = useAdminDeleteLook();

  const [editorMode, setEditorMode] = useState<'closed' | 'create' | 'edit'>(
    'closed',
  );
  const [editingLook, setEditingLook] = useState<LookbookItem | null>(null);

  const categories = categoriesQuery.data?.categories ?? [];
  const looks = looksQuery.data?.looks ?? [];
  const products = productsQuery.data?.items ?? [];

  const handleSwitchTab = (tab: 'categories' | 'looks') => {
    navigate(tab === 'looks' ? '/admin/looks' : '/admin/categories');
  };

  const handleOpenCreateLook = () => {
    setEditingLook(null);
    setEditorMode('create');
  };

  const handleOpenEditLook = (look: LookbookItem) => {
    setEditingLook(look);
    setEditorMode('edit');
  };

  const handleDeleteLook = (look: LookbookItem) => {
    deleteLookMutation.mutate(look.id, {
      onSuccess: () => {
        showToast(`Look « ${look.title} » supprimé`);
      },
      onError: () => {
        showToast('Impossible de supprimer ce look');
      },
    });
  };

  return (
    <div className="space-y-6 pb-10">
      {/* En-tête + navigation par onglets */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-ink">
            Catégories & Looks
          </h1>
          <p className="mt-0.5 font-body text-xs text-charcoal">
            Structurez les rayons du catalogue et les silhouettes «{'\u00A0'}
            Portés par L’Incompris{'\u00A0'}».
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Gestion des catégories et des looks"
          className="inline-flex rounded-sm border border-silver/50 bg-white p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'categories'}
            onClick={() => handleSwitchTab('categories')}
            className={`inline-flex min-h-10 items-center gap-2 rounded-sm px-3.5 py-1.5 font-body text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'categories'
                ? 'bg-ink text-white'
                : 'text-charcoal hover:text-ink'
            }`}
          >
            <FolderTree className="h-3.5 w-3.5" aria-hidden="true" />
            Catégories ({categories.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'looks'}
            onClick={() => handleSwitchTab('looks')}
            className={`inline-flex min-h-10 items-center gap-2 rounded-sm px-3.5 py-1.5 font-body text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'looks'
                ? 'bg-ink text-white'
                : 'text-charcoal hover:text-ink'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Looks ({looks.length})
          </button>
        </div>
      </div>

      {/* ONGLET 1 — Catégories & Sous-catégories */}
      {activeTab === 'categories' && (
        <div>
          {categoriesQuery.isLoading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-ink" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {categories.map((category) => (
                <CategoryEditorCard key={category.id} category={category} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ONGLET 2 — Looks « Portés par L’Incompris » (SP-005) */}
      {activeTab === 'looks' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-silver/40 bg-white p-4">
            <div>
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-ink">
                Silhouettes «{'\u00A0'}Portés par L’Incompris{'\u00A0'}»
              </h2>
              <p className="font-body text-xs text-charcoal">
                Chaque look associe une photo 4:5 et les articles correspondants
                sur la page d’accueil. Si aucun look n’est publié, la section se
                masque automatiquement côté client.
              </p>
            </div>

            {editorMode === 'closed' && (
              <button
                type="button"
                onClick={handleOpenCreateLook}
                className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-ink px-4 py-2 font-body text-xs font-bold uppercase tracking-wider text-white hover:bg-charcoal"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nouveau look
              </button>
            )}
          </div>

          {editorMode !== 'closed' && (
            <LookEditorPanel
              key={editingLook?.id ?? 'create-look'}
              initialLook={editingLook}
              products={products}
              onClose={() => {
                setEditorMode('closed');
                setEditingLook(null);
              }}
            />
          )}

          {looksQuery.isLoading ? (
            <div className="flex min-h-[25vh] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-ink" />
            </div>
          ) : looks.length === 0 ? (
            <div className="rounded-sm border border-dashed border-silver bg-white p-8 text-center">
              <p className="font-display text-base font-bold uppercase text-ink">
                Aucun look publié actuellement
              </p>
              <p className="mt-1 font-body text-xs text-charcoal">
                La section «{'\u00A0'}Portés par L’Incompris{'\u00A0'}» est
                actuellement masquée sur la page d’accueil client (SP-005).
              </p>
              <button
                type="button"
                onClick={handleOpenCreateLook}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-sm bg-ink px-4 py-2 font-body text-xs font-bold uppercase tracking-wider text-white"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Créer un premier look
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {looks.map((look) => (
                <article
                  key={look.id}
                  className="flex flex-col justify-between overflow-hidden rounded-sm border border-silver/40 bg-white"
                >
                  <div>
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface">
                      <img
                        src={look.image || look.fallback}
                        alt={look.title}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-2 left-2 rounded-sm bg-ink/90 px-2.5 py-1 font-mono text-[11px] font-bold text-white">
                        {look.productSlugs.length} article
                        {look.productSlugs.length > 1 ? 's' : ''} associé
                        {look.productSlugs.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="p-4">
                      <h3 className="font-display text-base font-bold uppercase text-ink">
                        {look.title}
                      </h3>
                      <p className="mt-0.5 font-body text-xs text-charcoal">
                        {look.subtitle}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-1">
                        {look.productSlugs.map((slug) => (
                          <span
                            key={slug}
                            className="rounded-sm bg-surface px-2 py-0.5 font-mono text-[10px] text-charcoal"
                          >
                            {slug}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-silver/30 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleOpenEditLook(look)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-silver/60 bg-white px-3 py-1.5 font-body text-xs font-semibold text-ink hover:border-ink"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Modifier
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteLook(look)}
                      disabled={deleteLookMutation.isPending}
                      aria-label={`Supprimer le look ${look.title}`}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-error/30 bg-white px-3 py-1.5 font-body text-xs font-semibold text-error hover:bg-error/5"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Supprimer
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
