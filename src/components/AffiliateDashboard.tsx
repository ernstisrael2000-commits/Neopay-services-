import React, { useState } from 'react';
import { 
  useAffiliateData, 
  useTopAffiliates, 
  submitWithdrawal, 
  useAffiliateWithdrawals 
} from '../services/affiliateService';
import { Affiliate, WithdrawalRequest } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { 
  Wallet, 
  Users, 
  Trophy, 
  ArrowUpRight, 
  History, 
  LogOut,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSettings } from '../services/parcelService';

interface AffiliateDashboardProps {
  affiliateId: string;
  onLogout: () => void;
}

export default function AffiliateDashboard({ affiliateId, onLogout }: AffiliateDashboardProps) {
  const { affiliate, loading: affiliateLoading } = useAffiliateData(affiliateId);
  const { topAffiliates, loading: topLoading } = useTopAffiliates();
  const { withdrawals, loading: withdrawalsLoading } = useAffiliateWithdrawals(affiliateId);
  const { settings } = useSettings();

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'MonCash' | 'Natcash'>('MonCash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (affiliateLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!affiliate) return null;

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Veuillez entrer un montant valide.");
      return;
    }

    if (amount > affiliate.balance) {
      toast.error("Solde insuffisant.");
      return;
    }

    if (amount < 20) {
      toast.error("Le montant minimum est de 20 Goud.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitWithdrawal(affiliate, amount, withdrawMethod);
      toast.success("Demande de retrait envoyée !");
      setIsWithdrawModalOpen(false);
      setWithdrawAmount('');

      // Send WhatsApp notification to admin
      const adminPhone = settings?.whatsappAdminNumber || "+50944813185";
      const message = `Bonjour Admin, j'ai soumis une demande de retrait Neopay.\n\nMontant: ${amount} Goud\nMéthode: ${withdrawMethod}\nCode Affilié: ${affiliate.code}\nNom: ${affiliate.name}`;
      window.open(`https://wa.me/${adminPhone}?text=${encodeURIComponent(message)}`, '_blank');
      
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la demande.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-100 text-green-700 border-green-200">Approuvé</Badge>;
      case 'rejected': return <Badge className="bg-red-100 text-red-700 border-red-200">Rejeté</Badge>;
      default: return <Badge className="bg-amber-100 text-amber-700 border-amber-200">En attente</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord Affilié</h1>
          <p className="text-gray-500">Bienvenue, {affiliate.name} (Code: {affiliate.code})</p>
        </div>
        <Button variant="outline" onClick={onLogout} className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-blue-600 text-white border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Solde Actuel</CardTitle>
            <Wallet className="h-5 w-5 text-blue-200" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{affiliate.balance} Goud</div>
            <p className="text-blue-100 text-sm mt-1">Prêt pour retrait dès 20 Goud</p>
            
            <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
              <DialogTrigger 
                render={
                  <Button 
                    className="w-full mt-4 bg-white text-blue-600 hover:bg-blue-50 font-bold"
                    disabled={affiliate.balance < 20}
                  >
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    Demander un retrait
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Demande de Retrait</DialogTitle>
                  <DialogDescription>
                    Choisissez votre méthode et le montant à retirer.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Méthode de retrait</Label>
                    <Select 
                      value={withdrawMethod} 
                      onValueChange={(v: any) => setWithdrawMethod(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir une méthode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MonCash">MonCash</SelectItem>
                        <SelectItem value="Natcash">Natcash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Montant (Goud)</Label>
                    <Input 
                      type="number" 
                      placeholder="Ex: 50" 
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Maximum disponible: {affiliate.balance} Goud</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsWithdrawModalOpen(false)}>Annuler</Button>
                  <Button 
                    onClick={handleWithdraw} 
                    disabled={isSubmitting}
                    className="bg-blue-600"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer le retrait"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium text-gray-600">Clients Référés</CardTitle>
            <Users className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{affiliate.referredClients}</div>
            <p className="text-gray-500 text-sm mt-1">Total des clients utilisant votre code</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium text-gray-600">Votre Classement</CardTitle>
            <Trophy className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              #{topAffiliates.findIndex(a => a.id === affiliate.id) + 1 || 'N/A'}
            </div>
            <p className="text-gray-500 text-sm mt-1">Parmi les meilleurs affiliés</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Affiliates Ranking */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Top 10 Affiliés
            </CardTitle>
            <CardDescription>Les affiliés les plus performants de la plateforme.</CardDescription>
          </CardHeader>
          <CardContent>
            {topLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-4">
                {topAffiliates.map((a, idx) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'}`}>
                        {idx + 1}
                      </span>
                      <span className="font-medium">{a.name}</span>
                    </div>
                    <span className="text-sm text-gray-500 font-mono">{a.referredClients} réf.</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Withdrawal History */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              Historique des Retraits
            </CardTitle>
            <CardDescription>Suivez l'état de vos demandes de retrait.</CardDescription>
          </CardHeader>
          <CardContent>
            {withdrawalsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : withdrawals.length > 0 ? (
              <div className="space-y-4">
                {withdrawals.map((w) => (
                  <div key={w.id} className="p-4 rounded-xl border bg-white space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-lg">{w.amount} Goud</p>
                        <p className="text-xs text-gray-500">{w.method}</p>
                      </div>
                      {getStatusBadge(w.status)}
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span>{w.createdAt?.toDate ? format(w.createdAt.toDate(), 'PPp', { locale: fr }) : 'Date inconnue'}</span>
                    </div>
                    {w.status === 'rejected' && w.rejectionReason && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600 flex items-start gap-2">
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>Raison: {w.rejectionReason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <History className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Aucun retrait effectué pour le moment.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
