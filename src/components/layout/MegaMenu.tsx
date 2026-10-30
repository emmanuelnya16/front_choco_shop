import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { ArrowRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { useCategories } from '@/features/catalog/api/useCatalogQueries';
import { fadeUp, staggerContainer } from '@/motion/presets';
import { duration, ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

export interface MegaMenuProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export function MegaMenu({ open, onClose, triggerRef }: MegaMenuProps) {
  const { data: categories = [] } = useCategories();
  const panelRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotionPref();

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        triggerRef.current?.focus();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [open, onClose, triggerRef]);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          ref={panelRef}
          id="mega-menu-panel"
          role="region"
          aria-label="Catégories de la boutique"
          initial={
            reducedMotion
              ? { opacity: 1 }
              : { clipPath: 'inset(0 0 100% 0)', opacity: 0.9 }
          }
          animate={
            reducedMotion
              ? { opacity: 1 }
              : {
                  clipPath: 'inset(0 0 0% 0)',
                  opacity: 1,
                  transition: { duration: 0.45, ease: ease.inOut },
                }
          }
          exit={
            reducedMotion
              ? { opacity: 0 }
              : {
                  clipPath: 'inset(0 0 100% 0)',
                  opacity: 0,
                  transition: { duration: duration.fast, ease: ease.inOut },
                }
          }
          className="absolute top-full right-0 left-0 z-50 border-b border-silver bg-white shadow-[var(--shadow-pop)]"
        >
          <Container className="py-8">
            <m.div
              variants={staggerContainer(0.05)}
              initial={reducedMotion ? 'visible' : 'hidden'}
              animate="visible"
              className="grid grid-cols-4 gap-8"
            >
              {categories.slice(0, 3).map((category) => (
                <m.div
                  key={category.id}
                  variants={fadeUp}
                  className="flex flex-col"
                >
                  <Link
                    to={`/explorer/${category.slug}`}
                    onClick={onClose}
                    className="group inline-flex items-center justify-between border-b border-silver/60 pb-3 text-h3 text-ink transition-colors hover:text-red"
                  >
                    <span>{category.name}</span>
                    <ArrowRight
                      className="h-4 w-4 text-text-2 transition-transform group-hover:translate-x-1 group-hover:text-red"
                      aria-hidden="true"
                    />
                  </Link>

                  <p className="mt-2 text-xs text-text-2">
                    {category.description}
                  </p>

                  <ul className="mt-4 space-y-2.5">
                    {category.subCategories.map((sub) => (
                      <li key={sub.id}>
                        <Link
                          to={`/explorer/${sub.slug}`}
                          onClick={onClose}
                          className="inline-flex w-full items-center justify-between text-small font-medium text-ink transition-colors hover:text-red"
                        >
                          <span>{sub.name}</span>
                          <span className="font-mono text-xs text-text-2">
                            ({sub.productCount})
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-4">
                    <Link
                      to={`/explorer/${category.slug}`}
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red hover:underline"
                    >
                      Voir tout ({category.productCount})
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </m.div>
              ))}

              {/* 4th column: Nouveautés mood tile */}
              <m.div
                variants={fadeUp}
                className="relative overflow-hidden rounded-[var(--radius-md)] bg-ink"
              >
                <SmartImage
                  src="/images/hero/hero-mobile.webp"
                  fallback="/images/fallback/mood-hero.svg"
                  alt=""
                  tone="mood"
                  ratio="4/3"
                  sizes="320px"
                  className="h-full w-full"
                  imgClassName="h-full w-full object-cover"
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to top, var(--color-scrim-85) 0%, var(--color-scrim-40) 60%, transparent 100%)',
                  }}
                />
                <div className="absolute inset-0 flex flex-col justify-end p-5">
                  <span className="text-label text-white/80">Arrivages</span>
                  <p className="mt-1 font-display text-2xl leading-none tracking-wide text-white uppercase">
                    NOUVEAUTÉS DE LA SEMAINE
                  </p>
                  <div className="mt-4" onClick={onClose}>
                    <Button
                      variant="light"
                      size="sm"
                      href="/explorer?sort=newest"
                    >
                      Découvrir
                    </Button>
                  </div>
                </div>
              </m.div>
            </m.div>
          </Container>
        </m.div>
      )}
    </AnimatePresence>
  );
}
