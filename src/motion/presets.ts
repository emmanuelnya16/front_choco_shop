import { stagger, type Variants } from 'motion/react';
import { duration, ease, pressScale, spring, staggerStep } from './tokens';

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.reveal, ease: ease.out },
  },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.fast, ease: ease.soft },
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.fast, ease: ease.soft },
  },
};

export function staggerContainer(step: number = staggerStep): Variants {
  return {
    hidden: {},
    visible: {
      transition: {
        delayChildren: stagger(step),
      },
    },
  };
}

export const lineReveal: Variants = {
  hidden: { y: '120%' },
  visible: {
    y: '0%',
    transition: { duration: duration.story, ease: ease.out },
  },
};

export const pageSlide: Variants = {
  initial: { x: '100%', opacity: 1 },
  animate: {
    x: 0,
    opacity: 1,
    transition: spring.sheet,
  },
  exit: {
    x: '-20%',
    opacity: 0,
    transition: spring.sheet,
  },
};

export const pageFade: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: duration.fast, ease: ease.soft },
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.fast, ease: ease.soft },
  },
};

export const sheetUp: Variants = {
  hidden: { y: '100%' },
  visible: {
    y: 0,
    transition: spring.sheet,
  },
  exit: {
    y: '100%',
    transition: spring.sheet,
  },
};

export const pressable = {
  whileTap: { scale: pressScale },
  transition: { duration: duration.tap },
} as const;
