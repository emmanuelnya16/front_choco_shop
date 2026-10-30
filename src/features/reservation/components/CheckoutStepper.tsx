import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface CheckoutStepperProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { step: 1, label: 'Réception' },
  { step: 2, label: 'Paiement' },
  { step: 3, label: 'Preuve' },
] as const;

/**
 * Indicateur d'étapes en haut du parcours de réservation (§6.1) :
 * `1 Réception` → `2 Paiement` → `3 Preuve`.
 * L'étape courante est en `ink`, les précédentes complétées et les suivantes en `silver`, reliées par une ligne.
 */
export function CheckoutStepper({ currentStep }: CheckoutStepperProps) {
  return (
    <nav
      aria-label="Étapes de votre réservation"
      className="border-b border-silver/70 bg-white py-3.5"
    >
      <ol className="mx-auto flex max-w-md items-center justify-between px-4">
        {STEPS.map((item, idx) => {
          const isCurrent = item.step === currentStep;
          const isCompleted = item.step < currentStep;

          return (
            <li
              key={item.step}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex flex-1 items-center last:flex-initial"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-extrabold transition-colors',
                    isCurrent
                      ? 'bg-ink text-white'
                      : isCompleted
                        ? 'bg-success text-white'
                        : 'border border-silver bg-white text-text-2',
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    item.step
                  )}
                </span>
                <span
                  className={cn(
                    'text-xs font-bold tracking-wide sm:text-small',
                    isCurrent
                      ? 'text-ink'
                      : isCompleted
                        ? 'text-ink'
                        : 'text-text-2',
                  )}
                >
                  {item.label}
                </span>
              </div>

              {idx < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'mx-2.5 h-[1.5px] flex-1 transition-colors sm:mx-4',
                    isCompleted ? 'bg-ink' : 'bg-silver',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
