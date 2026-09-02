import { useState } from 'react';
import { ShieldCheck, UserRoundCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { completeClientIdentityName } from '../services/clientService';
import type { Client } from '../types';

interface IdentityNameGateProps {
  client: Client;
  onCompleted: (client: Client) => void;
}

export default function IdentityNameGate({ client, onCompleted }: IdentityNameGateProps) {
  const existingParts = String(client.name || '').trim().split(/\s+/).filter(Boolean);
  const [firstName, setFirstName] = useState(client.firstName || existingParts.shift() || '');
  const [lastName, setLastName] = useState(client.lastName || existingParts.join(' '));
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Votre prénom et votre nom sont obligatoires.');
      return;
    }
    setSaving(true);
    try {
      const updated = await completeClientIdentityName(firstName.trim(), lastName.trim());
      onCompleted(updated);
      toast.success('Votre identité de profil est enregistrée.');
    } catch (error: any) {
      toast.error(error?.message || 'Impossible d’enregistrer votre identité.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open>
      <DialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        className="max-w-md overflow-hidden rounded-[2rem] border-0 p-0 shadow-2xl"
      >
        <div className="bg-gradient-to-br from-[#126f9e] to-[#154965] px-6 py-7 text-white">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <UserRoundCheck className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl font-black text-white">Confirmez votre identité</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-white/75">
            Indiquez votre prénom et votre nom officiels. Ils seront protégés côté serveur et utilisés pour sécuriser vos futurs services financiers.
          </DialogDescription>
        </div>

        <form onSubmit={submit} className="space-y-5 bg-white p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="identity-first-name" className="text-xs font-black uppercase tracking-wider text-slate-500">Prénom officiel</Label>
              <Input id="identity-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name" maxLength={80} placeholder="Votre prénom" className="h-12 rounded-xl" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="identity-last-name" className="text-xs font-black uppercase tracking-wider text-slate-500">Nom officiel</Label>
              <Input id="identity-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name" maxLength={80} placeholder="Votre nom" className="h-12 rounded-xl" required />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-xs leading-5">
              Une empreinte HMAC-SHA256 est calculée uniquement sur le serveur. Votre adresse e-mail n’est jamais utilisée pour comparer le titulaire d’une carte.
            </p>
          </div>

          <Button type="submit" disabled={saving} className="h-12 w-full rounded-xl bg-[#1478a7] font-black text-white hover:bg-[#11678f]">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enregistrer et continuer'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}