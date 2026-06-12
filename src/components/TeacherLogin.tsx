import React, { useState } from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Lock, User, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { toast } from 'sonner';
import { Teacher } from '../types';

interface TeacherLoginProps {
  onLoginSuccess: (teacher: Teacher) => void;
  onBack: () => void;
}

export default function TeacherLogin({ onLoginSuccess, onBack }: TeacherLoginProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !password) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erreur de connexion.');
        return;
      }
      toast.success(`Bienvenue, ${data.teacher.name} !`);
      onLoginSuccess(data.teacher);
    } catch {
      toast.error('Une erreur est survenue.');
    } finally {
      setLoading(false);
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
          <div className="h-3 bg-gradient-to-r from-violet-600 via-purple-500 to-indigo-600" />

          <CardHeader className="pt-8 pb-4 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
              <GraduationCap className="h-8 w-8 text-violet-600" />
            </div>
            <CardTitle className="text-2xl font-black text-dark">Espace Professeur</CardTitle>
            <CardDescription className="text-gray-500 font-medium pt-1">
              Connectez-vous pour gérer vos formations.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-10">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Nom</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="Votre nom"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-12 h-13 rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 h-13 rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-2xl shadow-lg shadow-violet-200 transition-all active:scale-[0.98] mt-4 border-0"
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Connexion...</>
                ) : (
                  'Se connecter'
                )}
              </Button>

              <button
                type="button"
                onClick={onBack}
                className="w-full flex items-center justify-center gap-2 text-sm font-bold text-gray-400 hover:text-violet-600 transition-colors mt-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour à l'accueil
              </button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
