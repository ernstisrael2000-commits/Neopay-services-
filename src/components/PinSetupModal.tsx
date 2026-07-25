import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Eye, EyeOff, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface PinSetupModalProps {
  open: boolean;
  role: 'agent' | 'affiliate' | 'admin';
  /** agentCode for agents, affiliateId for affiliates, adminId for admins */
  identifier: string;
  onSuccess: () => void;
}

function PinDigit({
  value,
  onChange,
  onKeyDown,
  inputRef,
  masked,
  filled,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  masked: boolean;
  filled: boolean;
}) {
  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={masked ? 'password' : 'text'}
      inputMode="numeric"
      maxLength={1}
      value={value}
      onChange={e => {
        const v = e.target.value.replace(/\D/, '');
        onChange(v);
      }}
      onKeyDown={onKeyDown}
      className={`w-9 h-11 sm:w-10 sm:h-12 text-center text-lg font-black rounded-xl border-2 transition-all outline-none bg-gray-50
        ${filled ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-[0_0_0_3px_rgba(99,102,241,0.15)]' : 'border-gray-200 text-gray-800'}
        focus:border-indigo-500 focus:bg-indigo-50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]`}
    />
  );
}

export default function PinSetupModal({ open, role, identifier, onSuccess }: PinSetupModalProps) {
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState(['', '', '', '', '', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '', '', '', '', '']);
  const [masked, setMasked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const pinRefs = Array.from({ length: 8 }, () => useRef<HTMLInputElement | null>(null));
  const confirmRefs = Array.from({ length: 8 }, () => useRef<HTMLInputElement | null>(null));

  useEffect(() => {
    if (open) {
      setStep('create');
      setPin(['', '', '', '', '', '', '', '']);
      setConfirmPin(['', '', '', '', '', '', '', '']);
      setMasked(true);
      setTimeout(() => pinRefs[0].current?.focus(), 200);
    }
  }, [open]);

  useEffect(() => {
    if (step === 'confirm') {
      setTimeout(() => confirmRefs[0].current?.focus(), 100);
    }
  }, [step]);

  const handleDigit = (
    arr: string[], setArr: (v: string[]) => void,
    refs2: React.RefObject<HTMLInputElement | null>[], idx: number, val: string
  ) => {
    const next = [...arr];
    next[idx] = val;
    setArr(next);
    if (val && idx < 7) refs2[idx + 1].current?.focus();
  };

  const handleKey = (
    arr: string[], setArr: (v: string[]) => void,
    refs2: React.RefObject<HTMLInputElement | null>[], idx: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !arr[idx] && idx > 0) {
      refs2[idx - 1].current?.focus();
      const next = [...arr];
      next[idx - 1] = '';
      setArr(next);
    }
  };

  const pinComplete = pin.every(d => d !== '');
  const confirmComplete = confirmPin.every(d => d !== '');

  const handleNext = () => {
    if (!pinComplete) { toast.error('Saisissez les 8 chiffres'); return; }
    setStep('confirm');
    setConfirmPin(['', '', '', '', '', '', '', '']);
  };

  const handleSubmit = async () => {
    if (!confirmComplete) { toast.error('Confirmez les 8 chiffres'); return; }
    const p = pin.join('');
    const c = confirmPin.join('');
    if (p !== c) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error('Les codes ne correspondent pas');
      setConfirmPin(['', '', '', '', '', '', '', '']);
      setTimeout(() => confirmRefs[0].current?.focus(), 100);
      return;
    }
    setLoading(true);
    try {
      const url = role === 'agent'
        ? '/api/agent/set-pin'
        : role === 'affiliate'
          ? '/api/affiliate/set-pin'
          : '/api/admin/set-pin';
      const body = role === 'agent'
        ? { agentCode: identifier, pin: p }
        : role === 'affiliate'
          ? { affiliateId: identifier, pin: p }
          : { adminId: identifier, pin: p };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      toast.success('✅ Code PIN créé avec succès !');
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = role === 'admin' ? 'administrateur' : role === 'agent' ? 'agent' : 'affilié';

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.92, y: 32 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <div className="w-full sm:max-w-sm bg-white rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden shadow-2xl">

              {/* Header */}
              <div className="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 px-6 pt-7 pb-9">
                {/* Step indicator */}
                <div className="flex justify-center gap-2 mb-5">
                  {['create', 'confirm'].map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all
                        ${step === s ? 'bg-white text-indigo-700 shadow-lg' :
                          (step === 'confirm' && i === 0) ? 'bg-green-400 text-white' : 'bg-white/20 text-white/50'}`}>
                        {step === 'confirm' && i === 0 ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                      </div>
                      {i === 0 && <div className={`w-8 h-0.5 rounded-full transition-all ${step === 'confirm' ? 'bg-green-400' : 'bg-white/20'}`} />}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-lg font-black text-white">
                      {step === 'create' ? 'Créer votre code PIN' : 'Confirmer le code PIN'}
                    </h2>
                    <p className="text-white/60 text-xs mt-1 leading-relaxed max-w-[240px] mx-auto">
                      {step === 'create'
                        ? `Choisissez un PIN à 8 chiffres pour sécuriser votre compte ${roleLabel}.`
                        : 'Ressaisissez votre code PIN pour le confirmer.'}
                    </p>
                  </div>
                </div>

                <div className="absolute top-0 right-0 w-28 h-28 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              </div>

              {/* Body */}
              <div className="px-6 py-6 flex flex-col items-center gap-5">

                {/* Digit inputs */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: step === 'confirm' ? 20 : -20 }}
                    animate={shake
                      ? { opacity: 1, x: [0, -8, 8, -8, 8, -4, 4, 0] }
                      : { opacity: 1, x: 0 }
                    }
                    exit={{ opacity: 0 }}
                    transition={{ duration: shake ? 0.4 : 0.2 }}
                    className="flex gap-2"
                  >
                    {(step === 'create' ? pin : confirmPin).map((d, i) => (
                      <PinDigit
                        key={i}
                        value={d}
                        masked={masked}
                        filled={d !== ''}
                        inputRef={step === 'create' ? pinRefs[i] : confirmRefs[i]}
                        onChange={val =>
                          step === 'create'
                            ? handleDigit(pin, setPin, pinRefs, i, val)
                            : handleDigit(confirmPin, setConfirmPin, confirmRefs, i, val)
                        }
                        onKeyDown={e =>
                          step === 'create'
                            ? handleKey(pin, setPin, pinRefs, i, e)
                            : handleKey(confirmPin, setConfirmPin, confirmRefs, i, e)
                        }
                      />
                    ))}
                  </motion.div>
                </AnimatePresence>

                {/* Progress dots */}
                <div className="flex gap-1.5">
                  {(step === 'create' ? pin : confirmPin).map((d, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${d ? 'bg-indigo-500 scale-125' : 'bg-gray-200'}`}
                    />
                  ))}
                </div>

                {/* Show/hide toggle */}
                <button
                  type="button"
                  onClick={() => setMasked(!masked)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {masked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {masked ? 'Afficher' : 'Masquer'}
                </button>

                {/* Action buttons */}
                {step === 'create' ? (
                  <Button
                    onClick={handleNext}
                    disabled={!pinComplete}
                    className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-200 disabled:opacity-40"
                  >
                    Suivant <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <div className="w-full flex flex-col gap-2">
                    <Button
                      onClick={handleSubmit}
                      disabled={!confirmComplete || loading}
                      className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-200 disabled:opacity-40"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                      Enregistrer le PIN
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => { setStep('create'); setPin(['', '', '', '', '', '', '', '']); }}
                      className="w-full h-10 text-sm text-gray-400 hover:text-gray-600 rounded-xl"
                    >
                      ← Recommencer
                    </Button>
                  </div>
                )}

                <p className="text-[10px] text-gray-300 text-center">
                  🔒 Votre PIN est chiffré — jamais visible en clair
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
