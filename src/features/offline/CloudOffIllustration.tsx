import { cn } from '@/lib/utils/cn';

/**
 * Illustration en traits « nuage barré » (M6 §6.5) : traits en `currentColor`,
 * même famille que les illustrations des états vides (colis, cintre).
 */
export function CloudOffIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('h-28 w-36', className)}
    >
      {/* Nuage */}
      <path d="M46 92h68a22 22 0 0 0 3-43.8A32 32 0 0 0 55.6 42 24 24 0 0 0 46 92Z" />
      {/* Ondes de réseau éteintes sous le nuage */}
      <path d="M66 104h28" opacity="0.45" />
      <path d="M74 112h12" opacity="0.3" />
      {/* Barre oblique (coupure) */}
      <path d="M38 22 124 104" strokeWidth="3" />
      {/* Petites gouttes de pluie, purement décoratives */}
      <path d="M128 26v6M134 34h-6" opacity="0.35" />
      <path d="M24 60v5M26.5 62.5h-5" opacity="0.35" />
    </svg>
  );
}
