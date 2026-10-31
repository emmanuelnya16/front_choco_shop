import { Ruler } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import type { SizeGuideTable } from '@/types/domain';

export interface SizeGuideSheetProps {
  open: boolean;
  onClose: () => void;
  sizeGuide?: SizeGuideTable;
}

/**
 * Tiroir du guide des tailles (§7.6) :
 * Affiche le tableau de correspondance adapté à la catégorie de l'article
 * (Vêtements en cm ou Chaussures/Babouches en pointures EU & longueur du pied)
 * ainsi que le conseil de coupe.
 */
export function SizeGuideSheet({ open, onClose, sizeGuide }: SizeGuideSheetProps) {
  if (!sizeGuide) return null;

  return (
    <Sheet open={open} onClose={onClose} title={sizeGuide.title}>
      {/* Écran peu haut (téléphone à l'horizontale) : le contenu défile dans la feuille au lieu de pousser
          son titre et sa croix hors de l'écran.
          HYPOTHÈSE: 9,5rem = marge haute + poignée, titre et marges de la feuille (≈ 131 px en mobile, 123 px en lg) */}
      <div className="-mx-1 max-h-[calc(100dvh-9.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] space-y-5 overflow-y-auto overscroll-contain px-1">
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-silver">
          <table className="w-full border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-silver bg-surface text-xs font-bold uppercase text-ink">
                {sizeGuide.headers.map((col) => (
                  <th key={col} scope="col" className="px-3.5 py-2.5">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-silver/60 bg-white">
              {sizeGuide.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-surface/60">
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className={
                        cellIdx === 0
                          ? 'px-3.5 py-2.5 font-bold text-ink tabular-nums'
                          : 'px-3.5 py-2.5 text-text-2 tabular-nums'
                      }
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-surface p-4">
          <Ruler className="mt-0.5 h-5 w-5 shrink-0 text-red" aria-hidden="true" />
          <p className="text-small text-ink">{sizeGuide.tip}</p>
        </div>
      </div>
    </Sheet>
  );
}
