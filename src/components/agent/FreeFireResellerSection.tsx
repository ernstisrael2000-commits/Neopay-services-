import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gamepad2, Diamond, TrendingUp, ShoppingCart, History, Loader2,
  CheckCircle2, XCircle, RefreshCw, Send, ChevronRight, Wallet,
  Clock, AlertCircle, Flame, Star, Zap, PackagePlus,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── Types ──────────────────────────────────────────────────────────────────────
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
  errorMessage?: string | null;
  fazerOrderId?: string | null;
  createdAt: any;
}

interface ResellerAccount {
  diamondBalance: number;
  totalSold: number;
  totalOrders: number;
  enabled: boolean;
}

interface CreditPack {
  id: string;
  label: string;
  diamonds: number;
  priceUSD: number;
}

interface Props {
  agentId: string;
  agentName: string;
  agentBalance?: number;
}

const FF_REGIONS = ['LATAM', 'Brésil', 'Europe', 'Indonésie', 'Thaïlande', 'Vietnam', 'MY/SG', 'Philippines', 'Bangladesh', 'Pakistan', 'Taiwan', 'CIS', 'MENA'];

function fmtTs(ts: any): string {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : ts?._seconds ? new Date(ts._seconds * 1000) : null;
  return d ? format(d, 'dd MMM yyyy · HH:mm', { locale: fr }) : '—';
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'success')
    return <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">✓ Succès</span>;
  if (status === 'failed')
    return <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full">✕ Échoué</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⏳ En cours</span>;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function FreeFireResellerSection({ agentId, agentName, agentBalance = 0 }: Props) {
  const [account, setAccount] = useState<ResellerAccount | null>(null);
  const [initialising, setInitialising] = useState(true);
  const [transactions, setTransactions] = useState<FFTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [packages, setPackages] = useState<FFPackage[]>([]);
  const [regions] = useState<string[]>(FF_REGIONS);
  const [orderOpen, setOrderOpen] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('LATAM');
  const [selectedPkg, setSelectedPkg] = useState<FFPackage | null>(null);
  const [loadingPkgs, setLoadingPkgs] = useState(false);
  const initCalled = useRef(false);

  // ── Credit packs (buy with wallet balance) ───────────────────────────────────
  const [creditPacks, setCreditPacks] = useState<CreditPack[]>([]);
  const [loadingCreditPacks, setLoadingCreditPacks] = useState(false);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [buyPackOpen, setBuyPackOpen] = useState(false);

  // ── Player ID lookup ──────────────────────────────────────────────────────────
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [lookingUpPlayer, setLookingUpPlayer] = useState(false);
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-init account on mount
  const ensureAccount = useCallback(async () => {
    if (initCalled.current) return;
    initCalled.current = true;
    setInitialising(true);
    try {
      const res = await fetch('/api/reseller/ff/ensure-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, agentName }),
      });
      const data = await res.json();
      setAccount(data.account || null);
    } catch { /* silent */ }
    finally { setInitialising(false); }
  }, [agentId, agentName]);

  const refreshAccount = useCallback(async () => {
    try {
      const res = await fetch(`/api/reseller/ff/account?agentId=${encodeURIComponent(agentId)}`);
      const data = await res.json();
      if (data.account) setAccount(data.account);
    } catch { /* silent */ }
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
    setLoadingPkgs(true);
    setSelectedPkg(null);
    try {
      const res = await fetch(`/api/reseller/ff/packages?region=${encodeURIComponent(region)}`);
      const data = await res.json();
      setPackages(data.items || []);
    } catch { setPackages([]); }
    finally { setLoadingPkgs(false); }
  }, []);

  const fetchCreditPacks = useCallback(async () => {
    setLoadingCreditPacks(true);
    try {
      const res = await fetch('/api/reseller/ff/credit-packs');
      const data = await res.json();
      setCreditPacks(data.packs || []);
    } catch { /* silent */ }
    finally { setLoadingCreditPacks(false); }
  }, []);

  const handleBuyPack = async (pack: CreditPack) => {
    if (agentBalance < pack.priceUSD) {
      toast.error('Solde insuffisant.');
      return;
    }
    setBuyingPackId(pack.id);
    try {
      const res = await fetch('/api/reseller/ff/buy-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, packId: pack.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Échec de l\'achat.');
        return;
      }
      toast.success(`✅ +${pack.diamonds.toLocaleString()} 💎 ajoutés à votre compte !`);
      setBuyPackOpen(false);
      refreshAccount();
    } catch { toast.error('Erreur réseau.'); }
    finally { setBuyingPackId(null); }
  };

  useEffect(() => { ensureAccount(); fetchTransactions(); fetchCreditPacks(); }, [ensureAccount, fetchTransactions, fetchCreditPacks]);
  useEffect(() => { if (orderOpen) fetchPackages(selectedRegion); }, [orderOpen, selectedRegion, fetchPackages]);

  // Debounced player name lookup
  useEffect(() => {
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    const pid = playerId.trim();
    if (!/^\d{5,15}$/.test(pid)) {
      setPlayerName(null);
      setLookingUpPlayer(false);
      return;
    }
    setPlayerName(null);
    setLookingUpPlayer(true);
    lookupTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/fazer/topups/validate-id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category_id: 'free_fire', fields: { player_id: pid } }),
        });
        const data = await res.json();
        if (res.ok && data.valid !== false) {
          setPlayerName(data.username || null);
        } else {
          setPlayerName(null);
        }
      } catch { setPlayerName(null); }
      finally { setLookingUpPlayer(false); }
    }, 700);
    return () => { if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current); };
  }, [playerId]);

  const handleOrder = async () => {
    const pid = playerId.trim();
    if (!pid) { toast.error('Entrez l\'ID du joueur.'); return; }
    if (!/^\d{5,15}$/.test(pid)) { toast.error('ID invalide — chiffres uniquement (5–15 caractères).'); return; }
    if (!selectedPkg) { toast.error('Sélectionnez un pack.'); return; }
    if ((account?.diamondBalance || 0) < selectedPkg.diamonds) {
      toast.error(`Crédit insuffisant — disponible : ${(account?.diamondBalance || 0).toLocaleString()} 💎`); return;
    }
    setOrdering(true);
    try {
      const res = await fetch('/api/reseller/ff/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId, playerId: pid, region: selectedRegion,
          offerId: selectedPkg.offerId, categoryId: selectedPkg.categoryId,
          diamonds: selectedPkg.diamonds, packageLabel: selectedPkg.label,
          priceUSD: selectedPkg.priceUSD,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Échec de la commande.'); return; }
      toast.success(`✅ ${selectedPkg.label} envoyés au joueur ${pid} !`);
      setOrderOpen(false);
      setPlayerId('');
      setSelectedPkg(null);
      refreshAccount();
      fetchTransactions();
    } catch { toast.error('Erreur réseau.'); }
    finally { setOrdering(false); }
  };

  // ── Initialisation screen ─────────────────────────────────────────────────
  if (initialising) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 bg-orange-100 rounded-3xl flex items-center justify-center animate-pulse">
          <Gamepad2 className="h-8 w-8 text-orange-500" />
        </div>
        <p className="text-slate-500 font-medium text-sm">Chargement du module Free Fire…</p>
      </div>
    );
  }

  const balance = account?.diamondBalance || 0;
  const totalSold = account?.totalSold || 0;
  const totalOrders = account?.totalOrders || 0;
  const estimatedValue = (balance * 0.01).toFixed(2);
  const successRate = totalOrders > 0 ? Math.round((totalOrders / totalOrders) * 100) : 100;
  const recentSuccesses = transactions.filter(t => t.status === 'success').length;

  return (
    <>
      {/* ── Full-page layout ─────────────────────────────────────────────── */}
      <motion.div
        key="ff-reseller"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-[#F8FAFC] -mx-4 -mt-4"
      >

        {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#FF6B00] via-[#FF8C00] to-[#FFB347] px-6 pt-10 pb-20">
          {/* Background decorations */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-8 right-8 opacity-20">
            <Gamepad2 className="h-24 w-24 text-white" />
          </div>

          {/* Header */}
          <div className="relative flex items-center justify-between mb-8">
            <div>
              <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Module Revendeur</p>
              <h1 className="text-2xl font-black text-white">Free Fire 💎</h1>
            </div>
            <button
              onClick={() => { refreshAccount(); fetchTransactions(); }}
              className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-white active:scale-90 transition-transform"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Balance card */}
          <div className="relative bg-white/15 backdrop-blur-sm rounded-3xl p-6 border border-white/20">
            <p className="text-white/70 text-[11px] font-black uppercase tracking-widest mb-2">Crédit disponible</p>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black text-white leading-none">{balance.toLocaleString()}</span>
              <span className="text-2xl mb-1">💎</span>
            </div>
            <p className="text-white/50 text-xs font-bold mt-2">≈ ${estimatedValue} USD estimé</p>

            {/* Status pill */}
            <div className="absolute top-4 right-4">
              {account?.enabled !== false ? (
                <span className="flex items-center gap-1.5 bg-emerald-400/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black rounded-full px-3 py-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Actif
                </span>
              ) : (
                <span className="flex items-center gap-1.5 bg-red-400/20 border border-red-400/30 text-red-300 text-[10px] font-black rounded-full px-3 py-1">
                  Désactivé
                </span>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="relative grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Total vendus', value: `${totalSold.toLocaleString()} 💎`, icon: <TrendingUp className="h-4 w-4" /> },
              { label: 'Commandes', value: totalOrders.toString(), icon: <ShoppingCart className="h-4 w-4" /> },
              { label: 'Succès', value: `${recentSuccesses}`, icon: <CheckCircle2 className="h-4 w-4" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-white/10 border border-white/15 rounded-2xl p-3 text-center">
                <div className="flex justify-center text-white/50 mb-1">{icon}</div>
                <p className="text-white font-black text-sm">{value}</p>
                <p className="text-white/50 text-[9px] font-black uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CONTENT PANEL (overlapping hero) ───────────────────────────── */}
        <div className="relative -mt-10 px-4 space-y-4 pb-28">

          {/* CTA Button */}
          {account?.enabled !== false ? (
            <button
              onClick={() => setOrderOpen(true)}
              className="w-full bg-white rounded-3xl shadow-xl shadow-orange-500/15 p-5 flex items-center gap-4 active:scale-[.98] transition-transform text-left border border-orange-100"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-400 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-400/30">
                <Zap className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-black text-slate-900 text-base">Recharger un joueur</p>
                <p className="text-slate-400 text-sm font-medium">Envoyer des diamants maintenant</p>
              </div>
              <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">
                <ChevronRight className="h-5 w-5" />
              </div>
            </button>
          ) : (
            <div className="w-full bg-white rounded-3xl shadow-sm p-5 flex items-center gap-4 border border-red-100 opacity-60">
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center shrink-0">
                <XCircle className="h-7 w-7 text-red-400" />
              </div>
              <div>
                <p className="font-black text-slate-900 text-base">Compte désactivé</p>
                <p className="text-slate-400 text-sm font-medium">Contactez l'administrateur</p>
              </div>
            </div>
          )}

          {/* Buy credit packs button */}
          <button
            onClick={() => setBuyPackOpen(true)}
            className="w-full bg-white rounded-3xl shadow-xl shadow-blue-500/10 p-5 flex items-center gap-4 active:scale-[.98] transition-transform text-left border border-blue-100"
          >
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-400/30">
              <PackagePlus className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-black text-slate-900 text-base">Acheter des parts</p>
              <p className="text-slate-400 text-sm font-medium">
                Solde disponible : <span className="font-black text-slate-700">${agentBalance.toFixed(2)}</span>
              </p>
            </div>
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
              <ChevronRight className="h-5 w-5" />
            </div>
          </button>

          {/* Balance info card */}
          {balance === 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-3xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-black text-amber-800 text-sm">Crédit à zéro</p>
                <p className="text-amber-600 text-xs font-medium mt-0.5 leading-relaxed">
                  Achetez des parts ci-dessus pour créditer votre compte en diamants.
                </p>
              </div>
            </div>
          )}

          {/* Transaction History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-slate-900 font-black text-base flex items-center gap-2">
                <History className="h-4 w-4 text-slate-400" />
                Dernières transactions
              </h2>
              <button
                onClick={fetchTransactions}
                className="text-orange-500 text-xs font-black uppercase tracking-widest"
              >
                Actualiser
              </button>
            </div>

            {loadingTx ? (
              <div className="bg-white rounded-3xl shadow-sm p-10 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm p-10 text-center">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <History className="h-7 w-7 text-slate-200" />
                </div>
                <p className="text-slate-400 font-bold text-sm">Aucune transaction</p>
                <p className="text-slate-300 text-xs font-medium mt-1">Vos recharges apparaîtront ici</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {transactions.map((tx, i) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="bg-white rounded-2xl shadow-sm border border-slate-50 overflow-hidden"
                    >
                      <div className="p-4 flex items-center gap-3">
                        {/* Icon */}
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                          tx.status === 'success' ? 'bg-emerald-50' :
                          tx.status === 'failed' ? 'bg-red-50' : 'bg-amber-50'
                        }`}>
                          {tx.status === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> :
                           tx.status === 'failed' ? <XCircle className="h-5 w-5 text-red-400" /> :
                           <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-slate-900 text-sm truncate">{tx.packageLabel}</p>
                            <StatusBadge status={tx.status} />
                          </div>
                          <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">
                            ID {tx.playerId} · {tx.region}
                          </p>
                          {tx.status === 'failed' && tx.errorMessage && (
                            <p className="text-xs text-red-400 font-medium mt-0.5 truncate">{tx.errorMessage}</p>
                          )}
                        </div>

                        {/* Diamond deduction */}
                        <div className="text-right shrink-0">
                          <p className={`font-black text-sm ${
                            tx.status === 'success' ? 'text-slate-700' :
                            tx.status === 'failed' ? 'text-red-400' : 'text-amber-500'
                          }`}>
                            {tx.status === 'success' ? `-${tx.diamonds.toLocaleString()} 💎` :
                             tx.status === 'failed' ? '—' : '…'}
                          </p>
                          <p className="text-[10px] text-slate-300 font-medium">{fmtTs(tx.createdAt)}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── ORDER DIALOG ────────────────────────────────────────────────────── */}
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-0 p-0 overflow-hidden shadow-2xl bg-white">
          {/* Dialog header with gradient */}
          <div className="bg-gradient-to-br from-orange-500 to-amber-400 px-6 pt-6 pb-5">
            <DialogHeader>
              <DialogTitle className="text-white font-black text-lg flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Recharger Free Fire
              </DialogTitle>
              <DialogDescription className="text-white/60 text-sm mt-0.5">
                Crédit : <span className="font-black text-white">{balance.toLocaleString()} 💎</span>
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[55vh]">
            {/* Player ID */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">ID Joueur *</Label>
              <div className="relative">
                <Input
                  value={playerId}
                  onChange={e => { setPlayerId(e.target.value.replace(/\D/g, '').slice(0, 15)); }}
                  placeholder="Ex : 123456789"
                  className="h-12 rounded-2xl bg-slate-50 border-0 font-black text-base placeholder:font-normal pr-10"
                  inputMode="numeric"
                  autoFocus
                />
                {lookingUpPlayer && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                )}
                {!lookingUpPlayer && playerName && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                )}
              </div>
              {lookingUpPlayer ? (
                <p className="text-[10px] text-slate-400 font-medium animate-pulse">Recherche du joueur…</p>
              ) : playerName ? (
                <p className="text-[10px] font-black text-emerald-600 flex items-center gap-1">
                  ✓ <span>{playerName}</span>
                </p>
              ) : playerId.length >= 5 && !lookingUpPlayer ? (
                <p className="text-[10px] text-amber-500 font-medium">Joueur non trouvé — vérifiez l'ID et la région</p>
              ) : (
                <p className="text-[10px] text-slate-300 font-medium">Chiffres uniquement · 5 à 15 caractères</p>
              )}
            </div>

            {/* Region */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Région du joueur *</Label>
              <Select value={selectedRegion} onValueChange={v => { setSelectedRegion(v); setSelectedPkg(null); }}>
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
              {loadingPkgs ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
              ) : packages.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-4">Aucun pack disponible pour cette région.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {packages.map(pkg => {
                    const canAfford = balance >= pkg.diamonds;
                    const selected = selectedPkg?.id === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        onClick={() => canAfford && setSelectedPkg(pkg)}
                        disabled={!canAfford}
                        className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all text-center ${
                          selected
                            ? 'border-orange-400 bg-orange-50 shadow-sm'
                            : canAfford
                              ? 'border-slate-100 bg-slate-50 hover:border-orange-200 active:scale-95'
                              : 'border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed'
                        }`}
                      >
                        <span className="text-2xl">💎</span>
                        <p className={`font-black text-xs ${selected ? 'text-orange-600' : 'text-slate-800'}`}>{pkg.label}</p>
                        {pkg.priceUSD > 0 && <p className="text-[10px] text-slate-400 font-medium">${pkg.priceUSD.toFixed(2)}</p>}
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
                            <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary */}
            <AnimatePresence>
              {selectedPkg && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Récapitulatif</p>
                    {[
                      ['Joueur', playerId || '—'],
                      ['Région', selectedRegion],
                      ['Pack', selectedPkg.label],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-xs text-slate-500 font-medium">{k}</span>
                        <span className="text-xs font-black text-slate-800">{v}</span>
                      </div>
                    ))}
                    <div className="h-px bg-orange-100 my-1" />
                    <div className="flex justify-between">
                      <span className="text-xs font-black text-slate-700">Crédit déduit</span>
                      <span className="text-xs font-black text-orange-600">−{selectedPkg.diamonds.toLocaleString()} 💎</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs font-medium text-slate-400">Nouveau solde</span>
                      <span className="text-xs font-black text-slate-700">{(balance - selectedPkg.diamonds).toLocaleString()} 💎</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer CTA */}
          <div className="px-6 pb-6">
            <Button
              onClick={handleOrder}
              disabled={ordering || !playerId.trim() || !selectedPkg || balance < (selectedPkg?.diamonds || 0)}
              className="w-full h-13 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-white font-black border-0 shadow-lg shadow-orange-500/25 uppercase tracking-widest text-[11px] disabled:opacity-40"
            >
              {ordering
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Envoi en cours…</>
                : <><Send className="h-4 w-4 mr-2" />Envoyer la recharge</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── BUY PACK DIALOG ─────────────────────────────────────────────────── */}
      <Dialog open={buyPackOpen} onOpenChange={setBuyPackOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-0 p-0 overflow-hidden shadow-2xl bg-white">
          {/* Header */}
          <div className="bg-gradient-to-br from-blue-500 to-indigo-500 px-6 pt-6 pb-5">
            <DialogHeader>
              <DialogTitle className="text-white font-black text-lg flex items-center gap-2">
                <PackagePlus className="h-5 w-5" />
                Acheter des parts
              </DialogTitle>
              <DialogDescription className="text-white/60 text-sm mt-0.5">
                Votre solde : <span className="font-black text-white">${agentBalance.toFixed(2)}</span>
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[60vh]">
            {loadingCreditPacks ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
              </div>
            ) : creditPacks.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6">Aucun pack disponible.</p>
            ) : (
              <div className="space-y-3">
                {creditPacks.map(pack => {
                  const canAfford = agentBalance >= pack.priceUSD;
                  const isBuying = buyingPackId === pack.id;
                  return (
                    <div
                      key={pack.id}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                        canAfford ? 'border-slate-100 bg-slate-50' : 'border-slate-100 bg-slate-50 opacity-60'
                      }`}
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center shrink-0 text-xl">
                        💎
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 text-sm">{pack.label}</p>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          {pack.diamonds.toLocaleString()} diamants
                        </p>
                        <p className="text-xs font-black text-blue-600 mt-0.5">${pack.priceUSD.toFixed(2)}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleBuyPack(pack)}
                        disabled={isBuying || !!buyingPackId}
                        className={`rounded-xl h-9 px-4 text-xs font-black border-0 shadow-sm shrink-0 ${
                          canAfford
                            ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20'
                            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isBuying ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : canAfford ? (
                          'Acheter'
                        ) : (
                          'Solde insuffisant'
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
