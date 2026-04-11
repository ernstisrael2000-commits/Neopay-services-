import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { loginAffiliate, submitAffiliateRequest } from '../services/affiliateService';
import { toast } from 'sonner';
import { Loader2, Lock, UserPlus, CheckCircle2 } from 'lucide-react';
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

interface AffiliateLoginProps {
  onLogin: (affiliate: Affiliate) => void;
}

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.name || !registerData.email || !registerData.phone) {
      toast.error("Veuillez remplir les champs obligatoires.");
      return;
    }

    setRegisterLoading(true);
    try {
      await submitAffiliateRequest(registerData);
      
      // Send notifications via backend
      try {
        await fetch('/api/notify-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...registerData,
            date: new Date().toLocaleString('fr-FR')
          })
        });
      } catch (notifyError) {
        console.error("Failed to send notification:", notifyError);
      }

      setIsRegisterOpen(false);
      // Small delay before toast and reset to avoid DOM conflicts during unmount
      setTimeout(() => {
        toast.success("Demande d'inscription envoyée ! Nous vous contacterons bientôt.");
        setRegisterData({ name: '', email: '', phone: '', message: '' });
      }, 100);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'envoi de la demande.");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Trim whitespace from credentials
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      toast.error("Veuillez remplir tous les champs.");
      return;
    }

    setLoading(true);
    try {
      const affiliate = await loginAffiliate(cleanUsername, cleanPassword);
      if (affiliate) {
        toast.success(`Bienvenue, ${affiliate.name} !`);
        onLogin(affiliate);
      } else {
        toast.error("Identifiants incorrects.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Une erreur est survenue lors de la connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 px-4">
      <Card className="shadow-xl border-0">
        <CardHeader className="text-center space-y-2">
          <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Espace Affilié</CardTitle>
          <CardDescription>
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
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-lg font-semibold"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Se connecter"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            Identifiants fournis par l'administrateur Neopay.
          </p>

          <div className="mt-8 pt-6 border-t text-center">
            <p className="text-gray-600 mb-4">Vous n'avez pas de compte ?</p>
            <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
              <DialogTrigger 
                render={
                  <Button variant="outline" className="w-full border-blue-200 text-blue-600 hover:bg-blue-50">
                    <UserPlus className="h-4 w-4 mr-2" />
                    S'inscrire comme affilié
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Devenir Affilié Neopay</DialogTitle>
                  <DialogDescription>
                    Remplissez ce formulaire pour soumettre votre demande d'adhésion.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleRegister} className="space-y-4 py-4">
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
                  <div className="grid grid-cols-2 gap-4">
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
                    <Button type="submit" className="w-full bg-blue-600" disabled={registerLoading}>
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
