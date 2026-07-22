import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gamepad2, Zap, Loader2, X, CheckCircle2, AlertCircle,
  Wallet, ChevronRight, Search, Flame, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { Client } from '../types';
import { useFazerTopups, useFazerOffers, useFazerValidatableGames, useFazerPriceOverrides, FazerCategory, FazerOffer } from '../hooks/useFazerTopups';
import { isGameAvailableInHaiti } from '../lib/haitiFilter';
import { useSettingsCtx } from '../contexts/SettingsContext';
import { useClientData } from '../services/clientService';

export type { FazerCategory };

// ── Known game accent colours ──────────────────────────────────────────────
const GAME_ACCENTS: Record<string, string> = {
  'free fire': 'from-orange-500 to-red-600',
  'freefire': 'from-orange-500 to-red-600',
  'mobile legends': 'from-blue-600 to-indigo-700',
  'pubg': 'from-yellow-500 to-orange-600',
  'clash of clans': 'from-yellow-400 to-amber-600',
  'brawl stars': 'from-fuchsia-500 to-purple-700',
  'genshin': 'from-sky-500 to-blue-700',
  'roblox': 'from-red-500 to-rose-700',
  'steam': 'from-slate-600 to-slate-800',
  'telegram': 'from-sky-400 to-blue-600',
  default: 'from-purple-600 to-indigo-700',
};
function gameAccent(name: string) {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(GAME_ACCENTS)) {
    if (lower.includes(k)) return v;
  }
  return GAME_ACCENTS.default;
}

// ── Validation state ───────────────────────────────────────────────────────
type ValidState = 'idle' | 'loading' | 'ok' | 'error';

interface Props {
  loggedClient?: Client | null;
  onOpenWallet?: () => void;
}

// ── Main component ─────────────────────────────────────────────────────────
export default function GamesTab({ loggedClient, onOpenWallet }: Props) {
  const { categories, loading, error } = useFazerTopups();
  const validatableGames = useFazerValidatableGames();
  const priceOverrides = useFazerPriceOverrides();
  const { settings } = useSettingsCtx();
  const exchangeRate = settings?.exchangeRate || 146;
  const { client: liveClient } = useClientData(loggedClient?.id || null);
  const effectiveClient = liveClient || loggedClient;

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FazerCategory | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const visibleCategories = categories.filter(c => isGameAvailableInHaiti(c.name));

  // Featured game: prefer Free Fire LATAM — always pinned first in grid
  const freefire =
    visibleCategories.find(c => c.name.toLowerCase().includes('free fire') && c.name.toLowerCase().includes('latam')) ||
    visibleCategories.find(c => c.name.toLowerCase().includes('pubg')) ||
    visibleCategories.find(c => c.name.toLowerCase().includes('mobile legend')) ||
    visibleCategories[0] || null;

  // Grid: Free Fire always first, rest sorted alphabetically, all filtered by search
  const othersFiltered = visibleCategories
    .filter(c => c.category_id !== freefire?.category_id)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));
  const freefireMatchesSearch = !search || (freefire && freefire.name.toLowerCase().includes(search.toLowerCase()));
  const gridItems: FazerCategory[] = [
    ...(freefire && freefireMatchesSearch ? [freefire] : []),
    ...othersFiltered,
  ];

  const openGame = (cat: FazerCategory) => {
    setSelected(cat);
    setIsDialogOpen(true);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="h-12 w-12 rounded-2xl bg-purple-100 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
      </div>
      <p className="text-sm text-gray-400 font-medium">Chargement des jeux…</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <AlertCircle className="h-10 w-10 text-red-300" />
      <p className="text-sm text-gray-400">Impossible de charger les jeux.</p>
      <p className="text-xs text-red-400">{error}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200">
          <Gamepad2 className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="font-black text-gray-900 text-base leading-none">Top-up Jeux</h2>
          <p className="text-xs text-gray-400 mt-0.5">Rechargez vos jeux préférés en HTG</p>
        </div>
        <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black text-emerald-600">En ligne</span>
        </div>
      </div>

      {/* Free Fire Hero Card — toujours visible */}
      {freefire && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => openGame(freefire)}
          className="w-full rounded-3xl overflow-hidden relative group text-left"
          style={{ minHeight: 140 }}
        >
          {/* Background */}
          <div className={`absolute inset-0 bg-gradient-to-br ${gameAccent(freefire.name)}`} />
          {freefire.imageurl && (
            <img
              src={freefire.imageurl}
              alt={freefire.name}
              className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-40 group-hover:scale-105 transition-all duration-500"
            />
          )}
          {/* Overlay pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

          {/* Badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
            <Flame className="h-3 w-3 text-orange-300" />
            <span className="text-[10px] font-black text-white">TOP</span>
          </div>

          <div className="relative p-5 flex items-end justify-between h-full min-h-[140px]">
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest mb-2">
                <Zap className="h-2.5 w-2.5" /> Jeu Vedette
              </span>
              <h3 className="text-2xl font-black text-white leading-none drop-shadow-lg">{freefire.name}</h3>
              <p className="text-white/70 text-xs mt-1 font-medium">Diamonds · Top-up instantané</p>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <ChevronRight className="h-5 w-5 text-white" />
            </div>
          </div>
        </motion.button>
      )}

      {/* Search */}
      {categories.length > 4 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un jeu…"
            className="w-full h-11 pl-10 pr-4 rounded-2xl border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all"
          />
        </div>
      )}

      {/* Games grid — Free Fire toujours en premier */}
      {gridItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <Gamepad2 className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Aucun jeu trouvé.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {gridItems.map((cat, i) => {
            const isFF = cat.category_id === freefire?.category_id;
            return (
              <motion.button
                key={cat.category_id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => openGame(cat)}
                className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all text-left group w-full active:scale-[0.98] ${isFF ? 'border-orange-200 ring-2 ring-orange-300/40' : 'border-gray-100'}`}
              >
                {/* Cover image — vraie image sans filtre coloré */}
                <div className="relative overflow-hidden bg-gray-200" style={{ paddingBottom: '75%' }}>
                  {cat.imageurl ? (
                    <img
                      src={cat.imageurl}
                      alt={cat.name}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={e => {
                        const t = e.target as HTMLImageElement;
                        t.style.display = 'none';
                        t.parentElement!.style.background = `linear-gradient(135deg, #6366f1, #8b5cf6)`;
                      }}
                    />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${gameAccent(cat.name)}`} />
                  )}
                  {/* Léger gradient bas pour lisibilité du texte */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  {isFF && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[8px] font-black">
                      <Flame className="h-2.5 w-2.5" /> TOP
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white font-black text-xs leading-tight line-clamp-2 drop-shadow">{cat.name}</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-3 py-2.5 flex items-center justify-between">
                  <span className="text-[9px] font-black text-purple-600 uppercase tracking-wide flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5" /> Top-up
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Trust line */}
      <div className="flex items-center justify-center gap-2 py-2">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        <p className="text-[10px] text-gray-400 font-bold">Livraison automatique · Paiement sécurisé · 24/7</p>
      </div>

      {/* Game catalog dialog — portal with self-contained AnimatePresence */}
      {isDialogOpen && selected && (
        <GameDialog
          category={selected}
          priceOverrides={priceOverrides}
          loggedClient={effectiveClient || null}
          exchangeRate={exchangeRate}
          onClose={() => { setIsDialogOpen(false); setSelected(null); }}
          onOpenWallet={onOpenWallet}
        />
      )}
    </div>
  );
}

// ── Game Dialog ────────────────────────────────────────────────────────────
export interface DialogProps {
  category: FazerCategory;
  priceOverrides: Record<string, number>;
  loggedClient: Client | null;
  exchangeRate: number;
  onClose: () => void;
  onOpenWallet?: () => void;
}

export function GameDialog({ category, priceOverrides, loggedClient, exchangeRate, onClose, onOpenWallet }: DialogProps) {
  const isAdmin = typeof localStorage !== 'undefined' && !!localStorage.getItem('rena_admin');
  // AnimatePresence lives INSIDE the portal — needed for proper exit animation
  const [visible, setVisible] = useState(true);

  const { offers, fields, loading: offersLoading } = useFazerOffers(category.category_id);

  const offerHTG = (offer: FazerOffer) =>
    offer.offer_id in priceOverrides
      ? priceOverrides[offer.offer_id]
      : Math.round(offer.price * exchangeRate);

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [validState, setValidState] = useState<ValidState>('idle');
  const [validatedUsername, setValidatedUsername] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<FazerOffer | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  const accent = gameAccent(category.name);
  const balanceUSD = loggedClient?.balance ?? 0;
  const balanceHTG = Math.round(balanceUSD * exchangeRate);

  // Trigger close: play exit animation, then unmount via onExitComplete
  const handleClose = () => setVisible(false);

  // ── Validate player ID ──
  const handleValidate = useCallback(async () => {
    if (!fields.length) return;
    const playerFields: Record<string, string> = {};
    for (const f of fields) playerFields[f.key] = fieldValues[f.key] || '';
    if (!Object.values(playerFields).some(v => v.trim())) return;
    setValidState('loading');
    setValidatedUsername(null);
    try {
      const res = await fetch('/api/fazer/topups/validate-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: category.category_id, fields: playerFields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impossible de valider cet identifiant.');
      if (data.valid === false) {
        // ID not found in the game's database
        setValidState('error');
        toast.error('Identifiant introuvable. Vérifiez votre ID dans le jeu et réessayez.');
        return;
      }
      setValidState('ok');
      setValidatedUsername(data.username || null);
      toast.success(data.username ? `✅ Compte trouvé : ${data.username}` : '✅ Identifiant validé avec succès');
    } catch (e: any) {
      setValidState('error');
      toast.error(e.message || 'Erreur de validation. Veuillez réessayer.');
    }
  }, [fields, fieldValues, category.category_id]);

  // ── Place order ──
  const handleOrder = async () => {
    if (!selectedOffer) return;
    if (!loggedClient) { onOpenWallet?.(); return; }
    const playerFields: Record<string, string> = {};
    for (const f of fields) playerFields[f.key] = fieldValues[f.key] || '';
    if (fields.length > 0 && !Object.values(playerFields).some(v => v.trim())) {
      toast.error('Entrez votre ID de joueur avant de payer.'); return;
    }
    if (fields.length > 0 && validState !== 'ok') {
      toast.error('Validez votre ID de joueur avant de payer.'); return;
    }
    if (balanceUSD < selectedOffer.price) {
      toast.error(`Solde insuffisant. Vous avez ${balanceHTG.toLocaleString()} HTG.`); return;
    }
    setOrderLoading(true);
    try {
      const res = await fetch('/api/fazer/topups/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: loggedClient.id,
          category_id: category.category_id,
          offer_id: selectedOffer.offer_id,
          fields: playerFields,
          priceUSD: selectedOffer.price,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur commande.');
      toast.success(`🎮 Commande passée ! ${selectedOffer.name} livré automatiquement.`);
      handleClose();
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de la commande.');
    } finally {
      setOrderLoading(false);
    }
  };

  return createPortal(
    <AnimatePresence onExitComplete={onClose}>
      {visible && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            key="card"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="bg-white w-full sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col"
            style={{ maxWidth: 540, maxHeight: '96vh', height: '92vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className={`relative bg-gradient-to-br ${accent} shrink-0`} style={{ minHeight: 88 }}>
              {category.imageurl && (
                <img src={category.imageurl} alt={category.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              {/* Close button — z-10 ensures it's above the gradient overlay */}
              <button
                type="button"
                onClick={handleClose}
                className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors border border-white/20"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative z-[1] p-4 pb-3 flex items-end justify-between h-full min-h-[88px]">
                <div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest mb-1.5">
                    <Zap className="h-2.5 w-2.5" /> Top-up
                  </span>
                  <h2 className="text-xl font-black text-white drop-shadow-lg leading-tight">{category.name}</h2>
                </div>
                {loggedClient && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/20 backdrop-blur-sm">
                    <Wallet className="h-3 w-3 text-white/80" />
                    <span className="text-white/90 text-[11px] font-black">{balanceHTG.toLocaleString()} HTG</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Body ── */}
            <div className="overflow-y-auto flex-1">
              {/* Step 1 — Grille d'offres */}
              <div className="px-4 pt-4 pb-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                  1 · Choisissez votre offre
                </p>
                {offersLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 text-purple-400 animate-spin" /></div>
                ) : offers.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Aucune offre disponible.</p>
                ) : (
                  <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
                    <div className="grid grid-cols-2 gap-2 pr-1">
                      {offers.map(offer => {
                        const htg = offerHTG(offer);
                        const isSelected = selectedOffer?.offer_id === offer.offer_id;
                        const canAfford = !loggedClient || balanceUSD >= offer.price;
                        return (
                          <button
                            key={offer.offer_id}
                            type="button"
                            onClick={() => {
                              setSelectedOffer(isSelected ? null : offer);
                              if (!isSelected) { setValidState('idle'); setValidatedUsername(null); setFieldValues({}); }
                            }}
                            className={`relative rounded-2xl p-3 text-left border-2 transition-all active:scale-95 ${
                              isSelected
                                ? 'border-purple-500 bg-purple-50 shadow-md shadow-purple-100'
                                : canAfford
                                ? 'border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/50'
                                : 'border-gray-100 bg-gray-50 opacity-50'
                            }`}
                          >
                            {isSelected && (
                              <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-purple-600 flex items-center justify-center">
                                <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                              </div>
                            )}
                            <p className="text-[11px] font-black text-gray-900 leading-tight pr-5">{offer.name}</p>
                            <p className="text-sm font-black text-purple-600 mt-1 leading-none">{htg.toLocaleString()} HTG</p>
                            {isAdmin && <p className="text-[9px] text-gray-400 font-medium mt-0.5">≈ ${offer.price.toFixed(2)}</p>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2 — Champ ID joueur (uniquement si le jeu le requiert ET une offre est sélectionnée) */}
              <AnimatePresence>
                {selectedOffer && fields.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 pt-3 space-y-2.5 border-t border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        2 · {fields.length === 1 ? 'Votre ID Joueur' : 'Vos informations'}
                      </p>
                      {fields.map(f => (
                        <div key={f.key} className="relative">
                          <input
                            type={f.type === 'number' ? 'number' : 'text'}
                            value={fieldValues[f.key] || ''}
                            onChange={e => {
                              setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }));
                              setValidState('idle');
                              setValidatedUsername(null);
                            }}
                            placeholder={f.placeholder || f.label}
                            className={`w-full h-11 px-4 pr-24 rounded-2xl border-2 text-sm font-bold focus:outline-none transition-all ${
                              validState === 'ok' ? 'border-emerald-400 bg-emerald-50' :
                              validState === 'error' ? 'border-red-300 bg-red-50' :
                              'border-gray-200 bg-gray-50 focus:border-purple-300 focus:bg-white'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={handleValidate}
                            disabled={validState === 'loading' || !(fieldValues[f.key] || '').trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-3 rounded-xl bg-purple-600 text-white text-xs font-black disabled:opacity-40 hover:bg-purple-700 transition-colors flex items-center gap-1"
                          >
                            {validState === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Vérifier'}
                          </button>
                        </div>
                      ))}
                      <AnimatePresence>
                        {validState === 'ok' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <p className="text-xs font-black text-emerald-700">{validatedUsername ? `✅ ${validatedUsername}` : 'ID validé avec succès'}</p>
                          </motion.div>
                        )}
                        {validState === 'error' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
                            <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                            <p className="text-xs font-bold text-red-600">ID introuvable. Vérifiez et réessayez.</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Footer CTA ── */}
            <div className="px-4 pb-5 pt-3 border-t border-gray-100 bg-white shrink-0 space-y-2">
              {loggedClient ? (
                <>
                  {/* Solde insuffisant — affiché en rouge si l'offre sélectionnée dépasse le solde */}
                  <AnimatePresence>
                    {selectedOffer && balanceUSD < selectedOffer.price && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200"
                      >
                        <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        <p className="text-xs font-black text-red-600">
                          Solde insuffisant — vous avez {balanceHTG.toLocaleString()} HTG
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button
                    type="button"
                    onClick={handleOrder}
                    disabled={!selectedOffer || orderLoading || (fields.length > 0 && validState !== 'ok') || (!!selectedOffer && balanceUSD < selectedOffer.price)}
                    className={`w-full rounded-2xl font-black text-base flex items-center justify-center gap-2.5 transition-all py-4 ${
                      selectedOffer && balanceUSD < selectedOffer.price
                        ? 'bg-red-50 text-red-400 cursor-not-allowed border-2 border-red-200'
                        : selectedOffer && (fields.length === 0 || validState === 'ok')
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-200 hover:shadow-xl active:scale-[0.98]'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {orderLoading
                      ? <><Loader2 className="h-5 w-5 animate-spin" /> Traitement…</>
                      : selectedOffer && balanceUSD < selectedOffer.price
                      ? <><AlertCircle className="h-5 w-5" /> Solde insuffisant</>
                      : selectedOffer && fields.length > 0 && validState !== 'ok'
                      ? <><AlertCircle className="h-5 w-5" /> Validez votre ID joueur</>
                      : selectedOffer
                      ? <><Zap className="h-5 w-5" /> Payer {offerHTG(selectedOffer).toLocaleString()} HTG</>
                      : <><Gamepad2 className="h-5 w-5" /> Sélectionnez une offre</>
                    }
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => { handleClose(); onOpenWallet?.(); }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-base flex items-center justify-center gap-2.5 shadow-lg shadow-purple-200 active:scale-[0.98]">
                  <Wallet className="h-5 w-5" /> Se connecter pour payer
                </button>
              )}
              <p className="text-[10px] text-gray-400 text-center font-bold flex items-center justify-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-primary" />
                Livraison automatique · Paiement sécurisé
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
