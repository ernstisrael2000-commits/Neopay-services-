// ─── Gestion du Concours — Admin ──────────────────────────────────────────────
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  onSnapshot, doc, updateDoc, setDoc, collection, addDoc, getDocs,
  orderBy, query, Timestamp,
} from 'firebase/firestore';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import {
  Trophy, Star, TrendingUp, Users, Zap, RotateCcw, Award,
  Loader2, Clock, Check, AlertTriangle, Upload, X, ChevronDown, ChevronUp,
  ImageIcon, Wallet, Package, Calendar, History,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminContentSkeleton } from './skeletons/AdminContentSkeleton';
import {
  awardMonthlyPrizes,
  awardAgentMonthlyPrizes,
  resetMonthlyStats,
  clearMonthlyWinners,
} from '../services/affiliateService';

// ── Types ─────────────────────────────────────────────────────────────────────
type AffMetric   = 'points' | 'monthlySales' | 'monthlyReferredClients';
type AgentMetric = 'monthlyTransactions' | 'commissionBalance';
type ContestType = 'affiliates' | 'agents' | 'both';
type PrizeType   = 'wallet' | 'physical';
type Period      = 'week' | 'month';

interface PrizeCfg {
  type: PrizeType;
  amount: number;
  label: string;
  emoji: string;
  imageUrl?: string;
  description?: string;
}
interface ContestCfg {
  contestActive: boolean;
  contestTitle: string;
  contestPeriod: Period;
  contestType: ContestType;
  affiliateContestMetric: AffMetric;
  agentContestMetric: AgentMetric;
  prize1: PrizeCfg; prize2: PrizeCfg; prize3: PrizeCfg;
  contestEndDate: string;
}
interface Participant { id: string; name: string; score: number }
interface ContestRecord {
  id: string; archivedAt: Timestamp; contestTitle: string;
  period: Period; type: ContestType;
  affiliateWinners: any[]; agentWinners: any[];
}

const DEFAULT_PRIZE = (rank: 1 | 2 | 3): PrizeCfg => ({
  type: 'wallet',
  amount: rank === 1 ? 500 : rank === 2 ? 250 : 150,
  label: rank === 1 ? '1er Prix' : rank === 2 ? '2ème Prix' : '3ème Prix',
  emoji: rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉',
});

const DEFAULT_CFG: ContestCfg = {
  contestActive: false,
  contestTitle: '',
  contestPeriod: 'month',
  contestType: 'both',
  affiliateContestMetric: 'points',
  agentContestMetric: 'monthlyTransactions',
  prize1: DEFAULT_PRIZE(1), prize2: DEFAULT_PRIZE(2), prize3: DEFAULT_PRIZE(3),
  contestEndDate: '',
};

const METRIC_LABEL: Record<string, string> = {
  points: 'Points accumulés',
  monthlySales: 'Ventes ce mois',
  monthlyReferredClients: 'Clients recrutés ce mois',
  monthlyTransactions: 'Transactions traitées',
  commissionBalance: 'Commissions gagnées (HTG)',
};
const UNIT: Record<string, string> = {
  points: 'pts', monthlySales: 'ventes', monthlyReferredClients: 'clients',
  monthlyTransactions: 'opérations', commissionBalance: 'HTG',
};

const PRIZE_META = [
  { label: 'Or — 1ère place',    bar: 'from-amber-400 to-yellow-500', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  { label: 'Argent — 2ème place', bar: 'from-slate-400 to-slate-500',  text: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
  { label: 'Bronze — 3ème place', bar: 'from-orange-400 to-amber-600', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
];

// ── Archive contest to Firestore ──────────────────────────────────────────────
async function archiveContest(cfg: ContestCfg, affWinners: any[], agentWinners: any[]) {
  if (affWinners.length === 0 && agentWinners.length === 0) return;
  await addDoc(collection(db, 'contests'), {
    archivedAt: new Date(),
    contestTitle: cfg.contestTitle || 'Concours',
    period: cfg.contestPeriod,
    type: cfg.contestType,
    affiliateMetric: cfg.affiliateContestMetric,
    agentMetric: cfg.agentContestMetric,
    affiliateWinners: affWinners,
    agentWinners: agentWinners,
  });
}

// ── PrizeCard ─────────────────────────────────────────────────────────────────
function PrizeCard({ rank, prize, onChange }: {
  rank: 1 | 2 | 3;
  prize: PrizeCfg;
  onChange: (p: PrizeCfg) => void;
}) {
  const meta = PRIZE_META[rank - 1];
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const ext = file.name.split('.').pop() || 'jpg';
      const storageRef = sRef(storage, `contests/prizes/prize${rank}-${Date.now()}.${ext}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      onChange({ ...prize, imageUrl: url });
      toast.success('Image uploadée ✓');
    } catch { toast.error('Erreur upload image'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  return (
    <div className={`rounded-2xl border ${meta.bg} overflow-hidden`}>
      {/* Header gradient */}
      <div className={`bg-gradient-to-r ${meta.bar} px-4 py-3 flex items-center gap-2`}>
        <Input
          value={prize.emoji}
          onChange={e => onChange({ ...prize, emoji: e.target.value })}
          className="h-8 w-11 text-center text-xl border-0 bg-white/20 text-white p-0 rounded-lg focus-visible:ring-white/40"
          maxLength={2}
        />
        <div className="flex-1">
          <p className="text-[10px] font-black text-white/90 uppercase tracking-wider">{meta.label}</p>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Prize label */}
        <div>
          <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Libellé</Label>
          <Input
            value={prize.label}
            onChange={e => onChange({ ...prize, label: e.target.value })}
            placeholder="ex: iPhone 16 Pro, 500 HTG…"
            className="h-8 text-sm mt-1"
          />
        </div>

        {/* Prize type toggle */}
        <div>
          <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Type de prix</Label>
          <div className="flex gap-1.5 mt-1">
            <button
              onClick={() => onChange({ ...prize, type: 'wallet' })}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                prize.type === 'wallet'
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'border-gray-200 text-gray-500 hover:border-emerald-300'
              }`}
            >
              <Wallet className="h-3 w-3" /> Wallet
            </button>
            <button
              onClick={() => onChange({ ...prize, type: 'physical' })}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                prize.type === 'physical'
                  ? 'bg-purple-500 text-white border-purple-500'
                  : 'border-gray-200 text-gray-500 hover:border-purple-300'
              }`}
            >
              <Package className="h-3 w-3" /> Physique
            </button>
          </div>
        </div>

        {/* Wallet: amount */}
        {prize.type === 'wallet' && (
          <div>
            <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Montant wallet (HTG)</Label>
            <div className="flex items-center gap-1.5 mt-1">
              <Input
                type="number" min={0}
                value={prize.amount || ''}
                onChange={e => onChange({ ...prize, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0 = pas de crédit"
                className="h-8 text-sm flex-1"
              />
              <span className="text-xs text-gray-400 shrink-0 font-bold">HTG</span>
            </div>
            {prize.amount === 0 && <p className="text-[10px] text-gray-400 mt-1">Aucun crédit automatique</p>}
          </div>
        )}

        {/* Physical: description + image */}
        {prize.type === 'physical' && (
          <div className="space-y-2">
            <div>
              <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description</Label>
              <Input
                value={prize.description || ''}
                onChange={e => onChange({ ...prize, description: e.target.value })}
                placeholder="ex: iPhone 16 Pro 256Go Noir"
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Image du cadeau</Label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              {prize.imageUrl ? (
                <div className="relative mt-1">
                  <img src={prize.imageUrl} alt="prize" className="w-full h-24 object-cover rounded-xl" />
                  <button
                    onClick={() => onChange({ ...prize, imageUrl: undefined })}
                    className="absolute top-1 right-1 h-6 w-6 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="mt-1 w-full h-16 rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-purple-500 transition-colors"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  <span className="text-[10px] font-bold">{uploading ? 'Upload…' : 'Ajouter une photo'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Live ranking row ──────────────────────────────────────────────────────────
function LiveRanking({ participants, metric, title }: { participants: Participant[]; metric: string; title: string }) {
  const ICONS: Record<string, React.ElementType> = {
    points: Star, monthlySales: TrendingUp, monthlyReferredClients: Users,
    monthlyTransactions: Zap, commissionBalance: TrendingUp,
  };
  const Icon = ICONS[metric] || Star;
  const unit = UNIT[metric] || '';
  const MEDALS = ['🥇', '🥈', '🥉'];
  return (
    <div>
      <p className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2">{title}</p>
      {participants.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl">Aucun participant actif</p>
      ) : (
        <div className="space-y-1.5">
          {participants.slice(0, 5).map((p, i) => (
            <div key={p.id} className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2">
              <span className="text-base w-6 text-center">{MEDALS[i] ?? `#${i + 1}`}</span>
              <p className="font-bold text-sm text-gray-800 flex-1 truncate">{p.name}</p>
              <div className="flex items-center gap-1 text-primary">
                <Icon className="h-3 w-3" />
                <span className="text-[11px] font-black">{p.score.toLocaleString('fr-FR')} {unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Countdown display ─────────────────────────────────────────────────────────
function CountdownBadge({ end }: { end: string }) {
  const [rem, setRem] = useState<string>('');
  useEffect(() => {
    if (!end) { setRem(''); return; }
    const tick = () => {
      const diff = new Date(end).getTime() - Date.now();
      if (diff <= 0) { setRem('Terminé'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRem(`${d}j ${h}h ${m}m`);
    };
    tick(); const id = setInterval(tick, 30000); return () => clearInterval(id);
  }, [end]);
  if (!rem) return null;
  return <span className="text-[11px] font-black text-primary bg-blue-50 px-2 py-0.5 rounded-full">⏱ {rem}</span>;
}

// ── History item ──────────────────────────────────────────────────────────────
function HistoryItem({ record }: { record: ContestRecord }) {
  const [open, setOpen] = useState(false);
  const date = record.archivedAt?.toDate?.() ?? new Date();
  const allWinners = [...(record.affiliateWinners || []), ...(record.agentWinners || [])];
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="h-8 w-8 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
          <Trophy className="h-4 w-4 text-amber-500" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-black text-gray-800">{record.contestTitle || 'Concours'}</p>
          <p className="text-[10px] text-gray-400">
            {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            &nbsp;·&nbsp;
            {record.period === 'week' ? '📅 Semaine' : '🗓️ Mois'}
            &nbsp;·&nbsp;
            {record.type === 'affiliates' ? '🤝 Affiliés' : record.type === 'agents' ? '⚡ Agents' : '🤝+⚡ Les deux'}
          </p>
        </div>
        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {allWinners.length} gagnant{allWinners.length > 1 ? 's' : ''}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-gray-100 pt-3 bg-gray-50/50">
          {allWinners.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Aucun gagnant enregistré</p>
          ) : allWinners.map((w: any, i: number) => (
            <div key={i} className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2 border border-gray-100">
              <span className="text-sm">{['🥇','🥈','🥉'][i] ?? '•'}</span>
              <p className="font-bold text-sm text-gray-800 flex-1 truncate">{w.name || 'Inconnu'}</p>
              {w.prizeLabel && <span className="text-[10px] text-gray-500 font-bold truncate max-w-[100px]">{w.prizeEmoji} {w.prizeLabel}</span>}
              {w.prize > 0 && <span className="text-[10px] font-black text-emerald-600">{w.prize.toLocaleString('fr-FR')} HTG</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminContestManager() {
  const [cfg, setCfg]             = useState<ContestCfg>(DEFAULT_CFG);
  const [draft, setDraft]         = useState<ContestCfg>(DEFAULT_CFG);
  const [dirty, setDirty]         = useState(false);
  const [saving, setSaving]       = useState(false);
  const [awarding, setAwarding]   = useState(false);
  const [resetting, setResetting] = useState(false);
  const [affRanking, setAffRanking]     = useState<Participant[]>([]);
  const [agentRanking, setAgentRanking] = useState<Participant[]>([]);
  const [history, setHistory]     = useState<ContestRecord[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  // For award — store last official winners to archive
  const [lastAffWinners, setLastAffWinners] = useState<any[]>([]);
  const [lastAgentWinners, setLastAgentWinners] = useState<any[]>([]);

  // ── Listen to settings/global ────────────────────────────────────────────
  useEffect(() => onSnapshot(doc(db, 'settings', 'global'), snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    const loaded: ContestCfg = {
      contestActive:          d.contestActive ?? false,
      contestTitle:           d.contestTitle ?? '',
      contestPeriod:          d.contestPeriod ?? 'month',
      contestType:            d.contestType ?? 'both',
      affiliateContestMetric: d.affiliateContestMetric ?? 'points',
      agentContestMetric:     d.agentContestMetric ?? 'monthlyTransactions',
      prize1: d.prize1 ?? DEFAULT_PRIZE(1),
      prize2: d.prize2 ?? DEFAULT_PRIZE(2),
      prize3: d.prize3 ?? DEFAULT_PRIZE(3),
      contestEndDate: d.contestEndDate ?? '',
    };
    setCfg(loaded); setDraft(loaded); setDirty(false);
    setLastAffWinners(d.officialWinners || []);
    setLastAgentWinners(d.officialAgentWinners || []);
  }), []);

  // ── Live affiliate ranking ───────────────────────────────────────────────
  useEffect(() => onSnapshot(collection(db, 'affiliates'), snap => {
    const m = draft.affiliateContestMetric;
    const all = snap.docs
      .map(d => ({ id: d.id, name: d.data().name || 'Affilié', score: d.data()[m] || 0 }))
      .filter(p => p.score > 0).sort((a, b) => b.score - a.score);
    setAffRanking(all);
  }), [draft.affiliateContestMetric]);

  // ── Live agent ranking ───────────────────────────────────────────────────
  useEffect(() => onSnapshot(collection(db, 'agents'), snap => {
    const m = draft.agentContestMetric;
    const all = snap.docs
      .map(d => ({ id: d.id, name: d.data().name || 'Agent', score: d.data()[m] || 0 }))
      .filter(p => p.score > 0).sort((a, b) => b.score - a.score);
    setAgentRanking(all);
  }), [draft.agentContestMetric]);

  // ── Load history ─────────────────────────────────────────────────────────
  useEffect(() => {
    getDocs(query(collection(db, 'contests'), orderBy('archivedAt', 'desc')))
      .then(snap => {
        setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContestRecord)));
      })
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, []);

  const updateDraft = useCallback(<K extends keyof ContestCfg>(key: K, val: ContestCfg[K]) => {
    setDraft(d => ({ ...d, [key]: val }));
    setDirty(true);
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        contestActive:          draft.contestActive,
        contestTitle:           draft.contestTitle,
        contestPeriod:          draft.contestPeriod,
        contestType:            draft.contestType,
        affiliateContestMetric: draft.affiliateContestMetric,
        agentContestMetric:     draft.agentContestMetric,
        prize1:                 draft.prize1,
        prize2:                 draft.prize2,
        prize3:                 draft.prize3,
        contestEndDate:         draft.contestEndDate || null,
      }, { merge: true });
      setDirty(false);
      toast.success('Configuration sauvegardée ✓');
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setSaving(false); }
  };

  // ── Award + Archive ──────────────────────────────────────────────────────
  const handleAward = async () => {
    if (!window.confirm('Décerner les prix au Top 3 et archiver ce concours ?')) return;
    setAwarding(true);
    try {
      let affWinners: any[] = [];
      let agentWinners: any[] = [];

      if (draft.contestType === 'affiliates' || draft.contestType === 'both') {
        const res = await awardMonthlyPrizes();
        affWinners = Array.isArray(res) ? res : lastAffWinners;
        toast.success('Prix affiliés décernés ✓');
      }
      if (draft.contestType === 'agents' || draft.contestType === 'both') {
        const res = await awardAgentMonthlyPrizes();
        agentWinners = Array.isArray(res) ? res : lastAgentWinners;
        toast.success('Prix agents décernés ✓');
      }

      // Archive to contests collection
      await archiveContest(
        draft,
        affWinners.length > 0 ? affWinners : lastAffWinners,
        agentWinners.length > 0 ? agentWinners : lastAgentWinners,
      );

      // Refresh history
      const snap = await getDocs(query(collection(db, 'contests'), orderBy('archivedAt', 'desc')));
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContestRecord)));
      toast.success('Concours archivé dans le palmarès ✓');
    } catch { toast.error('Erreur lors de la distribution des prix'); }
    finally { setAwarding(false); }
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!window.confirm('Remettre à zéro TOUS les compteurs ? Décernez les prix d\'abord !')) return;
    setResetting(true);
    try {
      await resetMonthlyStats();
      await clearMonthlyWinners();
      toast.success(`Statistiques réinitialisées pour le nouveau ${draft.contestPeriod === 'week' ? 'semaine' : 'mois'} ✓`);
    } catch { toast.error('Erreur lors de la réinitialisation'); }
    finally { setResetting(false); }
  };

  const showAff   = draft.contestType !== 'agents';
  const showAgent = draft.contestType !== 'affiliates';

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" /> Gestion du Concours
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Configurez et gérez le concours affiliés & agents.</p>
        </div>
        {dirty && (
          <Button onClick={handleSave} disabled={saving}
            className="bg-primary hover:bg-blue-700 text-white border-0 gap-2 rounded-2xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Enregistrer
          </Button>
        )}
      </div>

      {/* ── 1. Statut & Identité ── */}
      <Card className="border-gray-200 shadow-sm rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          {/* Active toggle */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-black text-gray-900">Concours actif</p>
                {draft.contestActive && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest rounded-full">EN COURS</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {draft.contestActive ? 'Le podium est visible par tous les participants.' : 'Le podium est masqué.'}
              </p>
            </div>
            <Switch checked={draft.contestActive} onCheckedChange={v => updateDraft('contestActive', v)} />
          </div>

          {/* Title */}
          <div className="px-5 py-4 border-b border-gray-100">
            <Label className="text-[11px] font-black text-gray-500 uppercase tracking-wider">Titre du concours</Label>
            <Input
              value={draft.contestTitle}
              onChange={e => updateDraft('contestTitle', e.target.value)}
              placeholder="ex: Grand Concours Juillet 2026…"
              className="mt-1.5 h-10 rounded-xl"
            />
          </div>

          {/* Period */}
          <div className="px-5 py-4">
            <Label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2 block">Période</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['week', 'month'] as const).map(p => (
                <button key={p} onClick={() => updateDraft('contestPeriod', p)}
                  className={`py-3 rounded-2xl border text-sm font-black transition-all flex items-center justify-center gap-2 ${
                    draft.contestPeriod === p
                      ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                      : 'border-gray-200 text-gray-600 hover:border-primary/40'
                  }`}>
                  {p === 'week' ? <><Calendar className="h-4 w-4" />📅 Semaine</> : <><Calendar className="h-4 w-4" />🗓️ Mois</>}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Participants & Métriques ── */}
      <Card className="border-gray-200 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
          <CardTitle className="text-[12px] font-black uppercase tracking-widest text-gray-600 flex items-center gap-2">
            <Users className="h-3.5 w-3.5" /> Participants & Métriques
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(['affiliates', 'agents', 'both'] as const).map(t => (
              <button key={t} onClick={() => updateDraft('contestType', t)}
                className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  draft.contestType === t
                    ? 'bg-primary text-white border-primary'
                    : 'border-gray-200 text-gray-600 hover:border-primary/40'
                }`}>
                {t === 'affiliates' ? '🤝 Affiliés' : t === 'agents' ? '⚡ Agents' : '🤝+⚡ Les deux'}
              </button>
            ))}
          </div>
          {showAff && (
            <div>
              <Label className="text-sm font-bold text-gray-700 mb-1.5 block">Affiliés — classés par</Label>
              <Select value={draft.affiliateContestMetric} onValueChange={v => updateDraft('affiliateContestMetric', v as AffMetric)}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['points', 'monthlySales', 'monthlyReferredClients'] as const).map(m => (
                    <SelectItem key={m} value={m}>{METRIC_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {showAgent && (
            <div>
              <Label className="text-sm font-bold text-gray-700 mb-1.5 block">Agents — classés par</Label>
              <Select value={draft.agentContestMetric} onValueChange={v => updateDraft('agentContestMetric', v as AgentMetric)}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['monthlyTransactions', 'commissionBalance'] as const).map(m => (
                    <SelectItem key={m} value={m}>{METRIC_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Date de clôture ── */}
      <Card className="border-gray-200 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
          <CardTitle className="text-[12px] font-black uppercase tracking-widest text-gray-600 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" /> Date de clôture
            {draft.contestEndDate && <CountdownBadge end={draft.contestEndDate} />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <Input
            type="datetime-local"
            value={draft.contestEndDate}
            onChange={e => updateDraft('contestEndDate', e.target.value)}
            className="h-10 rounded-xl"
          />
          <p className="text-[11px] text-gray-400 mt-2">Un compte à rebours animé s'affiche sur le podium des participants.</p>
        </CardContent>
      </Card>

      {/* ── 4. Prix ── */}
      <Card className="border-gray-200 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
          <CardTitle className="text-[12px] font-black uppercase tracking-widest text-gray-600 flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-amber-500" /> Configuration des Prix
          </CardTitle>
          <p className="text-[11px] text-gray-400 mt-1">
            Wallet = crédit automatique sur le solde. Physique = remis en main propre (photo optionnelle).
          </p>
        </CardHeader>
        <CardContent className="p-5 grid sm:grid-cols-3 gap-4">
          {([1, 2, 3] as const).map(rank => (
            <PrizeCard key={rank} rank={rank} prize={draft[`prize${rank}`]}
              onChange={p => updateDraft(`prize${rank}`, p)} />
          ))}
        </CardContent>
      </Card>

      {/* ── 5. Classement live ── */}
      <Card className="border-gray-200 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
          <CardTitle className="text-[12px] font-black uppercase tracking-widest text-gray-600">
            Classement Actuel (Temps Réel)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {showAff && <LiveRanking participants={affRanking} metric={draft.affiliateContestMetric} title="🤝 Affiliés" />}
          {showAgent && <LiveRanking participants={agentRanking} metric={draft.agentContestMetric} title="⚡ Agents" />}
        </CardContent>
      </Card>

      {/* ── 6. Actions ── */}
      <Card className="border-gray-200 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
          <CardTitle className="text-[12px] font-black uppercase tracking-widest text-gray-600">Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-bold gap-2 rounded-2xl"
            onClick={handleAward} disabled={awarding}>
            {awarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
            Décerner les prix & Archiver le concours
          </Button>
          <Button variant="outline"
            className="w-full h-12 border-red-200 text-red-600 hover:bg-red-50 font-bold gap-2 rounded-2xl"
            onClick={handleReset} disabled={resetting}>
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Nouveau {draft.contestPeriod === 'week' ? 'semaine' : 'mois'} — remettre à zéro
          </Button>
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-2xl p-3.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Décernez toujours les prix <strong>avant</strong> de remettre à zéro. La remise à zéro efface tous les compteurs sans récupération possible.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── 7. Palmarès ── */}
      <Card className="border-gray-200 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
          <CardTitle className="text-[12px] font-black uppercase tracking-widest text-gray-600 flex items-center gap-2">
            <History className="h-3.5 w-3.5" /> Palmarès
          </CardTitle>
          <p className="text-[11px] text-gray-400 mt-1">Historique des concours archivés.</p>
        </CardHeader>
        <CardContent className="p-5">
          {histLoading ? (
            <AdminContentSkeleton variant="list" rows={3} />
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-bold">Aucun concours archivé</p>
              <p className="text-xs mt-0.5">Les concours apparaîtront ici après être décernés.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(r => <HistoryItem key={r.id} record={r} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
