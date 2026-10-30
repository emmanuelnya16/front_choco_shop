import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatPrice } from '@/lib/utils/price';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Container({ children, className, ...props }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-content px-page', className)} {...props}>
      {children}
    </div>
  );
}

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  tone?: 'white' | 'surface' | 'ink';
  ref?: Ref<HTMLElement>;
}

const SECTION_TONES: Record<NonNullable<SectionProps['tone']>, string> = {
  white: 'bg-white text-ink',
  surface: 'bg-surface text-ink',
  ink: 'bg-ink text-white',
};

export function Section({ children, tone = 'white', className, ref, ...props }: SectionProps) {
  return (
    <section ref={ref} className={cn('py-section', SECTION_TONES[tone], className)} {...props}>
      {children}
    </section>
  );
}

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'light' | 'dark';
}

export function Skeleton({ tone = 'light', className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-[var(--radius-md)]',
        tone === 'dark' ? 'bg-ink-2' : 'bg-silver/45',
        className,
      )}
      {...props}
    />
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export interface PriceProps extends HTMLAttributes<HTMLSpanElement> {
  amount: number;
}

export function Price({ amount, className, ...props }: PriceProps) {
  return (
    <span className={cn('text-price tabular-nums', className)} {...props}>
      {formatPrice(amount)}
    </span>
  );
}
