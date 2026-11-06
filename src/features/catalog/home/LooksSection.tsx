import * as m from 'motion/react-m';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { Container, Section, Skeleton } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { useLooks } from '@/features/catalog/api/useCatalogQueries';
import { HomeSectionNotice } from '@/features/catalog/home/HomeSectionNotice';
import { homeSectionStatus } from '@/features/catalog/home/homeSectionStatus';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { fadeUp, staggerContainer } from '@/motion/presets';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

const NOTICE_TEXT = {
  error: 'Nos looks n’ont pas pu s’afficher.',
  offline: 'Vous êtes hors connexion\u00A0: nos looks s’afficheront dès le retour du réseau.',
};

/** Carrousel sur téléphone et tablette : cartes de 78 % de l'écran (312 px au plus). */
const MOBILE_ROW_CLASSES =
  'no-scrollbar -mx-page mt-8 flex snap-x snap-mandatory scroll-px-page gap-4 overflow-x-auto px-page lg:hidden';
const MOBILE_ITEM_CLASSES = 'w-[78vw] max-w-78 shrink-0 snap-start';

// Lien de carte : contour de focus visible au clavier, à l'écart de la photo
const LOOK_LINK_CLASSES =
  'block rounded-[var(--radius-md)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink';

function LookSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-[4/5] w-full" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  );
}

export function LooksSection() {
  const query = useLooks();
  const looks = query.data ?? [];
  const reducedMotion = useReducedMotionPref();
  const online = useOnlineStatus();
  const status = homeSectionStatus(query, looks.length === 0, online);

  if (status === 'empty') return null;

  return (
    <Section className="pt-0">
      <Container>
        <div className="mx-auto max-w-xl text-center">
          <span className="text-label text-red">Inspirations</span>
          <h2 className="mt-2 text-h2 text-ink">
            PORTÉS PAR
            <br />
            L&rsquo;INCOMPRIS
          </h2>
        </div>

        {status === 'loading' && (
          <>
            <div className="mt-10 hidden grid-cols-4 gap-5 lg:grid">
              {Array.from({ length: 4 }).map((_, idx) => (
                <LookSkeleton key={idx} />
              ))}
            </div>
            <div className={MOBILE_ROW_CLASSES}>
              {Array.from({ length: 2 }).map((_, idx) => (
                <div key={idx} className={MOBILE_ITEM_CLASSES}>
                  <LookSkeleton />
                </div>
              ))}
            </div>
          </>
        )}

        {(status === 'error' || status === 'offline') && (
          <div className="mt-8">
            <HomeSectionNotice status={status} onRetry={() => void query.refetch()} text={NOTICE_TEXT} />
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* Ordinateur : grille 4 colonnes ; photo en couleur et zoom de 1,04 au survol */}
            <m.div
              variants={staggerContainer()}
              initial={reducedMotion ? 'visible' : 'hidden'}
              whileInView="visible"
              viewport={{ once: true, amount: 0.25 }}
              className="mt-10 hidden grid-cols-4 gap-5 lg:grid"
            >
              {looks.map((look) => (
                <m.article key={look.id} variants={fadeUp} className="group/look">
                  <Link to={`/explorer?look=${encodeURIComponent(look.id)}`} className={LOOK_LINK_CLASSES}>
                    <div className="overflow-hidden rounded-[var(--radius-md)] bg-ink">
                      <SmartImage
                        src={look.image}
                        fallback={look.fallback}
                        alt=""
                        tone="mood"
                        colorRevealOnGroupHover
                        ratio="4/5"
                        sizes="(min-width: 1024px) 290px, 78vw"
                        imgClassName="transition-transform duration-reveal ease-brand-out [@media(hover:hover)]:group-hover/look:scale-[1.04]"
                      />
                    </div>

                    <div className="mt-4">
                      <h3 className="text-h3 text-ink transition-colors duration-fast [@media(hover:hover)]:group-hover/look:text-red">
                        {look.title}
                      </h3>
                      <p className="mt-1 text-caption text-text-2">{look.subtitle}</p>
                      <span className="mt-2 inline-flex items-center gap-2 text-small font-semibold text-ink transition-colors duration-fast [@media(hover:hover)]:group-hover/look:text-red">
                        <span>Voir le look</span>
                        <ArrowRight
                          className="h-4 w-4 transition-transform duration-fast [@media(hover:hover)]:group-hover/look:translate-x-1"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </Link>
                </m.article>
              ))}
            </m.div>

            {/* Téléphone et tablette : carrousel aimanté */}
            <div className={MOBILE_ROW_CLASSES}>
              {looks.map((look) => (
                <article key={look.id} className={MOBILE_ITEM_CLASSES}>
                  <Link to={`/explorer?look=${encodeURIComponent(look.id)}`} className={LOOK_LINK_CLASSES}>
                    <div className="overflow-hidden rounded-[var(--radius-md)] bg-ink">
                      <SmartImage
                        src={look.image}
                        fallback={look.fallback}
                        alt=""
                        tone="mood"
                        ratio="4/5"
                        sizes="(min-width: 768px) 312px, 78vw"
                      />
                    </div>

                    <div className="mt-3">
                      <h3 className="text-h3 text-ink">{look.title}</h3>
                      <p className="mt-1 text-caption text-text-2">{look.subtitle}</p>
                      <span className="mt-2 inline-flex items-center gap-2 text-small font-semibold text-ink">
                        <span>Voir le look</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}
      </Container>
    </Section>
  );
}
