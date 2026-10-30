import * as m from 'motion/react-m';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { Container, Section, Skeleton } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { useLooks } from '@/features/catalog/api/useCatalogQueries';
import { fadeUp, staggerContainer } from '@/motion/presets';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

export function LooksSection() {
  const { data: looks = [], isLoading } = useLooks();
  const reducedMotion = useReducedMotionPref();

  return (
    <Section className="pt-0">
      <Container>
        <div className="mx-auto max-w-xl text-center">
          <span className="text-label text-red">Inspirations</span>
          <h2 className="mt-2 text-h2 text-ink">
            PORTÉS PAR
            <br />
            L&apos;INCOMPRIS
          </h2>
        </div>

        {isLoading ? (
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="space-y-3">
                <Skeleton className="aspect-[4/5] w-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Desktop 4-column grid */}
            <m.div
              variants={staggerContainer(0.06)}
              initial={reducedMotion ? 'visible' : 'hidden'}
              whileInView="visible"
              viewport={{ once: true, amount: 0.25 }}
              className="mt-10 hidden grid-cols-4 gap-5 lg:grid"
            >
              {looks.map((look) => (
                <m.article key={look.id} variants={fadeUp} className="group">
                  <Link
                    to={`/explorer?look=${encodeURIComponent(look.id)}`}
                    className="block focus:outline-none"
                  >
                    <div className="overflow-hidden rounded-[var(--radius-md)] bg-ink">
                      <SmartImage
                        src={look.image}
                        fallback={look.fallback}
                        alt=""
                        tone="mood"
                        colorRevealOnGroupHover
                        ratio="4/5"
                        sizes="(min-width: 1024px) 290px, 78vw"
                        imgClassName="transition-transform duration-600 ease-out group-hover:scale-[1.04]"
                      />
                    </div>

                    <div className="mt-3.5">
                      <h3 className="text-h3 text-ink transition-colors group-hover:text-red">
                        {look.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-text-2">{look.subtitle}</p>
                      <span className="mt-2 inline-flex items-center gap-1.5 text-small font-semibold text-ink transition-colors group-hover:text-red">
                        <span>Voir le look</span>
                        <ArrowRight
                          className="h-4 w-4 transition-transform group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </Link>
                </m.article>
              ))}
            </m.div>

            {/* Mobile 78% width horizontal snap carousel */}
            <div className="no-scrollbar -mx-page mt-8 flex snap-x snap-mandatory scroll-px-page gap-4 overflow-x-auto px-page lg:hidden">
              {looks.map((look) => (
                <article
                  key={look.id}
                  className="w-[78vw] max-w-[310px] shrink-0 snap-start"
                >
                  <Link
                    to={`/explorer?look=${encodeURIComponent(look.id)}`}
                    className="block"
                  >
                    <div className="overflow-hidden rounded-[var(--radius-md)] bg-ink">
                      <SmartImage
                        src={look.image}
                        fallback={look.fallback}
                        alt=""
                        tone="mood"
                        ratio="4/5"
                        sizes="78vw"
                      />
                    </div>

                    <div className="mt-3">
                      <h3 className="text-h3 text-ink">{look.title}</h3>
                      <p className="mt-0.5 text-xs text-text-2">{look.subtitle}</p>
                      <span className="mt-2 inline-flex items-center gap-1.5 text-small font-semibold text-ink">
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
