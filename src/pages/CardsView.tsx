import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Check, CreditCard, Eye, LockKeyhole, RefreshCw, ShieldCheck, Snowflake, TriangleAlert, UnlockKeyhole, X } from 'lucide-react';
import { motion } from 'motion/react';
import { createHeyQOCard, depositToCard, freezeCard, getSecureView, terminateCard, unfreezeCard, useClientCards, withdrawFromCard } from '../services/cardsService';
import type { HeyQOCard, HeyQOCardTransaction } from '../types';

interface CardsViewProps {
  clientId: string;
  clientName: string;
  onBack: () => void;
  onRequestAuth: () => void;
}

type ViewStatus = 'none' | 'provisioning' | 'kyc_required' | 'active' | 'frozen' | 'terminated' | 'failed';

const statusCopy: Record<ViewStatus, { label: string; detail: string }> = {
  none: { label: 'Aucune carte', detail: 'Votre carte virtuelle n’est pas encore créée.' },
  provisioning: { label: 'Création en cours', detail: 'HeyQO prépare votre carte. Cela peut prendre quelques instants.' },
  kyc_required: { label: 'Vérification requise', detail: 'Une vérification d’identité est nécessaire avant l’émission.' },
  active: { label: 'Carte active', detail: 'Votre carte est prête pour vos paiements en ligne.' },
  frozen: { label: 'Carte gelée', detail: 'Les paiements sont temporairement suspendus.' },
  terminated: { label: 'Carte clôturée', detail: 'Cette carte ne peut plus être utilisée.' },
  failed: { label: 'Émission impossible', detail: 'HeyQO n’a pas pu émettre cette carte. Réessayez ou contactez-nous.' },
};

function mapStatus(status?: string, customerStatus?: string): ViewStatus {
  if (!status) return customerStatus === 'kyc_required' || customerStatus === 'pending_kyc' ? 'kyc_required' : 'none';
  if (status === 'pending' || status === 'processing') return 'provisioning';
  if (status === 'blocked') return 'frozen';
  if (status === 'failed') return 'failed';
  if (status === 'active' || status === 'frozen' || status === 'terminated') return status;
  return 'provisioning';
}

function formatAmount(value: number, currency = 'USD') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value || 0);
}

function CardVisual({ card, clientName }: { card: HeyQOCard; clientName: string }) {
  return (
    <div data-testid="card-visual" className="relative aspect-[1.59/1] w-full max-w-[430px] overflow-hidden rounded-[28px] border border-[#d7b879]/25 bg-[radial-gradient(circle_at_84%_15%,#7b573e_0%,transparent_35%),linear-gradient(135deg,#332a2b_0%,#211d22_54%,#17161c_100%)] p-6 text-[#f8edd5] shadow-[0_22px_70px_rgba(0,0,0,.34)]">
      <div className="absolute -right-14 -top-20 h-64 w-64 rounded-full border border-[#d7b879]/20" />
      <div className="absolute -right-3 -top-9 h-44 w-44 rounded-full border border-[#d7b879]/15" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.3em] text-[#d7b879]">HeyQO / solutionpam</p><p data-testid="text-card-holder" className="mt-2 max-w-[190px] truncate text-lg font-semibold">{card.cardholderName || clientName}</p></div><div className="flex h-11 w-14 items-center justify-center rounded-lg border border-[#f1d397]/30 bg-[#d7b879]/15"><div className="grid grid-cols-2 gap-1 opacity-70">{[1, 2, 3, 4].map((n) => <span key={n} className="h-3 w-5 rounded-sm bg-[#d7b879]/60" />)}</div></div></div>
        <div><p className="mb-1 text-[10px] uppercase tracking-[.28em] text-[#f8edd5]/45">Numéro sécurisé</p><p data-testid="text-card-last4" className="font-mono text-lg tracking-[.18em]">{card.last4 ? `••••  ••••  ••••  ${card.last4}` : '••••  ••••  ••••  ••••'}</p></div>
        <div className="flex items-end justify-between text-[10px] uppercase tracking-[.2em] text-[#f8edd5]/60"><span>Virtual debit</span><span className="text-xl font-black italic tracking-[-.12em] text-[#d7b879]">{card.brand || 'VISA'}</span></div>
      </div>
    </div>
  );
}

function ActionButton({ children, onClick, disabled, danger, testId }: { children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; testId: string }) {
  return <button type="button" data-testid={testId} onClick={onClick} disabled={disabled} className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-transform active:scale-[.98] disabled:opacity-45 ${danger ? 'border border-red-300/30 bg-red-400/10 text-red-200 hover:bg-red-400/15' : 'bg-[#d7b879] text-[#17151a] hover:bg-[#e4c78d]'}`}>{children}</button>;
}

export default function CardsView({ clientId, clientName, onBack, onRequestAuth }: CardsViewProps) {
  const { snapshot, loading, error, refresh } = useClientCards(clientId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [amountMode, setAmountMode] = useState<'deposit' | 'withdraw' | null>(null);
  const [amount, setAmount] = useState('');
  const [kycOpen, setKycOpen] = useState(false);
  const [secureUrl, setSecureUrl] = useState<string | null>(null);
  const intentKeys = useRef<Record<string, string>>({});
  const [kyc, setKyc] = useState({ dateOfBirth: '', addressLine1: '', city: '', postalCode: '', country: 'HT' });
  const card = snapshot?.cards?.[0];
  const status = mapStatus(card?.status, snapshot?.customer?.kycStatus || snapshot?.customer?.status);
  const meta = snapshot?.configured === false
    ? { label: 'Service en configuration', detail: 'L’espace est prêt. L’administration doit encore connecter les identifiants HeyQO.' }
    : statusCopy[status];
  const limit = card?.monthlyLimit || 0;
  const spent = card?.monthlySpent || 0;
  const progress = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  const transactions = useMemo(() => (snapshot?.cardTransactions || []).slice(0, 5), [snapshot?.cardTransactions]);
  const intentKey = (intent: string) => {
    intentKeys.current[intent] ||= crypto.randomUUID();
    return intentKeys.current[intent];
  };

  const submitKyc = async () => {
    if (!kyc.dateOfBirth || !kyc.addressLine1 || !kyc.city || !kyc.country) return setActionError('Complétez les champs obligatoires.');
    setBusy(true); setActionError(null);
    try {
      await createHeyQOCard('visa', {
        dateOfBirth: kyc.dateOfBirth,
        addressStreet: kyc.addressLine1,
        addressCity: kyc.city,
        addressPostalCode: kyc.postalCode,
        countryCode: kyc.country,
      }, intentKey('issue'));
      delete intentKeys.current.issue;
      setKycOpen(false); setNotice('Votre demande de carte a bien été envoyée.'); await refresh();
    } catch (cause: any) { setActionError(cause?.message || 'La demande n’a pas pu être envoyée.'); } finally { setBusy(false); }
  };
  const doCardAction = async (action: 'freeze' | 'unfreeze' | 'terminate') => {
    if (!card) return;
    if (action === 'terminate' && !window.confirm('Clôturer cette carte ? Cette action est définitive.')) return;
    setBusy(true); setActionError(null);
    try { const key = intentKey(`${action}:${card.id}`); if (action === 'freeze') await freezeCard(card.id, key); if (action === 'unfreeze') await unfreezeCard(card.id, key); if (action === 'terminate') await terminateCard(card.id, key); delete intentKeys.current[`${action}:${card.id}`]; setNotice(action === 'terminate' ? 'Carte clôturée.' : action === 'freeze' ? 'Carte gelée.' : 'Carte dégelée.'); await refresh(); } catch (cause: any) { setActionError(cause?.message || 'L’action n’a pas pu être finalisée.'); } finally { setBusy(false); }
  };
  const submitMoney = async () => {
    const value = Number(amount);
    if (!card || !amountMode || !Number.isFinite(value) || value <= 0) return setActionError('Saisissez un montant valide.');
    if (!window.confirm(amountMode === 'deposit' ? `Confirmer la recharge de ${formatAmount(value)} depuis Wallet ?` : `Confirmer le retrait de ${formatAmount(value)} vers Wallet ?`)) return;
    setBusy(true); setActionError(null);
    const intent = `${amountMode}:${card.id}`;
    try { const key = intentKey(intent); if (amountMode === 'deposit') await depositToCard(card.id, value, key); else await withdrawFromCard(card.id, value, key); delete intentKeys.current[intent]; setNotice(amountMode === 'deposit' ? 'Recharge envoyée vers HeyQO.' : 'Retrait envoyé vers Wallet.'); setAmount(''); setAmountMode(null); await refresh(); } catch (cause: any) { setActionError(cause?.message || 'Cette opération n’a pas pu être effectuée.'); } finally { setBusy(false); }
  };
  const openSecureView = async () => {
    if (!card) return;
    setBusy(true); setActionError(null);
    try { const result = await getSecureView(card.id) as { url?: string; secureViewUrl?: string }; const url = result?.url || result?.secureViewUrl; if (!url || !url.startsWith('https://heyqo.cash/')) throw new Error('Vue sécurisée invalide.'); setSecureUrl(url); } catch (cause: any) { setActionError(cause?.message || 'La vue sécurisée est indisponible.'); } finally { setBusy(false); }
  };

  return <main data-testid="cards-view" className="min-h-[100dvh] bg-[#17151a] px-4 pb-10 text-[#f8edd5] sm:px-8"><div className="mx-auto max-w-5xl">
    <header className="flex items-center justify-between py-5 sm:py-8"><button type="button" data-testid="button-back-cards" onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-[#f8edd5]/65 hover:text-[#f8edd5]"><ArrowLeft className="h-4 w-4" /> Retour</button><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.22em] text-[#d7b879]"><ShieldCheck className="h-4 w-4" /> Espace sécurisé</div></header>
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="grid gap-8 lg:grid-cols-[1fr_.8fr] lg:items-center"><div><p className="mb-3 text-xs font-bold uppercase tracking-[.25em] text-[#d7b879]">Carte virtuelle HeyQO</p><h1 data-testid="heading-cards" className="max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-.04em] sm:text-6xl">Votre argent, <em className="font-serif font-normal text-[#d7b879]">à portée.</em></h1><p className="mt-5 max-w-md text-base leading-7 text-[#f8edd5]/58">Une carte pensée pour vos paiements en ligne, avec le contrôle et la tranquillité d’esprit Solutionpam.</p></div><div className="rounded-[30px] border border-[#f8edd5]/10 bg-[#211d22] p-3 sm:p-5">{loading ? <div data-testid="loading-card" className="aspect-[1.59/1] animate-pulse rounded-[28px] bg-[#30292d]" /> : card ? <CardVisual card={card} clientName={clientName} /> : <div data-testid="empty-card" className="flex aspect-[1.59/1] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#d7b879]/35 bg-[#2a2328] px-8 text-center"><CreditCard className="mb-4 h-9 w-9 text-[#d7b879]" /><p className="font-semibold">Votre carte vous attend</p><p className="mt-2 text-sm text-[#f8edd5]/50">Demandez votre carte virtuelle en quelques étapes.</p></div>}</div></motion.section>
    <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_.8fr]"><div className="rounded-[26px] border border-[#f8edd5]/10 bg-[#211d22] p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.2em] text-[#f8edd5]/40">État de la carte</p><p data-testid="status-card" className="mt-2 text-2xl font-semibold">{meta.label}</p></div><span className="rounded-full bg-[#d7b879]/15 px-3 py-1 text-xs font-bold text-[#d7b879]">{snapshot?.stale ? 'Dernière mise à jour' : 'Protégée'}</span></div><p data-testid="text-card-status-detail" className="mt-3 text-sm leading-6 text-[#f8edd5]/55">{meta.detail}</p>{(error || actionError) && <div data-testid="error-card-action" role="alert" className="mt-4 flex gap-2 rounded-2xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-200"><TriangleAlert className="h-4 w-4 shrink-0" />{error || actionError}</div>}{notice && <div data-testid="notice-card-action" className="mt-4 flex gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-200"><Check className="h-4 w-4 shrink-0" />{notice}</div>}
    <div className="mt-6 grid gap-3 sm:grid-cols-2">{snapshot?.configured !== false && (status === 'none' || status === 'failed' || status === 'kyc_required') && <ActionButton testId="button-request-card" onClick={() => setKycOpen(true)} disabled={busy}><ShieldCheck className="h-4 w-4" />{status === 'kyc_required' ? 'Compléter ma vérification' : 'Demander ma carte'}</ActionButton>}{status === 'provisioning' && <ActionButton testId="button-refresh-card" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-4 w-4" /> Actualiser le statut</ActionButton>}{status === 'kyc_required' && <ActionButton testId="button-request-auth" onClick={onRequestAuth}>Vérifier mon identité</ActionButton>}{(status === 'active' || status === 'frozen') && <><ActionButton testId="button-secure-view" onClick={() => void openSecureView()} disabled={busy}><Eye className="h-4 w-4" /> Voir les détails sécurisés</ActionButton><ActionButton testId={status === 'frozen' ? 'button-unfreeze-card' : 'button-freeze-card'} onClick={() => void doCardAction(status === 'frozen' ? 'unfreeze' : 'freeze')} disabled={busy} danger={status === 'active'}>{status === 'frozen' ? <UnlockKeyhole className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}{status === 'frozen' ? 'Dégeler la carte' : 'Geler la carte'}</ActionButton><ActionButton testId="button-terminate-card" onClick={() => void doCardAction('terminate')} disabled={busy} danger><LockKeyhole className="h-4 w-4" /> Clôturer la carte</ActionButton></>}</div>
    {card && (status === 'active' || status === 'frozen') && <div className="mt-6 grid gap-3 sm:grid-cols-2"><ActionButton testId="button-open-deposit" onClick={() => setAmountMode('deposit')}><ArrowDownToLine className="h-4 w-4" /> Recharger depuis Wallet</ActionButton><ActionButton testId="button-open-withdraw" onClick={() => setAmountMode('withdraw')}><ArrowUpFromLine className="h-4 w-4" /> Retirer vers Wallet</ActionButton></div>}
    </div>
    <div className="space-y-4"><div data-testid="panel-card-balance" className="rounded-[26px] border border-[#d7b879]/15 bg-[#2a2328] p-5 sm:p-7"><p className="text-xs uppercase tracking-[.2em] text-[#d7b879]">Solde disponible HeyQO</p><p data-testid="text-card-balance" className="mt-3 text-3xl font-semibold">{formatAmount(card?.balance || 0, card?.currency || 'USD')}</p><div className="mt-6 flex items-center justify-between text-xs text-[#f8edd5]/55"><span>Limite mensuelle</span><span data-testid="text-card-limit">{limit ? `${formatAmount(spent, card?.currency)} / ${formatAmount(limit, card?.currency)}` : 'Non définie'}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f8edd5]/10"><div data-testid="progress-card-limit" className="h-full rounded-full bg-[#d7b879]" style={{ width: `${progress}%` }} /></div></div><div data-testid="panel-card-history" className="rounded-[26px] border border-[#f8edd5]/10 bg-[#211d22] p-5"><div className="flex justify-between"><p className="text-xs uppercase tracking-[.2em] text-[#f8edd5]/40">Activité récente</p>{snapshot?.stale && <span className="text-xs text-[#d7b879]">Hors ligne</span>}</div>{transactions.length ? transactions.map((tx: HeyQOCardTransaction) => <div data-testid={`row-card-transaction-${tx.id}`} key={tx.id} className="flex items-center justify-between border-b border-[#f8edd5]/8 py-3 last:border-0"><div><p className="text-sm font-medium">{tx.description || (tx.type === 'deposit' ? 'Recharge Wallet' : tx.type === 'withdrawal' ? 'Retrait vers Wallet' : 'Paiement')}</p><p className="text-xs text-[#f8edd5]/40">{tx.status}</p></div><span className="font-mono text-sm">{tx.type === 'withdrawal' || tx.type === 'charge' ? '−' : '+'}{formatAmount(tx.amount, tx.currency)}</span></div>) : <p data-testid="empty-card-history" className="py-6 text-sm text-[#f8edd5]/45">Aucune opération récente.</p>}</div></div></section>
    </div>
    {amountMode && <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#0b0a0d]/80 p-3 backdrop-blur-sm sm:items-center"><div className="w-full max-w-md rounded-[26px] bg-[#2a2328] p-6"><div className="flex justify-between"><h2 className="text-xl font-semibold">{amountMode === 'deposit' ? 'Recharger depuis Wallet' : 'Retirer vers Wallet'}</h2><button type="button" data-testid="button-close-money-modal" onClick={() => setAmountMode(null)}><X className="h-5 w-5" /></button></div><label className="mt-6 block text-sm text-[#f8edd5]/60">Montant ({card?.currency || 'USD'})<input data-testid="input-card-amount" type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 w-full rounded-xl border border-[#f8edd5]/15 bg-[#17151a] p-3 text-lg text-[#f8edd5] outline-none focus:border-[#d7b879]" /></label><div className="mt-5"><ActionButton testId="button-submit-card-money" onClick={() => void submitMoney()} disabled={busy}>{busy ? 'Traitement…' : 'Confirmer l’opération'}</ActionButton></div></div></div>}
    {kycOpen && <div className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-[#0b0a0d]/80 p-3 backdrop-blur-sm sm:items-center"><div className="w-full max-w-lg rounded-[26px] bg-[#2a2328] p-6"><div className="flex justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-[#d7b879]">Émission HeyQO</p><h2 className="mt-2 text-2xl font-semibold">Quelques informations</h2></div><button type="button" data-testid="button-close-kyc" onClick={() => setKycOpen(false)}><X className="h-5 w-5" /></button></div><p className="mt-3 text-sm text-[#f8edd5]/55">Ces informations servent uniquement à la vérification de votre identité et à l’adresse de facturation.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{[['dateOfBirth','Date de naissance','date'],['addressLine1','Adresse','text'],['city','Ville','text'],['postalCode','Code postal','text']].map(([key, label, type]) => <label key={key} className="text-sm text-[#f8edd5]/65">{label}<input data-testid={`input-kyc-${key}`} type={type} value={kyc[key as keyof typeof kyc]} onChange={(e) => setKyc({ ...kyc, [key]: e.target.value })} className="mt-1 w-full rounded-xl border border-[#f8edd5]/15 bg-[#17151a] p-3 text-[#f8edd5] outline-none focus:border-[#d7b879]" /></label>)}</div><div className="mt-5"><ActionButton testId="button-submit-kyc" onClick={() => void submitKyc()} disabled={busy}>{busy ? 'Envoi…' : 'Créer ma carte Visa'}</ActionButton></div></div></div>}
    {secureUrl && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0b0a0d]/80 p-3 backdrop-blur-sm sm:items-center"><div className="relative h-[80dvh] w-full max-w-lg overflow-hidden rounded-[26px] bg-[#f8edd5]"><button type="button" data-testid="button-close-secure-view" onClick={() => setSecureUrl(null)} className="absolute right-3 top-3 z-10 rounded-full bg-[#17151a] p-2 text-[#f8edd5]"><X className="h-4 w-4" /></button><iframe data-testid="iframe-secure-view" title="Vue sécurisée de la carte" src={secureUrl} className="h-full w-full border-0" referrerPolicy="no-referrer" sandbox="allow-scripts allow-forms allow-same-origin" /></div></div>}
  </main>;
}