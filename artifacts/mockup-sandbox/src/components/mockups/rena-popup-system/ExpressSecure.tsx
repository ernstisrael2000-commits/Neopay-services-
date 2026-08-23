import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Star,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';

const PLANS = [
  { id: 'basic', label: '1 Mois — Basique', price: '1 050 HTG' },
  { id: 'standard', label: '1 Mois — Standard', price: '1 575 HTG' },
  { id: 'premium', label: '1 Mois — Premium', price: '2 100 HTG' },
  { id: 'annual', label: '12 Mois — Premium', price: '21 000 HTG' },
];

export function ExpressSecure() {
  const [selectedPlan, setSelectedPlan] = useState(PLANS[2]);
  const [payment, setPayment] = useState<'express' | 'wallet'>('express');
  const [open, setOpen] = useState(true);
  const [showPlans, setShowPlans] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [complete, setComplete] = useState(false);

  const purchase = () => {
    setProcessing(true);
    window.setTimeout(() => {
      setProcessing(false);
      setComplete(true);
    }, 700);
  };

  if (!open) {
    return (
      <main className="min-h-[100dvh] bg-[#f5f7fb] flex items-center justify-center p-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-2xl bg-[#3159dc] px-6 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(49,89,220,.22)]"
        >
          Rouvrir la fiche produit
        </button>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#f5f7fb] text-[#17213b]">
      <div className="fixed inset-0 bg-[#17213b]/60 backdrop-blur-[3px]" />
      <section className="fixed inset-0 z-10 mx-auto flex w-full max-w-[430px] flex-col overflow-hidden bg-[#fbfcff] shadow-2xl">
        <header className="relative z-20 flex h-[62px] shrink-0 items-center justify-between border-b border-[#e7ebf4] bg-[#fbfcff]/95 px-5 backdrop-blur">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#8190ad]">Solutionpam Digital</p>
            <p className="mt-0.5 text-sm font-extrabold text-[#17213b]">Finaliser l’achat</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer les détails du produit"
            className="grid h-10 w-10 place-items-center rounded-full bg-[#edf1f8] text-[#52617e] transition-colors hover:bg-[#e1e7f2]"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="pb-36">
            <div className="relative h-[178px] overflow-hidden bg-[#15254f]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_28%,rgba(98,214,193,.75),transparent_27%),radial-gradient(circle_at_18%_90%,rgba(65,101,231,.9),transparent_46%)]" />
              <div className="absolute -right-8 -top-16 h-48 w-48 rounded-full border-[22px] border-white/10" />
              <div className="absolute -bottom-20 left-12 h-52 w-52 rounded-full border-[28px] border-[#7be0cb]/20" />
              <div className="relative flex h-full flex-col justify-end p-5">
                <span className="mb-2 w-fit rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.16em] text-white backdrop-blur">
                  Service premium
                </span>
                <h1 className="text-[27px] font-black leading-none tracking-[-.04em] text-white">Netflix Premium</h1>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#c8d5fa]">
                  <Star className="h-3.5 w-3.5 fill-[#ffd166] text-[#ffd166]" /> 4.9 · Livraison instantanée
                </p>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="rounded-2xl border border-[#dfe7f5] bg-[#f1f5ff] p-4">
                <p className="text-sm leading-relaxed text-[#52617e]">
                  Accès illimité à vos séries et films en Ultra HD 4K. Jusqu’à 4 écrans, activé immédiatement après paiement.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Clock3, label: '24/7', tone: 'text-[#178b78] bg-[#e9faf6]' },
                  { icon: ShieldCheck, label: 'Sécurisé', tone: 'text-[#3159dc] bg-[#edf1ff]' },
                  { icon: Zap, label: 'Instantané', tone: 'text-[#bc7415] bg-[#fff6e4]' },
                ].map(({ icon: Icon, label, tone }) => (
                  <div key={label} className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 ${tone}`}>
                    <Icon className="h-[18px] w-[18px]" />
                    <span className="text-[9px] font-black uppercase tracking-wide">{label}</span>
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#8190ad]">Votre formule</p>
                  <button type="button" onClick={() => setShowPlans((value) => !value)} className="flex items-center gap-1 text-xs font-black text-[#3159dc]">
                    {showPlans ? 'Réduire' : 'Modifier'} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showPlans ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                <div className="rounded-2xl border-2 border-[#3159dc] bg-[#f1f5ff] px-4 py-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-5 w-5 place-items-center rounded-full bg-[#3159dc]"><Check className="h-3 w-3 text-white" /></div>
                      <span className="text-sm font-extrabold text-[#3159dc]">{selectedPlan.label}</span>
                    </div>
                    <span className="text-base font-black text-[#3159dc]">{selectedPlan.price}</span>
                  </div>
                </div>
                {showPlans && (
                  <div className="mt-2 space-y-2">
                    {PLANS.filter((plan) => plan.id !== selectedPlan.id).map((plan) => (
                      <button key={plan.id} type="button" onClick={() => { setSelectedPlan(plan); setShowPlans(false); }} className="flex w-full items-center justify-between rounded-2xl border border-[#e0e6f1] bg-white px-4 py-3 text-left transition-colors hover:border-[#9bb0ef]">
                        <span className="text-sm font-bold text-[#52617e]">{plan.label}</span>
                        <span className="text-sm font-black text-[#52617e]">{plan.price}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[.16em] text-[#8190ad]">Choisissez comment payer</p>
                <button type="button" onClick={() => setPayment('express')} className={`mb-2 w-full rounded-2xl border-2 p-4 text-left transition-all ${payment === 'express' ? 'border-[#178b78] bg-[#effbf8]' : 'border-[#e0e6f1] bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${payment === 'express' ? 'border-[#178b78] bg-[#178b78]' : 'border-[#c6cfdf]'}`}>
                      {payment === 'express' && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-black text-[#17213b]"><Sparkles className="h-4 w-4 text-[#178b78]" /> Paiement express</span>
                        <span className="rounded-full bg-[#d4f4eb] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[#178b78]">Recommandé</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#6d7b96]">Carte bancaire ou portefeuille mobile · sans créer de compte</p>
                    </div>
                  </div>
                </button>
                <button type="button" onClick={() => setPayment('wallet')} className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${payment === 'wallet' ? 'border-[#3159dc] bg-[#f1f5ff]' : 'border-[#e0e6f1] bg-white'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${payment === 'wallet' ? 'border-[#3159dc] bg-[#3159dc]' : 'border-[#c6cfdf]'}`}>
                      {payment === 'wallet' && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <WalletCards className="h-4 w-4 text-[#3159dc]" />
                    <span className="text-sm font-black text-[#17213b]">Mon solde Solutionpam</span>
                    <span className="ml-auto text-xs font-bold text-[#8190ad]">2 628 HTG</span>
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-2 px-1 text-[11px] font-semibold text-[#8190ad]">
                <LockKeyhole className="h-3.5 w-3.5 text-[#178b78]" /> Paiement chiffré et protégé de bout en bout
              </div>
            </div>
          </div>
        </div>

        <footer className="absolute bottom-0 left-0 right-0 z-30 border-t border-[#e1e7f2] bg-[#fbfcff]/95 p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(23,33,59,.08)] backdrop-blur">
          {complete ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#dff7ef] py-4 text-sm font-black text-[#147662]"><Check className="h-5 w-5" /> Paiement confirmé — activation en cours</div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="min-w-[102px]">
                <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#8190ad]">Total</p>
                <p className="text-[21px] font-black tracking-[-.04em] text-[#17213b]">{selectedPlan.price}</p>
              </div>
              <button type="button" onClick={purchase} disabled={processing} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#3159dc] text-sm font-black text-white shadow-[0_10px_22px_rgba(49,89,220,.25)] transition-transform hover:-translate-y-0.5 disabled:opacity-70">
                {processing ? 'Sécurisation…' : payment === 'express' ? 'Payer en express' : 'Payer avec mon solde'}
                {!processing && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          )}
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-[#9aa6bb]"><CreditCard className="h-3 w-3" /> Aucun frais supplémentaire</div>
        </footer>
      </section>
    </main>
  );
}

export default ExpressSecure;