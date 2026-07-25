import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Lock, Eye, EyeOff, X } from 'lucide-react';

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
      setTimeout(() => refs[0].current?.focus(), 100);
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
    if (e.key === 'Enter' && digits.every(d => d !== '')) {
      handleConfirm();
    }
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

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <DialogTitle className="text-base">{title}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">{description}</DialogDescription>
              </div>
            </div>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 mt-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </DialogHeader>

        <div className={`flex flex-col items-center gap-5 py-2 ${shake ? 'animate-[shake_0.4s_ease]' : ''}`}>
          <div className="flex gap-2">
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
                className="w-10 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none bg-white transition-colors"
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setMasked(!masked)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            {masked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {masked ? 'Afficher' : 'Masquer'}
          </button>

          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Annuler
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!digits.every(d => d !== '')}
              className="flex-1"
            >
              Confirmer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
