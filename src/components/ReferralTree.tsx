// ─── Arbre de parrainage — Dashboard Affilié ──────────────────────────────────
import React, { useEffect, useState } from 'react';
import { getAffiliateReferrals } from '../services/affiliateService';
import { Affiliate } from '../types';
import { Loader2, User, Users, ChevronDown, ChevronRight, Crown, Star, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Skeleton } from './ui/skeleton';

// ── Couleurs par niveau ───────────────────────────────────────────────────────
const LEVEL_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  VIP:    { bg: 'bg-violet-50',  text: 'text-violet-700', border: 'border-violet-200', badge: 'bg-violet-600' },
  Elite:  { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200',  badge: 'bg-amber-500' },
  Gold:   { bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-200', badge: 'bg-yellow-500' },
  Silver: { bg: 'bg-gray-50',    text: 'text-gray-600',   border: 'border-gray-200',   badge: 'bg-gray-400' },
  Bronze: { bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200', badge: 'bg-orange-400' },
};

function getColors(level?: string) {
  return LEVEL_COLORS[level || 'Bronze'] || LEVEL_COLORS.Bronze;
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Nœud feuille (niveau 2 — filleul indirect) ────────────────────────────────
function LeafNode({ affiliate, isLast }: { affiliate: Affiliate; isLast: boolean }) {
  const colors = getColors(affiliate.level);
  return (
    <div className="flex items-start gap-2 relative pl-4">
      {/* Connecteur en L */}
      <div className={`absolute left-0 top-0 w-4 border-l-2 border-b-2 border-gray-200 rounded-bl-lg ${isLast ? 'h-5' : 'h-full'}`} />

      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className={`flex-1 flex items-center gap-2 p-2.5 rounded-xl border ${colors.border} ${colors.bg} mb-1.5`}
      >
        {/* Avatar */}
        <div className={`h-7 w-7 rounded-lg ${colors.badge} flex items-center justify-center text-[10px] font-black text-white shrink-0`}>
          {initials(affiliate.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-800 truncate">{affiliate.name}</p>
          <p className={`text-[9px] font-bold ${colors.text}`}>{affiliate.level || 'Bronze'} · {affiliate.referredClients || 0} filleul(s)</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-black text-emerald-600">${(affiliate.totalEarnings || 0).toFixed(0)}</p>
          <p className="text-[9px] text-gray-400">gains</p>
        </div>
      </motion.div>
    </div>
  );
}

// ── Nœud direct (niveau 1 — filleul direct) ───────────────────────────────────
function DirectNode({
  affiliate,
  children,
  isRoot = false,
}: {
  affiliate: Affiliate;
  children: Affiliate[];
  isRoot?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const colors = getColors(affiliate.level);
  const hasChildren = children.length > 0;

  return (
    <div className="relative">
      {/* Nœud principal */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative flex items-center gap-3 p-3 rounded-2xl border-2 ${colors.border} ${colors.bg} ${isRoot ? 'mb-3' : 'mb-2'} ${hasChildren ? 'cursor-pointer' : ''}`}
        onClick={() => hasChildren && setExpanded(e => !e)}
      >
        {/* Avatar */}
        <div className={`h-10 w-10 rounded-xl ${colors.badge} flex items-center justify-center text-sm font-black text-white shrink-0 relative`}>
          {initials(affiliate.name)}
          {isRoot && (
            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
              <Crown className="h-2.5 w-2.5 text-white" />
            </span>
          )}
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-sm text-gray-900 truncate">{affiliate.name}</p>
            {isRoot && <span className="text-[9px] bg-primary text-white font-bold px-1.5 py-0.5 rounded-full">MOI</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-bold ${colors.text}`}>{affiliate.level || 'Bronze'}</span>
            <span className="text-gray-300">·</span>
            <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
              <Users className="h-2.5 w-2.5" />
              {affiliate.referredClients || 0}
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <TrendingUp className="h-2.5 w-2.5" />
              ${(affiliate.totalEarnings || 0).toFixed(0)}
            </span>
          </div>
        </div>

        {/* Expand toggle */}
        {hasChildren && (
          <div className={`h-6 w-6 rounded-lg bg-white/70 flex items-center justify-center shrink-0 ${colors.text}`}>
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />}
          </div>
        )}
      </motion.div>

      {/* Enfants (niveau 2) */}
      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="ml-5 pl-0 overflow-hidden"
          >
            {children.map((child, i) => (
              <LeafNode key={child.id} affiliate={child} isLast={i === children.length - 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
interface Props {
  affiliate: Affiliate;
}

export default function ReferralTree({ affiliate }: Props) {
  const [directReferrals,   setDirect]   = useState<Affiliate[]>([]);
  const [indirectReferrals, setIndirect] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!affiliate.id) return;
    setLoading(true);
    getAffiliateReferrals(affiliate.id)
      .then(({ directReferrals: d, indirectReferrals: i }) => {
        setDirect(d);
        setIndirect(i);
      })
      .finally(() => setLoading(false));
  }, [affiliate.id]);

  // Associer les indirects à leur parent direct
  const childrenOf = (directId: string) =>
    indirectReferrals.filter(r => r.parentAffiliateId === directId);

  const totalMembers = directReferrals.length + indirectReferrals.length;

  return (
    <div className="space-y-4">
      {/* Titre */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-base text-gray-900">Mon Réseau</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {directReferrals.length} parrain(s) direct(s) · {indirectReferrals.length} indirect(s)
          </p>
        </div>
        {totalMembers > 0 && (
          <div className="bg-primary/10 text-primary font-black text-sm px-3 py-1 rounded-full flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {totalMembers}
          </div>
        )}
      </div>

      {/* Légende */}
      <div className="flex gap-3 flex-wrap">
        {[
          { dot: 'bg-primary', label: 'Moi (racine)' },
          { dot: 'bg-emerald-500', label: 'Filleul direct (N1)' },
          { dot: 'bg-gray-300', label: 'Filleul indirect (N2)' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${l.dot}`} />
            <span className="text-[10px] text-gray-500">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Arbre */}
      {loading ? (
        <div className="space-y-3 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-32 rounded-full" /><Skeleton className="h-2.5 w-24 rounded-full" /></div>
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <div className="ml-6 space-y-2 border-l-2 border-gray-100 pl-4">
            {[1, 2, 3].map(i => <div key={i} className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3"><Skeleton className="h-8 w-8 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-28 rounded-full" /><Skeleton className="h-2.5 w-20 rounded-full" /></div></div>)}
          </div>
        </div>
      ) : totalMembers === 0 ? (
        <div className="bg-gray-50 rounded-3xl border border-gray-100 p-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <p className="font-black text-gray-500 text-sm">Aucun filleul pour l'instant</p>
          <p className="text-[11px] text-gray-400 mt-1">Partagez votre code <span className="font-bold text-primary">{affiliate.code}</span> pour recruter !</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 space-y-2">
          {/* Racine : MOI */}
          <DirectNode
            affiliate={affiliate}
            children={[]}
            isRoot
          />

          {/* Connecteur vertical central */}
          {directReferrals.length > 0 && (
            <div className="flex justify-center">
              <div className="w-0.5 h-4 bg-gradient-to-b from-primary/30 to-emerald-400/30" />
            </div>
          )}

          {/* Label niveau 1 */}
          {directReferrals.length > 0 && (
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center mb-1">
              ── Filleuls directs (Niveau 1) ──
            </p>
          )}

          {/* Filleuls directs + leurs enfants */}
          <div className="space-y-1">
            {directReferrals.map(direct => (
              <DirectNode
                key={direct.id}
                affiliate={direct}
                children={childrenOf(direct.id!)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
