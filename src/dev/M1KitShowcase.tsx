import { Heart, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { Badge, Chip } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CategoryTile } from '@/components/ui/CategoryTile';
import { IconButton } from '@/components/ui/IconButton';
import { Logo } from '@/components/ui/Logo';
import { Marquee } from '@/components/ui/Marquee';
import { Price, Skeleton } from '@/components/ui/Primitives';
import { ProductCard, ProductCardSkeleton } from '@/components/ui/ProductCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { mockCategories } from '@/mocks/fixtures/categories';
import { mockProducts } from '@/mocks/fixtures/products';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';

export function M1KitShowcase() {
  const [selectedChip, setSelectedChip] = useState('tous');
  const openSizePicker = useUiStore((s) => s.openSizePicker);
  const showToast = useToastStore((s) => s.show);

  const sampleProduct = mockProducts[0];
  const soldOutProduct =
    mockProducts.find((p) => p.variants.every((v) => v.stock === 0)) ??
    mockProducts[1];
  const sampleCategory = mockCategories[0];

  return (
    <section aria-labelledby="dev-m1-kit" className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver pb-3">
        <h2 id="dev-m1-kit" className="text-h2 text-ink">
          10. Kit Visuel M1 (Composants Réutilisables)
        </h2>
        <span className="text-small text-text-2">
          src/components/ui/* · Logo, Button, IconButton, Badge, Chip, ProductCard, CategoryTile, Sheet, Toast, Marquee
        </span>
      </div>

      {/* 10.1 Logos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-[var(--radius-md)] border border-silver bg-white p-5">
          <p className="text-label text-text-2">Logo · variant=&quot;dark&quot; (sm, md, lg)</p>
          <div className="flex flex-wrap items-center gap-6">
            <Logo variant="dark" size="sm" />
            <Logo variant="dark" size="md" />
            <Logo variant="dark" size="lg" />
          </div>
        </div>

        <div className="space-y-4 rounded-[var(--radius-md)] bg-ink p-5">
          <p className="text-label text-silver">Logo · variant=&quot;light&quot; (sm, md, lg)</p>
          <div className="flex flex-wrap items-center gap-6">
            <Logo variant="light" size="sm" />
            <Logo variant="light" size="md" />
            <Logo variant="light" size="lg" />
          </div>
        </div>
      </div>

      {/* 10.2 Buttons & IconButtons */}
      <div className="space-y-6 rounded-[var(--radius-md)] border border-silver bg-surface p-5">
        <div>
          <p className="text-label text-text-2">Button · Variantes &amp; Tailles</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg">Primary lg</Button>
            <Button variant="dark" size="md">Dark md</Button>
            <Button variant="outline" size="md">Outline md</Button>
            <Button variant="ghost" size="sm">Ghost sm</Button>
            <Button variant="primary" size="md" loading>Chargement</Button>
            <Button variant="dark" size="md" disabled>Désactivé</Button>
          </div>
        </div>

        <div className="rounded-[var(--radius-sm)] bg-ink p-4">
          <p className="text-label text-silver">Button sur fond sombre (outline-light &amp; light)</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="light" size="md">Light md</Button>
            <Button variant="outline-light" size="md">Outline-light md</Button>
          </div>
        </div>

        <div>
          <p className="text-label text-text-2">IconButton · Variantes &amp; Badges</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <IconButton
              variant="plain"
              icon={<Heart className="h-5 w-5" aria-hidden="true" />}
              label="Favoris (plain)"
              badge={3}
            />
            <IconButton
              variant="surface"
              icon={<ShoppingBag className="h-5 w-5" aria-hidden="true" />}
              label="Panier (surface)"
              badge={12}
            />
            <IconButton
              variant="dark"
              icon={<ShoppingBag className="h-5 w-5" aria-hidden="true" />}
              label="Panier (dark)"
            />
          </div>
        </div>
      </div>

      {/* 10.3 Badges, Chips, Price, SectionHeader */}
      <div className="space-y-6 rounded-[var(--radius-md)] border border-silver bg-white p-5">
        <div>
          <p className="text-label text-text-2">Badge · 4 Variantes</p>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Badge variant="new">Nouveau</Badge>
            <Badge variant="low-stock" lowStockCount={2} />
            <Badge variant="sold-out">Épuisé</Badge>
            <Badge variant="info">Édition limitée</Badge>
          </div>
        </div>

        <div>
          <p className="text-label text-text-2">Chip · Filtres cliquables</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[
              { id: 'tous', label: 'Tous (24)' },
              { id: 't-shirts', label: 'T-shirts (6)' },
              { id: 'babouches', label: 'Babouches (6)' },
            ].map((chip) => (
              <Chip
                key={chip.id}
                active={selectedChip === chip.id}
                onClick={() => setSelectedChip(chip.id)}
              >
                {chip.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="text-label text-text-2">Price &amp; SectionHeader</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-6">
            <Price amount={45000} className="text-h3" />
            <Price amount={18000} className="text-small" />
          </div>
          <div className="mt-4 border-t border-silver/60 pt-4">
            <SectionHeader
              eyebrow="Exemple d'en-tête"
              title="Titre de section"
              actionLabel="Voir tout"
              actionHref="/explorer"
            />
          </div>
        </div>
      </div>

      {/* 10.4 ProductCard, ProductCardSkeleton & CategoryTile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {sampleProduct && (
          <div>
            <p className="mb-2 text-label text-text-2">ProductCard (En stock)</p>
            <ProductCard product={sampleProduct} />
          </div>
        )}
        {soldOutProduct && (
          <div>
            <p className="mb-2 text-label text-text-2">ProductCard (Épuisé)</p>
            <ProductCard product={soldOutProduct} />
          </div>
        )}
        <div>
          <p className="mb-2 text-label text-text-2">ProductCardSkeleton</p>
          <ProductCardSkeleton />
        </div>
        {sampleCategory && (
          <div>
            <p className="mb-2 text-label text-text-2">CategoryTile (4:3)</p>
            <CategoryTile
              name={sampleCategory.name}
              slug={sampleCategory.slug}
              count={sampleCategory.productCount}
              coverImage={sampleCategory.coverImage}
              fallbackImage={sampleCategory.fallbackImage}
              ratio="4/3"
            />
            <div className="mt-4 space-y-2">
              <p className="text-label text-text-2">Skeleton générique</p>
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        )}
      </div>

      {/* 10.5 Sheet + SizePicker & Toasts */}
      <div className="space-y-4 rounded-[var(--radius-md)] border border-silver bg-surface p-5">
        <p className="text-label text-text-2">Sheet (SizePicker) &amp; Notifications Toast</p>
        <div className="flex flex-wrap items-center gap-3">
          {sampleProduct && (
            <Button
              variant="dark"
              size="md"
              onClick={() => openSizePicker(sampleProduct, 'add')}
            >
              Ouvrir la feuille de taille (Sheet)
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={() =>
              showToast({
                message: `${sampleProduct?.name ?? 'Article'} (Taille L) ajouté au panier.`,
                actionLabel: 'Voir le panier',
                actionHref: '/panier',
              })
            }
          >
            Toast Ajout Panier
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() =>
              showToast({
                message: 'Bientôt disponible — fonctionnalité prévue au module suivant.',
              })
            }
          >
            Toast Info
          </Button>
        </div>
      </div>

      {/* 10.6 Marquee */}
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-silver">
        <Marquee
          tone="red"
          items={[
            { id: 'm1', label: 'BANDEAU DÉFILANT GSAP' },
            { id: 'm2', label: 'RÉACTION AU DÉFILEMENT' },
            { id: 'm3', label: 'PAUSE HORS ÉCRAN' },
          ]}
        />
      </div>
    </section>
  );
}
