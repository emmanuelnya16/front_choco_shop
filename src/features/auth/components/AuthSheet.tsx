import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { AlertCircle, Check, Loader2, RefreshCw } from 'lucide-react';
import {
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import {
  useRequestOtp,
  useUpdateProfile,
  useVerifyOtp,
} from '@/features/auth/api/useAuthQueries';
import { ApiError } from '@/lib/api/client';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { cn } from '@/lib/utils/cn';
import { haptic } from '@/lib/utils/haptics';
import { detectCmOperator, getOperatorLabel } from '@/lib/utils/operator';
import {
  cleanCmPhoneDigits,
  formatCmPhone,
  formatCmPhoneInput,
  isValidCmPhone,
  normalizeCmPhone,
} from '@/lib/utils/phone';
import { ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useUiStore } from '@/stores/uiStore';

type AuthStep = 'phone' | 'otp' | 'name';

function formatSecondsTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = String(safe % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

/**
 * Feuille globale de connexion OTP en 3 étapes (§5.1 à §5.4) :
 * - Étape 1 : Numéro camerounais (+237 6XX XX XX XX), détection d'opérateur Orange / MTN, validation à la sortie du champ.
 * - Étape 2 : Code à 6 chiffres (champ unique accessible + 6 cases visuelles), WebOTP Android, envoi auto au 6e chiffre,
 *   gestion 422 (essais restants + tremblement), 410 (expiré), 429 (blocage temporaire), cascade verte au succès.
 * - Étape 3 : Prénom & Nom pour les nouveaux clients (`isNewUser: true`) avec lien « Plus tard ».
 */
export function AuthSheet() {
  const isOpen = useUiStore((s) => s.isAuthSheetOpen);
  const closeAuthSheet = useUiStore((s) => s.closeAuthSheet);
  const consumeAuthAction = useUiStore((s) => s.consumeAuthAction);

  if (!isOpen) {
    return null;
  }

  return (
    <Sheet
      open={isOpen}
      onClose={() => closeAuthSheet(true)}
      title="Connexion par SMS"
    >
      <AuthSheetContent
        onCancel={() => closeAuthSheet(true)}
        onComplete={consumeAuthAction}
      />
    </Sheet>
  );
}

function AuthSheetContent({
  onCancel,
  onComplete,
}: {
  onCancel: () => void;
  onComplete: () => void;
}) {
  const reducedMotion = useReducedMotionPref();
  const isOnline = useOnlineStatus();
  const errorId = useId();

  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();
  const updateProfile = useUpdateProfile();

  const [step, setStep] = useState<AuthStep>('phone');
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);

  // Étape 1 : Téléphone
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [normalizedPhone, setNormalizedPhone] = useState('');

  // Étape 2 : Code OTP
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [lockedSeconds, setLockedSeconds] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(60);
  const [resentBannerVisible, setResentBannerVisible] = useState(false);
  const [shakeTick, setShakeTick] = useState(0);
  const [isSuccessCascade, setIsSuccessCascade] = useState(false);

  // Étape 3 : Prénom & Nom (nouveau client)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const otpInputRef = useRef<HTMLInputElement>(null);
  const verifyingCodeRef = useRef<string | null>(null);

  const detectedOperator = detectCmOperator(phoneInput);
  const operatorLabel = getOperatorLabel(detectedOperator);

  // Compte à rebours de renvoi (0:59 -> 0:00) et de blocage 429
  useEffect(() => {
    if (step !== 'otp') return;
    if (resendSeconds <= 0 && lockedSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setResendSeconds((prev) => Math.max(0, prev - 1));
      setLockedSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [step, resendSeconds, lockedSeconds]);

  // Focus sur le champ OTP à l'entrée de l'étape 2
  useEffect(() => {
    if (step === 'otp') {
      const id = window.setTimeout(() => {
        otpInputRef.current?.focus();
      }, 60);
      return () => window.clearTimeout(id);
    }
  }, [step]);

  const submitOtpCode = useCallback(
    async (codeToVerify: string, targetPhone: string) => {
      if (
        codeToVerify.length !== 6 ||
        verifyingCodeRef.current === codeToVerify ||
        lockedSeconds > 0
      ) {
        return;
      }
      verifyingCodeRef.current = codeToVerify;
      setOtpError(null);
      setIsExpired(false);

      try {
        const session = await verifyOtp.mutateAsync({
          phone: targetPhone,
          code: codeToVerify,
        });

        setIsSuccessCascade(true);
        haptic('success');

        const delayMs = reducedMotion ? 80 : 420;
        window.setTimeout(() => {
          if (session.isNewUser) {
            setStepDirection(1);
            setStep('name');
          } else {
            onComplete();
          }
        }, delayMs);
      } catch (err) {
        verifyingCodeRef.current = null;
        haptic('error');

        if (err instanceof ApiError) {
          if (err.status === 410 || err.code === 'OTP_EXPIRED') {
            setIsExpired(true);
            setOtpError('Ce code a expiré.');
            setOtpCode('');
            return;
          }

          if (err.status === 429) {
            const retryAfter =
              typeof err.details?.retryAfter === 'number'
                ? err.details.retryAfter
                : 600;
            setLockedSeconds(retryAfter);
            setOtpError(
              `Trop de tentatives. Réessayez dans ${Math.max(1, Math.ceil(retryAfter / 60))} min.`,
            );
            setOtpCode('');
            return;
          }

          const attemptsLeft =
            typeof err.details?.attemptsLeft === 'number'
              ? err.details.attemptsLeft
              : null;

          setShakeTick((t) => t + 1);
          setOtpError(
            attemptsLeft !== null
              ? `Code incorrect. Il vous reste ${attemptsLeft} essai${attemptsLeft > 1 ? 's' : ''}.`
              : err.message || 'Code incorrect.',
          );
          setOtpCode('');
          window.setTimeout(() => {
            otpInputRef.current?.focus();
          }, 30);
          return;
        }

        setShakeTick((t) => t + 1);
        setOtpError('Impossible de vérifier ce code. Réessayez.');
        setOtpCode('');
      }
    },
    [lockedSeconds, onComplete, reducedMotion, verifyOtp],
  );

  // Remplissage automatique Android via l'API WebOTP (§5.3)
  // HYPOTHÈSE: Le SMS envoyé par le back-end se termine par `@<domaine> #123456`.
  useEffect(() => {
    if (step !== 'otp' || typeof window === 'undefined') return;
    if (!('OTPCredential' in window) || !navigator.credentials?.get) return;

    const abortController = new AbortController();

    navigator.credentials
      .get({
        // @ts-expect-error — WebOTP API
        otp: { transport: ['sms'] },
        signal: abortController.signal,
      })
      .then((credential: unknown) => {
        const otp = credential as { code?: string } | null;
        if (otp?.code && /^\d{6}$/.test(otp.code)) {
          setOtpCode(otp.code);
          submitOtpCode(otp.code, normalizedPhone);
        }
      })
      .catch(() => {
        // Ignoré si annulé ou non supporté
      });

    return () => {
      abortController.abort();
    };
  }, [step, normalizedPhone, submitOtpCode]);

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCmPhoneInput(e.target.value);
    setPhoneInput(formatted);
    if (phoneError && isValidCmPhone(formatted)) {
      setPhoneError(null);
    }
  };

  const handlePhonePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData?.getData('text') ?? '';
    if (pasted) {
      e.preventDefault();
      const formatted = formatCmPhoneInput(pasted);
      setPhoneInput(formatted);
      if (isValidCmPhone(formatted)) {
        setPhoneError(null);
      }
    }
  };

  const handlePhoneBlur = () => {
    setPhoneTouched(true);
    const digits = cleanCmPhoneDigits(phoneInput);
    if (digits.length > 0 && !isValidCmPhone(phoneInput)) {
      setPhoneError('Ce numéro semble incomplet');
    }
  };

  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPhoneTouched(true);

    if (!isValidCmPhone(phoneInput)) {
      setPhoneError('Ce numéro semble incomplet');
      haptic('error');
      return;
    }

    if (!isOnline) {
      setPhoneError('Vous êtes hors connexion. Reconnectez-vous pour réserver.');
      return;
    }

    setPhoneError(null);
    const normalized = normalizeCmPhone(phoneInput);
    setNormalizedPhone(normalized);

    try {
      const res = await requestOtp.mutateAsync({ phone: normalized });
      setResendSeconds(res.resendIn ?? 60);
      setLockedSeconds(0);
      setIsExpired(false);
      setOtpError(null);
      setOtpCode('');
      verifyingCodeRef.current = null;
      setStepDirection(1);
      setStep('otp');
    } catch (err) {
      haptic('error');
      if (err instanceof ApiError && err.status === 429) {
        const retryAfter =
          typeof err.details?.retryAfter === 'number'
            ? err.details.retryAfter
            : 600;
        setLockedSeconds(retryAfter);
        setPhoneError(
          `Trop de tentatives. Réessayez dans ${Math.max(1, Math.ceil(retryAfter / 60))} min.`,
        );
        return;
      }
      setPhoneError(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer le SMS pour le moment.",
      );
    }
  };

  const handleOtpInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (lockedSeconds > 0 || isSuccessCascade) return;
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtpCode(digits);
    if (otpError && digits.length > 0) {
      setOtpError(null);
    }
    if (digits.length === 6) {
      submitOtpCode(digits, normalizedPhone);
    }
  };

  const handleOtpPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (lockedSeconds > 0 || isSuccessCascade) return;
    const raw = e.clipboardData?.getData('text') ?? '';
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    if (digits.length > 0) {
      e.preventDefault();
      setOtpCode(digits);
      setOtpError(null);
      if (digits.length === 6) {
        submitOtpCode(digits, normalizedPhone);
      }
    }
  };

  const handleResendCode = async () => {
    if (!isOnline || lockedSeconds > 0) return;
    setOtpError(null);
    setIsExpired(false);
    setOtpCode('');
    verifyingCodeRef.current = null;

    try {
      const res = await requestOtp.mutateAsync({ phone: normalizedPhone });
      setResendSeconds(res.resendIn ?? 60);
      setResentBannerVisible(true);
      window.setTimeout(() => setResentBannerVisible(false), 3000);
      otpInputRef.current?.focus();
    } catch (err) {
      haptic('error');
      if (err instanceof ApiError && err.status === 429) {
        const retryAfter =
          typeof err.details?.retryAfter === 'number'
            ? err.details.retryAfter
            : 600;
        setLockedSeconds(retryAfter);
        setOtpError(
          `Trop de tentatives. Réessayez dans ${Math.max(1, Math.ceil(retryAfter / 60))} min.`,
        );
      } else {
        setOtpError("Impossible de renvoyer le code pour l'instant.");
      }
    }
  };

  const handleNameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    if (!cleanFirst) {
      setNameError('Indiquez votre prénom pour la réception de votre colis.');
      haptic('error');
      return;
    }

    setNameError(null);
    try {
      await updateProfile.mutateAsync({
        firstName: cleanFirst,
        lastName: cleanLast || undefined,
      });
    } catch {
      // Non bloquant : sera repris dans le formulaire de réservation
    }
    onComplete();
  };

  const slideVariants = {
    initial: (dir: number) =>
      reducedMotion ? { opacity: 0 } : { opacity: 0, x: dir * 36 },
    animate: { opacity: 1, x: 0 },
    exit: (dir: number) =>
      reducedMotion ? { opacity: 0 } : { opacity: 0, x: dir * -36 },
  };

  return (
    <div className="overflow-hidden">
      <AnimatePresence mode="wait" custom={stepDirection} initial={false}>
        {step === 'phone' && (
          <m.form
            key="step-phone"
            custom={stepDirection}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.28, ease: ease.out }}
            onSubmit={handlePhoneSubmit}
            noValidate
            className="space-y-5"
          >
            <div>
              <h2 className="text-h2 text-ink">Réservez en 1 minute</h2>
              <p className="mt-1.5 text-small text-text-2">
                Entrez votre numéro : nous vous envoyons un code par SMS. Pas de
                mot de passe.
              </p>
            </div>

            <div>
              <label
                htmlFor="auth-phone-input"
                className="block text-label text-ink"
              >
                NUMÉRO DE TÉLÉPHONE MOBILE
              </label>

              <div
                className={cn(
                  'mt-2 flex h-13 items-center rounded-[var(--radius-md)] border bg-white px-3.5 transition-colors focus-within:border-ink',
                  phoneTouched && phoneError ? 'border-danger' : 'border-silver',
                )}
              >
                <span
                  aria-hidden="true"
                  className="select-none border-r border-silver/70 pr-3 font-mono text-body font-bold text-ink"
                >
                  🇨🇲 +237
                </span>

                <input
                  id="auth-phone-input"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  enterKeyHint="done"
                  placeholder="690 00 00 01"
                  value={phoneInput}
                  onChange={handlePhoneChange}
                  onPaste={handlePhonePaste}
                  onBlur={handlePhoneBlur}
                  aria-invalid={Boolean(phoneTouched && phoneError)}
                  aria-describedby={
                    phoneTouched && phoneError ? errorId : undefined
                  }
                  className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-[16px] font-bold tracking-wide text-ink placeholder:font-sans placeholder:font-normal placeholder:text-text-2 focus:outline-none"
                />

                {/* Repère d'opérateur dès 3 chiffres (§5.2) */}
                {operatorLabel && (
                  <span
                    data-testid="operator-badge"
                    className="shrink-0 rounded-[var(--radius-sm)] bg-surface px-2.5 py-1 text-xs font-bold text-ink"
                  >
                    {operatorLabel}
                  </span>
                )}
              </div>

              {phoneTouched && phoneError && (
                <p
                  id={errorId}
                  role="alert"
                  className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-danger"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{phoneError}</span>
                </p>
              )}

              {!isOnline && (
                <p
                  role="alert"
                  className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-warning"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Vous êtes hors connexion. Reconnectez-vous pour réserver.
                  </span>
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={requestOtp.isPending}
              disabled={!isOnline || requestOtp.isPending}
            >
              Recevoir mon code
            </Button>

            <p className="text-center text-xs leading-relaxed text-text-2">
              En continuant, vous acceptez nos{' '}
              <Link
                to="/pages/cgv"
                onClick={onCancel}
                className="font-semibold text-ink underline"
              >
                conditions générales
              </Link>{' '}
              et notre{' '}
              <Link
                to="/pages/confidentialite"
                onClick={onCancel}
                className="font-semibold text-ink underline"
              >
                politique de confidentialité
              </Link>
              .
            </p>
          </m.form>
        )}

        {step === 'otp' && (
          <m.div
            key="step-otp"
            custom={stepDirection}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.28, ease: ease.out }}
            className="space-y-5"
          >
            <div>
              <h2 className="text-h2 text-ink">Entrez le code reçu</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-small text-text-2">
                <span>Envoyé au {formatCmPhone(normalizedPhone)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStepDirection(-1);
                    setStep('phone');
                  }}
                  className="font-bold text-ink underline hover:text-red"
                >
                  Modifier
                </button>
              </div>
            </div>

            {/* 6 cases visuelles alimentées par un seul champ caché (§5.3 & §9.2) */}
            <div className="relative">
              <input
                ref={otpInputRef}
                data-testid="otp-hidden-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="\d*"
                disabled={lockedSeconds > 0 || isSuccessCascade}
                value={otpCode}
                onChange={handleOtpInputChange}
                onPaste={handleOtpPaste}
                aria-label="Code de vérification à 6 chiffres"
                aria-invalid={Boolean(otpError)}
                aria-describedby={otpError ? errorId : undefined}
                className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
              />

              <m.div
                key={shakeTick}
                animate={
                  shakeTick > 0 && !reducedMotion
                    ? { x: [0, -8, 8, -6, 6, 0] }
                    : { x: 0 }
                }
                transition={{ duration: 0.4, ease: ease.out }}
                aria-hidden="true"
                className="grid grid-cols-6 gap-2 sm:gap-3"
              >
                {Array.from({ length: 6 }).map((_, idx) => {
                  const char = otpCode[idx] ?? '';
                  const isActiveBox =
                    !isSuccessCascade &&
                    lockedSeconds <= 0 &&
                    (otpCode.length === idx ||
                      (otpCode.length === 6 && idx === 5));

                  return (
                    <m.div
                      key={idx}
                      animate={
                        isSuccessCascade
                          ? {
                              scale: reducedMotion ? 1 : [1, 1.08, 1],
                            }
                          : verifyOtp.isPending && !reducedMotion
                            ? { opacity: [1, 0.55, 1] }
                            : { scale: 1, opacity: 1 }
                      }
                      transition={
                        isSuccessCascade
                          ? { delay: idx * 0.05, duration: 0.22 }
                          : verifyOtp.isPending
                            ? {
                                repeat: Number.POSITIVE_INFINITY,
                                duration: 0.7,
                                delay: idx * 0.08,
                              }
                            : undefined
                      }
                      className={cn(
                        'relative flex h-[56px] w-full max-w-[52px] items-center justify-center justify-self-center rounded-[var(--radius-md)] border font-mono text-[24px] font-bold transition-colors',
                        isSuccessCascade
                          ? 'border-success bg-success text-white'
                          : lockedSeconds > 0
                            ? 'border-silver bg-surface text-silver'
                            : otpError
                              ? 'border-danger bg-white text-ink'
                              : isActiveBox
                                ? 'border-2 border-ink bg-white text-ink'
                                : char
                                  ? 'border-ink bg-surface text-ink'
                                  : 'border-silver bg-white text-ink',
                      )}
                    >
                      {isSuccessCascade && idx === 2 ? (
                        <Check className="h-6 w-6 text-white" />
                      ) : (
                        <span>{char}</span>
                      )}

                      {isActiveBox && !char && !verifyOtp.isPending && (
                        <span className="h-6 w-0.5 animate-pulse bg-ink" />
                      )}
                    </m.div>
                  );
                })}
              </m.div>
            </div>

            {/* État de vérification / messages d'erreur / essais restants annoncés en aria-live */}
            <div aria-live="polite" aria-atomic="true" className="min-h-[24px]">
              {verifyOtp.isPending && (
                <p className="flex items-center justify-center gap-2 text-xs font-semibold text-text-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Vérification du code…</span>
                </p>
              )}

              {otpError && !verifyOtp.isPending && (
                <p
                  id={errorId}
                  role="alert"
                  className="flex items-center justify-center gap-1.5 text-center text-xs font-bold text-danger"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {lockedSeconds > 0
                      ? `Trop de tentatives. Réessayez dans ${Math.max(1, Math.ceil(lockedSeconds / 60))} min.`
                      : otpError}
                  </span>
                </p>
              )}

              {resentBannerVisible && !otpError && (
                <p className="text-center text-xs font-bold text-success">
                  Nouveau code envoyé
                </p>
              )}
            </div>

            {/* Bouton « Recevoir un nouveau code » si expiré (410) */}
            {isExpired ? (
              <Button
                variant="primary"
                size="md"
                fullWidth
                loading={requestOtp.isPending}
                onClick={handleResendCode}
              >
                Recevoir un nouveau code
              </Button>
            ) : (
              <div className="flex items-center justify-between border-t border-silver/60 pt-3 text-xs text-text-2">
                {resendSeconds > 0 ? (
                  <span>
                    Renvoyer le code dans {formatSecondsTimer(resendSeconds)}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={requestOtp.isPending || lockedSeconds > 0}
                    onClick={handleResendCode}
                    className="inline-flex min-h-[44px] items-center gap-1.5 font-bold text-ink underline hover:text-red disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Renvoyer le code</span>
                  </button>
                )}

                <span className="font-mono text-[11px] text-text-2">
                  Démo : 123456
                </span>
              </div>
            )}
          </m.div>
        )}

        {step === 'name' && (
          <m.form
            key="step-name"
            custom={stepDirection}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.28, ease: ease.out }}
            onSubmit={handleNameSubmit}
            noValidate
            className="space-y-5"
          >
            <div>
              <h2 className="text-h2 text-ink">Comment vous appelez-vous ?</h2>
              <p className="mt-1.5 text-small text-text-2">
                Ces informations préremplissent vos réservations et l&rsquo;étiquette
                de votre colis.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="auth-first-name"
                  className="block text-label text-ink"
                >
                  PRÉNOM
                </label>
                <input
                  id="auth-first-name"
                  type="text"
                  autoComplete="given-name"
                  enterKeyHint="next"
                  placeholder="Ex. : Junior"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  className="mt-1.5 h-12 w-full rounded-[var(--radius-md)] border border-silver bg-white px-3.5 text-[16px] text-ink placeholder:text-text-2 focus:border-ink focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-last-name"
                  className="block text-label text-ink"
                >
                  NOM (FACULTATIF)
                </label>
                <input
                  id="auth-last-name"
                  type="text"
                  autoComplete="family-name"
                  enterKeyHint="done"
                  placeholder="Ex. : Mbarga"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1.5 h-12 w-full rounded-[var(--radius-md)] border border-silver bg-white px-3.5 text-[16px] text-ink placeholder:text-text-2 focus:border-ink focus:outline-none"
                />
              </div>

              {nameError && (
                <p
                  role="alert"
                  className="flex items-center gap-1.5 text-xs font-semibold text-danger"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{nameError}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={updateProfile.isPending}
              >
                Continuer
              </Button>

              <button
                type="button"
                onClick={onComplete}
                className="flex min-h-[44px] w-full items-center justify-center text-small font-semibold text-text-2 underline hover:text-ink"
              >
                Plus tard
              </button>
            </div>
          </m.form>
        )}
      </AnimatePresence>
    </div>
  );
}
