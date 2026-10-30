/**
 * RÈGLE D'ARCHITECTURE MOTION (MODULE M0) :
 * L'application est enveloppée dans <LazyMotion features={loadFeatures} strict>.
 * Avec le mode `strict` activé :
 * - Utilisez TOUJOURS `m` (`import * as m from 'motion/react-m'`, ex. `<m.div />`).
 * - N'utilisez JAMAIS `motion.div` (cela alourdirait le bundle initial et lèverait une erreur).
 * - Les fonctionnalités `domMax` (layout, layoutId, drag) sont chargées à la demande via `features.ts`.
 */
import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

const loadFeatures = () => import('./features').then((res) => res.default);

interface MotionProviderProps {
  children: ReactNode;
}

export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
