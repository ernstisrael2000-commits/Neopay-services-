// ─── Gestion du Concours — Admin ──────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import { onSnapshot, doc, updateDoc, collection, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import {
  Trophy, Star, TrendingUp, Users, Zap, RotateCcw, Award,
  Loader2, Clock, Check, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
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

interface PrizeCfg { amount: number; label: string; emoji: string }
interface ContestCfg {
  contestActive: boolean;
  contestType: ContestType;
  affiliateContestMetric: AffMetric;
  agentContestMetric: AgentMetric;
  prize1: PrizeCfg; prize2: PrizeCfg; prize3: PrizeCfg;
  contestEndDate: string;
}

interface Participant { id: string; name: string; score: number }

const DEFAULT_CFG: ContestCfg = {
  contestActive: false,
  contestType: 'affiliates',
  affiliateContestMetric: 'points',
  agentContestMetric: 'monthlyTransactions',
  prize1: { amount: 500, label: '1er Prix', emoji: '🥇' },
  prize2: { amount: 250, label: '2ème Prix', emoji: '🥈' },
  prize3: { amount: 150, label: '3ème Prix', emoji: '🥉' },
  contestEndDate: '',
};

const METRIC_LABEL: Record<string, string> = {
  points: 'Points accumulés',
  monthlySales: 'Ventes ce mois',
  monthlyReferredClients: 'Clients recrutés ce mois',
  monthlyTransactions: 'Transactions traitées',
  commissionBalance: 'Commissions gagnées ($)',
};

// ── PrizeCard ─────────────────────────────────────────────────────────────────
const PRIZE_COLORS = [
  { bg: 'bg-gradient-to-br from-amber-400 to-yellow-500', ring: 'ring-amber-300', label: 'Or — 1ère place' },
  { bg: 'bg-gradient-to-br from-slate-400 to-slate-500', ring: 'ring-slate-300', label: 'Argent — 2ème place' },
  { bg: 'bg-gradient-to-br from-orange-400 to-amber-600', ring: 'ring-orange-300', label: 'Bronze — 3ème place' },
];

function PrizeCard({
  rank, prize, onChange,
}: {
  rank: 1 | 2 | 3;
  prize: PrizeCfg;
  onChange: (p: PrizeCfg) => void;
}) {
  const c = PRIZE_COLORS[rank - 1];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className={`${c.bg} p-3 flex items-center gap-2`}>
        <Input
          value={prize.emoji}
          onChange={e => onChange({ ...prize, emoji: e.target.value })}
          className="h-8 w-12 text-center text-lg border-0 bg-white/20 text-white placeholder-white/50 p-0 font-bold focus-visible:ring-white/30"
          maxLength={2}
        />
        <p className="text-[11px] font-black text-white/80 flex-1">{c.label}</p>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Libellé du prix</Label>
          <Input
            value={prize.label}
            onChange={e => onChange({ ...prize, label: e.target.value })}
            placeholder="ex: iPhone 15, Bon Cadeau…"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Montant wallet (HTG)</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              value={prize.amount || ''}
              onChange={e => onChange({ ...prize, amount: parseFloat(e.target.value) || 0 })}
              placeholder="0 = pas de crédit"
              className="h-8 text-sm"
            />
            <span className="text-xs text-gray-400 shrink-0">HTG</span>
          </div>
          {prize.amount === 0 && (
            <p className="text-[10px] text-gray-400 mt-0.5">Aucun montant — prix remis en main propre</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mini classement live ───────────────────────────────────────────────────────
function LiveRanking({ participants, metric, title }: { participants: Participant[]; metric: string; title: string }) {
  const ICONS: Record<string, React.ElementType> = { points: Star, monthlySales: TrendingUp, monthlyReferredClients: Users, monthlyTransactions: Zap, commissionBalance: TrendingUp };
  const MetricIcon = ICONS[metric] || Star;
  const unit = { points: 'pts', monthlySales: 'ventes', monthlyReferredClients: 'clients', monthlyTransactions: 'opérations', commissionBalance: '$' }[metric] || '';
  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div>
      <p className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2">{title}</p>
      {participants.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Aucun participant avec des points pour l'instant.</p>
      ) : (
        <div className="space-y-1.5">
          {participants.slice(0, 5).map((p, i) => (
            <div key={p.id} className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2">
              <span className="text-base">{MEDALS[i] || `#${i + 1}`}</span>
              <p className="font-bold text-sm text-gray-800 flex-1 truncate">{p.name}</p>
              <div className="flex items-center gap-1 text-primary">
                <MetricIcon className="h-3 w-3" />
                <span className="text-[11px] font-black">{p.score.toLocaleString('fr-FR')} {unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function AdminContestManager() {
  const [cfg, setCfg]           = useState<ContestCfg>(DEFAULT_CFG);
  const [draft, setDraft]       = useState<ContestCfg>(DEFAULT_CFG);
  const [dirty, setDirty]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [affRanking, setAffRanking]   = useState<Participant[]>([]);
  const [agentRanking, setAgentRanking] = useState<Participant[]>([]);

  // ── Écoute settings ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      const loaded: ContestCfg = {
        contestActive: d.contestActive ?? false,
        contestType: d.contestType ?? 'affiliates',
        affiliateContestMetric: d.affiliateContestMetric ?? 'points',
        agentContestMetric: d.agentContestMetric ?? 'monthlyTransactions',
        prize1: d.prize1 ?? DEFAULT_CFG.prize1,
        prize2: d.prize2 ?? DEFAULT_CFG.prize2,
        prize3: d.prize3 ?? DEFAULT_CFG.prize3,
        contestEndDate: d.contestEndDate ?? '',
      };
      setCfg(loaded);
      setDraft(loaded);
      setDirty(false);
    });
    return unsub;
  }, []);

  // ── Écoute classements live ──────────────────────────────────────────────
  useEffect(() => {
    const metric = draft.affiliateContestMetric;
    const unsub = onSnapshot(collection(db, 'affiliates'), snap => {
      const all: Participant[] = snap.docs
        .map(d => ({ id: d.id, name: d.data().name || 'Affilié', score: d.data()[metric] || 0 }))
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score);
      setAffRanking(all);
    });
    return unsub;
  }, [draft.affiliateContestMetric]);

  useEffect(() => {
    const metric = draft.agentContestMetric;
    const unsub = onSnapshot(collection(db, 'agents'), snap => {
      const all: Participant[] = snap.docs
        .map(d => ({ id: d.id, name: d.data().name || 'Agent', score: d.data()[metric] || 0 }))
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score);
      setAgentRanking(all);
    });
    return unsub;
  }, [draft.agentContestMetric]);

  const updateDraft = useCallback(<K extends keyof ContestCfg>(key: K, val: ContestCfg[K]) => {
    setDraft(d => ({ ...d, [key]: val }));
    setDirty(true);
  }, []);

  // ── Sauvegarde ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'settings', 'global'), {
        contestActive: draft.contestActive,
        contestType: draft.contestType,
        affiliateContestMetric: draft.affiliateContestMetric,
        agentContestMetric: draft.agentContestMetric,
        prize1: draft.prize1,
        prize2: draft.prize2,
        prize3: draft.prize3,
        contestEndDate: draft.contestEndDate || null,
      });
      setDirty(false);
      toast.success('Configuration du concours sauvegardée ✓');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // ── Décerner les prix ────────────────────────────────────────────────────
  const handleAward = async () => {
    setAwarding(true);
    try {
      if (draft.contestType === 'affiliates' || draft.contestType === 'both') {
        await awardMonthlyPrizes();
        toast.success('Prix affiliés décernés ✓');
      }
      if (draft.contestType === 'agents' || draft.contestType === 'both') {
        await awardAgentMonthlyPrizes();
        toast.success('Prix agents décernés ✓');
      }
    } catch {
      toast.error('Erreur lors de la distribution des prix');
    } finally {
      setAwarding(false);
    }
  };

  // ── Réinitialiser ────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!window.confirm('Réinitialiser TOUS les compteurs mensuels ? Décernez les prix avant !')) return;
    setResetting(true);
    try {
      await resetMonthlyStats();
      await clearMonthlyWinners();
      toast.success('Statistiques et classement réinitialisés pour le nouveau mois ✓');
    } catch {
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setResetting(false);
    }
  };

  const showAff   = draft.contestType !== 'agents';
  const showAgent = draft.contestType !== 'affiliates';

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-900">Gestion du Concours</h2>
          <p className="text-sm text-gray-500 mt-0.5">Configurez le concours mensuel affiliés & agents.</p>
        </div>
        {dirty && (
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-blue-700 text-white border-0 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Enregistrer les changements
          </Button>
        )}
      </div>

      {/* ── Toggle actif ── */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-black text-gray-900">Concours actif</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {draft.contestActive
                ? 'Le podium est visible par tous les affiliés et agents.'
                : 'Le podium est masqué — les participants ne voient rien.'}
            </p>
          </div>
          <Switch
            checked={draft.contestActive}
            onCheckedChange={v => updateDraft('contestActive', v)}
          />
        </CardContent>
      </Card>

      {/* ── Type de concours ── */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
          <CardTitle className="text-[13px] font-black uppercase tracking-widest text-gray-700">Participants</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-3 gap-2">
            {(['affiliates', 'agents', 'both'] as const).map(t => (
              <button
                key={t}
                onClick={() => updateDraft('contestType', t)}
                className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  draft.contestType === t
                    ? 'bg-primary text-white border-primary'
                    : 'border-gray-200 text-gray-600 hover:border-primary/40'
                }`}
              >
                {t === 'affiliates' ? '🤝 Affiliés' : t === 'agents' ? '⚡ Agents' : '🤝+⚡ Les deux'}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Métriques ── */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
          <CardTitle className="text-[13px] font-black uppercase tracking-widest text-gray-700">Métriques de classement</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {showAff && (
            <div className="space-y-1.5">
              <Label className="text-sm font-bold text-gray-700">Affiliés — classés par</Label>
              <Select value={draft.affiliateContestMetric} onValueChange={v => updateDraft('affiliateContestMetric', v as AffMetric)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['points', 'monthlySales', 'monthlyReferredClients'] as const).map(m => (
                    <SelectItem key={m} value={m}>{METRIC_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {showAgent && (
            <div className="space-y-1.5">
              <Label className="text-sm font-bold text-gray-700">Agents — classés par</Label>
              <Select value={draft.agentContestMetric} onValueChange={v => updateDraft('agentContestMetric', v as AgentMetric)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
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

      {/* ── Date de fin (optionnel) ── */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
          <CardTitle className="text-[13px] font-black uppercase tracking-widest text-gray-700 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            Date de fin (optionnel)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <Input
            type="datetime-local"
            value={draft.contestEndDate}
            onChange={e => updateDraft('contestEndDate', e.target.value)}
            className="h-10"
          />
          <p className="text-[11px] text-gray-400 mt-1.5">Si renseignée, un compte à rebours s'affiche sur le podium.</p>
        </CardContent>
      </Card>

      {/* ── Prix ── */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
          <CardTitle className="text-[13px] font-black uppercase tracking-widest text-gray-700 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Configuration des Prix
          </CardTitle>
          <p className="text-[11px] text-gray-400 mt-1">Emoji + libellé (ex: iPhone 15) + montant wallet HTG (0 = pas de crédit automatique).</p>
        </CardHeader>
        <CardContent className="p-5 grid sm:grid-cols-3 gap-3">
          {([1, 2, 3] as const).map(rank => (
            <PrizeCard
              key={rank}
              rank={rank}
              prize={draft[`prize${rank}`]}
              onChange={p => updateDraft(`prize${rank}`, p)}
            />
          ))}
        </CardContent>
      </Card>

      {/* ── Classement live ── */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
          <CardTitle className="text-[13px] font-black uppercase tracking-widest text-gray-700">Classement Actuel (Temps Réel)</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {showAff && (
            <LiveRanking participants={affRanking} metric={draft.affiliateContestMetric} title="🤝 Affiliés" />
          )}
          {showAgent && (
            <LiveRanking participants={agentRanking} metric={draft.agentContestMetric} title="⚡ Agents" />
          )}
        </CardContent>
      </Card>

      {/* ── Actions ── */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
          <CardTitle className="text-[13px] font-black uppercase tracking-widest text-gray-700">Actions Mensuelles</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          {/* Award */}
          <Button
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-bold gap-2"
            onClick={handleAward}
            disabled={awarding}
          >
            {awarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
            Décerner les prix au Top 3
          </Button>

          {/* Reset */}
          <Button
            variant="outline"
            className="w-full h-11 border-red-200 text-red-600 hover:bg-red-50 font-bold gap-2"
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Nouveau mois — remettre à zéro
          </Button>

          <div className="flex items-start gap-2 mt-1 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Décernez toujours les prix <strong>avant</strong> de remettre à zéro. La remise à zéro efface tous les compteurs mensuels (points, ventes, transactions) sans récupération possible.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
