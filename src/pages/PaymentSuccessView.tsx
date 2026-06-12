import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Clock, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

interface Props {
  referenceId: string;
  onClose: () => void;
}

type Status = 'checking' | 'pending' | 'completed' | 'failed' | 'cancelled';

export default function PaymentSuccessView({ referenceId, onClose }: Props) {
  const [status, setStatus]     = useState<Status>('checking');
  const [usdAmount, setUsd]     = useState<number | null>(null);
  const [htgAmount, setHtg]     = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const MAX = 40;

  // On mount: call /verify first (asks MonCash API directly) then fall back to polling /status
  useEffect(() => {
    let cancelled = false;
    async function verifyNow() {
      try {
        const res  = await fetch('/api/payments/moncash/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referenceId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.status === 'completed') {
          setUsd(data.usdAmount); setHtg(data.htgAmount); setStatus('completed');
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          setStatus(data.status);
        } else {
          setStatus('pending');
        }
      } catch {
        if (!cancelled) setStatus('pending');
      }
    }
    verifyNow();
    return () => { cancelled = true; };
  }, [referenceId]);

  // Polling fallback while pending
  useEffect(() => {
    if (status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'checking') return;
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/payments/moncash/status/${referenceId}`);
        const data = await res.json();
        if (data.status === 'completed') {
          setUsd(data.usdAmount); setHtg(data.htgAmount); setStatus('completed');
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          setStatus(data.status);
        } else {
          setAttempts(p => p + 1);
        }
      } catch {
        setAttempts(p => p + 1);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [referenceId, status, attempts]);

  const isLoading  = status === 'checking' || (status === 'pending' && attempts < MAX);
  const isTimeout  = status === 'pending'  && attempts >= MAX;
  const isSuccess  = status === 'completed';
  const isError    = status === 'failed' || status === 'cancelled';

  const gradientCls = isSuccess
    ? 'from-emerald-500 to-emerald-700'
    : isError
    ? 'from-red-500 to-rose-700'
    : 'from-amber-400 to-orange-500';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden"
      >
        <div className={`p-6 bg-gradient-to-br ${gradientCls} text-white text-center`}>
          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div key="loading" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
                <div>
                  <p className="font-black text-lg">Vérification en cours…</p>
                  <p className="text-white/70 text-sm mt-1">En attente de confirmation MonCash</p>
                </div>
              </motion.div>
            )}
            {isTimeout && (
              <motion.div key="timeout" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="font-black text-lg">En attente</p>
                  <p className="text-white/70 text-sm mt-1">Vérification en cours côté MonCash</p>
                </div>
              </motion.div>
            )}
            {isSuccess && (
              <motion.div key="success" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.5 }}
                  className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center"
                >
                  <CheckCircle2 className="h-8 w-8 text-white" />
                </motion.div>
                <div>
                  <p className="font-black text-lg">Paiement confirmé !</p>
                  <p className="text-white/70 text-sm mt-1">Solde crédité automatiquement</p>
                </div>
              </motion.div>
            )}
            {isError && (
              <motion.div key="error" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="font-black text-lg">{status === 'cancelled' ? 'Annulé' : 'Paiement échoué'}</p>
                  <p className="text-white/70 text-sm mt-1">La transaction n'a pas abouti</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 space-y-4">
          {isSuccess && usdAmount !== null && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
              <p className="text-[11px] text-emerald-600 font-bold uppercase tracking-widest">Montant crédité</p>
              <p className="text-3xl font-black text-emerald-700 mt-1">
                ${usdAmount.toFixed(2)} <span className="text-base font-bold">USD</span>
              </p>
              {htgAmount && (
                <p className="text-sm text-emerald-500 mt-0.5">≈ {Number(htgAmount).toLocaleString()} HTG</p>
              )}
            </div>
          )}

          {isError && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
              <p className="text-sm text-red-700 font-bold leading-relaxed">
                {status === 'cancelled'
                  ? "Vous avez annulé le paiement. Aucun montant n'a été débité."
                  : "Le paiement n'a pas pu être traité. Aucun montant n'a été débité."}
              </p>
            </div>
          )}

          {(isLoading || isTimeout) && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
              <p className="text-[11px] text-amber-800 font-bold leading-relaxed">
                Votre solde sera mis à jour automatiquement dès confirmation par MonCash.
              </p>
              <div className="mt-3 flex justify-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.div key={i}
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    className="h-2 w-2 rounded-full bg-amber-400"
                  />
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-300 text-center font-mono">Réf: {referenceId}</p>

          <Button
            onClick={onClose}
            className={`w-full h-12 rounded-xl font-black text-white border-0 ${
              isSuccess ? 'bg-emerald-600 hover:bg-emerald-700' :
              isError   ? 'bg-rose-600 hover:bg-rose-700' :
              'bg-gray-700 hover:bg-gray-800'
            }`}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isSuccess ? 'Voir mon solde' : isError ? 'Retour' : 'Fermer'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
