import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Globe2,
  Loader2,
  Phone,
  Smartphone,
  WalletCards,
} from 'lucide-react';
import { Formation } from '../types';

type PlopPlopMethod = 'moncash' | 'moncash_ussd' | 'natcash' | 'carte' | 'kashpaw';
type PaymentState = 'idle' | 'creating' | 'waiting' | 'success' | 'error';

interface PlopPlopMethodPickerProps {
  formation: Formation;
  loggedClient?: { id?: string } | null;
  settings?: { moncashLogoUrl?: string; natcashLogoUrl?: string } | null;
  onRequestAuth?: () => void;
  onSuccess: () => void;
}

const METHODS: Array<{
  id: PlopPlopMethod;
  label: string;
  description: string;
  icon: typeof Smartphone;
  className: string;
}> = [
  {
    id: 'moncash',
    label: 'MonCash',
    description: 'Paiement mobile',
    icon: Smartphone,
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  {
    id: 'moncash_ussd',
    label: 'MonCash USSD',
    description: 'Validez depuis votre téléphone',
    icon: Phone,
    className: 'border-orange-200 bg-orange-50 text-orange-700',
  },
  {
    id: 'natcash',
    label: 'NatCash',
    description: 'Paiement mobile',
    icon: WalletCards,
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  {
    id: 'carte',
    label: 'Carte bancaire',
    description: 'Visa ou Mastercard',
    icon: CreditCard,
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  {
    id: 'kashpaw',
    label: 'KashPaw',
    description: 'Portefeuille numérique',
    icon: Globe2,
    className: 'border-violet-200 bg-violet-50 text-violet-700',
  },
];

export default function PlopPlopMethodPicker({
  formation,
  loggedClient,
  settings,
  onRequestAuth,
  onSuccess,
}: PlopPlopMethodPickerProps) {
  const [method, setMethod] = useState<PlopPlopMethod>('moncash');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [state, setState] = useState<PaymentState>('idle');
  const [error, setError] = useState('');
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);
  const paymentWindow = useRef<Window | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current !== null) window.clearTimeout(pollTimer.current);
      if (paymentWindow.current && !paymentWindow.current.closed) paymentWindow.current.close();
    };
  }, []);

  const pollPayment = (reference: string) => {
    const check = async () => {
      try {
        const res = await fetch(`/api/formations/purchases/plopplop/status/${encodeURIComponent(reference)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Impossible de vérifier le paiement.');

        if (data.status === 'completed') {
          setState('success');
          onSuccess();
          return;
        }
        if (data.status === 'failed') {
          throw new Error('Le paiement n’a pas pu être confirmé.');
        }
      } catch (err: any) {
        setState('error');
        setError(err.message || 'Impossible de vérifier le paiement.');
        return;
      }

      pollTimer.current = window.setTimeout(check, 3000);
    };

    void check();
  };

  const startPayment = async () => {
    if (!loggedClient?.id) {
      onRequestAuth?.();
      return;
    }
    if (method === 'moncash_ussd' && !phoneNumber.trim()) {
      setError('Saisissez le numéro MonCash à utiliser pour la validation USSD.');
      setState('error');
      return;
    }

    setState('creating');
    setError('');
    setReferenceId(null);

    // Open synchronously so the provider page is not blocked by popup protection
    // after the asynchronous create request returns.
    paymentWindow.current = method === 'moncash_ussd' ? null : window.open('', '_blank');

    try {
      const res = await fetch('/api/formations/purchases/plopplop/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formationId: formation.id,
          method,
          phoneNumber: method === 'moncash_ussd' ? phoneNumber.trim() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Paym Plop Plop est momentanément indisponible.');
      if (data.alreadyOwned) {
        paymentWindow.current?.close();
        onSuccess();
        return;
      }
      if (!data.referenceId) throw new Error('Référence de paiement manquante.');

      setReferenceId(data.referenceId);
      setState('waiting');

      if (data.url) {
        if (paymentWindow.current && !paymentWindow.current.closed) {
          paymentWindow.current.location.href = data.url;
        } else {
          window.open(data.url, '_blank', 'noopener,noreferrer');
        }
      }

      pollPayment(data.referenceId);
    } catch (err: any) {
      paymentWindow.current?.close();
      setState('error');
      setError(err.message || 'Impossible de démarrer le paiement.');
    }
  };

  const resetPayment = () => {
    if (pollTimer.current !== null) window.clearTimeout(pollTimer.current);
    setState('idle');
    setError('');
    setReferenceId(null);
  };

  const PaymentProviderLogo = ({ methodId }: { methodId: PlopPlopMethod }) => {
    const customLogo = methodId === 'moncash' ? settings?.moncashLogoUrl : methodId === 'natcash' ? settings?.natcashLogoUrl : undefined;
    if (customLogo) {
      return <img src={customLogo} alt="" className="h-8 w-8 rounded-lg object-contain bg-white p-1" referrerPolicy="no-referrer" />;
    }

    if (methodId === 'carte') {
      return (
        <span className="relative flex h-8 w-10 items-center justify-center overflow-hidden rounded-lg bg-slate-950 text-[8px] font-black tracking-tight text-white">
          <span className="absolute -left-1 h-5 w-5 rounded-full bg-red-500/90" />
          <span className="absolute -right-1 h-5 w-5 rounded-full bg-amber-400/90" />
          <span className="relative z-10">VISA</span>
        </span>
      );
    }

    const logoClass = methodId === 'moncash'
      ? 'bg-[#e92345] text-white'
      : methodId === 'natcash'
        ? 'bg-[#f6b51b] text-[#18223b]'
        : 'bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white';
    const letters = methodId === 'moncash' ? 'MC' : methodId === 'natcash' ? 'NC' : 'KP';
    return <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-black tracking-tight ${logoClass}`}>{letters}</span>;
  };

  if (state === 'success') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-emerald-600" />
        <p className="text-sm font-black text-emerald-800">Paiement confirmé</p>
        <p className="mt-1 text-xs text-emerald-700">Votre accès à la formation est activé.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-500 text-[10px] font-black text-white shadow-sm">PP</span>
          <div>
            <p className="text-[11px] font-black text-violet-900">Paym Plop Plop</p>
            <p className="text-[10px] text-violet-600">Paiement sécurisé en ligne</p>
          </div>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-emerald-600 shadow-sm">Sécurisé</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map(({ id, label, description, className }) => {
          const selected = method === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => { setMethod(id); if (state === 'error') resetPayment(); }}
              disabled={state === 'creating' || state === 'waiting'}
              className={`rounded-xl border p-3 text-left transition-all ${
                selected ? `${className} ring-2 ring-violet-300 ring-offset-1` : 'border-gray-200 bg-white hover:border-violet-200'
              } disabled:cursor-not-allowed disabled:opacity-60`}
              aria-pressed={selected}
            >
              <div className="flex items-center gap-2">
                <PaymentProviderLogo methodId={id} />
                <span className={`text-xs font-black ${selected ? '' : 'text-gray-700'}`}>{label}</span>
              </div>
              <p className={`mt-1 text-[10px] ${selected ? 'opacity-80' : 'text-gray-400'}`}>{description}</p>
            </button>
          );
        })}
      </div>

      {method === 'moncash_ussd' && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-gray-600">Numéro MonCash</span>
          <input
            type="tel"
            inputMode="tel"
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            placeholder="Ex. 509 37 00 00 00"
            disabled={state === 'creating' || state === 'waiting'}
            className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
          />
        </label>
      )}

      {state === 'waiting' ? (
        <div className="rounded-xl border border-violet-100 bg-violet-50 p-3">
          <div className="flex items-start gap-2">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-violet-600" />
            <div>
              <p className="text-xs font-black text-violet-800">
                {method === 'moncash_ussd' ? 'Validez le paiement sur votre téléphone.' : 'Paiement en attente de confirmation.'}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-violet-700">
                {method === 'carte' || method === 'kashpaw'
                  ? 'La page de paiement sécurisée est ouverte dans un nouvel onglet.'
                  : 'Ne fermez pas cette page. Votre accès sera activé automatiquement après confirmation.'}
              </p>
              {referenceId && <p className="mt-2 truncate font-mono text-[10px] text-violet-500">Réf. {referenceId}</p>}
            </div>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={startPayment}
            disabled={state === 'creating'}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state === 'creating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {loggedClient?.id ? `Payer ${(formation.price || 0).toLocaleString()} HTG` : 'Se connecter pour payer'}
          </button>
          <p className="text-center text-[10px] leading-relaxed text-gray-400">
            Paiement sécurisé via Paym Plop Plop · accès activé automatiquement après confirmation
          </p>
        </>
      )}
    </div>
  );
}