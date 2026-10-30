import { useEffect } from 'react';
import { formatPrice } from '@/lib/utils/price';
import type { Product } from '@/types/domain';

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
}

/**
 * Balises SEO dynamiques, OpenGraph (WhatsApp / Facebook) et données structurées Schema.org Product (§7.11).
 */
export function ProductSeo({ product }: { product: Product }) {
  useEffect(() => {
    const previousTitle = document.title;
    const formattedPrice = formatPrice(product.price);
    const pageTitle = `${product.name} — ${formattedPrice} | DR Choco L'Incompris`;
    document.title = pageTitle;

    const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://drchoco.cm';
    const rawImg = product.images[0] ?? product.fallbackImages[0] ?? '/mock/product-tee.svg';
    const imageUrl = rawImg.startsWith('http') ? rawImg : `${origin}${rawImg}`;
    const pageUrl =
      typeof window !== 'undefined'
        ? window.location.href
        : `${origin}/produit/${product.slug}`;

    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: product.description,
    });
    upsertMeta('meta[property="og:title"]', {
      property: 'og:title',
      content: `${product.name} — ${formattedPrice}`,
    });
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: product.description,
    });
    upsertMeta('meta[property="og:image"]', {
      property: 'og:image',
      content: imageUrl,
    });
    upsertMeta('meta[property="og:url"]', {
      property: 'og:url',
      content: pageUrl,
    });
    upsertMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: 'product',
    });
    upsertMeta('meta[property="product:price:amount"]', {
      property: 'product:price:amount',
      content: String(product.price),
    });
    upsertMeta('meta[property="product:price:currency"]', {
      property: 'product:price:currency',
      content: 'XAF',
    });

    // Données structurées JSON-LD Schema.org Product
    const scriptId = 'product-jsonld-schema';
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = scriptId;
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      image: [imageUrl],
      description: product.description,
      sku: product.id,
      brand: {
        '@type': 'Brand',
        name: "DR Choco L'Incompris",
      },
      offers: {
        '@type': 'Offer',
        url: pageUrl,
        priceCurrency: 'XAF',
        price: String(product.price),
        availability:
          totalStock > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
    };

    scriptEl.textContent = JSON.stringify(jsonLd);

    return () => {
      document.title = previousTitle;
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [product]);

  return null;
}
