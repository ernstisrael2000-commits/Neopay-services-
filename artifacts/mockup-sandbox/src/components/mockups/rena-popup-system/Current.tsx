/**
 * Current.tsx — Static reference extract of the Rena product-detail / purchase popup.
 * Source: src/pages/ProductsView.tsx lines 718-987
 *
 * ⚠️  This is a faithful STATIC mockup for the design sandbox only.
 *     Do NOT import from the production app. All data is inlined.
 */

import React, { useState } from 'react';
import {
  X, Star, Clock, ShieldCheck, Zap, Wallet, Tag, Loader2,
} from 'lucide-react';
import './_group.css';

// ── Static mock data ──────────────────────────────────────────────────────────

const MOCK_PRODUCT = {
  id: 'netflix-premium',
  name: 'Netflix Premium',
  // Netflix-brand image substitute (publicly available placeholder that conveys
  // the "streaming service" category, used only because original Firebase asset
  // path is not accessible from the sandbox at build-time).
  image: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&q=80',
  price: '2 100 HTG',
  description:
    "Accès illimité à toutes vos séries et films préférés en qualité Ultra HD 4K. Partagez avec jusqu'à 4 écrans simultanément. Livraison instantanée après paiement.",
  plans: [
    { id: 'basic',    name: '1 Mois — Basique', price: '1 050 HTG' },
    { id: 'standard', name: '1 Mois — Standard', price: '1 575 HTG' },
    { id: 'premium',  name: '1 Mois — Premium',  price: '2 100 HTG' },
    { id: 'annual',   name: '12 Mois — Premium', price: '21 000 HTG' },
  ],
};

const MOCK_CLIENT = {
  name: 'Jean-Pierre M.',
  walletId: 'W-4829',
  phone: '+509 37 00 0000',
  balance: 18, // USD — displayed as HTG via mock rate
};

const MOCK_EXCHANGE_RATE = 146; // 1 USD = 146 HTG (static mock)

// ── Helpers ───────────────────────────────────────────────────────────────────

function balanceHTG(balanceUSD: number): number {
  return Math.round(balanceUSD * MOCK_EXCHANGE_RATE);
}

function applyDiscount(priceStr: string, discountPercent: number): string {
  const numMatch = priceStr.match(/[\d\s]+/);
  if (!numMatch) return priceStr;
  const base = parseInt(numMatch[0].replace(/\s/g, ''), 10);
  const discounted = Math.round(base * (1 - discountPercent / 100));
  return priceStr.replace(numMatch[0], discounted.toLocaleString('fr-FR'));
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface WalletBtnProps {
  price: string;
  balanceUSD: number;
  loading?: boolean;
}
function WalletPayButton({ price, balanceUSD, loading = false }: WalletBtnProps) {
  const htg = balanceHTG(balanceUSD);
  const priceNum = parseInt(price.replace(/\D/g, ''), 10);
  const hasFunds = !isNaN(priceNum) && htg >= priceNum;

  return (
    <button
      type="button"
      disabled={loading || !hasFunds}
      className={[
        'w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all',
        hasFunds ? 'rena-wallet-btn-ok hover:bg-emerald-50' : 'rena-wallet-btn-insufficient',
      ].join(' ')}
    >
      {loading
        ? <Loader2 className="h-5 w-5 animate-spin" />
        : (
          <>
            <Wallet className="h-5 w-5" />
            {hasFunds
              ? `Payer avec mon solde (${htg.toLocaleString()} HTG)`
              : `Solde insuffisant (${htg.toLocaleString()} HTG)`}
          </>
        )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Current() {
  const product = MOCK_PRODUCT;

  const [selectedPlan, setSelectedPlan] = useState(product.plans[2]); // Premium pre-selected
  const [promoInput, setPromoInput] = useState('');
  const [promoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string; discountPercent: number
  } | null>(null);

  // Show the panel open by default in the static mockup
  const [isOpen, setIsOpen] = useState(true);

  const rawPrice = selectedPlan.price;
  const displayPrice = appliedPromo
    ? applyDiscount(rawPrice, appliedPromo.discountPercent)
    : rawPrice;

  const handleApplyPromo = () => {
    // Static mock: "RENA20" gives 20 % off
    if (promoInput.trim().toUpperCase() === 'RENA20') {
      setAppliedPromo({ code: 'RENA20', discountPercent: 20 });
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
  };

  if (!isOpen) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <button
          onClick={() => setIsOpen(true)}
          className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-black text-sm shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
        >
          Rouvrir la fiche produit
        </button>
      </div>
    );
  }

  return (
    /* Outer wrapper — simulates the full-screen fixed-overlay context */
    <div className="relative w-full" style={{ minHeight: '100vh', background: '#f9fafb' }}>

      {/* ── Backdrop ────────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 rena-backdrop"
        style={{ zIndex: 400 }}
        onClick={() => setIsOpen(false)}
      />

      {/* ── Panel ───────────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 flex items-center justify-center pointer-events-none"
        style={{ zIndex: 401 }}
      >
        <div
          className="relative pointer-events-auto bg-white shadow-2xl rena-panel flex flex-col overflow-hidden"
          style={{ width: '100%', height: '100%', maxWidth: '100vw', maxHeight: '100vh' }}
        >

          {/* ── Handle / top bar ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0 border-b border-gray-100">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">
              Détails du produit
            </span>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Fermer les détails du produit"
              className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="h-5 w-5 text-gray-700" />
            </button>
          </div>

          {/* ── Hero image ────────────────────────────────────────────────── */}
          <div className="relative w-full shrink-0" style={{ aspectRatio: '16/7' }}>
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
            {/* gradient overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.20) 45%, transparent 100%)',
              }}
            />

            {/* Close button (on-image) */}
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Fermer les détails du produit"
              className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full flex items-center justify-center border border-white/20 hover:bg-black/60 transition-all"
              style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(8px)' }}
            >
              <X className="h-4 w-4 text-white" />
            </button>

            {/* Category badge */}
            <span
              className="absolute top-4 left-4 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide text-white"
              style={{ background: 'rgba(37,99,235,0.90)', backdropFilter: 'blur(4px)' }}
            >
              Service Premium
            </span>

            {/* Price (bottom-left) */}
            <div className="absolute bottom-4 left-4">
              <p className="text-3xl font-black text-white drop-shadow-lg">
                {displayPrice}
              </p>
            </div>
          </div>

          {/* ── Scrollable content ────────────────────────────────────────── */}
          <div className="flex-1 min-h-0 overflow-y-auto rena-no-scrollbar overscroll-contain">
            <div className="p-5 space-y-5 pb-8">

              {/* Title + rating */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 leading-tight">
                    {product.name}
                  </h2>
                  <p className="text-gray-400 text-sm mt-0.5">
                    Rena Digital · Livraison instantanée
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
                  <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-black text-amber-700">4.9</span>
                </div>
              </div>

              {/* Description */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Guarantee badges */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl rena-badge-emerald">
                  <Clock className="h-5 w-5 text-emerald-500" />
                  <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wide text-center">
                    Livraison 24/7
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl rena-badge-blue">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-wide text-center">
                    100% Sécurisé
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl rena-badge-purple">
                  <Zap className="h-5 w-5 text-purple-500" />
                  <span className="text-[9px] font-black text-purple-700 uppercase tracking-wide text-center">
                    Instantané
                  </span>
                </div>
              </div>

              {/* Plan selection */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                  Choisissez votre plan
                </p>
                {product.plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={[
                      'w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all',
                      selectedPlan.id === plan.id
                        ? 'rena-plan-selected'
                        : 'rena-plan-unselected',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-3">
                      {/* Radio dot */}
                      <div
                        className={[
                          'h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors',
                          selectedPlan.id === plan.id
                            ? 'border-blue-600'
                            : 'border-gray-300',
                        ].join(' ')}
                      >
                        {selectedPlan.id === plan.id && (
                          <div className="h-2 w-2 rounded-full bg-blue-600" />
                        )}
                      </div>
                      <span
                        className={[
                          'font-bold text-sm',
                          selectedPlan.id === plan.id
                            ? 'text-blue-600'
                            : 'text-gray-800',
                        ].join(' ')}
                      >
                        {plan.name}
                      </span>
                    </div>
                    <span
                      className={[
                        'font-black text-base',
                        selectedPlan.id === plan.id
                          ? 'text-blue-600'
                          : 'text-gray-500',
                      ].join(' ')}
                    >
                      {plan.price}
                    </span>
                  </button>
                ))}
              </div>

              {/* ── Promo code section ──────────────────────────────────── */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                  Code promotionnel
                </p>

                {appliedPromo ? (
                  /* Applied chip */
                  <div className="flex items-center gap-2 p-3 rounded-2xl rena-promo-chip">
                    <Tag className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-emerald-700 font-mono">
                        {appliedPromo.code}
                      </p>
                      <p className="text-[10px] text-emerald-600">
                        -{appliedPromo.discountPercent}% appliqué !
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="shrink-0 h-6 w-6 rounded-full bg-emerald-200 flex items-center justify-center hover:bg-emerald-300 transition-colors"
                    >
                      <X className="h-3 w-3 text-emerald-700" />
                    </button>
                  </div>
                ) : (
                  /* Input row */
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ex: RENA20"
                      value={promoInput}
                      onChange={(e) =>
                        setPromoInput(e.target.value.toUpperCase())
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplyPromo();
                      }}
                      className="flex-1 h-11 rounded-2xl border-2 border-gray-200 font-mono text-sm px-4 focus:outline-none focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      disabled={!promoInput.trim()}
                      className="h-11 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black shrink-0 transition-colors"
                    >
                      Appliquer
                    </button>
                  </div>
                )}

                {promoError && (
                  <p className="text-[11px] text-red-500 font-semibold px-1">
                    {promoError}
                  </p>
                )}

                {/* Hint for sandbox */}
                {!appliedPromo && (
                  <p className="text-[10px] text-gray-300 px-1">
                    Essayez le code <span className="font-mono font-bold">RENA20</span> pour tester
                  </p>
                )}
              </div>

              {/* ── Purchase area — intentionally below the fold ─────────── */}
              <div className="rena-purchase-divider space-y-3 pt-1">

                {/* Discounted price comparison row */}
                {appliedPromo && rawPrice !== displayPrice && (
                  <div className="flex items-center justify-between px-2">
                    <span className="text-xs text-gray-400 line-through">
                      {rawPrice}
                    </span>
                    <span className="text-lg font-black text-emerald-600">
                      {displayPrice}
                    </span>
                  </div>
                )}

                {/* Wallet pay button — logged-in state */}
                <WalletPayButton
                  price={displayPrice}
                  balanceUSD={MOCK_CLIENT.balance}
                />

                {/* WhatsApp fallback — shown when wallet balance is insufficient (static "not-logged-in" variant) */}
                <button
                  type="button"
                  className="w-full h-12 rounded-2xl border-2 border-emerald-200 text-emerald-700 font-black flex items-center justify-center gap-2 hover:bg-emerald-50 active:scale-95 transition-all"
                >
                  <Wallet className="h-4 w-4" />
                  Se connecter pour payer
                </button>
              </div>

            </div>
          </div>
          {/* end scrollable */}

        </div>
      </div>
      {/* end panel */}

    </div>
  );
}

export default Current;
