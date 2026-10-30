import { cn } from '@/lib/utils/cn';

/** Illustration en traits d'un colis (états vides, §4.4 M5). Couleur héritée (`currentColor`). */
export function ParcelIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 140"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('h-28 w-32', className)}
    >
      {/* Ombre au sol */}
      <path d="M30 124 h100" strokeDasharray="2 6" />
      {/* Carton en trois-quarts */}
      <path d="M80 22 L132 46 L80 70 L28 46 Z" />
      <path d="M28 46 V98 L80 122 V70" />
      <path d="M132 46 V98 L80 122" />
      {/* Ruban */}
      <path d="M54 34 L106 58" strokeWidth="5" className="text-red" stroke="currentColor" />
      {/* Étiquette */}
      <path d="M40 74 L64 85 V98 L40 87 Z" />
    </svg>
  );
}
