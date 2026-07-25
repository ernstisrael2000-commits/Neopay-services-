import React, { useState } from 'react';
import { loginWithGoogle } from '../services/authService';
import { isInIframe } from '../lib/google-auth';
import { toast } from 'sonner';
import { Loader2, ExternalLink, ShieldCheck, UserCheck, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Agent } from '../types';
import { Button } from './ui/button';
import OtpVerifyStep from './OtpVerifyStep';

interface AgentLoginProps {
  onLogin: (agent: Agent) => void;
}

export default function AgentLogin({ onLogin }: AgentLoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2FA state
  const [pending2FA, setPending2FA] = useState<{ sessionId: string; maskedEmail: string } | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loginWithGoogle('agent');
      if (result.pending2fa && result.sessionId) {
        setPending2FA({ sessionId: result.sessionId, maskedEmail: result.maskedEmail || '' });
      } else if (result.error) {
        setError(result.error);
        toast.error(result.error);
      }
    } catch (error: any) {
      const msg = error?.message || 'Erreur connexion Google.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (sessionId: string, code: string) => {
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/agent/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOtpError(data.error || 'Code incorrect.');
        return;
      }
      toast.success(`Bienvenue, Agent ${data.agent.name} !`);
      onLogin(data.agent);
    } catch {
      setOtpError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResend = async () => {
    const res = await fetch('/api/auth/resend-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: pending2FA!.sessionId }),
    });
    const data = await res.json();
    if (data.sessionId) {
      setPending2FA({ sessionId: data.sessionId, maskedEmail: data.maskedEmail });
      toast.success('Nouveau code envoyé.');
    } else {
      toast.error(data.error || 'Erreur lors du renvoi.');
    }
  };

  // ── 2FA step ─────────────────────────────────────────────────────────────────
  if (pending2FA) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="relative w-full max-w-sm"
        >
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-primary to-indigo-500" />
            <div className="p-8">
              <OtpVerifyStep
                maskedEmail={pending2FA.maskedEmail}
                role="agent"
                sessionId={pending2FA.sessionId}
                onVerify={handleOtpVerify}
                onResend={handleResend}
                onBack={() => { setPending2FA(null); setOtpError(null); }}
                loading={otpLoading}
                error={otpError}
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative w-full max-w-sm"
      >
        {/* Card */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
          {/* Top accent */}
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-primary to-indigo-500" />

          <div className="p-8 space-y-8">
            {/* Logo area */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-white/10 mx-auto relative">
                <UserCheck className="h-9 w-9 text-blue-400" />
                <div className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/40">
                  <ShieldCheck className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">Espace Sécurisé</span>
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <h1 className="text-3xl font-black text-white tracking-tight">Accès Agent</h1>
                <p className="text-white/40 text-sm font-medium mt-1.5">
                  Connectez-vous avec votre compte Google autorisé par l'administration Rena.
                </p>
              </div>
            </div>

            {/* Google button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-16 rounded-2xl bg-white hover:bg-gray-50 text-gray-800 font-black flex items-center justify-center gap-4 shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <>
                  <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span className="text-base tracking-wide group-hover:text-primary transition-colors">Continuer avec Google</span>
                </>
              )}
            </motion.button>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-300 leading-relaxed">{error}</p>
              </div>
            )}

            {/* Iframe warning */}
            {isInIframe() && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <ExternalLink className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300 leading-relaxed">
                  Connexion Google indisponible dans cet aperçu.{' '}
                  <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="font-black underline text-amber-200">
                    Ouvrir dans un onglet complet
                  </a>
                </p>
              </div>
            )}

            {/* Info note */}
            <div className="text-center space-y-1">
              <p className="text-[10px] text-white/20 font-medium">
                Seuls les agents enregistrés par l'administrateur peuvent accéder à cet espace.
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/15">
                Système de Sécurité Rena · 2FA Activé
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
