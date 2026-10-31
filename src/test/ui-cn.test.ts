import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils/cn';

describe('cn() : fusion des classes Tailwind', () => {
  it('garde la taille typographique du projet à côté d’une couleur de texte', () => {
    expect(cn('text-small', 'text-ink')).toBe('text-small text-ink');
    expect(cn('text-label text-white', 'text-text-2')).toBe('text-label text-text-2');
    expect(cn('text-price', 'text-red')).toBe('text-price text-red');
    expect(cn('text-h2 text-ink')).toBe('text-h2 text-ink');
  });

  it('une taille remplace la précédente, une couleur aussi', () => {
    expect(cn('text-small', 'text-h3')).toBe('text-h3');
    expect(cn('text-ink', 'text-white')).toBe('text-white');
    expect(cn('text-body', 'text-xs')).toBe('text-xs');
  });
});
