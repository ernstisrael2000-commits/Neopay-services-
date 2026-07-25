import React, { useRef, useState, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { motion } from 'motion/react';
import { Loader2, ShieldCheck, RotateCcw, Mail } from 'lucide-react';
import { Button } from './ui/button';

interface OtpVerifyStepProps {
  maskedEmail: string;
  role: 'admin' | 'agent' | 'affiliate';
  sessionId: string;
  onVerify: (sessionId: string, code: string) => Promise<void>;
  onResend?: () => Promise<void>;
  onBack: () => void;
  loading?: boolean;
  error?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  agent: 'Agent',
  affiliate: 'Affilié',
};
const ROLE_COLORS: Record<string, string> = {
  admin: 'from-blue-600 to-blue-700',
  agent: 'from-slate-700 to-slate-900',
  affiliate: 'from-violet-600 to-violet-700',
};

export default function OtpVerifyStep({
  maskedEmail,
  role,
  sessionId,
  onVerify,
  onResend,
  onBack,
  loading = false,
  error = null,
}: OtpVerifyStepProps) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { refs.current[0]?.focus(); }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const focusNext = (i: number) => refs.current[Math.min(i + 1, 5)]?.focus();
  const focusPrev = (i: number) => refs.current[Math.max(i - 1, 0)]?.focus();

  const handleChange = (i: number, val: string) => {
    const ch = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = ch;
    setDigits(next);
    if (ch) focusNext(i);
    if (next.every(d => d !== '')) {
      onVerify(sessionId, next.join(''));
    }
  };

  const handleKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits]; next[i] = ''; setDigits(next);
      } else {
        focusPrev(i);
      }
    } else if (e.key === 'ArrowLeft') {
      focusPrev(i);
    } else if (e.key === 'ArrowRight') {
      focusNext(i);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const next = [...digits];
    for (let k = 0; k < 6; k++) next[k] = text[k] || '';
    setDigits(next);
    refs.current[Math.min(text.length, 5)]?.focus();
    if (text.length === 6) onVerify(sessionId, text);
  };

  const handleResend = async () => {
    if (!onResend || resendCooldown > 0) return;
    setResendLoading(true);
    try {
      await onResend();
      setResendCooldown(60);
      setDigits(Array(6).fill(''));
      refs.current[0]?.focus();
    } finally {
      setResendLoading(false);
    }
  };

  const code = digits.join('');
  const gradientClass = ROLE_COLORS[role] || 'from-blue-600 to-blue-700';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center space-y-3">
        <div className={`mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br ${gradientClass} flex items-center justify-center shadow-lg`}>
          <ShieldCheck className="h-7 w-7 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-900">Vérification en deux étapes</h3>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            Un code à 6 chiffres a été envoyé à
          </p>
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-700 mt-0.5">
            <Mail className="h-3.5 w-3.5 text-gray-400" />
            {maskedEmail}
          </p>
        </div>
      </div>

      {/* 6-digit boxes */}
      <div className="flex justify-center gap-2.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKey(i, e)}
            onPaste={handlePaste}
            disabled={loading}
            className={[
              'w-11 h-14 text-center text-2xl font-black rounded-xl border-2 transition-all outline-none',
              'focus:ring-2 focus:ring-offset-1',
              d ? 'border-blue-500 bg-blue-50 text-blue-700 focus:ring-blue-300' : 'border-gray-200 bg-gray-50 text-gray-900 focus:border-blue-400 focus:ring-blue-200',
              loading ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100"
        >
          <span className="text-xs text-red-700 leading-relaxed">{error}</span>
        </motion.div>
      )}

      {/* Submit button */}
      <Button
        onClick={() => onVerify(sessionId, code)}
        disabled={code.length < 6 || loading}
        className={`w-full h-12 bg-gradient-to-r ${gradientClass} hover:opacity-90 text-white font-black rounded-2xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50`}
      >
        {loading
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Vérification...</>
          : `Accéder à l'espace ${ROLE_LABELS[role]}`}
      </Button>

      {/* Resend + back */}
      <div className="flex flex-col items-center gap-2">
        {onResend && (
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || resendCooldown > 0}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 disabled:opacity-40 transition-colors"
          >
            {resendLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RotateCcw className="h-3.5 w-3.5" />}
            {resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : 'Renvoyer le code'}
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← Retour à la connexion
        </button>
      </div>
    </motion.div>
  );
}
