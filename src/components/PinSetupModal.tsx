import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from '../hooks/use-toast';

interface PinSetupModalProps {
  open: boolean;
  role: 'agent' | 'affiliate';
  /** agentCode for agents, affiliateId for affiliates */
  identifier: string;
  onSuccess: () => void;
}

function PinDigitInput({
  value,
  onChange,
  onKeyDown,
  inputRef,
  masked,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  masked: boolean;
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
      className="w-10 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white transition-colors"
    />
  );
}

export default function PinSetupModal({ open, role, identifier, onSuccess }: PinSetupModalProps) {
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState(['', '', '', '', '', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '', '', '', '', '']);
  const [masked, setMasked] = useState(true);
  const [loading, setLoading] = useState(false);

  const pinRefs = Array.from({ length: 8 }, () => useRef<HTMLInputElement | null>(null));
  const confirmRefs = Array.from({ length: 8 }, () => useRef<HTMLInputElement | null>(null));

  useEffect(() => {
    if (open) {
      setStep('create');
      setPin(['', '', '', '', '', '', '', '']);
      setConfirmPin(['', '', '', '', '', '', '', '']);
      setTimeout(() => pinRefs[0].current?.focus(), 100);
    }
  }, [open]);

  const handleDigit = (
    arr: string[],
    setArr: (v: string[]) => void,
    refs: React.RefObject<HTMLInputElement | null>[],
    idx: number,
    val: string
  ) => {
    const next = [...arr];
    next[idx] = val;
    setArr(next);
    if (val && idx < 7) refs[idx + 1].current?.focus();
  };

  const handleKey = (
    arr: string[],
    setArr: (v: string[]) => void,
    refs: React.RefObject<HTMLInputElement | null>[],
    idx: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !arr[idx] && idx > 0) {
      refs[idx - 1].current?.focus();
      const next = [...arr];
      next[idx - 1] = '';
      setArr(next);
    }
  };

  const pinComplete = pin.every(d => d !== '');
  const confirmComplete = confirmPin.every(d => d !== '');

  const handleNext = () => {
    if (!pinComplete) { toast({ title: 'Saisissez les 8 chiffres', variant: 'destructive' }); return; }
    setStep('confirm');
    setConfirmPin(['', '', '', '', '', '', '', '']);
    setTimeout(() => confirmRefs[0].current?.focus(), 100);
  };

  const handleSubmit = async () => {
    if (!confirmComplete) { toast({ title: 'Confirmez les 8 chiffres', variant: 'destructive' }); return; }
    const p = pin.join('');
    const c = confirmPin.join('');
    if (p !== c) {
      toast({ title: 'Les codes ne correspondent pas', variant: 'destructive' });
      setStep('confirm');
      setConfirmPin(['', '', '', '', '', '', '', '']);
      setTimeout(() => confirmRefs[0].current?.focus(), 100);
      return;
    }
    setLoading(true);
    try {
      const url = role === 'agent' ? '/api/agent/set-pin' : '/api/affiliate/set-pin';
      const body = role === 'agent'
        ? { agentCode: identifier, pin: p }
        : { affiliateId: identifier, pin: p };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      toast({ title: '✅ Code PIN créé avec succès !' });
      onSuccess();
    } catch (e: any) {
      toast({ title: e.message || 'Erreur', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-blue-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            {step === 'create' ? 'Créer votre code PIN' : 'Confirmer le code PIN'}
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            {step === 'create'
              ? 'Choisissez un code PIN à 8 chiffres. Il vous sera demandé pour chaque opération sensible.'
              : 'Ressaisissez votre code PIN pour le confirmer.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-2">
          {/* Digit inputs */}
          <div className="flex gap-2">
            {(step === 'create' ? pin : confirmPin).map((d, i) => (
              <PinDigitInput
                key={i}
                value={d}
                masked={masked}
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
          </div>

          {/* Toggle visibility */}
          <button
            type="button"
            onClick={() => setMasked(!masked)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            {masked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {masked ? 'Afficher' : 'Masquer'}
          </button>

          {/* Actions */}
          {step === 'create' ? (
            <Button onClick={handleNext} disabled={!pinComplete} className="w-full">
              Suivant
            </Button>
          ) : (
            <div className="w-full flex flex-col gap-2">
              <Button onClick={handleSubmit} disabled={!confirmComplete || loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Enregistrer le PIN
              </Button>
              <Button variant="ghost" onClick={() => { setStep('create'); setPin(['', '', '', '', '', '', '', '']); setTimeout(() => pinRefs[0].current?.focus(), 100); }} className="w-full text-sm">
                Recommencer
              </Button>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            🔒 Votre PIN est chiffré et ne sera jamais affiché en clair.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
