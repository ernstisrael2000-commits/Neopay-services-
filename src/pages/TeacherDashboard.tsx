import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap, LogOut, Plus, Pencil, Trash2, Eye, EyeOff,
  Wallet, ArrowDownCircle, CheckCircle2, Clock, XCircle,
  Loader2, BookOpen, Video, ChevronUp, ChevronDown, X,
  BarChart2, DollarSign, AlertTriangle, RefreshCw, ArrowUpDown
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Teacher, TeacherTransaction, Formation, FormationModule } from '../types';
import { useSettings } from '../services/parcelService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TeacherDashboardProps {
  teacher: Teacher;
  onLogout: () => void;
}

type DashTab = 'formations' | 'wallet';

const LEVEL_LABELS: Record<string, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
};

function newModule(): FormationModule {
  return {
    id: crypto.randomUUID(),
    title: '',
    videoUrl: '',
    duration: '',
    description: '',
    order: 0,
  } as FormationModule;
}

function tsDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts._seconds) return new Date(ts._seconds * 1000);
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (ts.toDate) return ts.toDate();
  return null;
}

function fmtDate(ts: any) {
  const d = tsDate(ts);
  if (!d) return '—';
  return format(d, 'dd MMM yyyy, HH:mm', { locale: fr });
}

export default function TeacherDashboard({ teacher, onLogout }: TeacherDashboardProps) {
  const { settings } = useSettings();
  const rate = settings?.exchangeRate ?? 146;

  const [activeTab, setActiveTab] = useState<DashTab>('formations');
  const [teacherBalance, setTeacherBalance] = useState<number>(teacher.balance ?? 0);

  // ── Formations state ────────────────────────────────────────────────────────
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loadingFormations, setLoadingFormations] = useState(true);

  // ── Formation dialog ────────────────────────────────────────────────────────
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFormation, setEditingFormation] = useState<Formation | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Formation | null>(null);

  const emptyForm = (): Partial<Formation> => ({
    title: '', shortDescription: '', description: '',
    coverImage: '', previewVideoUrl: '',
    price: 0, originalPrice: undefined,
    level: 'debutant', category: '', language: 'Français',
    totalDuration: '', hasCertificate: false, comingSoon: false, published: true,
    instructor: teacher.name, instructorBio: '', instructorAvatar: '',
    modules: [], chapters: [], resources: [],
    studentsCount: 0, rating: 0,
  });

  const [formData, setFormData] = useState<Partial<Formation>>(emptyForm());
  const [modules, setModules] = useState<FormationModule[]>([]);

  // ── Wallet state ────────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<TeacherTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'MonCash' | 'NatCash'>('MonCash');
  const [withdrawAccount, setWithdrawAccount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [teacherFee, setTeacherFee] = useState(0);

  // ── Load formations ─────────────────────────────────────────────────────────
  const loadFormations = useCallback(async () => {
    setLoadingFormations(true);
    try {
      const res = await fetch(`/api/teacher/formations/${teacher.id}`);
      const data = await res.json();
      setFormations(data.formations || []);
    } catch {
      toast.error('Erreur lors du chargement des formations.');
    } finally {
      setLoadingFormations(false);
    }
  }, [teacher.id]);

  // ── Load transactions + balance ─────────────────────────────────────────────
  const loadWallet = useCallback(async () => {
    setLoadingTx(true);
    try {
      const [txRes, meRes, feeRes] = await Promise.all([
        fetch(`/api/teacher/transactions/${teacher.id}`),
        fetch(`/api/teacher/me/${teacher.id}`),
        fetch('/api/admin/teacher-fee'),
      ]);
      const txData = await txRes.json();
      const meData = await meRes.json();
      const feeData = await feeRes.json();
      setTransactions(txData.transactions || []);
      if (meData.teacher) setTeacherBalance(meData.teacher.balance ?? 0);
      setTeacherFee(feeData.fee ?? 0);
    } catch {
      toast.error('Erreur lors du chargement du portefeuille.');
    } finally {
      setLoadingTx(false);
    }
  }, [teacher.id]);

  useEffect(() => { loadFormations(); }, [loadFormations]);
  useEffect(() => { if (activeTab === 'wallet') loadWallet(); }, [activeTab, loadWallet]);

  // ── Open formation editor ───────────────────────────────────────────────────
  const openNewFormation = () => {
    setEditingFormation(null);
    setFormData(emptyForm());
    setModules([]);
    setIsFormOpen(true);
  };

  const openEditFormation = (f: Formation) => {
    setEditingFormation(f);
    setFormData({
      title: f.title || '',
      shortDescription: f.shortDescription || '',
      description: f.description || '',
      coverImage: f.coverImage || '',
      previewVideoUrl: f.previewVideoUrl || '',
      price: f.price ?? 0,
      originalPrice: f.originalPrice,
      level: f.level || 'debutant',
      category: f.category || '',
      language: f.language || 'Français',
      totalDuration: f.totalDuration || '',
      hasCertificate: f.hasCertificate ?? false,
      comingSoon: f.comingSoon ?? false,
      published: f.published ?? false,
      instructor: f.instructor || teacher.name,
      instructorBio: f.instructorBio || '',
      instructorAvatar: f.instructorAvatar || '',
      chapters: f.chapters || [],
      resources: f.resources || [],
    });
    setModules((f.modules || []).map(m => ({ ...m })));
    setIsFormOpen(true);
  };

  // ── Save formation ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formData.title?.trim()) { toast.error('Le titre est requis.'); return; }
    setSaving(true);
    try {
      const sortedModules = modules.map((m, i) => ({ ...m, order: i }));
      const body = {
        ...formData,
        modules: sortedModules,
        teacherId: teacher.id,
        teacherName: teacher.name,
      };
      const url = editingFormation
        ? `/api/teacher/formations/${editingFormation.id}`
        : '/api/teacher/formations';
      const method = editingFormation ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success(editingFormation ? 'Formation mise à jour !' : 'Formation créée !');
      setIsFormOpen(false);
      loadFormations();
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete formation ────────────────────────────────────────────────────────
  const handleDelete = async (formation: Formation) => {
    setDeleting(formation.id!);
    try {
      const res = await fetch(`/api/teacher/formations/${formation.id}?teacherId=${teacher.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success('Formation supprimée.');
      setConfirmDelete(null);
      loadFormations();
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de la suppression.');
    } finally {
      setDeleting(null);
    }
  };

  // ── Toggle published ────────────────────────────────────────────────────────
  const togglePublish = async (formation: Formation) => {
    try {
      const res = await fetch(`/api/teacher/formations/${formation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formation, published: !formation.published, teacherId: teacher.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(formation.published ? 'Formation dépubliée.' : 'Formation publiée !');
      loadFormations();
    } catch (e: any) {
      toast.error(e.message || 'Erreur.');
    }
  };

  // ── Module management ───────────────────────────────────────────────────────
  const addModule = () => setModules(prev => [...prev, { ...newModule(), order: prev.length }]);

  const updateModule = (idx: number, field: keyof FormationModule, value: any) => {
    setModules(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const removeModule = (idx: number) => setModules(prev => prev.filter((_, i) => i !== idx));

  const moveModule = (idx: number, dir: -1 | 1) => {
    setModules(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // ── Withdrawal ──────────────────────────────────────────────────────────────
  const handleWithdraw = async () => {
    const amtHTG = Number(withdrawAmount);
    if (!amtHTG || amtHTG <= 0) { toast.error('Montant invalide.'); return; }
    if (!withdrawAccount.trim()) { toast.error('Numéro de compte requis.'); return; }

    const amtUSD = amtHTG / rate;
    if (amtUSD > teacherBalance) {
      toast.error(`Solde insuffisant. Votre solde est de ${Math.round(teacherBalance * rate).toLocaleString()} HTG.`);
      return;
    }

    setWithdrawing(true);
    try {
      const res = await fetch('/api/teacher/withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: teacher.id,
          amount: amtUSD,
          method: withdrawMethod,
          accountNumber: withdrawAccount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success('Demande de retrait envoyée ! En attente d\'approbation.');
      setIsWithdrawOpen(false);
      setWithdrawAmount('');
      setWithdrawAccount('');
      loadWallet();
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors du retrait.');
    } finally {
      setWithdrawing(false);
    }
  };

  const balanceHTG = Math.round(teacherBalance * rate);
  const netWithdrawHTG = withdrawAmount
    ? Math.round(Number(withdrawAmount) * (1 - teacherFee / 100))
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <GraduationCap className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="font-black text-sm text-dark leading-none">{teacher.name}</p>
              <p className="text-[10px] text-violet-500 font-bold uppercase tracking-widest mt-0.5">Professeur</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col items-end">
              <p className="text-xs text-gray-400 font-bold">Solde</p>
              <p className="font-black text-sm text-emerald-600">{balanceHTG.toLocaleString()} HTG</p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab navigation ─────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          {([
            { id: 'formations', label: 'Mes Formations', icon: BookOpen },
            { id: 'wallet', label: 'Mon Portefeuille', icon: Wallet },
          ] as { id: DashTab; label: string; icon: any }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-200'
                  : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-100'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── FORMATIONS TAB ───────────────────────────────────────────────── */}
        {activeTab === 'formations' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-dark">
                Formations ({formations.length})
              </h2>
              <Button
                onClick={openNewFormation}
                className="bg-violet-600 hover:bg-violet-700 text-white border-0 rounded-xl shadow-md shadow-violet-200 font-bold text-sm"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Nouvelle Formation
              </Button>
            </div>

            {loadingFormations ? (
              <div className="flex items-center justify-center py-20 text-gray-400">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : formations.length === 0 ? (
              <Card className="border-dashed border-2 border-gray-200 shadow-none">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <GraduationCap className="h-12 w-12 text-gray-200 mb-3" />
                  <p className="font-bold text-gray-500">Aucune formation encore</p>
                  <p className="text-sm text-gray-400 mt-1">Cliquez sur "Nouvelle Formation" pour commencer.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {formations.map(f => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    {f.coverImage ? (
                      <img src={f.coverImage} alt={f.title} className="w-full h-32 object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                    ) : (
                      <div className="w-full h-32 bg-gradient-to-br from-violet-50 to-indigo-100 flex items-center justify-center">
                        <GraduationCap className="h-10 w-10 text-violet-300" />
                      </div>
                    )}

                    <div className="p-4 space-y-3">
                      <div>
                        <p className="font-black text-sm text-dark leading-tight line-clamp-2">{f.title}</p>
                        {f.shortDescription && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{f.shortDescription}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-violet-700 border-violet-200 bg-violet-50 text-[10px] font-black">
                          {f.price === 0 ? 'Gratuit' : `${(f.price || 0).toLocaleString()} HTG`}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] font-black ${f.published ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : f.comingSoon ? 'text-orange-700 bg-orange-50 border-orange-200' : 'text-gray-500 bg-gray-50 border-gray-200'}`}>
                          {f.comingSoon ? 'À venir' : f.published ? 'Publié' : 'Brouillon'}
                        </Badge>
                        <span className="text-[10px] text-gray-400 font-semibold ml-auto">
                          {(f.modules || []).length} modules
                        </span>
                      </div>

                      <div className="flex gap-1 pt-1 border-t border-gray-50">
                        <button
                          onClick={() => openEditFormation(f)}
                          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-violet-600 hover:bg-violet-50 rounded-xl transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Modifier
                        </button>
                        <button
                          onClick={() => togglePublish(f)}
                          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
                        >
                          {f.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {f.published ? 'Dépublier' : 'Publier'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(f)}
                          className="flex items-center justify-center gap-1 py-2 px-3 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── WALLET TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            {/* Balance card */}
            <Card className="bg-gradient-to-br from-violet-600 to-indigo-700 border-0 shadow-xl shadow-violet-300/40 text-white rounded-3xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-violet-200 text-xs font-bold uppercase tracking-widest mb-2">Solde disponible</p>
                    <p className="text-4xl font-black tracking-tight">
                      {loadingTx ? '...' : balanceHTG.toLocaleString()}
                      <span className="text-lg font-bold text-violet-300 ml-2">HTG</span>
                    </p>
                    <p className="text-violet-300 text-xs mt-1 font-mono">≈ {teacherBalance.toFixed(2)} USD</p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Wallet className="h-6 w-6 text-white" />
                  </div>
                </div>

                {teacherFee > 0 && (
                  <div className="mt-4 pt-4 border-t border-violet-500/40">
                    <p className="text-violet-200 text-xs font-semibold">
                      Frais de retrait : <span className="font-black text-white">{teacherFee}%</span>
                    </p>
                  </div>
                )}

                <Button
                  onClick={() => setIsWithdrawOpen(true)}
                  className="mt-5 w-full bg-white/20 hover:bg-white/30 border border-white/30 text-white font-black rounded-2xl h-12 text-sm backdrop-blur-sm transition-all"
                >
                  <ArrowDownCircle className="h-4 w-4 mr-2" />
                  Demander un retrait
                </Button>
              </CardContent>
            </Card>

            {/* Transactions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-dark text-sm">Historique des transactions</h3>
                <button onClick={loadWallet} className="text-gray-400 hover:text-violet-600 transition-colors">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {loadingTx ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-200 shadow-none">
                  <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <BarChart2 className="h-8 w-8 text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400 font-semibold">Aucune transaction</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {transactions.map(tx => (
                    <div key={tx.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tx.type === 'sale_credit' ? 'bg-emerald-100' : tx.status === 'approved' ? 'bg-blue-100' : tx.status === 'rejected' ? 'bg-red-100' : 'bg-amber-100'}`}>
                        {tx.type === 'sale_credit' ? (
                          <DollarSign className="h-5 w-5 text-emerald-600" />
                        ) : tx.status === 'approved' ? (
                          <CheckCircle2 className="h-5 w-5 text-blue-600" />
                        ) : tx.status === 'rejected' ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <Clock className="h-5 w-5 text-amber-600" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-dark">
                          {tx.type === 'sale_credit' ? `Vente — ${tx.formationTitle || 'Formation'}` : 'Demande de retrait'}
                        </p>
                        {tx.type === 'sale_credit' && tx.clientName && (
                          <p className="text-xs text-gray-400">Acheté par {tx.clientName}</p>
                        )}
                        {tx.type === 'withdrawal' && tx.accountNumber && (
                          <p className="text-xs text-gray-400">{tx.method} — {tx.accountNumber}</p>
                        )}
                        <p className="text-[10px] text-gray-300 mt-0.5">{fmtDate(tx.createdAt)}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`font-black text-sm ${tx.type === 'sale_credit' ? 'text-emerald-600' : 'text-gray-700'}`}>
                          {tx.type === 'sale_credit' ? '+' : '-'}{Math.round((tx.amount || 0) * rate).toLocaleString()} HTG
                        </p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          tx.status === 'completed' || tx.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          tx.status === 'rejected' ? 'bg-red-100 text-red-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {tx.status === 'completed' ? 'Complété' :
                           tx.status === 'approved' ? 'Approuvé' :
                           tx.status === 'rejected' ? 'Rejeté' : 'En attente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Formation editor dialog ──────────────────────────────────────────── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-3xl border-0 shadow-2xl p-0">
          <DialogHeader className="p-6 border-b border-gray-100 bg-gray-50/50">
            <DialogTitle className="text-xl font-black text-dark">
              {editingFormation ? 'Modifier la formation' : 'Nouvelle formation'}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Informations de base</h3>
              <div className="grid gap-4">
                <div>
                  <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Titre *</Label>
                  <Input
                    value={formData.title || ''}
                    onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                    placeholder="Ex: Maîtriser la finance personnelle"
                    className="rounded-xl h-11"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Accroche (une phrase)</Label>
                  <Input
                    value={formData.shortDescription || ''}
                    onChange={e => setFormData(p => ({ ...p, shortDescription: e.target.value }))}
                    placeholder="Phrase d'accroche pour la carte..."
                    className="rounded-xl h-11"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Description complète</Label>
                  <Textarea
                    value={formData.description || ''}
                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                    placeholder="Description détaillée de la formation..."
                    className="rounded-xl min-h-[90px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Image de couverture (URL)</Label>
                    <Input
                      value={formData.coverImage || ''}
                      onChange={e => setFormData(p => ({ ...p, coverImage: e.target.value }))}
                      placeholder="https://..."
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Vidéo aperçu (URL)</Label>
                    <Input
                      value={formData.previewVideoUrl || ''}
                      onChange={e => setFormData(p => ({ ...p, previewVideoUrl: e.target.value }))}
                      placeholder="YouTube / Vimeo"
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing & Meta */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Prix & Paramètres</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Prix (HTG)</Label>
                  <Input type="number" min="0" value={formData.price ?? 0}
                    onChange={e => setFormData(p => ({ ...p, price: Number(e.target.value) }))}
                    className="rounded-xl h-11" placeholder="0 = Gratuit" />
                </div>
                <div>
                  <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Prix barré (HTG)</Label>
                  <Input type="number" min="0" value={formData.originalPrice ?? ''}
                    onChange={e => setFormData(p => ({ ...p, originalPrice: e.target.value ? Number(e.target.value) : undefined }))}
                    className="rounded-xl h-11" placeholder="Optionnel" />
                </div>
                <div>
                  <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Niveau</Label>
                  <select
                    value={formData.level || 'debutant'}
                    onChange={e => setFormData(p => ({ ...p, level: e.target.value as any }))}
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="debutant">Débutant</option>
                    <option value="intermediaire">Intermédiaire</option>
                    <option value="avance">Avancé</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Catégorie</Label>
                  <Input value={formData.category || ''} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                    placeholder="Finance, Marketing..." className="rounded-xl h-11" />
                </div>
                <div>
                  <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Langue</Label>
                  <Input value={formData.language || 'Français'} onChange={e => setFormData(p => ({ ...p, language: e.target.value }))}
                    placeholder="Français" className="rounded-xl h-11" />
                </div>
                <div>
                  <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Durée totale</Label>
                  <Input value={formData.totalDuration || ''} onChange={e => setFormData(p => ({ ...p, totalDuration: e.target.value }))}
                    placeholder="Ex: 3h 30min" className="rounded-xl h-11" />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-4">
                {/* Publié */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, published: !p.published }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${formData.published ? 'bg-emerald-500' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${formData.published ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm font-bold text-gray-600">Publié</span>
                </label>
                {/* À venir */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, comingSoon: !p.comingSoon }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${formData.comingSoon ? 'bg-orange-500' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${formData.comingSoon ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm font-bold text-gray-600">À venir</span>
                </label>
                {/* Certificat */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, hasCertificate: !p.hasCertificate }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${formData.hasCertificate ? 'bg-violet-500' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${formData.hasCertificate ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm font-bold text-gray-600">Certificat</span>
                </label>
              </div>
            </div>

            {/* Instructor */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Instructeur</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Nom de l'instructeur</Label>
                  <Input value={formData.instructor || ''} onChange={e => setFormData(p => ({ ...p, instructor: e.target.value }))}
                    className="rounded-xl h-11" />
                </div>
                <div>
                  <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Avatar (URL)</Label>
                  <Input value={formData.instructorAvatar || ''} onChange={e => setFormData(p => ({ ...p, instructorAvatar: e.target.value }))}
                    placeholder="https://..." className="rounded-xl h-11" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Bio de l'instructeur</Label>
                <Textarea value={formData.instructorBio || ''} onChange={e => setFormData(p => ({ ...p, instructorBio: e.target.value }))}
                  className="rounded-xl min-h-[70px]" placeholder="Courte biographie..." />
              </div>
            </div>

            {/* Modules */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Modules ({modules.length})</h3>
                <Button type="button" onClick={addModule} size="sm"
                  className="bg-violet-600 hover:bg-violet-700 text-white border-0 rounded-xl text-xs h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
                </Button>
              </div>

              <div className="space-y-2">
                {modules.map((mod, idx) => (
                  <div key={mod.id || idx} className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <button type="button" onClick={() => moveModule(idx, -1)} disabled={idx === 0}
                          className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => moveModule(idx, 1)} disabled={idx === modules.length - 1}
                          className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="h-6 w-6 rounded-lg bg-violet-100 text-violet-600 text-[10px] font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <Input
                        value={mod.title || ''}
                        onChange={e => updateModule(idx, 'title', e.target.value)}
                        placeholder="Titre du module"
                        className="flex-1 h-9 rounded-xl text-sm"
                      />
                      <button type="button" onClick={() => removeModule(idx)}
                        className="text-red-400 hover:text-red-600 p-1 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pl-8">
                      <Input
                        value={mod.videoUrl || ''}
                        onChange={e => updateModule(idx, 'videoUrl', e.target.value)}
                        placeholder="URL vidéo (YouTube/Vimeo)"
                        className="h-9 rounded-xl text-sm"
                      />
                      <Input
                        value={mod.duration || ''}
                        onChange={e => updateModule(idx, 'duration', e.target.value)}
                        placeholder="Durée (ex: 12min)"
                        className="h-9 rounded-xl text-sm"
                      />
                    </div>
                    <div className="pl-8">
                      <Textarea
                        value={mod.description || ''}
                        onChange={e => updateModule(idx, 'description', e.target.value)}
                        placeholder="Description du module (optionnel)"
                        className="rounded-xl min-h-[60px] text-sm"
                      />
                    </div>
                  </div>
                ))}
                {modules.length === 0 && (
                  <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-2xl">
                    Aucun module — cliquez sur "Ajouter" pour commencer.
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 border-t border-gray-100 bg-gray-50/50 gap-3">
            <Button variant="ghost" onClick={() => setIsFormOpen(false)} className="rounded-2xl h-12 font-bold px-6">Annuler</Button>
            <Button onClick={handleSave} disabled={saving}
              className="rounded-2xl h-12 bg-violet-600 hover:bg-violet-700 text-white font-black px-10 border-0 shadow-lg shadow-violet-200">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingFormation ? 'Mettre à jour' : 'Créer la formation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm delete dialog ────────────────────────────────────────────── */}
      <Dialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl border-0 shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 text-xl font-black">
              <AlertTriangle className="h-5 w-5" /> Supprimer la formation
            </DialogTitle>
            <DialogDescription className="text-gray-500 pt-2">
              Action irréversible. Supprimer <strong>{confirmDelete?.title}</strong> ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-6">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)} className="rounded-2xl h-12 font-bold">Annuler</Button>
            <Button
              variant="destructive"
              disabled={!!deleting}
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="rounded-2xl h-12 font-bold bg-red-600 hover:bg-red-700 shadow-lg shadow-red-100"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Withdrawal dialog ────────────────────────────────────────────────── */}
      <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-0 shadow-2xl p-0 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-violet-600 to-indigo-600" />
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-dark text-xl font-black">
              <ArrowDownCircle className="h-5 w-5 text-violet-600" /> Demande de retrait
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-4">
            {/* Balance info */}
            <div className="bg-violet-50 rounded-2xl p-4 flex items-center justify-between">
              <p className="text-xs font-bold text-violet-600">Solde disponible</p>
              <p className="font-black text-violet-700">{balanceHTG.toLocaleString()} HTG</p>
            </div>

            <div>
              <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Montant à retirer (HTG)</Label>
              <Input
                type="number"
                min="1"
                max={balanceHTG}
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                placeholder="Ex: 5000"
                className="rounded-2xl h-12"
              />
              {withdrawAmount && Number(withdrawAmount) > 0 && (
                <div className="mt-2 space-y-1">
                  {teacherFee > 0 && (
                    <p className="text-xs text-amber-600 font-semibold">
                      Frais ({teacherFee}%) : -{Math.round(Number(withdrawAmount) * teacherFee / 100).toLocaleString()} HTG
                    </p>
                  )}
                  <p className="text-xs text-emerald-600 font-black">
                    Vous recevrez : {netWithdrawHTG.toLocaleString()} HTG
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Méthode</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['MonCash', 'NatCash'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setWithdrawMethod(m)}
                    className={`h-11 rounded-2xl border-2 font-bold text-sm transition-all ${
                      withdrawMethod === m
                        ? 'border-violet-600 bg-violet-50 text-violet-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Numéro de compte</Label>
              <Input
                value={withdrawAccount}
                onChange={e => setWithdrawAccount(e.target.value)}
                placeholder="Ex: 509 XXXX XXXX"
                className="rounded-2xl h-12"
              />
            </div>

            <Button
              onClick={handleWithdraw}
              disabled={withdrawing || !withdrawAmount || !withdrawAccount}
              className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-2xl border-0 shadow-lg shadow-violet-200"
            >
              {withdrawing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Envoi...</> : 'Envoyer la demande'}
            </Button>

            <p className="text-xs text-gray-400 text-center">
              La demande sera traitée par l'administrateur dans les plus brefs délais.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
