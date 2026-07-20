import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift, Loader2, X, CheckCircle2, AlertCircle,
  Wallet, ChevronRight, Search, ShieldCheck, Zap, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { Client } from '../types';
import { useFazerGiftCards, useFazerGiftCardOffers, FazerGiftCategory, FazerOffer } from '../hooks/useFazerTopups';
import { useSettingsCtx } from '../contexts/SettingsContext';
import { useClientData } from '../services/clientService';

interface Props {
  loggedClient?: Client | null;
  onOpenWallet?: () => void;
}

export default function GiftCardsTab({ loggedClient, onOpenWallet }: Props) {
  const { categories, loading, error } = useFazerGiftCards();
  const { settings } = useSettingsCtx();
  const exchangeRate = settings?.exchangeRate || 146;
  const { client: liveClient } = useClientData(loggedClient?.id || null);
  const effectiveClient = liveClient || loggedClient;

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FazerGiftCategory | null>(null);

  const filtered = categories.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="h-12 w-12 rounded-2xl bg-rose-100 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-rose-500 animate-spin" />
      </div>
      <p className="text-sm text-gray-400 font-medium">Chargement des cartes-cadeaux…</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <AlertCircle className="h-10 w-10 text-red-300" />
      <p className="text-sm text-gray-400 text-center">Impossible de charger les cartes-cadeaux.</p>
      <p className="text-xs text-red-400">{error}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-200">
          <Gift className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="font-black text-gray-900 text-base leading-none">Cartes-cadeaux</h2>
          <p className="text-xs text-gray-400 mt-0.5">Amazon, Google Play, Steam et plus</p>
        </div>
        <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black text-emerald-600">En ligne</span>
        </div>
      </div>

      {/* Search */}
      {categories.length > 4 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une carte-cadeau…"
            className="w-full h-11 pl-10 pr-4 rounded-2xl border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 transition-all"
          />
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <Gift className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {search ? `Aucun résultat pour "${search}"` : 'Aucune carte-cadeau disponible.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((cat, i) => (
            <motion.button
              key={cat.category_id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setSelected(cat)}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all text-left group w-full active:scale-[0.98]"
            >
              <div className="relative overflow-hidden bg-gray-100" style={{ paddingBottom: '70%' }}>
                {cat.imageurl ? (
                  <img
                    src={cat.imageurl}
                    alt={cat.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={e => {
                      const t = e.target as HTMLImageElement;
                      t.style.display = 'none';
                      if (t.parentElement) t.parentElement.style.background = 'linear-gradient(135deg, #f43f5e, #ec4899)';
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                    <Gift className="h-8 w-8 text-white/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-white font-black text-xs leading-tight line-clamp-2 drop-shadow">{cat.name}</p>
                </div>
              </div>
              <div className="px-3 py-2.5 flex items-center justify-between">
                <span className="text-[9px] font-black text-rose-500 uppercase tracking-wide flex items-center gap-1">
                  <Gift className="h-2.5 w-2.5" /> Gift Card
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Trust line */}
      <div className="flex items-center justify-center gap-2 py-2">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        <p className="text-[10px] text-gray-400 font-bold">Code livré automatiquement · Paiement sécurisé · 24/7</p>
      </div>

      {/* Dialog */}
      {selected && (
        <GiftCardDialog
          category={selected}
          exchangeRate={exchangeRate}
          loggedClient={effectiveClient || null}
          onClose={() => setSelected(null)}
          onOpenWallet={onOpenWallet}
        />
      )}
    </div>
  );
}

// ── Gift Card Dialog ───────────────────────────────────────────────────────
interface GiftDialogProps {
  category: FazerGiftCategory;
  exchangeRate: number;
  loggedClient: Client | null;
  onClose: () => void;
  onOpenWallet?: () => void;
}

function GiftCardDialog({ category, exchangeRate, loggedClient, onClose, onOpenWallet }: GiftDialogProps) {
  const [visible, setVisible] = useState(true);
  const { offers, loading: offersLoading } = useFazerGiftCardOffers(category.category_id);
  const isAdmin = typeof localStorage !== 'undefined' && !!localStorage.getItem('rena_admin');

  const offerHTG = (offer: FazerOffer) => Math.round(offer.price * exchangeRate);

  const [selectedOffer, setSelectedOffer] = useState<FazerOffer | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [cardCode, setCardCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const balanceUSD = loggedClient?.balance ?? 0;
  const balanceHTG = Math.round(balanceUSD * exchangeRate);

  const handleClose = () => setVisible(false);

  const copyCode = () => {
    if (!cardCode) return;
    navigator.clipboard.writeText(cardCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleOrder = async () => {
    if (!selectedOffer) return;
    if (!loggedClient) { handleClose(); onOpenWallet?.(); return; }
    if (balanceUSD < selectedOffer.price) {
      toast.error(`Solde insuffisant. Vous avez ${balanceHTG.toLocaleString()} HTG.`); return;
    }
    setOrderLoading(true);
    try {
      const res = await fetch('/api/fazer/giftcards/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: loggedClient.id,
          category_id: category.category_id,
          offer_id: selectedOffer.offer_id,
          priceUSD: selectedOffer.price,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur commande.');
      const code = data.code || data.order?.code || data.order?.pin || data.order?.serial || null;
      if (code) {
        setCardCode(code);
        toast.success('🎁 Carte-cadeau achetée avec succès !');
      } else {
        toast.success('🎁 Commande passée ! Le code vous sera communiqué sous peu.');
        handleClose();
      }
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
          key="gc-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            key="gc-card"
            initial={{ scale: 0.93, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.93, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="bg-white w-full rounded-3xl overflow-hidden flex flex-col"
            style={{ maxWidth: 420 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-rose-500 to-pink-600 shrink-0" style={{ minHeight: 88 }}>
              {category.imageurl && (
                <img src={category.imageurl} alt={category.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
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
                    <Gift className="h-2.5 w-2.5" /> Carte-cadeau
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

            {/* Body */}
            {cardCode ? (
              /* ── Code display ── */
              <div className="px-5 py-6 space-y-4">
                <div className="text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-black text-gray-900 text-base">Votre carte-cadeau</p>
                  <p className="text-xs text-gray-400 mt-1">Copiez ce code et utilisez-le sur la plateforme correspondante</p>
                </div>
                <button
                  type="button"
                  onClick={copyCode}
                  className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 hover:border-rose-300 hover:bg-rose-50 transition-all group"
                >
                  <span className="font-mono font-black text-gray-900 text-base tracking-widest">{cardCode}</span>
                  <div className="flex items-center gap-1.5 text-xs font-black text-gray-400 group-hover:text-rose-500 transition-colors">
                    {codeCopied ? (
                      <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Copié !</>
                    ) : (
                      <><Copy className="h-4 w-4" /> Copier</>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black text-sm"
                >
                  Fermer
                </button>
              </div>
            ) : (
              /* ── Offer selection ── */
              <div>
                <div className="px-4 pt-3 pb-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                    Choisissez un montant
                  </p>
                  {offersLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 text-rose-400 animate-spin" /></div>
                  ) : offers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Aucune offre disponible.</p>
                  ) : (
                    <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
                      <div className="grid grid-cols-2 gap-2 pr-1">
                        {offers.map(offer => {
                          const htg = offerHTG(offer);
                          const isSelected = selectedOffer?.offer_id === offer.offer_id;
                          const canAfford = !loggedClient || balanceUSD >= offer.price;
                          return (
                            <button
                              key={offer.offer_id}
                              type="button"
                              onClick={() => setSelectedOffer(isSelected ? null : offer)}
                              className={`relative rounded-2xl p-3 text-left border-2 transition-all active:scale-95 ${
                                isSelected
                                  ? 'border-rose-500 bg-rose-50 shadow-md shadow-rose-100'
                                  : canAfford
                                  ? 'border-gray-100 bg-white hover:border-rose-200 hover:bg-rose-50/50'
                                  : 'border-gray-100 bg-gray-50 opacity-50'
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-rose-500 flex items-center justify-center">
                                  <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                                </div>
                              )}
                              <p className="text-[11px] font-black text-gray-900 leading-tight pr-5">{offer.name}</p>
                              <p className="text-sm font-black text-rose-600 mt-1 leading-none">{htg.toLocaleString()} HTG</p>
                              {isAdmin && <p className="text-[9px] text-gray-400 font-medium mt-0.5">≈ ${offer.price.toFixed(2)}</p>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer CTA */}
                <div className="px-4 pb-5 pt-3 border-t border-gray-100 bg-white shrink-0 space-y-2">
                  {loggedClient ? (
                    <button
                      type="button"
                      onClick={handleOrder}
                      disabled={!selectedOffer || orderLoading}
                      className={`w-full rounded-2xl font-black text-base flex items-center justify-center gap-2.5 transition-all py-4 ${
                        selectedOffer
                          ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-200 hover:shadow-xl active:scale-[0.98]'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {orderLoading
                        ? <><Loader2 className="h-5 w-5 animate-spin" /> Traitement…</>
                        : selectedOffer
                        ? <><Zap className="h-5 w-5" /> Payer {offerHTG(selectedOffer).toLocaleString()} HTG</>
                        : <><Gift className="h-5 w-5" /> Sélectionnez un montant</>
                      }
                    </button>
                  ) : (
                    <button type="button" onClick={() => { handleClose(); onOpenWallet?.(); }}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black text-base flex items-center justify-center gap-2.5 shadow-lg shadow-rose-200 active:scale-[0.98]">
                      <Wallet className="h-5 w-5" /> Se connecter pour payer
                    </button>
                  )}
                  <p className="text-[10px] text-gray-400 text-center font-bold flex items-center justify-center gap-1.5">
                    <ShieldCheck className="h-3 w-3 text-primary" />
                    Code livré automatiquement · Paiement sécurisé
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
