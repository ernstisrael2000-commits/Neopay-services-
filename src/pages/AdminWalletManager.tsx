import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Settings, Smartphone, Bitcoin, Building2, Globe, CreditCard,
  CheckCircle2, XCircle, Clock, ArrowDownToLine, ArrowUpFromLine, ShoppingBag,
  TrendingUp, Users, Wallet, Save, Plus, Trash2, Edit2, X, ToggleLeft, ToggleRight,
  Loader2, RefreshCw, Filter, Search, ChevronDown, Info, AlertTriangle, History, Download
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { updateSettings } from '../services/parcelService';
import { useSettingsCtx } from '../contexts/SettingsContext';
import { useAllClientTransactions, useAllClients } from '../services/clientService';
import { PaymentMethod, PaymentMethodType, DEFAULT_PAYMENT_METHODS, ClientTransaction } from '../types';
import { motion } from 'motion/react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_TYPE_OPTIONS: { value: PaymentMethodType; label: string; icon: React.ReactNode }[] = [
  { value: 'mobile_money', label: 'Mobile Money', icon: <Smartphone className="h-4 w-4" /> },
  { value: 'payment_app', label: 'App de paiement', icon: <Globe className="h-4 w-4" /> },
  { value: 'crypto', label: 'Crypto', icon: <Bitcoin className="h-4 w-4" /> },
  { value: 'bank_transfer', label: 'Virement bancaire', icon: <Building2 className="h-4 w-4" /> },
  { value: 'card', label: 'Carte bancaire', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'cash', label: 'Espèces', icon: <DollarSign className="h-4 w-4" /> },
];

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <Card className="border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black text-subtext uppercase tracking-widest">{label}</p>
            <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`p-3 rounded-2xl bg-gray-50 ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Payment Method Form ───────────────────────────────────────────────────────

function MethodDialog({
  method, onSave, onClose
}: { method: Partial<PaymentMethod> | null; onSave: (m: PaymentMethod) => void; onClose: () => void }) {
  const isNew = !method?.id || DEFAULT_PAYMENT_METHODS.some(d => d.id === method?.id && !method?.name);
  const [form, setForm] = useState<Partial<PaymentMethod>>(method || {
    id: `custom_${Date.now()}`, name: '', type: 'mobile_money', icon: '💳',
    enabled: true, forDeposit: true, forWithdrawal: true,
  });

  const set = (k: keyof PaymentMethod, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name?.trim()) { toast.error("Nom requis."); return; }
    if (!form.id) { toast.error("ID requis."); return; }
    onSave(form as PaymentMethod);
  };

  return (
    <DialogContent className="max-w-md rounded-2xl">
      <DialogHeader>
        <DialogTitle className="font-black text-dark">
          {isNew ? 'Nouvelle méthode' : `Modifier ${form.name}`}
        </DialogTitle>
        <DialogDescription className="text-xs text-subtext">
          Configurez les détails de cette méthode de paiement.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
        {/* Basic info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">Emoji / Icône</Label>
            <Input value={form.icon || ''} onChange={e => set('icon', e.target.value)}
              placeholder="💳" className="h-10 rounded-xl text-xl text-center" maxLength={4} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">Nom</Label>
            <Input value={form.name || ''} onChange={e => set('name', e.target.value)}
              placeholder="MonCash" className="h-10 rounded-xl" required />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">Type</Label>
          <Select value={form.type} onValueChange={v => set('type', v as PaymentMethodType)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {METHOD_TYPE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  <div className="flex items-center gap-2">{o.icon}{o.label}</div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: 'enabled', label: 'Activée' },
            { key: 'forDeposit', label: 'Dépôt' },
            { key: 'forWithdrawal', label: 'Retrait' },
          ] as const).map(({ key, label }) => (
            <button key={key} type="button" onClick={() => set(key, !form[key])}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all ${form[key] ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-gray-400'}`}>
              {form[key] ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              <span className="text-[10px] font-black">{label}</span>
            </button>
          ))}
        </div>

        {/* Contact / Address */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">Numéro de compte</Label>
            <Input value={form.number || ''} onChange={e => set('number', e.target.value)}
              placeholder="Ex: +509 XXXX XXXX" className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">Nom du compte</Label>
            <Input value={form.accountName || ''} onChange={e => set('accountName', e.target.value)}
              placeholder="Nom du bénéficiaire" className="h-10 rounded-xl" />
          </div>
          {(form.type === 'crypto' || form.type === 'payment_app') && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">Adresse / Email</Label>
              <Input value={form.address || ''} onChange={e => set('address', e.target.value)}
                placeholder="0x... ou email@exemple.com" className="h-10 rounded-xl font-mono text-xs" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">URL QR Code</Label>
            <Input value={form.qrUrl || ''} onChange={e => set('qrUrl', e.target.value)}
              placeholder="https://..." className="h-10 rounded-xl text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">Instructions</Label>
            <textarea value={form.instructions || ''} onChange={e => set('instructions', e.target.value)}
              placeholder="Instructions spécifiques pour l'utilisateur..."
              className="w-full min-h-[60px] px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>

        {/* Limits */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">Min USD</Label>
            <Input type="number" value={form.minAmountUSD || ''} onChange={e => set('minAmountUSD', parseFloat(e.target.value) || undefined)}
              placeholder="0.01" className="h-10 rounded-xl" min="0" step="0.01" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">Max USD</Label>
            <Input type="number" value={form.maxAmountUSD || ''} onChange={e => set('maxAmountUSD', parseFloat(e.target.value) || undefined)}
              placeholder="10000" className="h-10 rounded-xl" min="0" step="0.01" />
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">Annuler</Button>
        <Button onClick={handleSave} className="flex-1 rounded-xl bg-primary text-white font-black">
          <Save className="h-4 w-4 mr-1" />Enregistrer
        </Button>
      </div>
    </DialogContent>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminWalletManager() {
  const { settings, loading: settingsLoading } = useSettingsCtx();
  const { transactions, loading: txLoading } = useAllClientTransactions();
  const { clients } = useAllClients();

  const [isSaving, setIsSaving] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [minDepositInput, setMinDepositInput] = useState('');
  const [maxDepositInput, setMaxDepositInput] = useState('');
  const [minWithdrawInput, setMinWithdrawInput] = useState('');
  const [maxWithdrawInput, setMaxWithdrawInput] = useState('');
  const [cardRatesInput, setCardRatesInput] = useState<Record<string, string>>({});
  const [isSavingCardRates, setIsSavingCardRates] = useState(false);

  // Payment methods state
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodsChanged, setMethodsChanged] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null | 'new'>(null);

  // Transaction filters
  const [txSearch, setTxSearch] = useState('');
  const [txType, setTxType] = useState('all');
  const [txStatus, setTxStatus] = useState('all');
  const [txMethod, setTxMethod] = useState('all');
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (settings) {
      setRateInput(String(settings.exchangeRate || 135));
      setMinDepositInput(String(settings.minDepositUSD || 0.01));
      setMaxDepositInput(String(settings.maxDepositUSD || 10000));
      setMinWithdrawInput(String(settings.minWithdrawalUSD || 0.01));
      setMaxWithdrawInput(String(settings.maxWithdrawalUSD || 10000));
      const m = settings.paymentMethods;
      if (m && m.length > 0) {
        setMethods(m);
      } else {
        setMethods(DEFAULT_PAYMENT_METHODS);
      }
      // Load per-method custom rates
      const cr = (settings as any).cardRates as Record<string, number> | undefined;
      if (cr) {
        const asStrings: Record<string, string> = {};
        for (const [k, v] of Object.entries(cr)) asStrings[k] = String(v);
        setCardRatesInput(asStrings);
      }
    }
  }, [settings]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const rate = settings?.exchangeRate || 135;
    const deposits = transactions.filter(t => t.type === 'deposit');
    const withdrawals = transactions.filter(t => t.type === 'withdrawal');
    const purchases = transactions.filter(t => t.type === 'purchase');

    const totalDeposited = deposits.filter(t => t.status === 'approved' || t.status === 'completed')
      .reduce((s, t) => s + (t.usdAmount ?? t.amount), 0);
    const totalWithdrawn = withdrawals.filter(t => t.status === 'approved' || t.status === 'completed')
      .reduce((s, t) => s + (t.usdAmount ?? t.amount), 0);
    const totalSpent = purchases.filter(t => t.status === 'completed')
      .reduce((s, t) => s + (t.usdAmount ?? t.amount), 0);
    const totalBalance = clients.reduce((s, c) => s + (c.balance || 0), 0);
    const activeWallets = clients.filter(c => (c.balance || 0) > 0).length;
    const pendingDeposits = deposits.filter(t => t.status === 'pending').length;
    const pendingWithdrawals = withdrawals.filter(t => t.status === 'pending').length;

    return { totalDeposited, totalWithdrawn, totalSpent, totalBalance, activeWallets, pendingDeposits, pendingWithdrawals, rate };
  }, [transactions, clients, settings]);

  // ── Save rate ─────────────────────────────────────────────────────────────────
  const saveRate = async () => {
    const r = parseFloat(rateInput);
    if (isNaN(r) || r <= 0) { toast.error("Taux invalide."); return; }
    setIsSaving(true);
    try {
      await updateSettings({
        exchangeRate: r,
        minDepositUSD: parseFloat(minDepositInput) || 0.01,
        maxDepositUSD: parseFloat(maxDepositInput) || 10000,
        minWithdrawalUSD: parseFloat(minWithdrawInput) || 0.01,
        maxWithdrawalUSD: parseFloat(maxWithdrawInput) || 10000,
      } as any);
      toast.success("Paramètres de conversion sauvegardés !");
      setEditingRate(false);
    } catch { toast.error("Erreur lors de la sauvegarde."); }
    finally { setIsSaving(false); }
  };

  // ── Save per-method card rates ────────────────────────────────────────────────
  const saveCardRates = async () => {
    setIsSavingCardRates(true);
    try {
      const cardRates: Record<string, number> = {};
      for (const [id, val] of Object.entries(cardRatesInput)) {
        const n = parseFloat(val);
        if (!isNaN(n) && n > 0) cardRates[id] = n;
      }
      await updateSettings({ cardRates } as any);
      toast.success('Taux personnalisés sauvegardés !');
    } catch { toast.error('Erreur lors de la sauvegarde.'); }
    finally { setIsSavingCardRates(false); }
  };

  // ── Save methods ──────────────────────────────────────────────────────────────
  const saveMethodsToServer = async (updatedMethods: PaymentMethod[]) => {
    setIsSaving(true);
    try {
      await updateSettings({ paymentMethods: updatedMethods } as any);
      toast.success("Méthodes de paiement sauvegardées !");
      setMethodsChanged(false);
    } catch { toast.error("Erreur lors de la sauvegarde."); }
    finally { setIsSaving(false); }
  };

  const toggleMethod = (id: string) => {
    const updated = methods.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m);
    setMethods(updated);
    setMethodsChanged(true);
  };

  const handleSaveMethod = (m: PaymentMethod) => {
    let updated: PaymentMethod[];
    if (methods.some(x => x.id === m.id)) {
      updated = methods.map(x => x.id === m.id ? m : x);
    } else {
      updated = [...methods, m];
    }
    setMethods(updated);
    setMethodsChanged(true);
    setEditingMethod(null);
  };

  const deleteMethod = (id: string) => {
    if (!confirm("Supprimer cette méthode ?")) return;
    const updated = methods.filter(m => m.id !== id);
    setMethods(updated);
    setMethodsChanged(true);
  };

  // ── Transaction filters ───────────────────────────────────────────────────────
  const filteredTx = useMemo(() => {
    return transactions.filter(t => {
      if (txType !== 'all' && t.type !== txType) return false;
      if (txStatus !== 'all' && t.status !== txStatus) return false;
      if (txMethod !== 'all' && t.method !== txMethod) return false;
      if (txSearch && !(t.clientName?.toLowerCase().includes(txSearch.toLowerCase()) || t.id?.includes(txSearch))) return false;
      return true;
    });
  }, [transactions, txType, txStatus, txMethod, txSearch]);

  const txMethods = useMemo(() => {
    const s = new Set(transactions.map(t => t.method).filter(Boolean));
    return Array.from(s) as string[];
  }, [transactions]);

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-700',
  };

  const typeIcons: Record<string, React.ReactNode> = {
    deposit: <ArrowDownToLine className="h-4 w-4 text-emerald-600" />,
    withdrawal: <ArrowUpFromLine className="h-4 w-4 text-red-600" />,
    purchase: <ShoppingBag className="h-4 w-4 text-blue-600" />,
    refund: <RefreshCw className="h-4 w-4 text-violet-600" />,
    transfer_received: <ArrowDownToLine className="h-4 w-4 text-teal-600" />,
  };

  return (
    <div className="space-y-8 pb-16">
      {/* ── Stats ── */}
      <div>
        <h2 className="text-xl font-black text-dark mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Statistiques Wallet
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<ArrowDownToLine className="h-5 w-5" />} label="Total déposé" color="text-emerald-600"
            value={`$${stats.totalDeposited.toFixed(2)}`} sub={`${stats.pendingDeposits} en attente`} />
          <StatCard icon={<ArrowUpFromLine className="h-5 w-5" />} label="Total retiré" color="text-red-600"
            value={`$${stats.totalWithdrawn.toFixed(2)}`} sub={`${stats.pendingWithdrawals} en attente`} />
          <StatCard icon={<ShoppingBag className="h-5 w-5" />} label="Dépenses clients" color="text-blue-600"
            value={`$${stats.totalSpent.toFixed(2)}`} sub="achats complétés" />
          <StatCard icon={<Wallet className="h-5 w-5" />} label="Solde total" color="text-primary"
            value={`$${stats.totalBalance.toFixed(2)}`} sub={`${stats.activeWallets} wallets actifs`} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <StatCard icon={<Users className="h-5 w-5" />} label="Clients enregistrés" color="text-violet-600"
            value={String(clients.length)} sub={`${clients.filter(c => c.status === 'active').length} actifs`} />
          <StatCard icon={<DollarSign className="h-5 w-5" />} label="Taux actuel" color="text-amber-600"
            value={`${stats.rate} HTG`} sub="= 1 USD" />
        </div>
      </div>

      {/* ── Exchange Rate ── */}
      <div>
        <h2 className="text-xl font-black text-dark mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-amber-500" />
          Gestion du taux USD
        </h2>
        <Card className="border-gray-100 shadow-sm">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-100">
              <Info className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">
                Ce taux est utilisé pour convertir les dépôts HTG en USD. 1 USD = X HTG.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">1 USD = X HTG</Label>
                <div className="flex gap-2">
                  <Input type="number" value={rateInput} onChange={e => setRateInput(e.target.value)}
                    className="h-12 rounded-xl text-xl font-black" min="1" step="0.01" />
                  <div className="h-12 px-3 flex items-center rounded-xl bg-amber-50 border border-amber-100 font-black text-amber-600 whitespace-nowrap text-sm">
                    HTG/$
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">Min dépôt (USD)</Label>
                <Input type="number" value={minDepositInput} onChange={e => setMinDepositInput(e.target.value)}
                  className="h-12 rounded-xl font-bold" min="0" step="0.01" placeholder="0.01" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">Max dépôt (USD)</Label>
                <Input type="number" value={maxDepositInput} onChange={e => setMaxDepositInput(e.target.value)}
                  className="h-12 rounded-xl font-bold" min="0" step="0.01" placeholder="10000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">Min retrait (USD)</Label>
                <Input type="number" value={minWithdrawInput} onChange={e => setMinWithdrawInput(e.target.value)}
                  className="h-12 rounded-xl font-bold" min="0" step="0.01" placeholder="0.01" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-subtext">Max retrait (USD)</Label>
                <Input type="number" value={maxWithdrawInput} onChange={e => setMaxWithdrawInput(e.target.value)}
                  className="h-12 rounded-xl font-bold" min="0" step="0.01" placeholder="10000" />
              </div>
            </div>

            {rateInput && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm">
                <p className="font-black text-emerald-700">Aperçu conversions :</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-emerald-600">
                  {[100, 500, 1000].map(htg => (
                    <div key={htg} className="bg-white rounded-lg p-2 text-center border border-emerald-100">
                      <p className="font-bold text-gray-500">{htg} HTG</p>
                      <p className="font-black text-emerald-700">${(htg / parseFloat(rateInput || '1')).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={saveRate} disabled={isSaving} className="bg-primary text-white font-black rounded-xl h-11 px-6">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Sauvegarder le taux
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Per-method custom rates ── */}
      <div>
        <h2 className="text-xl font-black text-dark mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Taux personnalisés par méthode
        </h2>
        <Card className="border-gray-100 shadow-sm">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-blue-50 border border-blue-100">
              <Info className="h-4 w-4 text-blue-600 shrink-0" />
              <p className="text-xs text-blue-700">
                Définissez un taux HTG/USD spécifique par méthode de paiement. Laissez vide pour utiliser le taux global.
              </p>
            </div>
            {methods.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucune méthode configurée.</p>
            ) : (
              <div className="space-y-3">
                {methods.map(m => {
                  const customVal = cardRatesInput[m.id] || '';
                  const globalRate = parseFloat(rateInput) || settings?.exchangeRate || 135;
                  const previewRate = parseFloat(customVal) || globalRate;
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="h-9 w-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-lg shrink-0 shadow-sm">
                        {m.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-dark">{m.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {customVal ? `Taux personnalisé : ${previewRate} HTG/$` : `Taux global : ${globalRate} HTG/$`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Input
                          type="number"
                          value={customVal}
                          onChange={e => setCardRatesInput(prev => ({ ...prev, [m.id]: e.target.value }))}
                          placeholder={String(globalRate)}
                          className="h-9 w-28 rounded-xl text-sm font-bold text-center"
                          min="1" step="0.01"
                        />
                        <span className="text-[10px] font-black text-gray-400 whitespace-nowrap">HTG/$</span>
                        {customVal && (
                          <button type="button"
                            onClick={() => setCardRatesInput(prev => { const n = { ...prev }; delete n[m.id]; return n; })}
                            className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Button onClick={saveCardRates} disabled={isSavingCardRates} className="bg-primary text-white font-black rounded-xl h-11 px-6">
              {isSavingCardRates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Sauvegarder les taux
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Payment Methods ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-dark flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Méthodes de paiement
          </h2>
          <div className="flex gap-2">
            {methodsChanged && (
              <Button onClick={() => saveMethodsToServer(methods)} disabled={isSaving}
                className="bg-primary text-white font-black rounded-xl h-9 px-4 text-xs">
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Sauvegarder
              </Button>
            )}
            <Button onClick={() => setEditingMethod('new')} variant="outline"
              className="rounded-xl h-9 px-4 text-xs font-bold">
              <Plus className="h-3.5 w-3.5 mr-1" />Ajouter
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {methods.map(m => (
            <motion.div key={m.id} layout
              className={`relative rounded-2xl border-2 p-4 transition-all ${m.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl shrink-0">
                    {m.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-sm text-dark">{m.name}</p>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {m.forDeposit && <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Dépôt</span>}
                      {m.forWithdrawal && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Retrait</span>}
                    </div>
                    {m.number && <p className="text-[10px] text-subtext font-mono mt-0.5">{m.number}</p>}
                    {m.address && <p className="text-[10px] text-subtext font-mono truncate max-w-[140px]">{m.address}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleMethod(m.id)}
                    className={`h-7 w-12 rounded-full transition-colors flex items-center px-1 ${m.enabled ? 'bg-primary justify-end' : 'bg-gray-200 justify-start'}`}>
                    <div className="h-5 w-5 rounded-full bg-white shadow-sm" />
                  </button>
                  <button onClick={() => setEditingMethod(m)}
                    className="h-7 w-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                    <Edit2 className="h-3 w-3 text-gray-500" />
                  </button>
                  <button onClick={() => deleteMethod(m.id)}
                    className="h-7 w-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors">
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Transaction History ── */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black text-dark">Historique des Transactions</h2>
              <p className="text-xs text-gray-400 font-medium">{transactions.length} transaction(s) au total</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={transactions.length === 0}
            className="rounded-xl h-10 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-bold text-xs flex items-center gap-2 shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer l'historique
          </Button>
        </div>

        {/* Summary pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Dépôts', count: transactions.filter(t => t.type === 'deposit').length, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            { label: 'Retraits', count: transactions.filter(t => t.type === 'withdrawal').length, color: 'bg-red-50 text-red-700 border-red-100' },
            { label: 'Transferts', count: transactions.filter(t => t.type === 'transfer_received' || t.type === 'transfer_sent').length, color: 'bg-teal-50 text-teal-700 border-teal-100' },
            { label: 'Achats', count: transactions.filter(t => t.type === 'purchase').length, color: 'bg-blue-50 text-blue-700 border-blue-100' },
          ].map(({ label, count, color }) => (
            <div key={label} className={`rounded-2xl border px-4 py-3 flex items-center justify-between ${color}`}>
              <span className="text-xs font-bold">{label}</span>
              <span className="text-lg font-black">{count}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input value={txSearch} onChange={e => setTxSearch(e.target.value)}
              placeholder="Client / ID..." className="h-10 pl-9 rounded-xl" />
          </div>
          <Select value={txType} onValueChange={setTxType}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              <SelectItem value="deposit">Dépôt</SelectItem>
              <SelectItem value="withdrawal">Retrait</SelectItem>
              <SelectItem value="purchase">Achat</SelectItem>
              <SelectItem value="transfer_received">Transfert reçu</SelectItem>
              <SelectItem value="refund">Remboursement</SelectItem>
            </SelectContent>
          </Select>
          <Select value={txStatus} onValueChange={setTxStatus}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="approved">Approuvé</SelectItem>
              <SelectItem value="completed">Complété</SelectItem>
              <SelectItem value="rejected">Refusé</SelectItem>
            </SelectContent>
          </Select>
          <Select value={txMethod} onValueChange={setTxMethod}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Méthode" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes méthodes</SelectItem>
              {txMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-gray-400 font-semibold">{filteredTx.length} résultat(s)</p>

        {/* Transaction cards */}
        {txLoading ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filteredTx.length === 0 ? (
          <div className="py-16 text-center">
            <History className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Aucune transaction trouvée.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTx.slice(0, 100).map(tx => {
              const usd = tx.usdAmount ?? tx.amount;
              const htg = tx.htgAmount ?? tx.htgEquivalent;
              const isCredit = tx.type === 'deposit' || tx.type === 'transfer_received' || tx.type === 'refund';
              return (
                <div key={tx.id} className="bg-white border border-gray-100 rounded-2xl px-5 py-4 hover:border-gray-200 hover:shadow-sm transition-all flex items-center gap-4">
                  {/* Type icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isCredit ? 'bg-emerald-50' : 'bg-red-50'
                  }`}>
                    {typeIcons[tx.type] || <Wallet className="h-4 w-4 text-gray-400" />}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-dark text-sm truncate">{tx.clientName || '—'}</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[tx.status] || 'bg-gray-100 text-gray-600'}`}>
                        {tx.status === 'approved' ? 'Approuvé' : tx.status === 'pending' ? 'En attente' : tx.status === 'rejected' ? 'Refusé' : tx.status === 'completed' ? 'Complété' : tx.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-gray-400 capitalize">{tx.type?.replace('_', ' ')}</span>
                      {tx.method && <span className="text-[11px] text-gray-500">· {tx.method}</span>}
                      <span className="text-[11px] text-gray-400">
                        {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'dd MMM yyyy, HH:mm', { locale: fr }) : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <p className={`font-black text-base ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isCredit ? '+' : '-'}${usd.toFixed(2)}
                    </p>
                    {htg && htg > 0 && (
                      <p className="text-[10px] text-gray-400">≈ {Math.round(htg).toLocaleString()} HTG</p>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredTx.length > 100 && (
              <p className="text-center text-xs text-gray-400 py-3 font-medium">
                Affichage des 100 premières sur {filteredTx.length} transactions
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Delete History Confirm Dialog ── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 border border-red-100 mx-auto mb-2">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <DialogTitle className="font-black text-dark text-center text-xl">Supprimer l'historique</DialogTitle>
            <DialogDescription className="text-center text-sm text-gray-500">
              Cette action va <span className="font-black text-red-600">supprimer définitivement</span> les{' '}
              <span className="font-black">{transactions.length}</span> transactions enregistrées.
              <br /><br />
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-2xl h-12">
              Annuler
            </Button>
            <Button
              disabled={isDeletingHistory}
              onClick={async () => {
                setIsDeletingHistory(true);
                try {
                  const res = await fetch('/api/admin/transactions/all', { method: 'DELETE' });
                  const data = await res.json();
                  if (data.success) {
                    toast.success(`${data.deleted} transaction(s) supprimées.`);
                    setShowDeleteConfirm(false);
                  } else {
                    toast.error(data.error || "Erreur lors de la suppression.");
                  }
                } catch {
                  toast.error("Erreur réseau.");
                } finally {
                  setIsDeletingHistory(false);
                }
              }}
              className="flex-1 rounded-2xl h-12 bg-red-600 hover:bg-red-700 text-white font-black border-0"
            >
              {isDeletingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer tout'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Method dialog */}
      <Dialog open={!!editingMethod} onOpenChange={v => { if (!v) setEditingMethod(null); }}>
        {editingMethod && (
          <MethodDialog
            method={editingMethod === 'new'
              ? { id: `custom_${Date.now()}`, name: '', type: 'mobile_money', icon: '💳', enabled: true, forDeposit: true, forWithdrawal: true }
              : editingMethod}
            onSave={handleSaveMethod}
            onClose={() => setEditingMethod(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
