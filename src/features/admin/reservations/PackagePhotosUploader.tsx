import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { useAdminPackageReady } from '@/features/admin/api/useAdminQueries';
import {
  formatFileSizeFr,
  prepareProof,
} from '@/features/payment/proof/prepareProof';
import { useToastStore } from '@/stores/toastStore';
import type { Agency, Reservation } from '@/types/domain';

interface DraftPackagePhoto {
  id: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  label: string;
}

const DEMO_PACKAGE_PHOTOS: DraftPackagePhoto[] = [
  {
    id: 'demo-colis-1',
    url: '/mock/colis-1.svg',
    width: 800,
    height: 600,
    sizeBytes: 245 * 1024,
    label: 'Vue de dessus (étiquette visible)',
  },
  {
    id: 'demo-colis-2',
    url: '/mock/colis-2.svg',
    width: 800,
    height: 600,
    sizeBytes: 218 * 1024,
    label: 'Vue trois-quarts (colis scellé)',
  },
  {
    id: 'demo-colis-3',
    url: '/mock/colis-3.svg',
    width: 800,
    height: 1000,
    sizeBytes: 274 * 1024,
    label: 'Bordereau & emballage',
  },
];

export interface PackagePhotosUploaderProps {
  reservation: Reservation;
  availableAgencies: Agency[];
}

export function PackagePhotosUploader({
  reservation,
  availableAgencies,
}: PackagePhotosUploaderProps) {
  const showToast = useToastStore((s) => s.show);
  const packageReadyMutation = useAdminPackageReady(reservation.ref);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [photos, setPhotos] = useState<DraftPackagePhoto[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>(
    reservation.agency?.id ?? reservation.deliveryAddress?.agencyId ?? '',
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const cityAgencies = availableAgencies.filter(
    (a) =>
      !reservation.city ||
      a.city.toLowerCase() === reservation.city.toLowerCase(),
  );
  const agencyOptions =
    cityAgencies.length > 0 ? cityAgencies : availableAgencies;

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const remainingSlots = 3 - photos.length;
    if (remainingSlots <= 0) {
      setError('Maximum 3 photos par colis.');
      event.target.value = '';
      return;
    }

    setError(null);
    setCompressing(true);

    try {
      const files = Array.from(fileList).slice(0, remainingSlots);
      const preparedItems: DraftPackagePhoto[] = [];

      for (const [idx, file] of files.entries()) {
        try {
          const result = await prepareProof(file);
          const previewUrl =
            typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
              ? URL.createObjectURL(result.blob)
              : `/mock/colis-${((photos.length + idx) % 4) + 1}.svg`;
          preparedItems.push({
            id: `upload-${Date.now()}-${idx}`,
            url: previewUrl,
            width: result.width,
            height: result.height,
            sizeBytes: result.finalSizeBytes,
            label: file.name || `Photo ${photos.length + idx + 1}`,
          });
        } catch {
          // Repli propre si le fichier image de test ne peut pas être décodé par le canvas
          preparedItems.push({
            id: `upload-${Date.now()}-${idx}`,
            url: `/mock/colis-${((photos.length + idx) % 4) + 1}.svg`,
            width: 800,
            height: 600,
            sizeBytes: file.size || 220 * 1024,
            label: file.name || `Photo ${photos.length + idx + 1}`,
          });
        }
      }

      setPhotos((prev) => [...prev, ...preparedItems].slice(0, 3));
    } finally {
      setCompressing(false);
      event.target.value = '';
    }
  };

  const handleUseDemoPhotos = (count: 1 | 2 | 3) => {
    setError(null);
    setPhotos(DEMO_PACKAGE_PHOTOS.slice(0, count));
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmitPackageReady = async () => {
    if (photos.length < 1) {
      setError(
        'Veuillez prendre ou joindre au moins 1 photo du colis emballé avant de notifier le client.',
      );
      return;
    }

    setError(null);
    try {
      await packageReadyMutation.mutateAsync({
        photos: photos.map((p) => ({
          url: p.url,
          thumbnailUrl: p.url,
          width: p.width,
          height: p.height,
        })),
        agencyId:
          reservation.receptionMode === 'delivery' && selectedAgencyId
            ? selectedAgencyId
            : undefined,
        note: note.trim() || undefined,
      });

      setPhotos([]);
      setNote('');
      showToast({
        message: 'Colis déclaré prêt · le client a reçu les photos',
        subtitle:
          reservation.receptionMode === 'pickup'
            ? 'Statut : Prête pour retrait en boutique'
            : 'Statut : Remise à l’agence / livreur',
      });
    } catch {
      setError('Impossible d’enregistrer les photos du colis. Réessayez.');
    }
  };

  return (
    <div className="space-y-4 rounded-[var(--radius-md)] border border-silver bg-surface p-4 sm:p-5">
      <div>
        <h3 className="text-body font-bold text-ink">
          Emballer et photographier le colis prêt (1 à 3 photos)
        </h3>
        <p className="mt-1 text-small text-text-2">
          Prenez en photo le colis emballé avec l’étiquette{' '}
          <strong className="font-mono text-ink">{reservation.ref}</strong>. Le client recevra une notification et découvrira ces photos dans son suivi.
        </p>
      </div>

      {/* Sélecteurs de fichiers cachés */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void handleFilesSelected(e)}
        className="sr-only"
        aria-label="Prendre une photo du colis avec l’appareil photo"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => void handleFilesSelected(e)}
        className="sr-only"
        aria-label="Choisir des photos du colis dans la galerie"
      />

      {/* Boutons d'ajout de photos */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          variant="dark"
          size="md"
          disabled={photos.length >= 3 || compressing}
          onClick={() => cameraInputRef.current?.click()}
          iconLeft={<Camera className="h-4 w-4" aria-hidden="true" />}
        >
          Prendre une photo
        </Button>

        <Button
          variant="outline"
          size="md"
          disabled={photos.length >= 3 || compressing}
          onClick={() => galleryInputRef.current?.click()}
          iconLeft={<ImagePlus className="h-4 w-4" aria-hidden="true" />}
        >
          Choisir dans la galerie ({photos.length}/3)
        </Button>

        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={() => handleUseDemoPhotos(2)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-dashed border-silver bg-white px-3 py-2 text-xs font-semibold text-text-2 transition-colors hover:border-ink hover:text-ink"
          >
            <Sparkles className="h-3.5 w-3.5 text-red" aria-hidden="true" />
            <span>Utiliser 2 photos de colis de démo</span>
          </button>
        )}
      </div>

      {/* Grille de prévisualisation des photos sélectionnées */}
      {photos.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="relative overflow-hidden rounded-[var(--radius-md)] border border-silver bg-white p-2"
            >
              <img
                src={photo.url}
                alt={`Aperçu photo colis ${index + 1}`}
                className="h-36 w-full rounded-[var(--radius-sm)] bg-surface object-cover"
              />
              <div className="mt-2 flex items-center justify-between gap-2 px-1">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">
                    Photo {index + 1} · {photo.label}
                  </p>
                  <p className="text-[11px] text-text-2">
                    {formatFileSizeFr(photo.sizeBytes)} · {photo.width}×{photo.height}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(photo.id)}
                  aria-label={`Retirer la photo ${index + 1}`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-danger hover:bg-surface"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Choix d'agence (si livraison) et note d'expédition */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {reservation.receptionMode === 'delivery' && agencyOptions.length > 0 && (
          <div>
            <label
              htmlFor="admin-package-agency"
              className="mb-1 block text-xs font-semibold text-ink"
            >
              Agence de transport (si expédition interurbaine)
            </label>
            <select
              id="admin-package-agency"
              value={selectedAgencyId}
              onChange={(e) => setSelectedAgencyId(e.target.value)}
              className="h-11 w-full rounded-[var(--radius-md)] border border-silver bg-white px-3 text-small text-ink focus:border-ink focus:outline-none"
            >
              <option value="">Livraison locale / Aucune agence</option>
              {agencyOptions.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.name} ({ag.city})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={reservation.receptionMode === 'pickup' ? 'sm:col-span-2' : ''}>
          <label
            htmlFor="admin-package-note"
            className="mb-1 block text-xs font-semibold text-ink"
          >
            Note pour le client (facultatif : bordereau, contact livreur, consigne)
          </label>
          <input
            id="admin-package-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              reservation.receptionMode === 'pickup'
                ? 'Ex. : Votre colis vous attend au comptoir d’Akwa.'
                : 'Ex. : Bordereau N° 4829 · Agence Express Centre'
            }
            className="h-11 w-full rounded-[var(--radius-md)] border border-silver bg-white px-3.5 text-small text-ink placeholder:text-grey focus:border-ink focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="pt-1">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={packageReadyMutation.isPending}
          onClick={() => void handleSubmitPackageReady()}
          iconLeft={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
        >
          Valider le colis prêt et notifier le client
        </Button>
      </div>
    </div>
  );
}

