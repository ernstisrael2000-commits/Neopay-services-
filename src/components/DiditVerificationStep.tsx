import { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from './ui/button';
import {
  getDiditVerificationStatus,
  type DiditChallenge,
  type DiditVerificationStatus,
} from '../services/diditService';

interface DiditVerificationStepProps {
  challenge: DiditChallenge;
  title: string;
  description: string;
  onVerified: (challengeId: string) => Promise<void> | void;
  onBack?: () => void;
}

export default function DiditVerificationStep({
  challenge,
  title,
  description,
  onVerified,
  onBack,
}: DiditVerificationStepProps) {
  const [status, setStatus] = useState<DiditVerificationStatus>('pending');
  const [error, setError] = useState<string | null>(null);
  const completionStarted = useRef(false);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const result = await getDiditVerificationStatus(challenge.challengeId);
        if (!active) return;
        setStatus(result.status);
        if (result.status === 'approved' && !completionStarted.current) {
          completionStarted.current = true;
          await onVerified(challenge.challengeId);
        }
      } catch (cause: any) {
        if (active) setError(cause?.message || 'La session Didit est momentanément indisponible.');
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 2500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [challenge.challengeId, onVerified]);

  const rejected = status === 'rejected' || status === 'expired' || Boolean(error);

  return (
    <section data-testid="didit-verification-step" className="mt-8 overflow-hidden rounded-[1.75rem] border border-[#dce8ee] bg-white shadow-[0_22px_60px_rgba(47,89,112,.12)]">
      <div className="border-b border-[#e5eef2] bg-[#f8fbfd] p-5 text-center sm:p-7">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#b9dfef] bg-[#eaf7fc] text-[#1979a8]">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <p className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-[#1979a8]">Vérification Didit</p>
        <h1 className="mt-2 text-2xl font-black tracking-[-.035em] text-[#18384d]">{title}</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#60798a]">{description}</p>
      </div>

      <div className="p-3 sm:p-5">
        <iframe
          title="Vérification d’identité Didit"
          src={challenge.url}
          allow="camera; microphone; fullscreen; autoplay; encrypted-media"
          className="h-[min(68vh,620px)] min-h-[480px] w-full rounded-2xl border border-[#dce8ee] bg-[#f8fbfd]"
        />
      </div>

      <div className="flex items-center justify-center gap-2 px-5 pb-5 text-center text-xs font-bold text-[#60798a]">
        {!rejected && <Loader2 className="h-4 w-4 animate-spin text-[#1979a8]" />}
        <span>
          {error ? 'La comparaison avec le nom légal du compte a échoué.' :
           status === 'approved' ? 'Vérification validée. Ouverture sécurisée…' :
           status === 'rejected' ? 'La vérification n’a pas été acceptée.' :
           status === 'expired' ? 'Cette session Didit a expiré.' :
           'Terminez la vérification dans la fenêtre ci-dessus.'}
        </span>
      </div>

      {error && (
        <div role="alert" className="mx-5 mb-5 flex items-start gap-2 rounded-xl border border-[#f3b7b0] bg-[#fff1f0] p-3 text-xs leading-5 text-[#b42318]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {rejected && onBack && (
        <div className="px-5 pb-6">
          <Button type="button" variant="outline" onClick={onBack} className="w-full rounded-xl">
            Retour
          </Button>
        </div>
      )}
    </section>
  );
}