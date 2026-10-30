import { Check, ChevronDown, MapPin, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/utils/cn';
import { formatPrice } from '@/lib/utils/price';
import type { DeliveryCity } from '@/types/domain';

function normalizeCitySearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export interface CityPickerFieldProps {
  cities: DeliveryCity[];
  value: string;
  onChange: (cityName: string) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Sélecteur de ville de livraison (§6.4.2) :
 * - Mobile : ouvre une feuille (`Sheet`) avec recherche insensible aux accents.
 * - Ordinateur : ouvre une liste déroulante avec recherche.
 * - Villes triées : ville locale (Douala) en premier, puis ordre alphabétique,
 *   chacune avec ses frais et son délai (« Yaoundé · 2 500 FCFA · 1 à 2 jours »).
 */
export function CityPickerField({
  cities,
  value,
  onChange,
  error,
  disabled,
}: CityPickerFieldProps) {
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [isDesktopDropdownOpen, setIsDesktopDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  const sortedCities = useMemo(() => {
    return [...cities].sort((a, b) => {
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      return a.name.localeCompare(b.name, 'fr');
    });
  }, [cities]);

  const filteredCities = useMemo(() => {
    const q = normalizeCitySearch(searchQuery);
    if (!q) return sortedCities;
    return sortedCities.filter((c) => normalizeCitySearch(c.name).includes(q));
  }, [sortedCities, searchQuery]);

  const selectedCity = useMemo(
    () =>
      cities.find(
        (c) =>
          c.name.toLowerCase() === value.toLowerCase() ||
          c.id.toLowerCase() === value.toLowerCase(),
      ),
    [cities, value],
  );

  // Fermeture au clic extérieur pour la liste déroulante ordinateur
  useEffect(() => {
    if (!isDesktopDropdownOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDesktopDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDesktopDropdownOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDesktopDropdownOpen]);

  const handleTriggerClick = () => {
    if (disabled) return;
    setSearchQuery('');
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsDesktopDropdownOpen((prev) => !prev);
    } else {
      setIsMobileSheetOpen(true);
    }
  };

  const handleSelectCity = (city: DeliveryCity) => {
    onChange(city.name);
    setIsMobileSheetOpen(false);
    setIsDesktopDropdownOpen(false);
  };

  const renderCityList = () => (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-text-2"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher une ville (Douala, Yaoundé, Bafoussam…)"
          aria-label="Rechercher une ville"
          className="h-11 w-full rounded-[var(--radius-md)] border border-silver bg-surface pr-3.5 pl-10 text-[16px] text-ink placeholder:text-text-2 focus:border-ink focus:bg-white focus:outline-none"
        />
      </div>

      <ul
        role="listbox"
        aria-label="Villes de livraison au Cameroun"
        className="max-h-[300px] divide-y divide-silver/50 overflow-y-auto rounded-[var(--radius-md)] border border-silver/70 bg-white"
      >
        {filteredCities.length === 0 ? (
          <li className="px-4 py-6 text-center text-small text-text-2">
            Aucune ville ne correspond à « {searchQuery} ».
          </li>
        ) : (
          filteredCities.map((city) => {
            const isSelected = selectedCity?.id === city.id;
            return (
              <li key={city.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => handleSelectCity(city)}
                  className={cn(
                    'flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors',
                    isSelected
                      ? 'bg-surface font-bold text-ink'
                      : 'text-ink hover:bg-surface/70',
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-body font-bold text-ink">
                        {city.name}
                      </span>
                      {city.isLocal && (
                        <span className="rounded-[var(--radius-sm)] bg-ink px-2 py-0.5 text-[11px] font-bold text-white">
                          Domicile
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-text-2">
                      {formatPrice(city.fee)} · {city.estimatedDelay}
                    </p>
                  </div>

                  {isSelected && (
                    <Check
                      className="h-4 w-4 shrink-0 text-red"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={handleTriggerClick}
        aria-haspopup="listbox"
        aria-expanded={isMobileSheetOpen || isDesktopDropdownOpen}
        aria-invalid={Boolean(error)}
        className={cn(
          'flex min-h-[48px] w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border bg-white px-3.5 py-2.5 text-left transition-colors focus:border-ink focus:outline-none',
          error ? 'border-danger' : 'border-silver hover:border-ink',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <MapPin
            className="h-4 w-4 shrink-0 text-text-2"
            aria-hidden="true"
          />
          {selectedCity ? (
            <div className="min-w-0 truncate">
              <span className="font-bold text-ink">{selectedCity.name}</span>
              <span className="ml-2 text-xs text-text-2">
                · {formatPrice(selectedCity.fee)} · {selectedCity.estimatedDelay}
              </span>
            </div>
          ) : (
            <span className="text-text-2">Choisir votre ville…</span>
          )}
        </div>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-text-2"
          aria-hidden="true"
        />
      </button>

      {/* Liste déroulante sur ordinateur */}
      {isDesktopDropdownOpen && (
        <div className="absolute right-0 left-0 z-30 mt-2 hidden rounded-[var(--radius-md)] border border-silver bg-white p-3 shadow-[var(--shadow-pop)] lg:block">
          {renderCityList()}
        </div>
      )}

      {/* Feuille modale sur mobile */}
      <Sheet
        open={isMobileSheetOpen}
        onClose={() => setIsMobileSheetOpen(false)}
        title="Choisir votre ville"
      >
        {renderCityList()}
      </Sheet>
    </div>
  );
}
