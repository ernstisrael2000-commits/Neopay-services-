import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  Gift,
  LockKeyhole,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Tag,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';

type Plan = {
  id: string;
  title: string;
  detail: string;
  price: number;
  popular?: boolean;
};

const plans: Plan[] = [
  { id: 'basic', title: '1 mois · Basique', detail: '1 écran · HD', price: 1050 },
  { id: 'standard', title: '1 mois · Standard', detail: '2 écrans · Full HD', price: 1575 },
  { id: 'premium', title: '1 mois · Premium', detail: '4 écrans · Ultra HD', price: 2100, popular: true },
  { id: 'annual', title: '12 mois · Premium', detail: '4 écrans · Ultra HD', price: 21000 },
  { id: 'family', title: '12 mois · Famille', detail: '6 écrans · Ultra HD', price: 26500 },
];

const formatHTG = (amount: number) => `${amount.toLocaleString('fr-FR')} HTG`;

export function ModernMobile() {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedId, setSelectedId] = useState('premium');
  const [promo, setPromo] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [showPlans, setShowPlans] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isPaying, setIsPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[2];
  const discount = promoApplied ? Math.round(selected.price * 0.2) : 0;
  const total = (selected.price - discount) * quantity;
  const walletBalance = 11_840;
  const canPay = walletBalance >= total;

  const summaryLabel = useMemo(
    () => `${selected.title.replace(' · ', ' — ')}${quantity > 1 ? ` × ${quantity}` : ''}`,
    [selected.title, quantity],
  );

  const handlePay = () => {
    if (!canPay || isPaying) return;
    setIsPaying(true);
    window.setTimeout(() => {
      setIsPaying(false);
      setPaid(true);
    }, 850);
  };

  if (!isOpen) {
    return (
      <main className="rena-modern-stage rena-modern-reopen">
        <button className="rena-reopen-button" type="button" onClick={() => setIsOpen(true)}>
          Rouvrir l’offre Netflix <ArrowRight size={16} />
        </button>
        <ModernStyles />
      </main>
    );
  }

  return (
    <main className="rena-modern-stage">
      <div className="rena-modern-backdrop" onClick={() => setIsOpen(false)} aria-hidden="true" />
      <section className="rena-modern-modal" role="dialog" aria-modal="true" aria-label="Acheter Netflix Premium">
        <header className="rena-modern-header">
          <div className="rena-grabber" />
          <div className="rena-header-row">
            <div>
              <p className="rena-kicker"><Sparkles size={13} /> SOLUTIONPAM MARKETPLACE</p>
              <h1>Acheter un service</h1>
            </div>
            <button className="rena-close-button" type="button" onClick={() => setIsOpen(false)} aria-label="Fermer">
              <X size={19} />
            </button>
          </div>
        </header>

        <div className="rena-modern-scroll">
          <div className="rena-product-hero">
            <div className="rena-netflix-mark">N</div>
            <div className="rena-hero-copy">
              <div className="rena-service-line"><span className="rena-live-dot" /> Livraison instantanée</div>
              <h2>Netflix Premium</h2>
              <p>Vos films et séries, sans attente.</p>
            </div>
            <div className="rena-hero-orbit" aria-hidden="true"><span /><span /><span /></div>
          </div>

          <div className="rena-trust-strip">
            <span><ShieldCheck size={15} /> Paiement protégé</span>
            <i />
            <span><Zap size={15} /> Activé maintenant</span>
          </div>

          <div className="rena-section">
            <div className="rena-section-heading">
              <div>
                <p className="rena-label">Votre formule</p>
                <h3>{summaryLabel}</h3>
              </div>
              <button className="rena-collapse" type="button" onClick={() => setShowPlans((open) => !open)}>
                {showPlans ? 'Réduire' : 'Modifier'} <ChevronDown size={16} className={showPlans ? 'rena-chevron-open' : ''} />
              </button>
            </div>

            {showPlans && (
              <div className="rena-plan-list">
                {plans.map((plan) => {
                  const isSelected = selected.id === plan.id;
                  return (
                    <button
                      className={`rena-plan ${isSelected ? 'rena-plan-selected-modern' : ''}`}
                      type="button"
                      key={plan.id}
                      onClick={() => setSelectedId(plan.id)}
                      aria-pressed={isSelected}
                    >
                      <span className={`rena-radio ${isSelected ? 'rena-radio-selected' : ''}`}>{isSelected && <Check size={13} />}</span>
                      <span className="rena-plan-copy">
                        <strong>{plan.title}</strong>
                        <small>{plan.detail}</small>
                      </span>
                      {plan.popular && <span className="rena-popular">Choisi</span>}
                      <span className="rena-plan-price">{formatHTG(plan.price)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rena-detail-row">
            <div><Clock3 size={16} /><span><b>Instantané</b><small>Disponible 24/7</small></span></div>
            <div><LockKeyhole size={16} /><span><b>Garanti Solutionpam</b><small>Support local</small></span></div>
          </div>

          <div className="rena-section rena-promo-section">
            <p className="rena-label"><Gift size={14} /> Offre disponible</p>
            {promoApplied ? (
              <div className="rena-promo-applied"><span><Tag size={15} /><b>RENA20</b><small>20% économisés</small></span><button type="button" onClick={() => setPromoApplied(false)}>Retirer</button></div>
            ) : (
              <div className="rena-promo-input">
                <Tag size={16} />
                <input value={promo} onChange={(event) => setPromo(event.target.value.toUpperCase())} placeholder="Ajouter un code promo" aria-label="Code promo" />
                <button type="button" disabled={!promo.trim()} onClick={() => promo.trim() && setPromoApplied(true)}>Appliquer</button>
              </div>
            )}
          </div>

          <div className="rena-quantity-row">
            <span><b>Quantité</b><small>Pour plusieurs comptes</small></span>
            <div className="rena-quantity-control">
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Diminuer la quantité"><Minus size={15} /></button>
              <strong>{quantity}</strong>
              <button type="button" onClick={() => setQuantity((value) => Math.min(4, value + 1))} aria-label="Augmenter la quantité"><Plus size={15} /></button>
            </div>
          </div>
          <div className="rena-scroll-spacer" />
        </div>

        <footer className="rena-modern-footer">
          <div className="rena-total-row">
            <span><small>Total à payer</small><strong>{formatHTG(total)}</strong></span>
            <span className="rena-wallet-balance"><WalletCards size={15} /> Solde&nbsp; {formatHTG(walletBalance)}</span>
          </div>
          <button className={`rena-pay-button ${!canPay ? 'rena-pay-disabled' : ''}`} type="button" disabled={!canPay || isPaying} onClick={handlePay}>
            {isPaying ? <><span className="rena-loader" /> Vérification du paiement…</> : paid ? <><Check size={19} /> Paiement confirmé</> : <><CreditCard size={18} /> Payer avec mon solde <ArrowRight size={17} /></>}
          </button>
          {!canPay && <p className="rena-insufficient">Il vous manque {formatHTG(total - walletBalance)} sur votre solde.</p>}
          {paid && <p className="rena-success-note">Votre accès sera envoyé à l’adresse liée à votre compte.</p>}
          <p className="rena-safe-area-note">Transaction sécurisée · Prix affiché en gourdes haïtiennes</p>
        </footer>
      </section>
      <ModernStyles />
    </main>
  );
}

function ModernStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
      .rena-modern-stage{--ink:#251a2c;--muted:#847889;--cream:#fffaf4;--coral:#f05f4f;--plum:#4d234e;--mint:#cceee1;min-height:100dvh;background:#271d34;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;color:var(--ink);overflow:hidden}
      .rena-modern-backdrop{position:fixed;inset:0;background:rgba(29,18,39,.74);backdrop-filter:blur(11px)}
      .rena-modern-modal{position:fixed;inset:0;display:flex;flex-direction:column;background:var(--cream);animation:renaModalIn .52s cubic-bezier(.22,1,.36,1);max-width:520px;overflow:hidden;box-shadow:0 32px 90px rgba(13,7,20,.35)}
      .rena-modern-header{background:var(--cream);padding:12px 18px 15px;flex:none;border-bottom:1px solid #f4e9df;z-index:2}
      .rena-grabber{width:38px;height:4px;border-radius:9px;background:#ddcfc9;margin:0 auto 17px}
      .rena-header-row{display:flex;align-items:center;justify-content:space-between}.rena-header-row h1{font:700 19px 'Space Grotesk',sans-serif;margin:5px 0 0;letter-spacing:-.03em}.rena-kicker,.rena-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#a08491;font-weight:700;margin:0;display:flex;align-items:center;gap:5px}.rena-kicker svg{color:var(--coral)}
      .rena-close-button{height:38px;width:38px;border:1px solid #eedfd7;background:#fff4ed;color:var(--plum);border-radius:13px;display:grid;place-items:center;transition:transform .2s,background .2s}.rena-close-button:active{transform:scale(.92);background:#fbe1d9}
      .rena-modern-scroll{overflow-y:auto;overscroll-behavior:contain;flex:1;min-height:0;padding:17px 18px 0}.rena-product-hero{height:128px;border-radius:22px;overflow:hidden;position:relative;padding:19px;color:#fff;background:linear-gradient(132deg,#471e4c 0%,#71344e 53%,#ee654f 100%);display:flex;align-items:flex-end}.rena-product-hero:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 90% 15%,rgba(255,219,176,.4),transparent 28%),linear-gradient(110deg,transparent 43%,rgba(255,255,255,.06) 43%,transparent 44%)}.rena-netflix-mark{position:absolute;right:20px;top:18px;font:700 64px 'Space Grotesk',sans-serif;color:rgba(255,241,222,.16);line-height:1}.rena-hero-copy{position:relative;z-index:1}.rena-hero-copy h2{font:700 24px 'Space Grotesk',sans-serif;letter-spacing:-.05em;margin:5px 0 2px}.rena-hero-copy p{font-size:12px;margin:0;color:#f8dbd0}.rena-service-line{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#ffd9b5;font-weight:700;display:flex;align-items:center;gap:6px}.rena-live-dot{height:6px;width:6px;background:#baf2c5;border-radius:50%;box-shadow:0 0 0 4px rgba(186,242,197,.13);animation:renaPulse 1.7s infinite}.rena-hero-orbit{position:absolute;right:36px;bottom:26px;width:78px;height:78px;border:1px solid rgba(255,229,198,.23);border-radius:50%}.rena-hero-orbit:after{content:'';position:absolute;inset:11px;border:1px solid rgba(255,229,198,.19);border-radius:50%}.rena-hero-orbit span{position:absolute;height:5px;width:5px;background:#ffcf9a;border-radius:50%;top:-2px;left:38px}.rena-hero-orbit span:nth-child(2){top:35px;left:-3px;background:#f58a78}.rena-hero-orbit span:nth-child(3){top:auto;left:auto;right:13px;bottom:5px;background:#f8ebca}
      .rena-trust-strip{display:flex;justify-content:space-between;align-items:center;padding:13px 3px 16px;color:#8d7180;font-size:10px;font-weight:700}.rena-trust-strip span{display:flex;align-items:center;gap:5px}.rena-trust-strip svg:first-child{color:#31a57f}.rena-trust-strip svg{color:var(--coral)}.rena-trust-strip i{height:15px;width:1px;background:#eadbd3}
      .rena-section{border-top:1px solid #f0e4dc;padding-top:16px}.rena-section-heading{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px}.rena-section-heading h3{font:600 16px 'Space Grotesk',sans-serif;margin:5px 0 0;letter-spacing:-.03em}.rena-collapse{border:0;background:none;color:var(--coral);font-size:11px;font-weight:700;padding:3px 0;display:flex;align-items:center;gap:3px}.rena-collapse svg{transition:transform .2s}.rena-chevron-open{transform:rotate(180deg)}
      .rena-plan-list{display:flex;flex-direction:column;gap:7px}.rena-plan{appearance:none;border:1px solid #f0e5de;background:#fffdfb;border-radius:14px;min-height:57px;text-align:left;padding:9px 11px;display:flex;align-items:center;gap:10px;color:var(--ink);transition:transform .2s,border-color .2s,background .2s;position:relative}.rena-plan:active{transform:scale(.985)}.rena-plan-selected-modern{border:1.5px solid var(--coral);background:#fff0e9;box-shadow:0 4px 13px rgba(240,95,79,.1)}.rena-radio{height:20px;width:20px;flex:none;border:1.5px solid #d9c9c3;border-radius:50%;display:grid;place-items:center;color:white}.rena-radio-selected{background:var(--coral);border-color:var(--coral)}.rena-plan-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:2px}.rena-plan-copy strong{font-size:12px;font-weight:700}.rena-plan-copy small{font-size:10px;color:#9b8990}.rena-plan-price{font:700 12px 'Space Grotesk',sans-serif;white-space:nowrap}.rena-popular{position:absolute;top:-8px;right:10px;padding:3px 7px;background:var(--coral);border-radius:6px;color:white;font-size:8px;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
      .rena-detail-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:17px 0}.rena-detail-row>div{border-radius:13px;padding:11px;background:#f7f1ed;display:flex;gap:8px;align-items:flex-start;color:#d66759}.rena-detail-row span{display:flex;flex-direction:column;gap:2px}.rena-detail-row b{font-size:10px;color:#694e5d}.rena-detail-row small{font-size:9px;color:#9b858d}
      .rena-promo-section{padding-bottom:17px}.rena-promo-section>.rena-label{margin-bottom:9px;color:#987c87}.rena-promo-input{height:43px;display:flex;align-items:center;gap:9px;border:1px solid #eadbd4;background:#fffdfb;border-radius:12px;padding:0 11px;color:#bd988e}.rena-promo-input input{font:500 12px 'DM Sans',sans-serif;min-width:0;flex:1;border:0;outline:0;background:none;color:var(--ink)}.rena-promo-input button,.rena-promo-applied button{border:0;background:none;color:var(--coral);font-size:11px;font-weight:700}.rena-promo-input button:disabled{color:#cdbdb7}.rena-promo-applied{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px dashed #62b893;background:#edf9f2;border-radius:12px;color:#278460}.rena-promo-applied span{display:flex;align-items:center;gap:7px}.rena-promo-applied small{font-size:10px;color:#559b7c;margin-left:2px}
      .rena-quantity-row{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f0e4dc;padding:16px 0 8px}.rena-quantity-row span{display:flex;flex-direction:column;gap:3px}.rena-quantity-row b{font-size:12px}.rena-quantity-row small{font-size:10px;color:#9d898e}.rena-quantity-control{height:34px;display:flex;align-items:center;gap:15px;border:1px solid #eadbd4;border-radius:10px;padding:0 6px;background:#fffdfb}.rena-quantity-control button{border:0;background:none;color:var(--coral);display:grid;place-items:center;padding:3px}.rena-quantity-control strong{font-size:12px;min-width:10px;text-align:center}.rena-scroll-spacer{height:20px}
      .rena-modern-footer{flex:none;background:rgba(255,250,244,.97);border-top:1px solid #eadbd4;padding:13px 18px calc(12px + env(safe-area-inset-bottom));box-shadow:0 -10px 30px rgba(77,35,78,.07);z-index:2}.rena-total-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.rena-total-row>span:first-child{display:flex;flex-direction:column;gap:2px}.rena-total-row small{color:#9a858e;font-size:10px}.rena-total-row strong{font:700 21px 'Space Grotesk',sans-serif;letter-spacing:-.04em}.rena-wallet-balance{color:#398b71;font-size:10px;font-weight:700;display:flex;align-items:center;gap:4px;align-self:flex-end;margin-bottom:3px}.rena-pay-button{width:100%;height:51px;border:0;border-radius:15px;background:var(--coral);color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;font-size:13px;box-shadow:0 8px 18px rgba(240,95,79,.24);transition:transform .2s,background .2s}.rena-pay-button:active{transform:scale(.985)}.rena-pay-disabled{background:#d7c7c2;box-shadow:none}.rena-insufficient,.rena-success-note{text-align:center;font-size:10px;margin:7px 0 0;color:#bd625d}.rena-success-note{color:#398b71}.rena-safe-area-note{text-align:center;color:#b3a0a0;font-size:9px;margin:8px 0 0}.rena-loader{width:14px;height:14px;border:2px solid rgba(255,255,255,.35);border-top-color:white;border-radius:50%;animation:renaSpin .7s linear infinite}.rena-reopen{background:#271d34}.rena-reopen-button{border:0;background:var(--coral);color:#fff;border-radius:13px;padding:13px 17px;font-weight:700;display:flex;align-items:center;gap:8px}
      @keyframes renaModalIn{from{transform:translateY(34px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes renaPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.75)}}@keyframes renaSpin{to{transform:rotate(360deg)}}@media(min-width:600px){.rena-modern-modal{height:min(850px,calc(100dvh - 38px));inset:auto;border-radius:27px}.rena-modern-header{border-radius:27px 27px 0 0}.rena-modern-stage{padding:19px}.rena-modern-backdrop{position:fixed}.rena-modern-scroll{padding-left:22px;padding-right:22px}.rena-modern-footer{padding-left:22px;padding-right:22px;border-radius:0 0 27px 27px}}
    `}</style>
  );
}

export default ModernMobile;