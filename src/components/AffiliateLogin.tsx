import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { loginWithGoogle } from '../services/authService';
import { submitAffiliateRequest } from '../services/affiliateService';
import { isInIframe } from '../lib/google-auth';
import { toast } from 'sonner';
import { Loader2, Lock, UserPlus, CheckCircle2, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { Affiliate } from '../types';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
  DialogTrigger
} from './ui/dialog';
import { Textarea } from './ui/textarea';
import OtpVerifyStep from './OtpVerifyStep';

interface AffiliateLoginProps {
  onLogin: (affiliate: Affiliate) => void;
}

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function AffiliateLogin({ onLogin }: AffiliateLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [googleRegistration, setGoogleRegistration] = useState<{ uid: string; email: string } | null>(null);

  // 2FA state
  const [pending2FA, setPending2FA] = useState<{ sessionId: string; maskedEmail: string } | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.name || !registerData.phone) {
      toast.error("Veuillez remplir les champs obligatoires.");
      return;
    }
    if (!googleRegistration && !registerData.email) {
      toast.error("L'email est requis.");
      return;
    }

    setRegisterLoading(true);
    try {
      const requestPayload = {
        ...registerData,
        email: googleRegistration ? googleRegistration.email : registerData.email,
        ...(googleRegistration && { uid: googleRegistration.uid }),
      };
      await submitAffiliateRequest(requestPayload);
      
      try {
        await fetch('/api/notify-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...requestPayload,
            date: new Date().toLocaleString('fr-FR')
          })
        });
      } catch {}

      setIsRegisterOpen(false);
      setGoogleRegistration(null);
      setTimeout(() => {
        toast.success("Demande d'inscription envoyée ! Vous serez contacté après approbation.");
        setRegisterData({ name: '', email: '', phone: '', message: '' });
      }, 100);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'envoi de la demande.");
    } finally {
      setRegisterLoading(false);
    }
  };

  // ── Credential login (server-side) ───────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();
    if (!cleanUsername || !cleanPassword) {
      toast.error("Veuillez remplir tous les champs.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/affiliate/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Identifiants incorrects.");
        return;
      }
      if (data.pending2fa) {
        setPending2FA({ sessionId: data.sessionId, maskedEmail: data.maskedEmail });
      }
    } catch (error) {
      console.error(error);
      toast.error("Une erreur est survenue lors de la connexion.");
    } finally {
      setLoading(false);
    }
  };

  // ── Google login ─────────────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await loginWithGoogle('affiliate');
      if (result.pending2fa && result.sessionId) {
        setPending2FA({ sessionId: result.sessionId, maskedEmail: result.maskedEmail || '' });
      } else if (result.noAccount) {
        setGoogleRegistration({ uid: result.googleUid!, email: result.googleEmail! });
        setRegisterData(prev => ({
          ...prev,
          name: result.googleName || '',
          email: result.googleEmail || '',
        }));
        setIsRegisterOpen(true);
        toast.info("Aucun compte trouvé. Complétez votre demande d'inscription.");
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Erreur connexion Google.");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP verify ───────────────────────────────────────────────────────────────
  const handleOtpVerify = async (sessionId: string, code: string) => {
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/affiliate/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOtpError(data.error || 'Code incorrect.');
        return;
      }
      toast.success(`Bienvenue, ${data.affiliate.name} !`);
      onLogin(data.affiliate);
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
      <div className="max-w-md mx-auto mt-20 px-4">
        <Card className="shadow-xl border-0">
          <CardContent className="pt-8 pb-8 px-8">
            <OtpVerifyStep
              maskedEmail={pending2FA.maskedEmail}
              role="affiliate"
              sessionId={pending2FA.sessionId}
              onVerify={handleOtpVerify}
              onResend={handleResend}
              onBack={() => { setPending2FA(null); setOtpError(null); }}
              loading={otpLoading}
              error={otpError}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20 px-4">
      <Card className="shadow-xl border-0">
        <CardHeader className="text-center space-y-2">
          <div className="bg-accent-light w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-dark">Espace Affilié</CardTitle>
          <CardDescription className="text-subtext">
            Connectez-vous pour accéder à votre tableau de bord.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <Input
                id="username"
                placeholder="Votre nom d'utilisateur"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="Votre mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 bg-primary hover:bg-[#1D4ED8] text-lg font-semibold border-0"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Se connecter"}
            </Button>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-subtext">Ou continuer avec</span>
              </div>
            </div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleGoogleLogin}
                className="w-full h-12 flex items-center justify-center gap-3 border-gray-200 hover:bg-gray-50 text-dark font-medium"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><GoogleIcon /> Se connecter avec Google</>}
              </Button>
            </motion.div>
            {isInIframe() && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 mt-2">
                <ExternalLink className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Connexion Google indisponible dans cet aperçu.{' '}
                  <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                    Ouvrir dans un onglet complet
                  </a>.
                </p>
              </div>
            )}
          </form>
          <p className="mt-6 text-center text-sm text-subtext">
            Identifiants fournis par l'administrateur Solutionpam après approbation.
          </p>

          <div className="mt-8 pt-6 border-t text-center">
            <p className="text-subtext mb-4">Vous n'avez pas de compte ?</p>
            <Dialog open={isRegisterOpen} onOpenChange={(v) => { setIsRegisterOpen(v); if (!v) setGoogleRegistration(null); }}>
              <DialogTrigger 
                render={
                  <Button variant="outline" className="w-full border-accent-light text-primary hover:bg-accent-light">
                    <UserPlus className="h-4 w-4 mr-2" />
                    S'inscrire comme affilié
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Devenir Affilié Solutionpam</DialogTitle>
                  <DialogDescription>
                    {googleRegistration
                      ? "Complétez votre demande d'inscription Google. Elle sera examinée par l'administrateur."
                      : "Remplissez ce formulaire pour soumettre votre demande d'adhésion."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleRegister} className="space-y-4 py-4">
                  {googleRegistration && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                      <GoogleIcon />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-blue-800">Inscription via Google</p>
                        <p className="text-[11px] text-blue-600 truncate">{googleRegistration.email}</p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Nom complet *</Label>
                    <Input 
                      id="reg-name" 
                      placeholder="Jean Dupont" 
                      value={registerData.name}
                      onChange={(e) => setRegisterData({...registerData, name: e.target.value})}
                      required
                    />
                  </div>
                  {!googleRegistration && (
                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Email *</Label>
                      <Input 
                        id="reg-email" 
                        type="email" 
                        placeholder="jean@example.com" 
                        value={registerData.email}
                        onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                        required
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="reg-phone">Téléphone *</Label>
                    <Input 
                      id="reg-phone" 
                      placeholder="+509..." 
                      value={registerData.phone}
                      onChange={(e) => setRegisterData({...registerData, phone: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-message">Pourquoi voulez-vous nous rejoindre ? (Optionnel)</Label>
                    <Textarea 
                      id="reg-message" 
                      placeholder="Parlez-nous de votre audience ou de votre motivation..." 
                      value={registerData.message}
                      onChange={(e) => setRegisterData({...registerData, message: e.target.value})}
                      rows={3}
                    />
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="submit" className="w-full bg-primary hover:bg-[#1D4ED8] border-0" disabled={registerLoading}>
                      {registerLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      <span>Envoyer ma demande</span>
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
