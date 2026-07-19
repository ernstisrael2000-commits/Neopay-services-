import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Copy, CheckCircle2, Clock, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';
import { apiFetch } from '../lib/apiFetch';
import { motion, AnimatePresence } from 'motion/react';

// ── Crypto definitions ────────────────────────────────────────────────────────

interface CryptoDef {
  id: string;       // NOWPayments currency code
  label: string;
  symbol: string;
  network: string;
  bgColor: string;
  textColor: string;
  emoji: string;
}

const CRYPTOS: CryptoDef[] = [
  {
    id: 'usdttrc20', label: 'USDT', symbol: 'USDT',
    network: 'TRC-20', bgColor: '#e6f7f1', textColor: '#26a17b', emoji: '₮',
  },
  {
    id: 'usdc', label: 'USDC', symbol: 'USDC',
    network: 'ERC-20', bgColor: '#e8f0fd', textColor: '#2775ca', emoji: '$',
  },
  {
    id: 'btc', label: 'Bitcoin', symbol: 'BTC',
    network: 'Bitcoin', bgColor: '#fff4e5', textColor: '#f7931a', emoji: '₿',
  },
];

type PayStatus = 'waiting' | 'confirming' | 'finished' | 'failed' | 'expired' | 'partially_paid';

interface CryptoPayment {
  payment_id: string;
  payment_status: PayStatus;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  price_amount: number;
  expiration_estimate_date?: string | null;
  paymentId?: string;
  payAddress?: string;
  payAmount?: number;
  payCurrency?: string;
  status?: string;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; sublabel: string; color: string; bg: string; icon: React.ReactNode }> = {
  waiting: {
    label: 'En attente du paiement',
    sublabel: 'Envoyez exactement le montant indiqué à l\'adresse ci-dessous.',
    color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200',
    icon: <Clock className="h-5 w-5 text-amber-500" />,
  },
  confirming: {
    label: 'Transaction reçue',
    sublabel: 'Confirmation blockchain en cours. Merci de patienter.',
    color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200',
    icon: <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />,
  },
  finished: {
    label: 'Paiement confirmé !',
    sublabel: 'Votre compte a été rechargé avec succès.',
    color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200',
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  },
  failed: {
    label: 'Paiement échoué',
    sublabel: 'Le paiement n\'a pas pu être traité. Réessayez.',
    color: 'text-red-700', bg: 'bg-red-50 border-red-200',
    icon: <AlertCircle className="h-5 w-5 text-red-500" />,
  },
  expired: {
    label: 'Paiement expiré',
    sublabel: 'La session a expiré. Créez un nouveau paiement.',
    color: 'text-gray-700', bg: 'bg-gray-100 border-gray-200',
    icon: <AlertCircle className="h-5 w-5 text-gray-400" />,
  },
  partially_paid: {
    label: 'Paiement partiel',
    sublabel: 'Montant insuffisant reçu. Contactez le support.',
    color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200',
    icon: <AlertCircle className="h-5 w-5 text-orange-500" />,
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
  clientName: string;
  clientWalletId: string;
  onSuccess: (amount: number) => void;
  onBack?: () => void;
}

export default function CryptoDepositFlow({ clientId, clientName, clientWalletId, onSuccess, onBack }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<CryptoDef | null>(null);
  const [usdInput, setUsdInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [payment, setPayment] = useState<CryptoPayment | null>(null);
  const [status, setStatus] = useState<PayStatus | null>(null);
  const [creditDone, setCreditDone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const usd = parseFloat(usdInput) || 0;

  // ── Countdown timer ──
  useEffect(() => {
    if (!payment?.expiration_estimate_date) return;
    const exp = new Date(payment.expiration_estimate_date).getTime();
    const tick = () => {
      const left = Math.max(0, Math.floor((exp - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [payment?.expiration_estimate_date]);

  // ── Polling ──
  useEffect(() => {
    if (step !== 3 || !payment) return;
    const paymentId = payment.payment_id || payment.paymentId;
    if (!paymentId) return;

    const poll = async () => {
      try {
        const data = await apiFetch(`/api/crypto/payment-status/${paymentId}`);
        const s = (data.payment_status || data.status) as PayStatus;
        setStatus(s);
        if (data.credited || s === 'finished') {
          setCreditDone(true);
          if (pollRef.current) clearInterval(pollRef.current);
          if (data.credited) {
            setTimeout(() => onSuccess(usd), 1500);
          }
        }
        if (['failed', 'expired'].includes(s)) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {/* silent — keep polling */}
    };

    poll();
    pollRef.current = setInterval(poll, 12000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, payment]);

  // ── Create payment ──
  const handleCreate = async () => {
    if (!selected || usd < 15) return;
    setCreating(true);
    try {
      const data: CryptoPayment = await apiFetch('/api/crypto/create-payment', {
        method: 'POST',
        body: JSON.stringify({ clientId, clientName, clientWalletId, amount: usd, currency: selected.id }),
      });
      if ((data as any).error) throw new Error((data as any).error);
      // Normalise fields (existing vs new payment)
      setPayment({
        payment_id: String(data.payment_id || data.paymentId),
        payment_status: (data.payment_status || data.status || 'waiting') as PayStatus,
        pay_address: data.pay_address || data.payAddress || '',
        pay_amount: data.pay_amount ?? data.payAmount ?? 0,
        pay_currency: data.pay_currency || data.payCurrency || selected.id,
        price_amount: data.price_amount ?? usd,
        expiration_estimate_date: data.expiration_estimate_date || null,
      });
      setStatus((data.payment_status || data.status || 'waiting') as PayStatus);
      setStep(3);
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de la création du paiement.');
    } finally {
      setCreating(false);
    }
  };

  const copyAddress = () => {
    if (!payment?.pay_address) return;
    navigator.clipboard.writeText(payment.pay_address);
    toast.success('Adresse copiée !');
  };

  const copyAmount = () => {
    if (!payment?.pay_amount) return;
    navigator.clipboard.writeText(String(payment.pay_amount));
    toast.success('Montant copié !');
  };

  const statusCfg = status ? (STATUS_CONFIG[status] ?? STATUS_CONFIG.waiting) : STATUS_CONFIG.waiting;
  const mins = secondsLeft !== null ? Math.floor(secondsLeft / 60) : null;
  const secs = secondsLeft !== null ? secondsLeft % 60 : null;

  // ── Step 1: Choose crypto ─────────────────────────────────────────────────
  if (step === 1) {
    return (
      <motion.div
        key="step1"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-4"
      >
        {/* Header info */}
        <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-100 rounded-2xl">
          <span className="text-xl shrink-0">₿</span>
          <div>
            <p className="text-xs font-black text-amber-800">Payer avec Crypto</p>
            <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
              Envoyez directement depuis votre portefeuille crypto. Les frais réseau sont à votre charge.
            </p>
          </div>
        </div>

        {/* Crypto selection */}
        <div className="space-y-2">
          <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Choisissez votre crypto
          </Label>
          <div className="space-y-2">
            {CRYPTOS.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all ${
                  selected?.id === c.id
                    ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                {/* Logo */}
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-xl font-black shrink-0"
                  style={{ backgroundColor: c.bgColor, color: c.textColor }}
                >
                  {c.emoji}
                </div>
                <div className="text-left flex-1">
                  <p className="font-black text-gray-900 text-sm">{c.label}</p>
                  <p className="text-[10px] text-gray-400 font-bold">Réseau {c.network}</p>
                </div>
                {/* Radio */}
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  selected?.id === c.id ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                }`}>
                  {selected?.id === c.id && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        <Button
          type="button"
          onClick={() => selected && setStep(2)}
          disabled={!selected}
          className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black border-0"
        >
          Continuer →
        </Button>
      </motion.div>
    );
  }

  // ── Step 2: Amount ────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <motion.div
        key="step2"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-4"
      >
        {/* Selected crypto badge */}
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setStep(1)} className="h-8 w-8 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-lg font-black shrink-0"
            style={{ backgroundColor: selected!.bgColor, color: selected!.textColor }}
          >
            {selected!.emoji}
          </div>
          <div>
            <p className="font-black text-gray-900 text-sm">{selected!.label}</p>
            <p className="text-[10px] text-gray-400 font-bold">Réseau {selected!.network}</p>
          </div>
        </div>

        {/* Amount input */}
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Montant à recharger (USD)
          </Label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-lg">$</span>
            <Input
              type="number"
              min="15"
              step="1"
              value={usdInput}
              onChange={e => setUsdInput(e.target.value)}
              placeholder="Min. $15"
              className="h-13 pl-8 rounded-xl text-lg font-black"
              autoFocus
            />
          </div>
        </div>

        {/* Fee notice */}
        {usd > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-gray-100 overflow-hidden"
          >
            <div className="flex justify-between items-center px-3.5 py-2.5 bg-white border-b border-gray-50">
              <span className="text-[11px] text-gray-500 font-medium">Montant de recharge</span>
              <span className="text-sm font-black text-gray-800">${usd.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between items-center px-3.5 py-2.5 bg-amber-50">
              <span className="text-[11px] text-amber-700 font-medium">Frais réseau</span>
              <span className="text-[11px] text-amber-700 font-bold">Inclus dans le montant {selected!.symbol}</span>
            </div>
            <div className="flex justify-between items-center px-3.5 py-2.5 bg-emerald-50">
              <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wide">Vous recevrez</span>
              <span className="text-base font-black text-emerald-700">${usd.toFixed(2)} USD</span>
            </div>
          </motion.div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
          <span className="text-blue-500 text-xs font-black shrink-0 mt-0.5">ℹ</span>
          <p className="text-[11px] text-blue-700 leading-relaxed">
            Les frais de réseau blockchain sont payés par vous et sont déduits du montant envoyé en {selected!.symbol}. Le crédit USD est fixé au montant saisi.
          </p>
        </div>

        {usd > 0 && usd < 15 && (
          <p className="text-[11px] text-red-500 font-bold text-center -mt-1">
            Montant minimum : $15 USD
          </p>
        )}

        <Button
          type="button"
          onClick={handleCreate}
          disabled={creating || usd < 15}
          className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black border-0 disabled:opacity-40"
        >
          {creating
            ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Création en cours…</>
            : 'Continuer le paiement →'}
        </Button>
      </motion.div>
    );
  }

  // ── Step 3: Address + status ──────────────────────────────────────────────
  const payAddr = payment?.pay_address || '';
  const payAmt  = payment?.pay_amount ?? 0;
  const payCurr = (payment?.pay_currency || selected?.id || '').toUpperCase();

  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      {/* Status badge */}
      <div className={`flex items-center gap-3 p-3.5 rounded-2xl border ${statusCfg.bg}`}>
        {statusCfg.icon}
        <div>
          <p className={`text-sm font-black ${statusCfg.color}`}>{statusCfg.label}</p>
          <p className={`text-[11px] mt-0.5 leading-relaxed ${statusCfg.color} opacity-80`}>{statusCfg.sublabel}</p>
        </div>
      </div>

      {/* Expiry countdown */}
      {status === 'waiting' && secondsLeft !== null && secondsLeft > 0 && (
        <div className={`flex items-center gap-2 justify-center px-4 py-2 rounded-full text-sm font-black w-fit mx-auto ${
          secondsLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
        }`}>
          <Clock className="h-4 w-4" />
          Expire dans {mins}:{String(secs).padStart(2, '0')}
        </div>
      )}

      {/* Show address & QR when payment is active */}
      {(status === 'waiting' || status === 'confirming') && payAddr && (
        <>
          {/* Amount to send */}
          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant exact à envoyer</p>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white">
              <div>
                <p className="text-xl font-black text-gray-900 font-mono">{payAmt}</p>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">{payCurr} · Réseau {selected?.network}</p>
              </div>
              <button
                type="button"
                onClick={copyAmount}
                className="h-10 w-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <Copy className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* QR + address */}
          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Adresse de paiement</p>
            </div>
            {/* QR */}
            <div className="flex justify-center p-4 bg-white border-b border-gray-100">
              <div className="p-3 bg-white rounded-2xl border-2 border-gray-100 shadow-sm">
                <QRCode value={payAddr} size={160} />
              </div>
            </div>
            {/* Address text */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white">
              <p className="flex-1 text-[11px] font-mono text-gray-600 break-all leading-relaxed">{payAddr}</p>
              <button
                type="button"
                onClick={copyAddress}
                className="h-10 w-10 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center transition-colors shrink-0"
              >
                <Copy className="h-4 w-4 text-emerald-600" />
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
            <span className="text-blue-500 text-xs shrink-0 mt-0.5">ℹ</span>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Envoyez <strong>exactement {payAmt} {payCurr}</strong> à l'adresse ci-dessus. Ne fermez pas cette fenêtre — le statut se met à jour automatiquement.
            </p>
          </div>
        </>
      )}

      {/* Success state */}
      {status === 'finished' && creditDone && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <div>
            <p className="text-lg font-black text-gray-900">+${usd.toFixed(2)} USD</p>
            <p className="text-xs text-gray-400 mt-0.5">Votre compte a été rechargé</p>
          </div>
        </div>
      )}

      {/* Failed/expired — restart */}
      {(status === 'failed' || status === 'expired') && (
        <Button
          type="button"
          onClick={() => { setStep(1); setPayment(null); setStatus(null); setUsdInput(''); setSelected(null); }}
          className="w-full h-11 rounded-xl border-gray-200 bg-white text-gray-600 border font-bold hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Recommencer
        </Button>
      )}

      {/* Payment ID reference */}
      {payment?.payment_id && (
        <p className="text-center text-[10px] text-gray-300 font-mono">
          Réf: {payment.payment_id}
        </p>
      )}
    </motion.div>
  );
}
