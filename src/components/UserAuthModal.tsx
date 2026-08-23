import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  UserPlus, LogIn, ShieldCheck, Loader2, Eye, EyeOff,
  ArrowLeft, ArrowRight, User, Phone, Mail, Lock, Hash, Wallet,
  AlertCircle, Users, ExternalLink, GraduationCap
} from 'lucide-react';
import { toast } from 'sonner';
import { isInIframe } from '../lib/google-auth';
import {
  registerClient, loginClient,
  loginClientWithGoogle, registerClientWithGoogle
} from '../services/clientService';
import { loginAdminWithGoogle, linkAdminGoogle } from '../services/adminService';
import { Client, AdminAccount } from '../types';
import OtpVerifyStep from './OtpVerifyStep';
import { establishAdminFirebaseSession } from '../lib/adminFirebaseSession';

type ModalView = 'choice' | 'client-login' | 'client-register' | 'admin-access' | 'google-register' | 'admin-link-google' | 'admin-2fa';

interface UserAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientLogin: (client: Client) => void;
  onAdminLogin: (admin: AdminAccount) => void;
  onAffiliateAccess: () => void;
  onAdminPasswordLogin?: () => void;
  onTeacherAccess?: () => void;
}

// Plain Google icon — no motion, no framer
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GoogleBtn = ({
  onClick, label, loading
}: { onClick: () => void; label: string; loading: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm"
  >
    {loading
      ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      : <><GoogleIcon /><span className="font-bold text-sm text-gray-700">{label}</span></>
    }
  </button>
);

const Divider = ({ label = 'ou' }: { label?: string }) => (
  <div className="flex items-center gap-3">
    <div className="flex-1 h-px bg-gray-100" />
    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{label}</span>
    <div className="flex-1 h-px bg-gray-100" />
  </div>
);

const IframeGoogleWarning = () => {
  if (!isInIframe()) return null;
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
      <ExternalLink className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-bold text-amber-800 leading-snug">Connexion Google indisponible ici</p>
        <p className="text-[11px] text-amber-700 leading-relaxed mt-0.5">
          Votre navigateur bloque la connexion Google dans les aperçus intégrés.{' '}
          <a
            href={window.location.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline underline-offset-2 hover:text-amber-900"
          >
            Ouvrir dans un onglet complet
          </a>
          {' '}pour utiliser Google.
        </p>
      </div>
    </div>
  );
};

export default function UserAuthModal({
  open, onOpenChange, onClientLogin, onAdminLogin, onAffiliateAccess, onAdminPasswordLogin, onTeacherAccess
}: UserAuthModalProps) {
  const [view, setView] = useState<ModalView>('choice');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSponsor, setRegSponsor] = useState('');

  const [googleUser, setGoogleUser] = useState<{
    uid: string; email: string; name: string; photoUrl?: string
  } | null>(null);
  const [googleRegPhone, setGoogleRegPhone] = useState('');
  const [googleRegSponsor, setGoogleRegSponsor] = useState('');

  // Stores pending google result when dialog is closed during auth
  const pendingGoogleResult = useRef<any>(null);

  // For Google → credentials link flow
  const [pendingGoogleEmail, setPendingGoogleEmail] = useState('');
  const [pendingGoogleUid, setPendingGoogleUid] = useState('');
  const [linkFullName, setLinkFullName] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [showLinkPassword, setShowLinkPassword] = useState(false);

  // Admin 2FA state
  const [adminPending2FA, setAdminPending2FA] = useState<{ sessionId: string; maskedEmail: string } | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const resetForms = () => {
    setLoginEmail(''); setLoginPassword('');
    setRegName(''); setRegPhone(''); setRegEmail(''); setRegPassword(''); setRegSponsor('');
    setGoogleUser(null); setGoogleRegPhone(''); setGoogleRegSponsor('');
    setShowPassword(false); setGoogleError(null);
    setPendingGoogleEmail(''); setPendingGoogleUid('');
    setLinkFullName(''); setLinkPassword(''); setLinkCode(''); setShowLinkPassword(false);
    setAdminPending2FA(null); setOtpLoading(false); setOtpError(null);
    setView('choice');
    setLoading(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) resetForms();
    onOpenChange(val);
  };

  // ── Email/password login ─────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) { toast.error("Veuillez remplir tous les champs."); return; }
    setLoading(true);
    try {
      const client = await loginClient(loginEmail.trim().toLowerCase(), loginPassword);
      if (!client) { toast.error("Email ou mot de passe incorrect."); return; }
      if ((client as any).status === 'blocked') { toast.error("Votre compte est bloqué. Contactez le support."); return; }
      toast.success(`Bienvenue, ${client.name} !`);
      onClientLogin(client);
      handleClose(false);
    } catch (err: any) {
      toast.error(err.message || "Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  // ── Email/password register ──────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regPhone || !regEmail || !regPassword) { toast.error("Veuillez remplir tous les champs obligatoires."); return; }
    if (regPassword.length < 6) { toast.error("Le mot de passe doit contenir au moins 6 caractères."); return; }
    setLoading(true);
    try {
      const client = await registerClient({
        name: regName.trim(), phone: regPhone.trim(),
        email: regEmail.trim().toLowerCase(), password: regPassword,
        sponsorCode: regSponsor.trim() || undefined
      });
      toast.success(`Compte créé ! Bienvenue, ${client.name} !`);
      onClientLogin(client);
      handleClose(false);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  };

  // ── Google client login — CLOSE DIALOG FIRST to avoid DOM conflicts ──────
  // Firebase signInWithPopup injects/removes hidden iframes into document.body.
  // Having an animated Radix Dialog portal open at the same time causes React
  // to throw "insertBefore/removeChild: node is not a child" errors.
  // Solution: close the dialog before calling signInWithPopup, reopen if needed.
  const handleGoogleClientLogin = () => {
    setGoogleError(null);
    // Close modal immediately — Firebase popup needs a clean DOM
    onOpenChange(false);

    setLoading(true);
    // Small delay lets Radix finish its exit animation before Firebase injects iframes
    setTimeout(async () => {
      try {
        const result = await loginClientWithGoogle();

        if (result.error) {
          if (result.error) toast.error(result.error);
          // Reopen modal so user can try again
          setLoading(false);
          onOpenChange(true);
          return;
        }

        if (result.noAccount) {
          // Store data, reopen modal to google-register view
          setGoogleUser({
            uid: result.googleUid!,
            email: result.googleEmail!,
            name: result.googleName!,
            photoUrl: result.googlePhotoUrl
          });
          setLoading(false);
          setView('google-register');
          onOpenChange(true);
          return;
        }

        if (result.client) {
          toast.success(`Bienvenue, ${result.client.name} !`);
          onClientLogin(result.client);
          setLoading(false);
          resetForms();
        }
      } catch (err: any) {
        setLoading(false);
        toast.error(err.message || "Erreur de connexion Google.");
        onOpenChange(true);
      }
    }, 150);
  };

  // ── Google register (complete profile) ──────────────────────────────────
  const handleGoogleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleUser) return;
    if (!googleRegPhone.trim()) { toast.error("Le numéro de téléphone est requis."); return; }
    setLoading(true);
    try {
      const client = await registerClientWithGoogle({
        phone: googleRegPhone.trim(),
        sponsorCode: googleRegSponsor.trim() || undefined,
        googleUser
      });
      toast.success(`Compte créé ! Bienvenue, ${client.name} !`);
      onClientLogin(client);
      handleClose(false);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création du compte.");
    } finally {
      setLoading(false);
    }
  };

  // ── Google admin login ───────────────────────────────────────────────────
  const handleGoogleAdminLogin = () => {
    setGoogleError(null);
    onOpenChange(false);
    setLoading(true);

    setTimeout(async () => {
      try {
        const result = await loginAdminWithGoogle();
        setLoading(false);

        // 1. 2FA required (account found, OTP sent) — must check BEFORE "not linked"
        if (result.pending2fa && result.sessionId) {
          setAdminPending2FA({ sessionId: result.sessionId, maskedEmail: result.maskedEmail || '' });
          setOtpError(null);
          setView('admin-2fa');
          onOpenChange(true);
          return;
        }

        // 2. Successful direct login (legacy path — no 2FA)
        if (result.success && result.admin) {
          toast.success(`Bienvenue Admin, ${result.admin.fullName} !`);
          onAdminLogin(result.admin);
          resetForms();
          return;
        }

        // 3. Account not linked yet — offer link flow
        if (result.googleEmail && result.googleUid) {
          setPendingGoogleEmail(result.googleEmail);
          setPendingGoogleUid(result.googleUid);
          setView('admin-link-google');
          onOpenChange(true);
          return;
        }

        // 4. Generic error
        setGoogleError(result.error || "Accès refusé.");
        setView('admin-access');
        onOpenChange(true);
      } catch (err: any) {
        setLoading(false);
        setGoogleError(err.message || "Erreur lors de la connexion Google.");
        setView('admin-access');
        onOpenChange(true);
      }
    }, 150);
  };

  // ── Admin 2FA verify ─────────────────────────────────────────────────────
  const handleAdminOtpVerify = async (sessionId: string, code: string) => {
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/admin/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOtpError(data.error || 'Code incorrect.');
        return;
      }
      await establishAdminFirebaseSession(data.firebaseToken);
      toast.success(`Bienvenue Admin, ${data.admin.fullName} !`);
      onAdminLogin(data.admin);
      handleClose(false);
    } catch {
      setOtpError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleAdminResend2FA = async () => {
    if (!adminPending2FA) return;
    try {
      const res = await fetch('/api/auth/resend-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: adminPending2FA.sessionId }),
      });
      const data = await res.json();
      if (data.sessionId) {
        setAdminPending2FA({ sessionId: data.sessionId, maskedEmail: data.maskedEmail || adminPending2FA.maskedEmail });
        toast.success('Nouveau code envoyé.');
      } else {
        toast.error(data.error || 'Erreur lors du renvoi.');
      }
    } catch {
      toast.error('Erreur réseau.');
    }
  };

  // ── Link Google to existing admin account ────────────────────────────────
  const handleLinkGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkCode.trim()) { toast.error("Veuillez entrer votre code secret."); return; }
    setLoading(true);
    try {
      const result = await linkAdminGoogle(linkCode.trim(), pendingGoogleEmail, pendingGoogleUid);
      setLoading(false);
      // After linking, 2FA OTP is sent — redirect to OTP view
      if (result.pending2fa && result.sessionId) {
        setAdminPending2FA({ sessionId: result.sessionId, maskedEmail: result.maskedEmail || '' });
        setOtpError(null);
        setView('admin-2fa');
        return;
      }
      if (!result.success || !result.admin) {
        toast.error(result.error || "Identifiants incorrects.");
        return;
      }
      toast.success(`Compte Google associé ! Bienvenue, ${result.admin.fullName} !`);
      onAdminLogin(result.admin);
      resetForms();
    } catch (err: any) {
      setLoading(false);
      toast.error(err.message || "Erreur lors de la liaison.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-sm rounded-[2rem] p-0 overflow-hidden border-0 shadow-2xl"
      >
        {/* No AnimatePresence / motion.div — plain conditional rendering to avoid DOM conflicts */}

        {/* ── CHOICE ── */}
        {view === 'choice' && (
          <div className="max-h-[90svh] overflow-y-auto">
            <div className="relative overflow-hidden p-8 text-white text-center" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #4f46e5 100%)' }}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400/20 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />
              <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
              <div className="relative z-10">
                <div className="h-16 w-16 rounded-[20px] bg-white/15 backdrop-blur-md flex items-center justify-center mx-auto mb-4 border border-white/25 shadow-xl">
                  <Wallet className="h-8 w-8 text-white" />
                </div>
                <DialogTitle className="text-2xl font-black text-white">Bienvenue sur Solutionpam</DialogTitle>
                <DialogDescription className="text-white/70 text-sm mt-1.5">Votre plateforme de services digitaux</DialogDescription>
              </div>
            </div>
            <div className="p-5 space-y-2.5 bg-white">
              <button onClick={() => setView('client-login')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-primary/25 hover:bg-blue-50/40 hover:shadow-sm transition-all group text-left active:scale-[0.98]">
                <div className="h-11 w-11 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                  <LogIn className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-dark text-sm">Se connecter</p>
                  <p className="text-xs text-gray-400 mt-0.5">Accéder à votre wallet client</p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
              <button onClick={() => setView('client-register')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/40 hover:shadow-sm transition-all group text-left active:scale-[0.98]">
                <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">
                  <UserPlus className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-dark text-sm">Créer un compte</p>
                  <p className="text-xs text-gray-400 mt-0.5">Nouveau chez Solutionpam ? Inscrivez-vous</p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
              <div className="h-px bg-gray-50 my-1" />
              <button onClick={() => setView('admin-access')}
                className="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-gray-50 transition-all group text-left active:scale-[0.98]">
                <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-500 text-xs">Espace Admin / Affilié</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-all shrink-0" />
              </button>
              {onTeacherAccess && (
                <button onClick={() => { onTeacherAccess!(); handleClose(false); }}
                  className="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-violet-50/50 transition-all group text-left active:scale-[0.98]">
                  <div className="h-9 w-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0 group-hover:bg-violet-200 transition-colors">
                    <GraduationCap className="h-4 w-4 text-violet-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-500 text-xs">Espace Professeur</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-violet-500 transition-all shrink-0" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── ADMIN ACCESS ── */}
        {view === 'admin-access' && (
          <div className="max-h-[90svh] overflow-y-auto">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white">
              <button onClick={() => { setView('choice'); setGoogleError(null); }}
                className="flex items-center gap-1 text-white/60 hover:text-white text-sm mb-4 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Retour
              </button>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-white">Espace Professionnel</DialogTitle>
                  <DialogDescription className="text-white/60 text-xs mt-0.5">Accès administrateur ou affilié</DialogDescription>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4 bg-white">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Connexion Administrateur</p>
                <GoogleBtn onClick={handleGoogleAdminLogin} label="Se connecter en tant qu'administrateur" loading={loading} />
                <IframeGoogleWarning />
                {googleError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 leading-relaxed">{googleError}</p>
                  </div>
                )}
                {onAdminPasswordLogin && (
                  <button
                    type="button"
                    onClick={onAdminPasswordLogin}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all text-sm font-semibold text-slate-600"
                  >
                    <Lock className="h-4 w-4" />
                    Connexion par identifiants
                  </button>
                )}
                <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                  Seuls les comptes autorisés par Solutionpam peuvent accéder au tableau de bord admin.
                </p>
              </div>
              <Divider />
              <div className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Espace Affilié / Agent</p>
                <button onClick={() => { onAffiliateAccess(); handleClose(false); }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-amber-300 hover:bg-amber-50/30 transition-all group text-left active:scale-[0.98]">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
                    <Users className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-dark">Accès Affilié / Agent</p>
                    <p className="text-xs text-gray-500">Tableau de bord affiliés et agents</p>
                  </div>
                </button>
              </div>
              {onTeacherAccess && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Espace Professeur</p>
                  <button onClick={() => { onTeacherAccess!(); handleClose(false); }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-violet-300 hover:bg-violet-50/30 transition-all group text-left active:scale-[0.98]">
                    <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0 group-hover:bg-violet-200 transition-colors">
                      <GraduationCap className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-dark">Accès Professeur</p>
                      <p className="text-xs text-gray-500">Gérez vos formations et votre portefeuille</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CLIENT LOGIN ── */}
        {view === 'client-login' && (
          <div>
            <div className="bg-gradient-to-br from-primary to-[#1B4FD8] p-6 text-white">
              <button onClick={() => setView('choice')}
                className="flex items-center gap-1 text-white/70 hover:text-white text-sm mb-4 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Retour
              </button>
              <DialogTitle className="text-xl font-black text-white">Connexion Client</DialogTitle>
              <DialogDescription className="text-white/70 text-xs mt-1">Accédez à votre wallet Solutionpam</DialogDescription>
            </div>
            <div className="p-6 space-y-4 bg-white">
              <GoogleBtn onClick={handleGoogleClientLogin} label="Se connecter avec Google" loading={loading} />
              <IframeGoogleWarning />
              <Divider />
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                      placeholder="votre@email.com" className="pl-10 h-11 rounded-xl border-gray-200" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input type={showPassword ? 'text' : 'password'} value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••" className="pl-10 pr-10 h-11 rounded-xl border-gray-200" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-dark transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading}
                  className="w-full h-12 rounded-xl bg-primary hover:bg-[#1D4ED8] text-white font-black shadow-lg shadow-primary/30">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><LogIn className="h-5 w-5 mr-2" />Connexion</>}
                </Button>
              </form>
              <p className="text-center text-sm text-gray-500">
                Pas encore de compte ?{' '}
                <button type="button" onClick={() => setView('client-register')} className="text-primary font-bold hover:underline">
                  S'inscrire
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ── CLIENT REGISTER ── */}
        {view === 'client-register' && (
          <div>
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 text-white">
              <button onClick={() => setView('choice')}
                className="flex items-center gap-1 text-white/70 hover:text-white text-sm mb-4 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Retour
              </button>
              <DialogTitle className="text-xl font-black text-white">Créer un compte</DialogTitle>
              <DialogDescription className="text-white/70 text-xs mt-1">Rejoignez Solutionpam gratuitement</DialogDescription>
            </div>
            <div className="p-6 space-y-4 bg-white">
              <GoogleBtn onClick={handleGoogleClientLogin} label="S'inscrire avec Google" loading={loading} />
              <IframeGoogleWarning />
              <Divider label="ou manuellement" />
              <form onSubmit={handleRegister} className="space-y-3 max-h-[45vh] overflow-y-auto no-scrollbar">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nom complet *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input value={regName} onChange={e => setRegName(e.target.value)}
                      placeholder="Jean Dupont" className="pl-10 h-11 rounded-xl border-gray-200" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Téléphone *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input value={regPhone} onChange={e => setRegPhone(e.target.value)}
                      placeholder="+509 XXXX XXXX" className="pl-10 h-11 rounded-xl border-gray-200" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                      placeholder="votre@email.com" className="pl-10 h-11 rounded-xl border-gray-200" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mot de passe *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input type={showPassword ? 'text' : 'password'} value={regPassword} onChange={e => setRegPassword(e.target.value)}
                      placeholder="6 caractères minimum" className="pl-10 pr-10 h-11 rounded-xl border-gray-200" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-dark transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Code parrain (optionnel)</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input value={regSponsor} onChange={e => setRegSponsor(e.target.value)}
                      placeholder="Code affilié parrain" className="pl-10 h-11 rounded-xl border-gray-200" />
                  </div>
                </div>
                <Button type="submit" disabled={loading}
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><UserPlus className="h-5 w-5 mr-2" />Créer mon compte</>}
                </Button>
              </form>
              <p className="text-center text-sm text-gray-500">
                Déjà un compte ?{' '}
                <button type="button" onClick={() => setView('client-login')} className="text-primary font-bold hover:underline">
                  Se connecter
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ── GOOGLE REGISTER — complete profile ── */}
        {view === 'google-register' && googleUser && (
          <div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-6 text-white">
              <button onClick={() => setView('client-register')}
                className="flex items-center gap-1 text-white/70 hover:text-white text-sm mb-4 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Retour
              </button>
              <DialogTitle className="text-xl font-black text-white">Compléter votre profil</DialogTitle>
              <DialogDescription className="text-white/70 text-xs mt-1">Un dernier détail pour finaliser l'inscription</DialogDescription>
            </div>
            <form onSubmit={handleGoogleRegister} className="p-6 space-y-4 bg-white">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                {googleUser.photoUrl
                  ? <img src={googleUser.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  : <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center"><User className="h-5 w-5 text-blue-600" /></div>
                }
                <div className="min-w-0 flex-1">
                  <p className="font-black text-sm text-dark truncate">{googleUser.name}</p>
                  <p className="text-xs text-gray-500 truncate">{googleUser.email}</p>
                </div>
                <GoogleIcon />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Téléphone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input value={googleRegPhone} onChange={e => setGoogleRegPhone(e.target.value)}
                    placeholder="+509 XXXX XXXX" className="pl-10 h-11 rounded-xl border-gray-200" required autoFocus />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Code parrain (optionnel)</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input value={googleRegSponsor} onChange={e => setGoogleRegSponsor(e.target.value)}
                    placeholder="Code affilié parrain" className="pl-10 h-11 rounded-xl border-gray-200" />
                </div>
              </div>
              <Button type="submit" disabled={loading}
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><UserPlus className="h-5 w-5 mr-2" />Créer mon compte</>}
              </Button>
            </form>
          </div>
        )}

        {/* ── ADMIN 2FA — OTP verification after Google login / link ── */}
        {view === 'admin-2fa' && adminPending2FA && (
          <div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white">
              <button
                onClick={() => { setView('admin-access'); setAdminPending2FA(null); setOtpError(null); }}
                className="flex items-center gap-1 text-white/60 hover:text-white text-sm mb-4 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Retour
              </button>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-white">Vérification en deux étapes</DialogTitle>
                  <DialogDescription className="text-white/60 text-xs mt-0.5">Administration Solutionpam</DialogDescription>
                </div>
              </div>
            </div>
            <div className="p-6 bg-white">
              <OtpVerifyStep
                maskedEmail={adminPending2FA.maskedEmail}
                role="admin"
                sessionId={adminPending2FA.sessionId}
                onVerify={handleAdminOtpVerify}
                onResend={handleAdminResend2FA}
                onBack={() => { setView('admin-access'); setAdminPending2FA(null); setOtpError(null); }}
                loading={otpLoading}
                error={otpError}
              />
            </div>
          </div>
        )}

        {/* ── ADMIN LINK GOOGLE — first-time Google account association ── */}
        {view === 'admin-link-google' && (
          <div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white">
              <button onClick={() => { setView('admin-access'); setPendingGoogleEmail(''); setPendingGoogleUid(''); }}
                className="flex items-center gap-1 text-white/60 hover:text-white text-sm mb-4 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Retour
              </button>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-white">Associer votre compte Google</DialogTitle>
                  <DialogDescription className="text-white/60 text-xs mt-0.5">Première connexion — vérification requise</DialogDescription>
                </div>
              </div>
            </div>
            <div className="p-6 bg-white space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <GoogleIcon />
                <p className="text-xs text-blue-800 font-semibold truncate">{pendingGoogleEmail}</p>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Ce compte Google n'est pas encore lié. Entrez votre <strong className="text-gray-700">code secret</strong> pour l'associer en un clic.
              </p>
              <form onSubmit={handleLinkGoogle} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Code secret</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input value={linkCode} onChange={e => setLinkCode(e.target.value)}
                      placeholder="Ex: XX-2026" className="pl-10 h-12 rounded-xl border-gray-200 font-mono tracking-widest text-base" required autoFocus />
                  </div>
                </div>
                <Button type="submit" disabled={loading}
                  className="w-full h-12 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black shadow-lg">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ShieldCheck className="h-5 w-5 mr-2" />Associer et accéder</>}
                </Button>
              </form>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
