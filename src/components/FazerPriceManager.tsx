import React, { useState, useEffect } from 'react';
import { Loader2, ChevronRight, ChevronLeft, Save, RotateCcw, Gamepad2, DollarSign, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useFazerTopups, useFazerOffers, FazerCategory, FazerOffer } from '../hooks/useFazerTopups';
import { useSettingsCtx } from '../contexts/SettingsContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024';

async function loadOverrides(): Promise<Record<string, number>> {
  const r = await fetch('/api/fazer/price-overrides');
  const data = await r.json();
  return data.overrides || {};
}

async function saveOverride(offerId: string, customPriceHTG: number | null) {
  const r = await fetch('/api/fazer/price-overrides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
    body: JSON.stringify({ offerId, customPriceHTG }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || 'Erreur serveur.');
  }
}

// ── Category picker ───────────────────────────────────────────────────────────
export default function FazerPriceManager() {
  const { categories, loading, error } = useFazerTopups();
  const [selected, setSelected] = useState<FazerCategory | null>(null);

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="text-sm font-medium">Chargement des jeux FazerCards…</span>
    </div>
  );

  if (error) return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
      <p className="text-sm font-bold text-red-600">{error}</p>
      <p className="text-xs text-red-400 mt-1">Vérifiez que FAZERCARDS_API_KEY est bien configurée.</p>
    </div>
  );

  if (selected) return (
    <OfferPriceEditor
      category={selected}
      onBack={() => setSelected(null)}
    />
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-xs font-bold text-blue-700">
          💡 Les jeux et offres viennent directement de FazerCards. Définissez ici un prix HTG personnalisé par offre (sinon : prix USD × taux de change).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map(cat => (
          <button
            key={cat.category_id}
            onClick={() => setSelected(cat)}
            className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/40 hover:shadow-md transition-all text-left group"
          >
            {cat.imageurl ? (
              <img src={cat.imageurl} alt={cat.name} className="h-12 w-12 rounded-xl object-cover border shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Gamepad2 className="h-6 w-6 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm text-gray-900 leading-tight truncate">{cat.name}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Modifier les prix →</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-purple-500 shrink-0 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Offer price editor ────────────────────────────────────────────────────────
function OfferPriceEditor({ category, onBack }: { category: FazerCategory; onBack: () => void }) {
  const { offers, loading } = useFazerOffers(category.category_id);
  const { settings } = useSettingsCtx();
  const exchangeRate = settings?.exchangeRate || 146;

  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loadingOverrides, setLoadingOverrides] = useState(true);

  useEffect(() => {
    loadOverrides()
      .then(o => {
        setOverrides(o);
        // Pre-fill draft with existing overrides
        const d: Record<string, string> = {};
        for (const [k, v] of Object.entries(o)) d[k] = String(v);
        setDraft(d);
      })
      .catch(() => {})
      .finally(() => setLoadingOverrides(false));
  }, []);

  const handleSave = async (offer: FazerOffer) => {
    const val = draft[offer.offer_id];
    const customPriceHTG = val === '' || val === undefined ? null : Number(val);
    if (customPriceHTG !== null && (isNaN(customPriceHTG) || customPriceHTG < 0)) {
      toast.error('Prix invalide.'); return;
    }
    setSaving(s => ({ ...s, [offer.offer_id]: true }));
    try {
      await saveOverride(offer.offer_id, customPriceHTG);
      setOverrides(prev => {
        const next = { ...prev };
        if (customPriceHTG === null) delete next[offer.offer_id];
        else next[offer.offer_id] = customPriceHTG;
        return next;
      });
      toast.success(customPriceHTG === null ? 'Prix par défaut restauré.' : `Prix mis à jour : ${customPriceHTG.toLocaleString()} HTG`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(s => ({ ...s, [offer.offer_id]: false }));
    }
  };

  const handleReset = async (offer: FazerOffer) => {
    setDraft(d => { const next = { ...d }; delete next[offer.offer_id]; return next; });
    setSaving(s => ({ ...s, [offer.offer_id]: true }));
    try {
      await saveOverride(offer.offer_id, null);
      setOverrides(prev => { const next = { ...prev }; delete next[offer.offer_id]; return next; });
      toast.success('Prix remis par défaut.');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(s => ({ ...s, [offer.offer_id]: false }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>
        {category.imageurl && (
          <img src={category.imageurl} alt={category.name} className="h-9 w-9 rounded-xl object-cover border" />
        )}
        <div>
          <h3 className="font-black text-gray-900 text-sm">{category.name}</h3>
          <p className="text-[10px] text-gray-400">Taux actuel : 1 USD = {exchangeRate} HTG</p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
        <p className="text-xs text-amber-700 font-medium">
          Laissez vide pour utiliser le prix automatique (USD × taux de change). Entrez un prix HTG fixe pour le forcer.
        </p>
      </div>

      {(loading || loadingOverrides) ? (
        <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Chargement des offres…</span>
        </div>
      ) : offers.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">Aucune offre disponible.</p>
      ) : (
        <div className="space-y-2">
          {offers.map(offer => {
            const autoHTG = Math.round(offer.price * exchangeRate);
            const hasOverride = offer.offer_id in overrides;
            const isSaving = saving[offer.offer_id];
            const draftVal = draft[offer.offer_id] ?? '';

            return (
              <div
                key={offer.offer_id}
                className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-2xl border transition-all ${hasOverride ? 'border-purple-200 bg-purple-50/40' : 'border-gray-100 bg-white'}`}
              >
                {/* Offer info */}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-gray-900 leading-tight">{offer.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <DollarSign className="h-2.5 w-2.5" />
                      {offer.price.toFixed(2)} USD → {autoHTG.toLocaleString()} HTG auto
                    </span>
                    {hasOverride && (
                      <Badge className="text-[9px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200 h-4">
                        Personnalisé
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Price input */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-40">
                    <Input
                      type="number"
                      min="0"
                      value={draftVal}
                      onChange={e => setDraft(d => ({ ...d, [offer.offer_id]: e.target.value }))}
                      placeholder={`${autoHTG.toLocaleString()} (auto)`}
                      className="h-9 rounded-xl pr-12 text-sm font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">HTG</span>
                  </div>

                  {hasOverride && (
                    <button
                      onClick={() => handleReset(offer)}
                      disabled={isSaving}
                      title="Supprimer le prix personnalisé"
                      className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all disabled:opacity-40"
                    >
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    </button>
                  )}

                  <button
                    onClick={() => handleSave(offer)}
                    disabled={isSaving}
                    className="h-9 px-3 rounded-xl bg-purple-600 text-white text-xs font-black flex items-center gap-1 hover:bg-purple-700 transition-colors disabled:opacity-40"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5" /> Sauver</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
