// ─── Podium du Concours — vue affiliés & agents ────────────────────────────
import React, { useState, useEffect } from 'react';
import { onSnapshot, doc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trophy, Clock } from 'lucide-react';
import { motion } from 'motion/react';

// ── Types ────────────────────────────────────────────────────────────────────
interface PrizeCfg {
  type?: 'wallet' | 'physical';
  amount: number;
  label: string;
  emoji: string;
  imageUrl?: string;
  description?: string;
}
interface ContestConfig {
  contestActive: boolean;
  contestType: 'affiliates' | 'agents' | 'both';
  contestTitle?: string;
  contestPeriod?: 'week' | 'month';
  affiliateContestMetric: string;
  agentContestMetric: string;
  contestEndDate?: string;
  prize1: PrizeCfg; prize2: PrizeCfg; prize3: PrizeCfg;
}
interface Participant { id: string; name: string; score: number }
export interface ContestPodiumProps {
  participantId: string;
  participantType: 'affiliate' | 'agent';
}

// ── Metric unit labels ───────────────────────────────────────────────────────
const UNIT: Record<string, string> = {
  points: 'pts', monthlySales: 'ventes', monthlyReferredClients: 'clients',
  monthlyTransactions: 'opérations', commissionBalance: 'HTG',
};

// ── Countdown hook ───────────────────────────────────────────────────────────
function useCountdown(end?: string) {
  const [rem, setRem] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  useEffect(() => {
    if (!end) { setRem(null); return; }
    const tick = () => {
      const diff = new Date(end).getTime() - Date.now();
      if (diff <= 0) { setRem(null); return; }
      setRem({ d: Math.floor(diff / 86400000), h: Math.floor((diff % 86400000) / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end]);
  return rem;
}

// ── Prize badge ──────────────────────────────────────────────────────────────
function PrizeBadge({ prize }: { prize?: PrizeCfg }) {
  if (!prize) return null;
  const isPhysical = prize.type === 'physical';
  if (isPhysical) return (
    <div className="w-full text-center">
      {prize.imageUrl && <img src={prize.imageUrl} alt={prize.label} className="w-full h-12 object-cover rounded-xl mb-1" />}
      <p className="text-[10px] font-black text-gray-600 truncate px-1">{prize.label || '—'}</p>
      {prize.description && <p className="text-[9px] text-gray-400 truncate px-1">{prize.description}</p>}
    </div>
  );
  if (!prize.amount) return <p className="text-[10px] text-gray-400 text-center px-1">{prize.label || '—'}</p>;
  return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-2 py-1 text-center w-full">
      <p className="text-[11px] font-black text-emerald-700">{prize.amount.toLocaleString('fr-FR')} HTG</p>
      <p className="text-[9px] text-emerald-500 truncate">{prize.label}</p>
    </div>
  );
}

// ── Podium step ──────────────────────────────────────────────────────────────
const PODIUM_STYLES = [
  // 2nd
  { height: 72, bg: 'linear-gradient(160deg,#94a3b8,#64748b)', shadow: 'rgba(100,116,139,0.4)' },
  // 1st
  { height: 104, bg: 'linear-gradient(160deg,#f59e0b,#d97706)', shadow: 'rgba(245,158,11,0.45)' },
  // 3rd
  { height: 52, bg: 'linear-gradient(160deg,#fb923c,#ea580c)', shadow: 'rgba(251,146,60,0.4)' },
];
const MEDALS = ['🥈', '🥇', '🥉'];
// visual order: 2nd(idx=1), 1st(idx=0), 3rd(idx=2) → maps from top3[podiumMap[i]]
const PODIUM_MAP = [1, 0, 2]; // visual position → ranking index

const DEFAULT_PRIZE = (rank: 1 | 2 | 3): PrizeCfg => ({
  type: 'wallet',
  amount: rank === 1 ? 500 : rank === 2 ? 250 : 150,
  label: rank === 1 ? '1er Prix' : rank === 2 ? '2ème Prix' : '3ème Prix',
  emoji: rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉',
});

const DEFAULT_CONTEST_CONFIG: ContestConfig = {
  contestActive: false,
  contestType: 'both',
  contestTitle: 'Grand Concours Solutionpam',
  contestPeriod: 'month',
  affiliateContestMetric: 'points',
  agentContestMetric: 'monthlyTransactions',
  prize1: DEFAULT_PRIZE(1),
  prize2: DEFAULT_PRIZE(2),
  prize3: DEFAULT_PRIZE(3),
};

// ── Main component ───────────────────────────────────────────────────────────
export default function ContestPodium({ participantId, participantType }: ContestPodiumProps) {
  const [config, setConfig] = useState<ContestConfig>(DEFAULT_CONTEST_CONFIG);
  const [ranking, setRanking] = useState<Participant[]>([]);
  const countdown = useCountdown(config?.contestEndDate || undefined);

  // Listen to contest config
  useEffect(() => onSnapshot(doc(db, 'settings', 'global'), snap => {
    if (!snap.exists()) return;
    const data = snap.data() as Partial<ContestConfig>;
    setConfig({
      ...DEFAULT_CONTEST_CONFIG,
      ...data,
      contestType: data.contestType || 'both',
      prize1: data.prize1 || DEFAULT_PRIZE(1),
      prize2: data.prize2 || DEFAULT_PRIZE(2),
      prize3: data.prize3 || DEFAULT_PRIZE(3),
    });
  }), []);

  // Live ranking
  useEffect(() => {
    if (!config?.contestActive) return;
    const col = participantType === 'affiliate' ? 'affiliates' : 'agents';
    const metric = participantType === 'affiliate'
      ? (config.affiliateContestMetric || 'points')
      : (config.agentContestMetric || 'monthlyTransactions');
    return onSnapshot(collection(db, col), snap => {
      const all = snap.docs
        .map(d => ({ id: d.id, name: d.data().name || '—', score: d.data()[metric] || 0 }))
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score);
      setRanking(all);
    });
  }, [config?.contestActive, config?.affiliateContestMetric, config?.agentContestMetric, participantType]);

  if (!config.contestActive) {
    return (
      <div className="mx-4 mb-5 rounded-3xl overflow-hidden border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="h-11 w-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <Trophy className="h-5 w-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900">Concours Solutionpam</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Le prochain concours affiliés & agents sera bientôt disponible.
            </p>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-amber-700">
            À venir
          </span>
        </div>
      </div>
    );
  }
  const typeOk = config.contestType === 'both'
    || (participantType === 'affiliate' && config.contestType === 'affiliates')
    || (participantType === 'agent' && config.contestType === 'agents');
  if (!typeOk) return null;

  const prizes = [config.prize1, config.prize2, config.prize3];
  const metric = participantType === 'affiliate' ? config.affiliateContestMetric : config.agentContestMetric;
  const unit = UNIT[metric] || '';
  const top3 = ranking.slice(0, 3);

  const myIdx = ranking.findIndex(p => p.id === participantId);
  const myRank = myIdx >= 0 ? myIdx + 1 : null;
  const myScore = myIdx >= 0 ? ranking[myIdx].score : 0;
  const nextScore = myIdx > 0 ? ranking[myIdx - 1].score : null;
  const gap = nextScore !== null ? nextScore - myScore : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-4 mb-5 rounded-3xl overflow-hidden shadow-xl shadow-blue-900/15"
    >
      {/* ── Hero banner ── */}
      <div className="relative px-5 pt-5 pb-4 overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#0A3D91 0%,#06214D 100%)' }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/[0.04] rounded-full pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-white/[0.04] rounded-full pointer-events-none" />

        <div className="relative z-10 flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">Concours en cours</span>
            </div>
            <p className="text-[19px] font-black text-white leading-snug">
              {config.contestTitle || 'Grand Concours Solutionpam'}
            </p>
            <p className="text-[11px] text-white/50 mt-0.5">
              {participantType === 'affiliate' ? '🤝 Affiliés' : '⚡ Agents'} &nbsp;·&nbsp;
              {config.contestPeriod === 'week' ? 'Cette semaine' : 'Ce mois'}
            </p>
          </div>
          <span className={`mt-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
            config.contestPeriod === 'week'
              ? 'bg-purple-500/25 text-purple-200'
              : 'bg-emerald-500/25 text-emerald-200'
          }`}>
            {config.contestPeriod === 'week' ? '📅 Semaine' : '🗓️ Mois'}
          </span>
        </div>

        {/* Countdown */}
        {countdown ? (
          <div className="relative z-10 flex items-center gap-2">
            <Clock className="h-3 w-3 text-white/40 shrink-0" />
            <div className="flex items-center gap-1.5">
              {[{ v: countdown.d, l: 'j' }, { v: countdown.h, l: 'h' }, { v: countdown.m, l: 'm' }, { v: countdown.s, l: 's' }].map(({ v, l }) => (
                <div key={l} className="flex items-baseline gap-0.5">
                  <span className="text-sm font-black text-white tabular-nums w-5 text-right">{String(v).padStart(2, '0')}</span>
                  <span className="text-[10px] text-white/40 font-bold">{l}</span>
                </div>
              ))}
            </div>
          </div>
        ) : config.contestEndDate ? (
          <p className="relative z-10 text-[11px] text-amber-400 font-bold">⏱️ Concours terminé</p>
        ) : null}
      </div>

      {/* ── Podium ── */}
      <div className="bg-white px-5 pt-5 pb-3">
        {top3.length === 0 ? (
          <p className="text-center text-sm text-gray-300 py-6 font-bold">Aucun participant pour l'instant</p>
        ) : (
          <>
            <div className="flex items-end justify-center gap-2 mb-3">
              {PODIUM_MAP.map((rankIdx, visualPos) => {
                const p = top3[rankIdx];
                const prize = prizes[rankIdx];
                const style = PODIUM_STYLES[visualPos];
                if (!p) return (
                  <div key={visualPos} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-xl bg-gray-100" style={{ height: style.height }} />
                  </div>
                );
                return (
                  <div key={visualPos} className="flex-1 flex flex-col items-center gap-1">
                    {/* Avatar / medal */}
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg shadow-sm border-2 border-white mb-0.5">
                      {MEDALS[visualPos]}
                    </div>
                    {/* Name + score */}
                    <p className="text-[10px] font-black text-gray-700 truncate max-w-[72px] text-center">{p.name.split(' ')[0]}</p>
                    <p className="text-[9px] text-gray-400 mb-1">{p.score.toLocaleString('fr-FR')} {unit}</p>
                    {/* Podium block */}
                    <div
                      className="w-full rounded-t-xl flex items-center justify-center"
                      style={{
                        height: style.height,
                        background: style.bg,
                        boxShadow: `0 8px 20px ${style.shadow}`,
                      }}
                    >
                      <span className="text-white font-black text-base">#{rankIdx + 1}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Prizes row */}
            <div className="flex gap-2 mt-1">
              {PODIUM_MAP.map((rankIdx, visualPos) => (
                <div key={visualPos} className="flex-1">
                  <PrizeBadge prize={prizes[rankIdx]} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── My position ── */}
      <div className="bg-gray-50 border-t border-gray-100 px-4 py-3">
        {myRank !== null ? (
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-sm font-black"
              style={myRank <= 3
                ? { background: PODIUM_STYLES[[1,0,2].indexOf(myRank-1) >= 0 ? [1,0,2].indexOf(myRank-1) : 0].bg, color: 'white' }
                : { background: '#EFF6FF', color: '#2563EB' }
              }
            >
              #{myRank}
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-gray-800">Votre position</p>
              {myRank <= 3 ? (
                <p className="text-[11px] text-emerald-600 font-bold">🎉 Vous êtes sur le podium !</p>
              ) : gap !== null && gap > 0 ? (
                <p className="text-[11px] text-gray-500">
                  <span className="font-black text-primary">+{gap.toLocaleString('fr-FR')} {unit}</span>
                  {' '}pour atteindre le podium
                </p>
              ) : null}
            </div>
            <span className="text-xs font-black text-gray-400">{myScore.toLocaleString('fr-FR')} {unit}</span>
          </div>
        ) : (
          <p className="text-[11px] text-gray-400 text-center">Progressez pour rejoindre le classement 🚀</p>
        )}
      </div>
    </motion.div>
  );
}
