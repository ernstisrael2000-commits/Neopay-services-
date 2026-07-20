import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, Diamond, TrendingUp, ShoppingCart, History, Loader2, AlertCircle, CheckCircle2, XCircle, ChevronRight, RefreshCw, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface FFPackage {
  id: string;
  label: string;
  diamonds: number;
  priceUSD: number;
  offerId: string;
  categoryId: string;
}

interface FFTransaction {
  id: string;
  playerId: string;
  region: string;
  packageLabel: string;
  diamonds: number;
  status: 'pending' | 'success' | 'failed';
  errorMessage?: string;
  fazerOrderId?: string;
  createdAt: any;
}

interface ResellerAccount {
  diamondBalance: number;
  totalSold: number;
  totalOrders: number;
  enabled: boolean;
}

interface Props {
  agentId: string;
  agentName: string;
}

function fmtTs(ts: any) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : ts?._seconds ? new Date(ts._seconds * 1000) : null;
  return d ? format(d, 'dd MMM yyyy HH:mm', { locale: fr }) : '—';
}

export default function FreeFireResellerSection({ agentId, agentName }: Props) {
  const [account, setAccount] = useState<ResellerAccount | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [transactions, setTransactions] = useState<FFTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [packages, setPackages] = useState<FFPackage[]>([]);
  const [regions, setRegions] = useState<string[]>(['LATAM']);
  const [orderOpen, setOrderOpen] = useState(false);
  const [ordering, setOrdering] = useState(false);

  // Order form state
  const [playerId, setPlayerId] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('LATAM');
  const [selectedPackage, setSelectedPackage] = useState<FFPackage | null>(null);
  const [loadingPackages, setLoadingPackages] = useState(false);

  const fetchAccount = useCallback(async () => {
    setLoadingAccount(true);
    try {
      const res = await fetch(`/api/reseller/ff/account?agentId=${encodeURIComponent(agentId)}`);
      const data = await res.json();
      setAccount(data.account || null);
    } catch { /* silent */ }
    finally { setLoadingAccount(false); }
  }, [agentId]);

  const fetchTransactions = useCallback(async () => {
    setLoadingTx(true);
    try {
      const res = await fetch(`/api/reseller/ff/transactions?agentId=${encodeURIComponent(agentId)}&limit=30`);
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch { /* silent */ }
    finally { setLoadingTx(false); }
  }, [agentId]);

  const fetchPackages = useCallback(async (region: string) => {
    setLoadingPackages(true);
    setSelectedPackage(null);
    try {
      const res = await fetch(`/api/reseller/ff/packages?region=${encodeURIComponent(region)}`);
      const data = await res.json();
      setPackages(data.items || []);
      if (data.regions?.length) setRegions(data.regions);
    } catch { setPackages([]); }
    finally { setLoadingPackages(false); }
  }, []);

  useEffect(() => { fetchAccount(); fetchTransactions(); }, [fetchAccount, fetchTransactions]);
  useEffect(() => { if (orderOpen) fetchPackages(selectedRegion); }, [orderOpen, selectedRegion, fetchPackages]);

  const handleOrder = async () => {
    if (!playerId.trim()) { toast.error('ID joueur requis.'); return; }
    if (!/^\d{5,15}$/.test(playerId.trim())) { toast.error("Format d'ID invalide (5 à 15 chiffres)."); return; }
    if (!selectedPackage) { toast.error('Sélectionnez un pack de diamants.'); return; }
    if (!account?.enabled) { toast.error("Compte revendeur désactivé."); return; }
    if ((account?.diamondBalance || 0) < selectedPackage.diamonds) {
      toast.error(`Crédit insuffisant. Disponible : ${account?.diamondBalance || 0} 💎`);
      return;
    }

    setOrdering(true);
    try {
      const res = await fetch('/api/reseller/ff/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          playerId: playerId.trim(),
          region: selectedRegion,
          offerId: selectedPackage.offerId,
          categoryId: selectedPackage.categoryId,
          diamonds: selectedPackage.diamonds,
          packageLabel: selectedPackage.label,
          priceUSD: selectedPackage.priceUSD,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Échec de la commande.');
        return;
      }
      toast.success(`✅ ${selectedPackage.label} envoyés au joueur ${playerId.trim()} !`);
      setOrderOpen(false);
      setPlayerId('');
      setSelectedPackage(null);
      fetchAccount();
      fetchTransactions();
    } catch { toast.error('Erreur réseau.'); }
    finally { setOrdering(false); }
  };

  const estimatedValue = (account?.diamondBalance || 0) * 0.01;

  if (loadingAccount) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!account) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-orange-100 rounded-2xl flex items-center justify-center">
            <Gamepad2 className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">Free Fire Revendeur</h2>
            <p className="text-xs text-slate-400">Module de revente de diamants</p>
          </div>
        </div>
        <Card className="border-0 shadow-sm rounded-3xl">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Compte non activé</h3>
              <p className="text-sm text-slate-400 mt-1">
                Votre accès au module Free Fire Revendeur n'est pas encore configuré.
                Contactez l'administrateur pour activer votre compte et recevoir du crédit diamant.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!account.enabled) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-orange-100 rounded-2xl flex items-center justify-center">
            <Gamepad2 className="h-5 w-5 text-orange-600" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Free Fire Revendeur</h2>
        </div>
        <Card className="border-0 shadow-sm rounded-3xl border-2 border-red-100">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h3 className="font-black text-red-700 text-base">Compte désactivé</h3>
              <p className="text-sm text-slate-400 mt-1">
                Votre compte revendeur Free Fire est temporairement désactivé. Contactez l'administrateur.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div key="free-fire" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-2xl flex items-center justify-center">
            <Gamepad2 className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">Free Fire Revendeur</h2>
            <p className="text-xs text-slate-400 font-medium">Revente de diamants</p>
          </div>
        </div>
        <button onClick={() => { fetchAccount(); fetchTransactions(); }} className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 text-white overflow-hidden">
          <CardContent className="p-5">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <span className="text-lg">💎</span>
            </div>
            <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">Crédit Diamants</p>
            <p className="text-3xl font-black mt-1">{(account.diamondBalance || 0).toLocaleString()}</p>
            <p className="text-white/60 text-xs font-bold mt-1">≈ ${estimatedValue.toFixed(2)} USD</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-3xl overflow-hidden">
          <CardContent className="p-5">
            <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center mb-3">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Total Vendus</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{(account.totalSold || 0).toLocaleString()}</p>
            <p className="text-slate-400 text-xs font-bold mt-1">{account.totalOrders || 0} commandes</p>
          </CardContent>
        </Card>
      </div>

      {/* Recharge button */}
      <Button
        onClick={() => setOrderOpen(true)}
        className="w-full h-14 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black uppercase tracking-widest text-[11px] border-0 shadow-lg shadow-orange-500/25 flex items-center gap-3"
      >
        <ShoppingCart className="h-5 w-5" />
        Recharger un joueur Free Fire
      </Button>

      {/* Transaction history */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-slate-900 font-bold flex items-center gap-2">
            <History className="h-4 w-4 text-slate-400" />
            Historique des transactions
          </h3>
          <button onClick={fetchTransactions} className="text-blue-600 text-xs font-bold">Actualiser</button>
        </div>

        {loadingTx ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : transactions.length === 0 ? (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-8 text-center">
              <History className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">Aucune transaction pour l'instant</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {transactions.map(tx => (
              <Card key={tx.id} className="border-0 shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        tx.status === 'success' ? 'bg-emerald-100' :
                        tx.status === 'failed' ? 'bg-red-100' : 'bg-amber-100'
                      }`}>
                        {tx.status === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> :
                         tx.status === 'failed' ? <XCircle className="h-5 w-5 text-red-500" /> :
                         <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 text-sm truncate">{tx.packageLabel}</p>
                        <p className="text-xs text-slate-400 font-medium">ID: {tx.playerId} · {tx.region}</p>
                        {tx.status === 'failed' && tx.errorMessage && (
                          <p className="text-xs text-red-500 font-medium mt-0.5 truncate">{tx.errorMessage}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-black ${
                        tx.status === 'success' ? 'text-emerald-600' :
                        tx.status === 'failed' ? 'text-red-500' : 'text-amber-500'
                      }`}>
                        {tx.status === 'success' ? `-${tx.diamonds} 💎` :
                         tx.status === 'failed' ? 'Échoué' : 'En attente'}
                      </span>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">{fmtTs(tx.createdAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Order dialog */}
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-0 p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogTitle className="font-black text-slate-900 flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-orange-500" />
              Recharger Free Fire
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              Crédit disponible : <span className="font-black text-orange-500">{(account.diamondBalance || 0).toLocaleString()} 💎</span>
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[60vh]">
            {/* Player ID */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">ID Joueur Free Fire *</Label>
              <Input
                value={playerId}
                onChange={e => setPlayerId(e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="Ex: 123456789"
                className="h-12 rounded-2xl bg-slate-50 border-0 font-black text-base"
                inputMode="numeric"
              />
              <p className="text-[10px] text-slate-400 font-medium">Chiffres uniquement (5–15 caractères)</p>
            </div>

            {/* Region */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Région *</Label>
              <Select value={selectedRegion} onValueChange={v => { setSelectedRegion(v); setSelectedPackage(null); }}>
                <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-0 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {regions.map(r => (
                    <SelectItem key={r} value={r} className="font-medium">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Packages */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pack de diamants *</Label>
              {loadingPackages ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
              ) : (
                <div className="space-y-2">
                  {packages.map(pkg => (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                        selectedPackage?.id === pkg.id
                          ? 'border-orange-400 bg-orange-50'
                          : 'border-slate-100 bg-slate-50 hover:border-orange-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">💎</span>
                        <div>
                          <p className="font-black text-slate-900 text-sm">{pkg.label}</p>
                          {pkg.priceUSD > 0 && <p className="text-xs text-slate-400 font-medium">${pkg.priceUSD.toFixed(2)} USD</p>}
                        </div>
                      </div>
                      {selectedPackage?.id === pkg.id && (
                        <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            {selectedPackage && (
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Résumé</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 font-medium">Joueur</span>
                  <span className="text-sm font-black text-slate-900">{playerId || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 font-medium">Région</span>
                  <span className="text-sm font-black text-slate-900">{selectedRegion}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 font-medium">Pack</span>
                  <span className="text-sm font-black text-orange-600">{selectedPackage.label}</span>
                </div>
                <div className="h-px bg-slate-200 my-1" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-black text-slate-700">Crédit déduit</span>
                  <span className="text-sm font-black text-red-500">-{selectedPackage.diamonds} 💎</span>
                </div>
                {(account.diamondBalance || 0) < selectedPackage.diamonds && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-2.5 mt-1">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-xs text-red-600 font-bold">Crédit insuffisant</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-6 pb-6 pt-4 border-t border-slate-100">
            <Button
              onClick={handleOrder}
              disabled={ordering || !playerId.trim() || !selectedPackage || (account.diamondBalance || 0) < (selectedPackage?.diamonds || 0)}
              className="w-full h-13 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black border-0 shadow-lg shadow-orange-500/20 uppercase tracking-widest text-[11px]"
            >
              {ordering ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Envoyer la recharge</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
