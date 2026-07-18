// ─── Podium Concours — Temps Réel ────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { onSnapshot, doc, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Clock, Star, Zap, Users, TrendingUp } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type AffMetric   = 'points' | 'monthlySales' | 'monthlyReferredClients';
type AgentMetric = 'monthlyTransactions' | 'commissionBalance';
type ContestType = 'affiliates' | 'agents' | 'both';

interface PrizeCfg   { amount: number; label: string; emoji: string }
interface ContestCfg {
  contestActive: boolean;
  contestType: ContestType;
  affiliateContestMetric: AffMetric;
  agentContestMetric: AgentMetric;
  prize1: PrizeCfg; prize2: PrizeCfg; prize3: PrizeCfg;
  contestEndDate?: string;
}
interface Participant { id: string; name: string; score: number; level?: string; photoURL?: string }

// ── Helpers ───────────────────────────────────────────────────────────────────
const DEFAULT_CFG: ContestCfg = {
  contestActive: false, contestType: 'affiliates',
  affiliateContestMetric: 'points', agentContestMetric: 'monthlyTransactions',
  prize1: { amount: 500, label: '1er Prix', emoji: '🥇' },
  prize2: { amount: 250, label: '2ème Prix', emoji: '🥈' },
  prize3: { amount: 150, label: '3ème Prix', emoji: '🥉' },
};

const METRIC_LABEL: Record<string, string> = {
  points: 'pts', monthlySales: 'ventes', monthlyReferredClients: 'clients',
  monthlyTransactions: 'opérations', commissionBalance: 'USD',
};

const METRIC_ICON: Record<string, React.ElementType> = {
  points: Star, monthlySales: TrendingUp, monthlyReferredClients: Users,
  monthlyTransactions: Zap, commissionBalance: TrendingUp,
};

function fmtScore(score: number, metric: string) {
  if (metric === 'commissionBalance') return `$${score.toFixed(2)}`;
  return score.toLocaleString('fr-FR');
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Compte à rebours ──────────────────────────────────────────────────────────
function Countdown({ end }: { end: string }) {
  const [rem, setRem] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = new Date(end).getTime() - Date.now();
      if (diff <= 0) { setRem('Terminé'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRem(d > 0 ? `${d}j ${h}h ${m}m` : `${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [end]);
  return (
    <div className="flex items-center gap-1.5 text-white/70">
      <Clock className="h-3 w-3" />
      <span className="text-[11px] font-bold">{rem}</span>
    </div>
  );
}

// ── Carte podium ──────────────────────────────────────────────────────────────
const PODIUM_STYLES = [
  // #2 — Argent (gauche)
  { outer: 'order-1', base: 'h-16', bg: 'from-slate-400 to-slate-500', ring: 'ring-slate-300', avatar: 'h-12 w-12 text-sm', glow: '' },
  // #1 — Or (centre, surélevé)
  { outer: 'order-2', base: 'h-24', bg: 'from-amber-400 to-yellow-500', ring: 'ring-amber-300', avatar: 'h-16 w-16 text-lg', glow: 'shadow-amber-400/40 shadow-lg' },
  // #3 — Bronze (droite)
  { outer: 'order-3', base: 'h-12', bg: 'from-orange-400 to-amber-600', ring: 'ring-orange-300', avatar: 'h-11 w-11 text-sm', glow: '' },
];

function PodiumSpot({
  rank, participant, prize, metric, isSelf,
}: {
  rank: number; participant?: Participant; prize: PrizeCfg; metric: string; isSelf: boolean;
}) {
  const s = PODIUM_STYLES[rank - 1];
  const unit = METRIC_LABEL[metric] || '';
  const MetricIcon = METRIC_ICON[metric] || Star;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.1 }}
      className={`flex flex-col items-center gap-2 flex-1 ${s.outer}`}
    >
      {/* Prize label */}
      <div className="text-center">
        <span className="text-xl">{prize.emoji}</span>
        {prize.label && <p className="text-[9px] font-bold text-white/70 mt-0.5 leading-tight max-w-[80px] truncate">{prize.label}</p>}
        {prize.amount > 0 && <p className="text-[10px] font-black text-white/90">{prize.amount} HTG</p>}
      </div>

      {/* Avatar */}
      {participant ? (
        <div className={`relative rounded-full ring-2 ${s.ring} ${s.glow}`}>
          <div className={`${s.avatar} rounded-full bg-gradient-to-br ${s.bg} flex items-center justify-center font-black text-white`}>
            {initials(participant.name)}
          </div>
          {isSelf && (
            <span className="absolute -bottom-1 -right-1 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
              <span className="text-[8px] text-white font-black">★</span>
            </span>
          )}
        </div>
      ) : (
        <div className={`${s.avatar} rounded-full border-2 border-dashed border-white/30 flex items-center justify-center`}>
          <span className="text-white/30 text-lg">?</span>
        </div>
      )}

      {/* Name + score */}
      <div className="text-center">
        <p className="text-[11px] font-black text-white leading-tight max-w-[80px] truncate">
          {participant?.name || '—'}
        </p>
        {participant && (
          <div className="flex items-center justify-center gap-0.5 mt-0.5">
            <MetricIcon className="h-2.5 w-2.5 text-white/60" />
            <span className="text-[10px] text-white/70 font-bold">
              {fmtScore(participant.score, metric)} {unit}
            </span>
          </div>
        )}
      </div>

      {/* Podium base */}
      <div className={`w-full ${s.base} rounded-t-xl bg-gradient-to-b ${s.bg} flex items-center justify-center`}>
        <span className="text-white font-black text-xl opacity-40">#{rank}</span>
      </div>
    </motion.div>
  );
}

// ── Podium complet ────────────────────────────────────────────────────────────
function Podium({
  top3, prizes, metric, currentId,
}: {
  top3: Participant[];
  prizes: [PrizeCfg, PrizeCfg, PrizeCfg];
  metric: string;
  currentId?: string;
}) {
  // Affichage : [#2, #1, #3]
  const order: (0 | 1 | 2)[] = [1, 0, 2];
  return (
    <div className="flex items-end gap-2 px-2 pb-0">
      {order.map((idx, i) => (
        <PodiumSpot
          key={i}
          rank={idx + 1}
          participant={top3[idx]}
          prize={prizes[idx]}
          metric={metric}
          isSelf={!!(currentId && top3[idx]?.id === currentId)}
        />
      ))}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
interface Props {
  currentId?: string; // id de l'affilié ou agent connecté (pour highlight)
  forType?: 'affiliates' | 'agents'; // force un type (sinon suit contestType)
}

export default function ContestLeaderboard({ currentId, forType }: Props) {
  const [cfg, setCfg] = useState<ContestCfg>(DEFAULT_CFG);
  const [affTop3, setAffTop3]     = useState<Participant[]>([]);
  const [agentTop3, setAgentTop3] = useState<Participant[]>([]);
  const [myRank, setMyRank]       = useState<number | null>(null);
  const [tab, setTab] = useState<'affiliates' | 'agents'>('affiliates');

  // ── Écoute settings/global ────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setCfg({
        contestActive: d.contestActive ?? false,
        contestType: d.contestType ?? 'affiliates',
        affiliateContestMetric: d.affiliateContestMetric ?? 'points',
        agentContestMetric: d.agentContestMetric ?? 'monthlyTransactions',
        prize1: d.prize1 ?? DEFAULT_CFG.prize1,
        prize2: d.prize2 ?? DEFAULT_CFG.prize2,
        prize3: d.prize3 ?? DEFAULT_CFG.prize3,
        contestEndDate: d.contestEndDate,
      });
    });
    return unsub;
  }, []);

  // ── Affiliés — top 3 en temps réel ───────────────────────────────────────
  useEffect(() => {
    if (!cfg.contestActive) return;
    const showAff = forType ? forType === 'affiliates' : cfg.contestType !== 'agents';
    if (!showAff) return;

    const unsub = onSnapshot(collection(db, 'affiliates'), snap => {
      const metric = cfg.affiliateContestMetric;
      const all: Participant[] = snap.docs
        .map(d => ({ id: d.id, name: d.data().name || 'Affilié', score: d.data()[metric] || 0, level: d.data().level }))
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score);
      setAffTop3(all.slice(0, 3));

      if (currentId) {
        const rank = all.findIndex(p => p.id === currentId);
        setMyRank(rank >= 0 ? rank + 1 : null);
      }
    });
    return unsub;
  }, [cfg.contestActive, cfg.contestType, cfg.affiliateContestMetric, forType, currentId]);

  // ── Agents — top 3 en temps réel ────────────────────────────────────────
  useEffect(() => {
    if (!cfg.contestActive) return;
    const showAgent = forType ? forType === 'agents' : cfg.contestType !== 'affiliates';
    if (!showAgent) return;

    const unsub = onSnapshot(collection(db, 'agents'), snap => {
      const metric = cfg.agentContestMetric;
      const all: Participant[] = snap.docs
        .map(d => ({ id: d.id, name: d.data().name || 'Agent', score: d.data()[metric] || 0 }))
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score);
      setAgentTop3(all.slice(0, 3));

      if (currentId && forType === 'agents') {
        const rank = all.findIndex(p => p.id === currentId);
        setMyRank(rank >= 0 ? rank + 1 : null);
      }
    });
    return unsub;
  }, [cfg.contestActive, cfg.contestType, cfg.agentContestMetric, forType, currentId]);

  if (!cfg.contestActive) return null;

  const showBoth = !forType && cfg.contestType === 'both';
  const showAff  = forType === 'affiliates' || (!forType && cfg.contestType !== 'agents');
  const showAgt  = forType === 'agents'     || (!forType && cfg.contestType !== 'affiliates');

  const prizes: [PrizeCfg, PrizeCfg, PrizeCfg] = [cfg.prize1, cfg.prize2, cfg.prize3];
  const activeMetric = tab === 'agents' ? cfg.agentContestMetric : cfg.affiliateContestMetric;
  const activeTop3   = tab === 'agents' ? agentTop3 : affTop3;
  const activeLabel  = tab === 'agents' ? 'Agents' : 'Affiliés';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl overflow-hidden shadow-xl"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)' }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-amber-400/20 flex items-center justify-center">
              <Trophy className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Concours du Mois</p>
              <p className="text-sm font-black text-white">Classement {activeLabel}</p>
            </div>
          </div>
          {cfg.contestEndDate && <Countdown end={cfg.contestEndDate} />}
        </div>

        {/* Tabs (si both) */}
        {showBoth && (
          <div className="flex gap-2 mt-3">
            {(['affiliates', 'agents'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                  tab === t ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60'
                }`}
              >
                {t === 'affiliates' ? '🤝 Affiliés' : '⚡ Agents'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Podium */}
      <div className="px-4 pb-5">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Podium
              top3={activeTop3}
              prizes={prizes}
              metric={activeMetric}
              currentId={currentId}
            />
          </motion.div>
        </AnimatePresence>

        {/* Position perso */}
        {myRank !== null && myRank > 3 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 bg-white/10 rounded-2xl px-4 py-2.5 flex items-center justify-between"
          >
            <p className="text-[11px] text-white/60 font-bold">Votre position</p>
            <p className="text-sm font-black text-white">#{myRank}</p>
          </motion.div>
        )}
        {myRank !== null && myRank <= 3 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 bg-amber-400/20 border border-amber-400/30 rounded-2xl px-4 py-2.5 text-center"
          >
            <p className="text-[11px] font-black text-amber-300">🎉 Vous êtes sur le podium !</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
