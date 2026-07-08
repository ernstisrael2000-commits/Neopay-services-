import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, ArrowLeft, Key, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { toast } from 'sonner';
import { loginAdminWithGoogle, linkAdminGoogle } from '../services/adminService';
import { isInIframe } from '../lib/google-auth';
import { AdminAccount } from '../types';

interface AdminLoginProps {
  onLoginSuccess: (admin: AdminAccount) => void;
  onBack: () => void;
}

const GoogleIcon = () => (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function AdminLogin({ onLoginSuccess, onBack }: AdminLoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showLink, setShowLink] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingUid, setPendingUid] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);

  const inIframe = isInIframe();

  const handleGoogleLogin = async () => {
    if (inIframe) return;
    setLoading(true);
    setError(null);
    try {
      const result = await loginAdminWithGoogle();
      if (result.success && result.admin) {
        toast.success(`Bienvenue, ${result.admin.fullName} !`);
        onLoginSuccess(result.admin);
      } else if (result.googleEmail && result.googleUid && result.error) {
        setPendingEmail(result.googleEmail);
        setPendingUid(result.googleUid);
        setShowLink(true);
      } else if (result.error) {
        setError(result.error);
      }
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkCode.trim()) { toast.error('Entrez votre code de connexion.'); return; }
    setLinkLoading(true);
    try {
      const result = await linkAdminGoogle(linkCode.trim(), pendingEmail, pendingUid);
      if (result.success && result.admin) {
        toast.success(`Compte lié. Bienvenue, ${result.admin.fullName} !`);
        onLoginSuccess(result.admin);
      } else {
        toast.error(result.error || 'Code incorrect.');
      }
    } catch {
      toast.error('Une erreur est survenue.');
    } finally {
      setLinkLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4 bg-gray-50/50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="border-0 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <div className="h-3 bg-gradient-to-r from-primary via-accent to-primary" />

          <CardHeader className="pt-8 pb-4 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-black text-dark">Accès Administrateur</CardTitle>
            <CardDescription className="text-gray-500 font-medium pt-1">
              {showLink
                ? 'Liez votre compte Google à votre profil administrateur.'
                : 'Connectez-vous pour gérer la plateforme Rena.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-10">
            {!showLink ? (
              <div className="space-y-4">
                {inIframe ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-1">
                    <p className="text-xs font-black text-amber-800">Connexion Google indisponible ici</p>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Votre navigateur bloque la connexion dans les aperçus intégrés.
                      Ouvrez le site dans un onglet normal pour vous connecter.
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all font-semibold text-gray-700 shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading
                      ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      : <GoogleIcon />}
                    <span>{loading ? 'Connexion en cours...' : 'Se connecter avec Google'}</span>
                  </button>
                )}

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 leading-relaxed">{error}</p>
                  </div>
                )}

                <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                  Seuls les comptes autorisés par Rena peuvent accéder au tableau de bord administrateur.
                </p>
              </div>
            ) : (
              <form onSubmit={handleLink} className="space-y-5">
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-xs text-blue-700 font-medium leading-relaxed">
                    Le compte Google <strong>{pendingEmail}</strong> n'est pas encore lié.
                    Entrez votre code de connexion administrateur pour finaliser la liaison.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">
                    Code de connexion
                  </Label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Votre code secret administrateur"
                      value={linkCode}
                      onChange={(e) => setLinkCode(e.target.value)}
                      className="pl-12 h-13 rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-primary/20"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={linkLoading}
                  className="w-full h-14 bg-primary hover:bg-[#1D4ED8] text-white font-black rounded-2xl shadow-lg transition-all active:scale-[0.98]"
                >
                  {linkLoading
                    ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Liaison en cours...</>
                    : 'Lier mon compte Google'}
                </Button>

                <button
                  type="button"
                  onClick={() => { setShowLink(false); setLinkCode(''); }}
                  className="w-full text-sm font-bold text-gray-400 hover:text-primary transition-colors"
                >
                  ← Retour
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={onBack}
              className="w-full flex items-center justify-center gap-2 text-sm font-bold text-gray-400 hover:text-primary transition-colors mt-5"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à l'accueil
            </button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
