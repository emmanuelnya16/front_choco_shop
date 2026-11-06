import { useEffect } from 'react';
import { canonicalFor, DEFAULT_DESCRIPTION, normalizeDescription, siteOrigin, SITE_NAME, upsertMeta } from '@/lib/seo/seo';
import { useSeo } from '@/lib/seo/useSeo';
import { formatPrice } from '@/lib/utils/price';
import { productPrimaryImage } from './productImages';
import type { Product } from '@/types/domain';

const JSON_LD_ID = 'product-jsonld-schema';

/** Balises propres à la fiche, retirées en la quittant. */
const PRODUCT_ONLY_META = [
  'meta[property="og:image"]',
  'meta[property="og:url"]',
  'meta[property="product:price:amount"]',
  'meta[property="product:price:currency"]',
];

/**
 * Référencement de la fiche produit (§7.11, M7 §7) : titre avec le prix, description, adresse
 * canonique sans paramètres (`/produit/slug`, quelle que soit la taille choisie dans l'adresse) et
 * données structurées Schema.org Product.
 *
 * Rappel : les balises Open Graph écrites ici ne servent qu'aux robots qui exécutent le JavaScript.
 * WhatsApp et Facebook ne le font pas : pour un aperçu de partage correct, ces balises doivent être
 * insérées côté serveur dans la page renvoyée pour /produit/:slug (M2).
 */
export function ProductSeo({ product }: { product: Product }) {
  const formattedPrice = formatPrice(product.price);
  const canonicalPath = `/produit/${product.slug}`;

  useSeo({
    title: `${product.name} — ${formattedPrice} | ${SITE_NAME}`,
    absoluteTitle: true,
    description: product.description,
    canonicalPath,
    // Une fiche produit est toujours indexable
    noindex: false,
  });

  useEffect(() => {
    const origin = siteOrigin();
    const pageUrl = canonicalFor(canonicalPath, origin);
    const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    const rawImg = productPrimaryImage(product);
    const imageUrl = /^https?:\/\//.test(rawImg) ? rawImg : `${origin}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`;
    const description = normalizeDescription(product.description);

    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: `${product.name} — ${formattedPrice}` });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: pageUrl });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'product' });
    upsertMeta('meta[property="product:price:amount"]', {
      property: 'product:price:amount',
      content: String(product.price),
    });
    upsertMeta('meta[property="product:price:currency"]', { property: 'product:price:currency', content: 'XAF' });

    // Données structurées JSON-LD Schema.org Product
    let scriptEl = document.getElementById(JSON_LD_ID) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = JSON_LD_ID;
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      image: [imageUrl],
      description: product.description,
      sku: product.id,
      url: pageUrl,
      brand: { '@type': 'Brand', name: SITE_NAME },
      offers: {
        '@type': 'Offer',
        url: pageUrl,
        priceCurrency: 'XAF',
        price: String(product.price),
        availability: totalStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
    });

    return () => {
      document.getElementById(JSON_LD_ID)?.remove();
      for (const selector of PRODUCT_ONLY_META) document.head.querySelector(selector)?.remove();
      // Valeurs de index.html
      upsertMeta('meta[property="og:title"]', { property: 'og:title', content: SITE_NAME });
      upsertMeta('meta[property="og:description"]', { property: 'og:description', content: DEFAULT_DESCRIPTION });
      upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    };
  }, [product, formattedPrice, canonicalPath]);

  return null;
}
