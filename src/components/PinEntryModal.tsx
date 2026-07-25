import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Eye, EyeOff, X, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';

interface PinEntryModalProps {
  open: boolean;
  title?: string;
  description?: string;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
}

export default function PinEntryModal({
  open,
  title = 'Code PIN requis',
  description = 'Saisissez votre code PIN à 8 chiffres pour confirmer cette action.',
  onConfirm,
  onCancel,
}: PinEntryModalProps) {
  const [digits, setDigits] = useState(['', '', '', '', '', '', '', '']);
  const [masked, setMasked] = useState(true);
  const [shake, setShake] = useState(false);
  const refs = Array.from({ length: 8 }, () => useRef<HTMLInputElement | null>(null));

  useEffect(() => {
    if (open) {
      setDigits(['', '', '', '', '', '', '', '']);
      setMasked(true);
      setTimeout(() => refs[0].current?.focus(), 150);
    }
  }, [open]);

  const handleChange = (idx: number, val: string) => {
    const v = val.replace(/\D/, '');
    const next = [...digits];
    next[idx] = v;
    setDigits(next);
    if (v && idx < 7) refs[idx + 1].current?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      refs[idx - 1].current?.focus();
      const next = [...digits];
      next[idx - 1] = '';
      setDigits(next);
    }
    if (e.key === 'Enter' && digits.every(d => d !== '')) handleConfirm();
  };

  const handleConfirm = () => {
    if (!digits.every(d => d !== '')) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    onConfirm(digits.join(''));
    setDigits(['', '', '', '', '', '', '', '']);
  };

  const complete = digits.every(d => d !== '');

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
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full sm:max-w-sm bg-white rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden shadow-2xl">

              {/* Header */}
              <div className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 px-6 pt-6 pb-8">
                <button
                  onClick={onCancel}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>

                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-lg">
                    <Lock className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-lg font-black text-white leading-tight">{title}</h2>
                    <p className="text-white/60 text-xs mt-1 leading-relaxed max-w-[240px] mx-auto">{description}</p>
                  </div>
                </div>

                {/* Decorative circles */}
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-blue-500/10 translate-y-1/2 -translate-x-1/2 pointer-events-none" />
              </div>

              {/* Body */}
              <div className="px-6 py-6 flex flex-col items-center gap-5">

                {/* Digit inputs */}
                <motion.div
                  animate={shake ? { x: [0, -8, 8, -8, 8, -4, 4, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  className="flex gap-2"
                >
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={refs[i] as React.RefObject<HTMLInputElement>}
                      type={masked ? 'password' : 'text'}
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={e => handleChange(i, e.target.value)}
                      onKeyDown={e => handleKeyDown(i, e)}
                      className={`w-9 h-11 sm:w-10 sm:h-12 text-center text-lg font-black rounded-xl border-2 transition-all outline-none bg-gray-50
                        ${d ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-[0_0_0_3px_rgba(59,130,246,0.15)]' : 'border-gray-200 text-gray-800'}
                        focus:border-blue-500 focus:bg-blue-50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]`}
                    />
                  ))}
                </motion.div>

                {/* Show/hide toggle */}
                <button
                  type="button"
                  onClick={() => setMasked(!masked)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {masked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {masked ? 'Afficher le code' : 'Masquer le code'}
                </button>

                {/* Progress dots */}
                <div className="flex gap-1.5">
                  {digits.map((d, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${d ? 'bg-blue-500 scale-125' : 'bg-gray-200'}`}
                    />
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3 w-full">
                  <Button
                    variant="outline"
                    onClick={onCancel}
                    className="flex-1 h-12 rounded-xl border-gray-200 font-bold text-gray-600"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={!complete}
                    className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Confirmer
                  </Button>
                </div>

                <p className="text-[10px] text-gray-300 text-center">
                  🔒 Votre PIN est vérifié de façon sécurisée
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
