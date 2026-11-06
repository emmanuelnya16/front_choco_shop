import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  Save,
  Smartphone,
  Store,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { Price } from '@/components/ui/Primitives';
import { buildUssdCode } from '@/features/payment/utils/ussd';
import { isValidCmPhone, normalizeCmPhone } from '@/lib/utils/phone';
import { useToastStore } from '@/stores/toastStore';
import {
  useAdminCreateAgency,
  useAdminCreateCity,
  useAdminDeleteAgency,
  useAdminDeleteCity,
  useAdminDeliveryAgencies,
  useAdminDeliveryCities,
  useAdminSettings,
  useAdminUpdateAgency,
  useAdminUpdateCity,
  useAdminUpdateSettings,
} from '@/features/admin/api/useAdminQueries';
import type {
  Agency,
  DeliveryCity,
  PaymentOperatorConfig,
  PublicSettings,
} from '@/types/domain';

const PREVIEW_BASKET_AMOUNT = 45000;

interface PaymentSettingsPanelProps {
  settings: PublicSettings;
}

function PaymentSettingsPanel({ settings }: PaymentSettingsPanelProps) {
  const updateSettingsMutation = useAdminUpdateSettings();
  const notifyToast = useToastStore((s) => s.show);

  const [operators, setOperators] = useState<PaymentOperatorConfig[]>(() =>
    settings.payment.operators.map((op) => ({
      ...op,
      steps: [...op.steps],
    })),
  );
  const [validationDelayText, setValidationDelayText] = useState(
    settings.payment.validationDelayText,
  );
  const [proofMaxSizeMb, setProofMaxSizeMb] = useState(
    String(settings.payment.proofMaxSizeMb ?? 10),
  );
  const [reservationHoldHours, setReservationHoldHours] = useState(
    String(settings.reservationHoldHours ?? 24),
  );
  const [deliveryFeePayment, setDeliveryFeePayment] = useState<'upfront' | 'on_delivery'>(
    settings.deliveryFeePayment ?? 'upfront',
  );
  const [newStepInputs, setNewStepInputs] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const updateOperatorField = <K extends keyof PaymentOperatorConfig>(
    id: 'orange' | 'mtn',
    field: K,
    value: PaymentOperatorConfig[K],
  ) => {
    setOperators((prev) =>
      prev.map((op) => (op.id === id ? { ...op, [field]: value } : op)),
    );
  };

  const handleToggleOperator = (id: 'orange' | 'mtn') => {
    const target = operators.find((op) => op.id === id);
    if (!target) return;
    if (target.enabled) {
      const enabledCount = operators.filter((op) => op.enabled).length;
      if (enabledCount <= 1) {
        notifyToast({
          message: 'Au moins un opérateur Mobile Money doit rester actif.',
        });
        return;
      }
    }
    updateOperatorField(id, 'enabled', !target.enabled);
  };

  const handleUpdateStep = (
    opId: 'orange' | 'mtn',
    stepIndex: number,
    value: string,
  ) => {
    setOperators((prev) =>
      prev.map((op) => {
        if (op.id !== opId) return op;
        const nextSteps = [...op.steps];
        nextSteps[stepIndex] = value;
        return { ...op, steps: nextSteps };
      }),
    );
  };

  const handleMoveStep = (
    opId: 'orange' | 'mtn',
    stepIndex: number,
    direction: -1 | 1,
  ) => {
    setOperators((prev) =>
      prev.map((op) => {
        if (op.id !== opId) return op;
        const targetIndex = stepIndex + direction;
        if (targetIndex < 0 || targetIndex >= op.steps.length) return op;
        const nextSteps = [...op.steps];
        const current = nextSteps[stepIndex];
        const target = nextSteps[targetIndex];
        if (current === undefined || target === undefined) return op;
        nextSteps[stepIndex] = target;
        nextSteps[targetIndex] = current;
        return { ...op, steps: nextSteps };
      }),
    );
  };

  const handleRemoveStep = (opId: 'orange' | 'mtn', stepIndex: number) => {
    setOperators((prev) =>
      prev.map((op) => {
        if (op.id !== opId) return op;
        return {
          ...op,
          steps: op.steps.filter((_, idx) => idx !== stepIndex),
        };
      }),
    );
  };

  const handleAddStep = (opId: 'orange' | 'mtn') => {
    const text = (newStepInputs[opId] ?? '').trim();
    if (!text) return;
    setOperators((prev) =>
      prev.map((op) =>
        op.id === opId ? { ...op, steps: [...op.steps, text] } : op,
      ),
    );
    setNewStepInputs((prev) => ({ ...prev, [opId]: '' }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);

    const enabledOperators = operators.filter((op) => op.enabled);
    if (enabledOperators.length === 0) {
      setErrorMsg('Activez au moins un opérateur Mobile Money.');
      return;
    }

    for (const op of operators) {
      if (!op.merchantName.trim() || !op.merchantCode.trim()) {
        setErrorMsg(
          `Veuillez renseigner le nom et le code marchand pour ${op.label}.`,
        );
        return;
      }
      const tpl = (op.ussdTemplate ?? '').trim();
      if (tpl && (!tpl.includes('{code}') || !tpl.includes('{amount}'))) {
        setErrorMsg(
          `La formule USSD de ${op.label} doit contenir les balises {code} et {amount}.`,
        );
        return;
      }
    }

    updateSettingsMutation.mutate(
      {
        payment: {
          operators,
          exactAmountRequired: true,
          validationDelayText:
            validationDelayText.trim() ||
            'en général en moins d’une heure, de 8\u00A0h à 20\u00A0h',
          proofMaxSizeMb: Math.max(1, Math.min(25, Number(proofMaxSizeMb) || 10)),
        },
        reservationHoldHours: Math.max(
          1,
          Math.min(72, Math.round(Number(reservationHoldHours) || 24)),
        ),
        deliveryFeePayment,
      },
      {
        onSuccess: () => {
          notifyToast({
            message: 'Paramètres Mobile Money enregistrés',
          });
        },
        onError: (err) => {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : 'Impossible d’enregistrer les paramètres de paiement.',
          );
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-sm border border-error/40 bg-error/5 p-3.5 text-error"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="font-body text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Cartes par opérateur : Orange Money & MTN MoMo */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {operators.map((op) => {
          const liveUssdPreview = buildUssdCode(
            op.ussdTemplate,
            op.merchantCode,
            PREVIEW_BASKET_AMOUNT,
          );
          const tplHasMissingPlaceholders =
            Boolean(op.ussdTemplate?.trim()) &&
            (!op.ussdTemplate?.includes('{code}') ||
              !op.ussdTemplate?.includes('{amount}'));

          return (
            <section
              key={op.id}
              className="rounded-sm border border-silver/50 bg-white p-4 sm:p-5"
            >
              <div className="mb-4 flex items-center justify-between border-b border-silver/30 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-ink font-display text-xs font-bold uppercase text-white">
                    {op.id === 'orange' ? 'OM' : 'MTN'}
                  </span>
                  <div>
                    <h2 className="font-display text-base font-bold uppercase text-ink">
                      {op.label}
                    </h2>
                    <p className="font-body text-[11px] text-charcoal">
                      {op.enabled ? 'Actif sur l’écran de paiement' : 'Désactivé'}
                    </p>
                  </div>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-2 font-body text-xs font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={op.enabled}
                    onChange={() => handleToggleOperator(op.id)}
                    aria-label={`Activer ${op.label}`}
                    className="h-4 w-4 accent-ink"
                  />
                  Actif
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor={`merchant-name-${op.id}`}
                    className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
                  >
                    Nom officiel du compte marchand ({op.label})
                  </label>
                  <input
                    id={`merchant-name-${op.id}`}
                    type="text"
                    value={op.merchantName}
                    onChange={(e) =>
                      updateOperatorField(op.id, 'merchantName', e.target.value)
                    }
                    className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm font-semibold text-ink"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`merchant-code-${op.id}`}
                      className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
                    >
                      Code marchand ({op.label})
                    </label>
                    <input
                      id={`merchant-code-${op.id}`}
                      type="text"
                      value={op.merchantCode}
                      onChange={(e) =>
                        updateOperatorField(op.id, 'merchantCode', e.target.value)
                      }
                      className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-mono text-sm font-bold text-ink"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`ussd-template-${op.id}`}
                      className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
                    >
                      Formule USSD ({op.label})
                    </label>
                    <input
                      id={`ussd-template-${op.id}`}
                      type="text"
                      value={op.ussdTemplate ?? ''}
                      onChange={(e) =>
                        updateOperatorField(
                          op.id,
                          'ussdTemplate',
                          e.target.value || null,
                        )
                      }
                      placeholder="#150*47*{code}*{amount}#"
                      className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-mono text-xs text-ink"
                    />
                  </div>
                </div>

                {/* Aperçu interactif en direct du code USSD */}
                <div className="rounded-sm border border-silver/40 bg-surface p-3">
                  <p className="font-body text-[11px] font-bold uppercase tracking-wider text-charcoal">
                    Aperçu en direct (panier de 45{'\u00A0'}000{'\u00A0'}FCFA) :
                  </p>
                  {tplHasMissingPlaceholders ? (
                    <p className="mt-1 font-body text-xs font-semibold text-error">
                      Attention : incluez {'{code}'} et {'{amount}'} dans la formule.
                    </p>
                  ) : liveUssdPreview ? (
                    <p
                      data-testid={`ussd-preview-${op.id}`}
                      className="mt-1 font-mono text-sm font-bold text-ink"
                    >
                      {liveUssdPreview}
                    </p>
                  ) : (
                    <p className="mt-1 font-body text-xs text-charcoal">
                      Aucun code USSD (paiement via l’application ou QR uniquement).
                    </p>
                  )}
                </div>

                {/* QR Code marchand */}
                <div>
                  <label
                    htmlFor={`qr-url-${op.id}`}
                    className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
                  >
                    Image du QR officiel ({op.label})
                  </label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-silver/50 bg-surface">
                      {op.qrImageUrl ? (
                        <img
                          src={op.qrImageUrl}
                          alt={`QR ${op.label}`}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <QrCode className="h-6 w-6 text-charcoal" />
                      )}
                    </div>
                    <input
                      id={`qr-url-${op.id}`}
                      type="text"
                      value={op.qrImageUrl ?? ''}
                      onChange={(e) =>
                        updateOperatorField(
                          op.id,
                          'qrImageUrl',
                          e.target.value || null,
                        )
                      }
                      placeholder="/mock/qr-orange.svg"
                      className="min-h-10 flex-1 rounded-sm border border-silver/60 bg-surface px-3 font-mono text-xs text-ink"
                    />
                  </div>
                </div>

                {/* Instructions étape par étape */}
                <div>
                  <p className="font-body text-xs font-bold uppercase tracking-wider text-charcoal">
                    Instructions pas à pas ({op.steps.length})
                  </p>
                  <div className="mt-2 space-y-2">
                    {op.steps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="w-5 shrink-0 font-mono text-xs font-bold text-charcoal">
                          {idx + 1}.
                        </span>
                        <input
                          type="text"
                          value={step}
                          aria-label={`Étape ${idx + 1} ${op.label}`}
                          onChange={(e) =>
                            handleUpdateStep(op.id, idx, e.target.value)
                          }
                          className="min-h-9 flex-1 rounded-sm border border-silver/60 bg-surface px-2.5 font-body text-xs text-ink"
                        />
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveStep(op.id, idx, -1)}
                          aria-label={`Monter l’étape ${idx + 1} ${op.label}`}
                          className="rounded-sm border border-silver/40 p-1 text-charcoal hover:text-ink disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === op.steps.length - 1}
                          onClick={() => handleMoveStep(op.id, idx, 1)}
                          aria-label={`Descendre l’étape ${idx + 1} ${op.label}`}
                          className="rounded-sm border border-silver/40 p-1 text-charcoal hover:text-ink disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(op.id, idx)}
                          aria-label={`Supprimer l’étape ${idx + 1} ${op.label}`}
                          className="rounded-sm p-1 text-charcoal hover:text-error"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={newStepInputs[op.id] ?? ''}
                      onChange={(e) =>
                        setNewStepInputs((prev) => ({
                          ...prev,
                          [op.id]: e.target.value,
                        }))
                      }
                      placeholder="Ajouter une étape d’instruction..."
                      className="min-h-9 flex-1 rounded-sm border border-silver/60 bg-surface px-2.5 font-body text-xs text-ink"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddStep(op.id)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-sm border border-ink bg-white px-2.5 font-body text-xs font-semibold text-ink hover:bg-surface"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Étape
                    </button>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Règles de réservation et de validation */}
      <section className="rounded-sm border border-silver/50 bg-white p-4 sm:p-5">
        <h2 className="mb-4 border-b border-silver/30 pb-3 font-display text-base font-bold uppercase tracking-wide text-ink">
          Règles de réservation et de validation
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="validation-delay-input"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Texte du délai de validation affiché au client (SP-017)
            </label>
            <input
              id="validation-delay-input"
              type="text"
              value={validationDelayText}
              onChange={(e) => setValidationDelayText(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink"
            />
          </div>

          <div>
            <label
              htmlFor="hold-hours-input"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Durée de mise de côté du stock (heures)
            </label>
            <input
              id="hold-hours-input"
              type="number"
              min={1}
              max={72}
              value={reservationHoldHours}
              onChange={(e) => setReservationHoldHours(e.target.value)}
              className="mt-1 min-h-11 w-40 rounded-sm border border-silver/60 bg-surface px-3 font-mono text-sm font-bold text-ink"
            />
          </div>

          <div>
            <label
              htmlFor="proof-max-mb-input"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Poids maximal d’une capture (Mo)
            </label>
            <input
              id="proof-max-mb-input"
              type="number"
              min={1}
              max={25}
              value={proofMaxSizeMb}
              onChange={(e) => setProofMaxSizeMb(e.target.value)}
              className="mt-1 min-h-11 w-40 rounded-sm border border-silver/60 bg-surface px-3 font-mono text-sm font-bold text-ink"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="delivery-fee-payment-select"
              className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
            >
              Règlement des frais de livraison (SP-019)
            </label>
            <select
              id="delivery-fee-payment-select"
              value={deliveryFeePayment}
              onChange={(e) =>
                setDeliveryFeePayment(
                  e.target.value as 'upfront' | 'on_delivery',
                )
              }
              className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink"
            >
              <option value="upfront">
                Payés d’avance avec la réservation Mobile Money
              </option>
              <option value="on_delivery">
                Payés à la réception du colis
              </option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex justify-end border-t border-silver/30 pt-4">
          <button
            type="submit"
            disabled={updateSettingsMutation.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-ink px-5 py-2.5 font-body text-xs font-bold uppercase tracking-wider text-white hover:bg-charcoal disabled:opacity-50"
          >
            {updateSettingsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Enregistrer les paramètres de paiement
          </button>
        </div>
      </section>
    </form>
  );
}

interface BoutiqueSettingsPanelProps {
  settings: PublicSettings;
}

function BoutiqueSettingsPanel({ settings }: BoutiqueSettingsPanelProps) {
  const updateSettingsMutation = useAdminUpdateSettings();
  const notifyToast = useToastStore((s) => s.show);

  const [shopName, setShopName] = useState(settings.shop.name);
  const [city, setCity] = useState(settings.shop.city || 'Douala');
  const [quarter, setQuarter] = useState(
    settings.pickupAddress.quarter || 'Akwa, Boulevard de la Liberté',
  );
  const [landmark, setLandmark] = useState(
    settings.pickupAddress.landmark ||
      'À 100 m de la Cathédrale, immeuble anthracite rez-de-chaussée',
  );
  const [address, setAddress] = useState(settings.shop.address);
  const [openingHours, setOpeningHours] = useState(settings.shop.openingHours);
  const [mapsUrl, setMapsUrl] = useState(settings.shop.mapsUrl);
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsappNumber);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);

    if (!shopName.trim()) {
      setErrorMsg('Le nom de la boutique est obligatoire.');
      return;
    }
    if (!isValidCmPhone(whatsappNumber)) {
      setErrorMsg(
        'Le numéro WhatsApp doit être un numéro camerounais valide (+237 6XX XX XX XX).',
      );
      return;
    }

    const normalizedWhatsapp = normalizeCmPhone(whatsappNumber);
    const fullAddress =
      address.trim() || `${quarter.trim()} — ${landmark.trim()}`;

    updateSettingsMutation.mutate(
      {
        whatsappNumber: normalizedWhatsapp,
        shop: {
          name: shopName.trim(),
          city: city.trim() || 'Douala',
          address: fullAddress,
          openingHours: openingHours.trim(),
          mapsUrl: mapsUrl.trim(),
        },
        pickupAddress: {
          name: shopName.trim(),
          city: city.trim() || 'Douala',
          quarter: quarter.trim(),
          landmark: landmark.trim(),
          openingHours: openingHours.trim(),
        },
      },
      {
        onSuccess: () => {
          notifyToast({
            message: 'Coordonnées de la boutique mises à jour',
          });
        },
        onError: (err) => {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : 'Impossible d’enregistrer les coordonnées de la boutique.',
          );
        },
      },
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-sm border border-silver/50 bg-white p-4 sm:p-5"
      noValidate
    >
      <div className="mb-4 flex items-center gap-2 border-b border-silver/30 pb-3">
        <Store className="h-4 w-4 text-red" aria-hidden="true" />
        <h2 className="font-display text-base font-bold uppercase tracking-wide text-ink">
          Boutique, Retrait sur place & WhatsApp officiel (SP-033, SP-034)
        </h2>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mb-4 rounded-sm border border-error/40 bg-error/5 p-3 font-body text-xs font-medium text-error"
        >
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="shop-name-input"
            className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
          >
            Nom de la boutique
          </label>
          <input
            id="shop-name-input"
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink"
          />
        </div>

        <div>
          <label
            htmlFor="shop-whatsapp-input"
            className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
          >
            Numéro WhatsApp officiel (+237)
          </label>
          <input
            id="shop-whatsapp-input"
            type="tel"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="+237 690 00 00 00"
            className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-mono text-sm font-bold text-ink"
          />
        </div>

        <div>
          <label
            htmlFor="shop-city-input"
            className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
          >
            Ville du Retrait en boutique
          </label>
          <input
            id="shop-city-input"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink"
          />
        </div>

        <div>
          <label
            htmlFor="shop-quarter-input"
            className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
          >
            Quartier & rue
          </label>
          <input
            id="shop-quarter-input"
            type="text"
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink"
          />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="shop-landmark-input"
            className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
          >
            Point de repère pour le client
          </label>
          <input
            id="shop-landmark-input"
            type="text"
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink"
          />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="shop-address-input"
            className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
          >
            Adresse complète affichée dans le pied de page
          </label>
          <input
            id="shop-address-input"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink"
          />
        </div>

        <div>
          <label
            htmlFor="shop-hours-input"
            className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
          >
            Horaires d’ouverture
          </label>
          <input
            id="shop-hours-input"
            type="text"
            value={openingHours}
            onChange={(e) => setOpeningHours(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-body text-sm text-ink"
          />
        </div>

        <div>
          <label
            htmlFor="shop-maps-input"
            className="block font-body text-xs font-bold uppercase tracking-wider text-charcoal"
          >
            Lien Google Maps
          </label>
          <input
            id="shop-maps-input"
            type="url"
            value={mapsUrl}
            onChange={(e) => setMapsUrl(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-sm border border-silver/60 bg-surface px-3 font-mono text-xs text-ink"
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end border-t border-silver/30 pt-4">
        <button
          type="submit"
          disabled={updateSettingsMutation.isPending}
          className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-ink px-5 py-2.5 font-body text-xs font-bold uppercase tracking-wider text-white hover:bg-charcoal disabled:opacity-50"
        >
          {updateSettingsMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Enregistrer les informations boutique
        </button>
      </div>
    </form>
  );
}

interface DeliverySettingsPanelProps {
  cities: DeliveryCity[];
  agencies: Agency[];
}

function DeliverySettingsPanel({
  cities,
  agencies,
}: DeliverySettingsPanelProps) {
  const notifyToast = useToastStore((s) => s.show);

  const createCityMutation = useAdminCreateCity();
  const updateCityMutation = useAdminUpdateCity();
  const deleteCityMutation = useAdminDeleteCity();

  const createAgencyMutation = useAdminCreateAgency();
  const updateAgencyMutation = useAdminUpdateAgency();
  const deleteAgencyMutation = useAdminDeleteAgency();

  // Formulaire Ville
  const [cityFormOpen, setCityFormOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<DeliveryCity | null>(null);
  const [cityName, setCityName] = useState('');
  const [cityFee, setCityFee] = useState('2500');
  const [cityIsLocal, setCityIsLocal] = useState(false);
  const [cityDelay, setCityDelay] = useState('1 à 2 jours');

  // Filtre & Formulaire Agence
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('');
  const [agencyFormOpen, setAgencyFormOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [agencyName, setAgencyName] = useState('');
  const [agencyCityId, setAgencyCityId] = useState<string>(
    cities.find((c) => !c.isLocal)?.id ?? cities[0]?.id ?? '',
  );
  const [agencyAddress, setAgencyAddress] = useState('');
  const [agencyPhone, setAgencyPhone] = useState('+237 690 00 00 00');
  const [agencyHours, setAgencyHours] = useState('Tous les jours · 7 h à 20 h');

  const filteredAgencies = useMemo(() => {
    if (!selectedCityFilter) return agencies;
    return agencies.filter((ag) => ag.cityId === selectedCityFilter);
  }, [agencies, selectedCityFilter]);

  const openNewCityForm = () => {
    setEditingCity(null);
    setCityName('');
    setCityFee('2500');
    setCityIsLocal(false);
    setCityDelay('1 à 2 jours');
    setCityFormOpen(true);
  };

  const openEditCityForm = (city: DeliveryCity) => {
    setEditingCity(city);
    setCityName(city.name);
    setCityFee(String(city.fee));
    setCityIsLocal(city.isLocal);
    setCityDelay(city.estimatedDelay);
    setCityFormOpen(true);
  };

  const handleSaveCity = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = cityName.trim();
    if (!cleanName) return;

    const payload = {
      name: cleanName,
      fee: Math.max(0, Math.round(Number(cityFee) || 0)),
      isLocal: cityIsLocal,
      hasAgencies: !cityIsLocal,
      estimatedDelay: cityDelay.trim() || '1 à 3 jours',
    };

    if (editingCity) {
      updateCityMutation.mutate(
        { id: editingCity.id, payload },
        {
          onSuccess: (res) => {
            notifyToast({ message: `Ville « ${res.city.name} » mise à jour` });
            setCityFormOpen(false);
          },
        },
      );
    } else {
      createCityMutation.mutate(payload, {
        onSuccess: (res) => {
          notifyToast({ message: `Ville « ${res.city.name} » ajoutée` });
          setCityFormOpen(false);
        },
      });
    }
  };

  const openNewAgencyForm = () => {
    setEditingAgency(null);
    setAgencyName('');
    setAgencyCityId(
      selectedCityFilter ||
        cities.find((c) => !c.isLocal)?.id ||
        cities[0]?.id ||
        '',
    );
    setAgencyAddress('');
    setAgencyPhone('+237 690 00 00 00');
    setAgencyHours('Tous les jours · 7 h à 20 h');
    setAgencyFormOpen(true);
  };

  const openEditAgencyForm = (agency: Agency) => {
    setEditingAgency(agency);
    setAgencyName(agency.name);
    setAgencyCityId(agency.cityId);
    setAgencyAddress(agency.address);
    setAgencyPhone(agency.phone);
    setAgencyHours(agency.openingHours);
    setAgencyFormOpen(true);
  };

  const handleSaveAgency = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = agencyName.trim();
    if (!cleanName || !agencyCityId) return;

    const payload = {
      name: cleanName,
      cityId: agencyCityId,
      address: agencyAddress.trim() || 'Adresse agence',
      phone: agencyPhone.trim() || '+237 690 00 00 00',
      openingHours: agencyHours.trim() || 'Tous les jours · 7 h à 20 h',
    };

    if (editingAgency) {
      updateAgencyMutation.mutate(
        { id: editingAgency.id, payload },
        {
          onSuccess: (res) => {
            notifyToast({
              message: `Agence « ${res.agency.name} » mise à jour`,
            });
            setAgencyFormOpen(false);
          },
        },
      );
    } else {
      createAgencyMutation.mutate(payload, {
        onSuccess: (res) => {
          notifyToast({ message: `Agence « ${res.agency.name} » ajoutée` });
          setAgencyFormOpen(false);
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1 — Villes desservies */}
      <section className="rounded-sm border border-silver/50 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-silver/30 pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-red" aria-hidden="true" />
            <div>
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-ink">
                1. Villes de livraison ({cities.length})
              </h2>
              <p className="font-body text-xs text-charcoal">
                Tarifs en FCFA et délais affichés dans le formulaire de réservation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openNewCityForm}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-sm bg-ink px-3.5 py-2 font-body text-xs font-bold uppercase tracking-wider text-white hover:bg-charcoal"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Ajouter une ville
          </button>
        </div>

        {/* Formulaire Ville */}
        {cityFormOpen && (
          <form
            onSubmit={handleSaveCity}
            className="mb-5 rounded-sm border border-ink bg-surface p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold uppercase text-ink">
                {editingCity
                  ? `Modifier la ville : ${editingCity.name}`
                  : 'Nouvelle ville desservie'}
              </h3>
              <button
                type="button"
                onClick={() => setCityFormOpen(false)}
                aria-label="Fermer le formulaire de ville"
                className="p-1 text-charcoal hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label
                  htmlFor="city-name-input"
                  className="block font-body text-xs font-bold text-charcoal"
                >
                  Nom de la ville *
                </label>
                <input
                  id="city-name-input"
                  type="text"
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  placeholder="Ex. : Bertoua"
                  className="mt-1 min-h-10 w-full rounded-sm border border-silver/60 bg-white px-3 font-body text-sm text-ink"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="city-fee-input"
                  className="block font-body text-xs font-bold text-charcoal"
                >
                  Tarif livraison (FCFA) *
                </label>
                <input
                  id="city-fee-input"
                  type="number"
                  min={0}
                  step={500}
                  value={cityFee}
                  onChange={(e) => setCityFee(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-sm border border-silver/60 bg-white px-3 font-mono text-sm font-bold text-ink"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="city-delay-input"
                  className="block font-body text-xs font-bold text-charcoal"
                >
                  Délai estimé
                </label>
                <input
                  id="city-delay-input"
                  type="text"
                  value={cityDelay}
                  onChange={(e) => setCityDelay(e.target.value)}
                  placeholder="1 à 2 jours"
                  className="mt-1 min-h-10 w-full rounded-sm border border-silver/60 bg-white px-3 font-body text-sm text-ink"
                />
              </div>

              <div className="flex flex-col justify-end">
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 font-body text-xs font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={cityIsLocal}
                    onChange={(e) => setCityIsLocal(e.target.checked)}
                    className="h-4 w-4 accent-ink"
                  />
                  Livraison locale à domicile
                </label>
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCityFormOpen(false)}
                className="rounded-sm border border-silver/60 bg-white px-3 py-1.5 font-body text-xs font-medium text-ink"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-sm bg-ink px-4 py-1.5 font-body text-xs font-bold uppercase text-white"
              >
                <Check className="h-3.5 w-3.5" />
                {editingCity ? 'Enregistrer la ville' : 'Créer la ville'}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-silver/40 bg-surface font-body text-[11px] font-bold uppercase tracking-wider text-charcoal">
                <th className="py-2.5 pr-3 pl-3">Ville</th>
                <th className="px-3 py-2.5">Mode d’acheminement</th>
                <th className="px-3 py-2.5">Tarif</th>
                <th className="px-3 py-2.5">Délai annoncé</th>
                <th className="px-3 py-2.5 text-center">Agences</th>
                <th className="py-2.5 pr-3 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver/30 font-body text-sm">
              {cities.map((city) => {
                const countAgencies = agencies.filter(
                  (a) => a.cityId === city.id,
                ).length;
                return (
                  <tr key={city.id} className="hover:bg-surface/60">
                    <td className="py-2.5 pr-3 pl-3 font-bold text-ink">
                      {city.name}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-charcoal">
                      {city.isLocal
                        ? 'Livraison locale à domicile'
                        : 'Expédition par agence'}
                    </td>
                    <td className="px-3 py-2.5">
                      <Price amount={city.fee} className="font-bold text-ink" />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-charcoal">
                      {city.estimatedDelay}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-xs">
                      {city.isLocal ? '—' : countAgencies}
                    </td>
                    <td className="py-2.5 pr-3 pl-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditCityForm(city)}
                          aria-label={`Modifier la ville ${city.name}`}
                          className="rounded-sm border border-silver/50 bg-white p-1.5 text-charcoal hover:border-ink hover:text-ink"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            deleteCityMutation.mutate(city.id, {
                              onSuccess: () =>
                                notifyToast({
                                  message: `Ville « ${city.name} » supprimée`,
                                }),
                            })
                          }
                          aria-label={`Supprimer la ville ${city.name}`}
                          className="rounded-sm border border-silver/50 bg-white p-1.5 text-charcoal hover:border-error hover:text-error"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 2 — Agences de transport */}
      <section className="rounded-sm border border-silver/50 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-silver/30 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-red" aria-hidden="true" />
            <div>
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-ink">
                2. Agences de transport interurbaines ({filteredAgencies.length})
              </h2>
              <p className="font-body text-xs text-charcoal">
                Affichées au client lors du choix de l’agence et du retrait du colis.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrer les agences par ville"
              value={selectedCityFilter}
              onChange={(e) => setSelectedCityFilter(e.target.value)}
              className="min-h-10 rounded-sm border border-silver/60 bg-surface px-3 font-body text-xs text-ink"
            >
              <option value="">Toutes les villes</option>
              {cities
                .filter((c) => !c.isLocal)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>

            <button
              type="button"
              onClick={openNewAgencyForm}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-sm bg-ink px-3.5 py-2 font-body text-xs font-bold uppercase tracking-wider text-white hover:bg-charcoal"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Ajouter une agence
            </button>
          </div>
        </div>

        {/* Formulaire Agence */}
        {agencyFormOpen && (
          <form
            onSubmit={handleSaveAgency}
            className="mb-5 rounded-sm border border-ink bg-surface p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold uppercase text-ink">
                {editingAgency
                  ? `Modifier l’agence : ${editingAgency.name}`
                  : 'Nouvelle agence de transport'}
              </h3>
              <button
                type="button"
                onClick={() => setAgencyFormOpen(false)}
                aria-label="Fermer le formulaire d’agence"
                className="p-1 text-charcoal hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label
                  htmlFor="agency-name-input"
                  className="block font-body text-xs font-bold text-charcoal"
                >
                  Nom de l’agence *
                </label>
                <input
                  id="agency-name-input"
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="Ex. : Finexs Voyages Terminus"
                  className="mt-1 min-h-10 w-full rounded-sm border border-silver/60 bg-white px-3 font-body text-sm text-ink"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="agency-city-select"
                  className="block font-body text-xs font-bold text-charcoal"
                >
                  Ville *
                </label>
                <select
                  id="agency-city-select"
                  value={agencyCityId}
                  onChange={(e) => setAgencyCityId(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-sm border border-silver/60 bg-white px-3 font-body text-sm text-ink"
                >
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="agency-phone-input"
                  className="block font-body text-xs font-bold text-charcoal"
                >
                  Téléphone agence
                </label>
                <input
                  id="agency-phone-input"
                  type="text"
                  value={agencyPhone}
                  onChange={(e) => setAgencyPhone(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-sm border border-silver/60 bg-white px-3 font-mono text-xs text-ink"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="agency-address-input"
                  className="block font-body text-xs font-bold text-charcoal"
                >
                  Adresse & repère
                </label>
                <input
                  id="agency-address-input"
                  type="text"
                  value={agencyAddress}
                  onChange={(e) => setAgencyAddress(e.target.value)}
                  placeholder="Quartier, rue et point de repère"
                  className="mt-1 min-h-10 w-full rounded-sm border border-silver/60 bg-white px-3 font-body text-sm text-ink"
                />
              </div>

              <div>
                <label
                  htmlFor="agency-hours-input"
                  className="block font-body text-xs font-bold text-charcoal"
                >
                  Horaires de retrait
                </label>
                <input
                  id="agency-hours-input"
                  type="text"
                  value={agencyHours}
                  onChange={(e) => setAgencyHours(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-sm border border-silver/60 bg-white px-3 font-body text-xs text-ink"
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAgencyFormOpen(false)}
                className="rounded-sm border border-silver/60 bg-white px-3 py-1.5 font-body text-xs font-medium text-ink"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-sm bg-ink px-4 py-1.5 font-body text-xs font-bold uppercase text-white"
              >
                <Check className="h-3.5 w-3.5" />
                {editingAgency ? 'Enregistrer l’agence' : 'Créer l’agence'}
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgencies.map((agency) => (
            <article
              key={agency.id}
              className="flex flex-col justify-between rounded-sm border border-silver/50 bg-surface p-3.5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-sm bg-ink px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                    {agency.city}
                  </span>
                  <span className="font-mono text-[11px] text-charcoal">
                    {agency.phone}
                  </span>
                </div>
                <h3 className="mt-2 font-body text-sm font-bold text-ink">
                  {agency.name}
                </h3>
                <p className="mt-1 font-body text-xs text-charcoal">
                  {agency.address}
                </p>
                <p className="mt-1 font-body text-[11px] text-charcoal">
                  {agency.openingHours}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-silver/30 pt-2.5">
                <button
                  type="button"
                  onClick={() => openEditAgencyForm(agency)}
                  aria-label={`Modifier l’agence ${agency.name}`}
                  className="inline-flex items-center gap-1 rounded-sm border border-silver/60 bg-white px-2.5 py-1 font-body text-xs font-medium text-ink hover:border-ink"
                >
                  <Pencil className="h-3 w-3" />
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() =>
                    deleteAgencyMutation.mutate(agency.id, {
                      onSuccess: () =>
                        notifyToast({
                          message: `Agence « ${agency.name} » supprimée`,
                        }),
                    })
                  }
                  aria-label={`Supprimer l’agence ${agency.name}`}
                  className="inline-flex items-center gap-1 rounded-sm border border-error/30 bg-white px-2.5 py-1 font-body text-xs font-medium text-error hover:bg-error/5"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function AdminSettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab: 'paiement' | 'livraison' | 'boutique' =
    location.pathname.includes('/livraison')
      ? 'livraison'
      : location.pathname.includes('/boutique')
        ? 'boutique'
        : 'paiement';

  const settingsQuery = useAdminSettings();
  const citiesQuery = useAdminDeliveryCities();
  const agenciesQuery = useAdminDeliveryAgencies();

  const settings = settingsQuery.data?.settings;
  const cities = citiesQuery.data?.cities ?? [];
  const agencies = agenciesQuery.data?.agencies ?? [];

  const handleSelectTab = (tab: 'paiement' | 'livraison' | 'boutique') => {
    navigate(`/admin/parametres/${tab}`);
  };

  return (
    <div className="space-y-6 pb-10">
      {/* En-tête + sous-navigation par onglets */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-ink">
            Paramètres de la boutique
          </h1>
          <p className="mt-0.5 font-body text-xs text-charcoal">
            Codes marchands Mobile Money, villes et agences de transport, adresse
            et WhatsApp officiel.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Sections des paramètres"
          className="inline-flex flex-wrap rounded-sm border border-silver/50 bg-white p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'paiement'}
            onClick={() => handleSelectTab('paiement')}
            className={`inline-flex min-h-10 items-center gap-2 rounded-sm px-3.5 py-1.5 font-body text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'paiement'
                ? 'bg-ink text-white'
                : 'text-charcoal hover:text-ink'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
            Paiement Mobile Money
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'livraison'}
            onClick={() => handleSelectTab('livraison')}
            className={`inline-flex min-h-10 items-center gap-2 rounded-sm px-3.5 py-1.5 font-body text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'livraison'
                ? 'bg-ink text-white'
                : 'text-charcoal hover:text-ink'
            }`}
          >
            <Truck className="h-3.5 w-3.5" aria-hidden="true" />
            Livraison & Agences
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'boutique'}
            onClick={() => handleSelectTab('boutique')}
            className={`inline-flex min-h-10 items-center gap-2 rounded-sm px-3.5 py-1.5 font-body text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'boutique'
                ? 'bg-ink text-white'
                : 'text-charcoal hover:text-ink'
            }`}
          >
            <Store className="h-3.5 w-3.5" aria-hidden="true" />
            Boutique & WhatsApp
          </button>
        </div>
      </div>

      {settingsQuery.isLoading ? (
        <div className="flex min-h-[35vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ink" />
        </div>
      ) : (
        <>
          {activeTab === 'paiement' && settings && (
            <PaymentSettingsPanel
              key={`payment-${settings.payment.operators.map((o) => o.merchantCode).join('-')}`}
              settings={settings}
            />
          )}

          {activeTab === 'livraison' && (
            <DeliverySettingsPanel cities={cities} agencies={agencies} />
          )}

          {activeTab === 'boutique' && settings && (
            <BoutiqueSettingsPanel
              key={`boutique-${settings.whatsappNumber}-${settings.shop.name}`}
              settings={settings}
            />
          )}
        </>
      )}
    </div>
  );
}

