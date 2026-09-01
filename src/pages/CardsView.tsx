import { useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  Bell,
  Check,
  CreditCard,
  Eye,
  LockKeyhole,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  Snowflake,
  TriangleAlert,
  UnlockKeyhole,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import HeyQOKycWizard, { type HeyQOKycValue } from '../components/cards/HeyQOKycWizard';
import {
  createHeyQOCard,
  depositToCard,
  freezeCard,
  getSecureView,
  submitHeyQOCustomerKyc,
  terminateCard,
  unfreezeCard,
  useClientCards,
  withdrawFromCard,
} from '../services/cardsService';
import type { HeyQOCard, HeyQOCardTransaction } from '../types';

interface CardsViewProps {
  clientId: string;
  clientName: string;
  clientPhone?: string;
  onBack: () => void;
  onRequestAuth: () => void;
}

type ViewStatus = 'none' | 'provisioning' | 'kyc_required' | 'active' | 'frozen' | 'terminated' | 'failed';

const statusCopy: Record<ViewStatus, { label: string; detail: string }> = {
  none: { label: 'Aucune carte', detail: 'Votre carte virtuelle n’est pas encore créée.' },
  provisioning: { label: 'Création en cours', detail: 'Solution PAM prépare votre carte. Cela peut prendre quelques instants.' },
  kyc_required: { label: 'Vérification requise', detail: 'Une vérification d’identité est nécessaire avant l’émission.' },
  active: { label: 'Carte active', detail: 'Votre carte est prête pour vos paiements en ligne.' },
  frozen: { label: 'Carte gelée', detail: 'Les paiements sont temporairement suspendus.' },
  terminated: { label: 'Carte clôturée', detail: 'Cette carte ne peut plus être utilisée.' },
  failed: { label: 'Émission impossible', detail: 'La carte n’a pas pu être émise. Réessayez ou contactez-nous.' },
};

function mapStatus(status?: string, customerStatus?: string): ViewStatus {
  if (!status) {
    const kyc = String(customerStatus || '').toLowerCase();
    return ['pending', 'processing', 'submitted', 'rejected', 'kyc_required', 'pending_kyc'].includes(kyc) ? 'kyc_required' : 'none';
  }
  if (status === 'pending' || status === 'processing') return 'provisioning';
  if (status === 'blocked') return 'frozen';
  if (status === 'failed') return 'failed';
  if (status === 'active' || status === 'frozen' || status === 'terminated') return status;
  return 'provisioning';
}

function formatAmount(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return 'Date indisponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date indisponible';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function cardStatusLabel(status: ViewStatus) {
  if (status === 'active') return 'Active';
  if (status === 'frozen') return 'Gelée';
  if (status === 'provisioning') return 'En cours';
  if (status === 'terminated') return 'Clôturée';
  if (status === 'failed') return 'À revoir';
  return 'À créer';
}

function transactionMeta(tx: HeyQOCardTransaction) {
  const description = String(tx.description || '').toLowerCase();
  if (tx.type === 'deposit' || description.includes('recharge')) return { icon: ArrowDownToLine, tone: 'bg-sky-500/20 text-sky-300', positive: true };
  if (tx.type === 'refund' || description.includes('rembourse')) return { icon: RefreshCw, tone: 'bg-emerald-500/20 text-emerald-300', positive: true };
  if (description.includes('netflix')) return { icon: CreditCard, tone: 'bg-red-500/20 text-red-300', positive: false };
  return { icon: CreditCard, tone: 'bg-white/10 text-slate-300', positive: false };
}

function CardLogo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ${className}`}>
      <img data-testid="img-card-logo" src="/solution-pam-logo.png" alt="Logo Solution PAM" className="h-full w-full object-contain p-1" />
    </span>
  );
}

function CardVisual({ card, clientName }: { card: HeyQOCard; clientName: string }) {
  const last4 = card.last4 ? `••••   ••••   ••••   ${card.last4}` : '••••   ••••   ••••   ••••';
  return (
    <div data-testid="card-visual" className="relative aspect-[1.58/1] w-full overflow-hidden rounded-[1.35rem] border border-white/10 bg-[radial-gradient(circle_at_12%_115%,#0e6e9c_0%,transparent_38%),radial-gradient(circle_at_90%_5%,#1d7098_0%,transparent_33%),linear-gradient(135deg,#0d5579_0%,#073553_52%,#061f3a_100%)] p-5 text-white shadow-[0_22px_48px_rgba(1,13,28,.45)] sm:rounded-[1.6rem] sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/[.07]" />
      <div className="pointer-events-none absolute -right-4 -top-10 h-40 w-40 rounded-full border border-white/[.06]" />
      <div className="pointer-events-none absolute -bottom-24 left-16 h-64 w-64 rounded-full border border-white/[.05]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(125deg,transparent_30%,rgba(255,255,255,.16)_31%,transparent_32%),linear-gradient(165deg,transparent_48%,rgba(255,255,255,.12)_49%,transparent_50%)] [background-size:24px_24px]" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CardLogo className="h-9 w-9 sm:h-10 sm:w-10" />
            <div>
              <p data-testid="text-card-brand" className="text-[11px] font-black tracking-[.16em]">SOLUTION PAM</p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[.12em] text-white/55">Carte virtuelle</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-[.1em] text-white/55">Carte</p>
            <p className="text-lg font-black italic tracking-[-.09em]">VISA</p>
          </div>
        </div>

        <div>
          <p data-testid="text-card-last4" className="font-mono text-[clamp(1rem,4vw,1.35rem)] tracking-[.1em] text-white/95">{last4}</p>
          <p className="mt-1 font-mono text-[9px] tracking-[.25em] text-white/50">{card.last4 || '••••'}</p>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[.18em] text-white/50">Titulaire</p>
            <p data-testid="text-card-holder" className="mt-1 max-w-[190px] truncate text-xs font-bold uppercase tracking-[.08em] sm:text-sm">{card.cardholderName || clientName}</p>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[.18em] text-white/50">Détails</p>
              <p className="mt-1 text-xs font-bold text-white/85">Sécurisés</p>
            </div>
            <div className="relative h-6 w-8 opacity-90">
              <span className="absolute right-0 top-0 h-6 w-3 rounded-r-full border-2 border-l-0 border-white" />
              <span className="absolute right-1 top-1 h-4 w-2 rounded-r-full border-2 border-l-0 border-white" />
              <span className="absolute right-2 top-2 h-2 w-1 rounded-r-full border-2 border-l-0 border-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ children, onClick, disabled, danger, testId }: { children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; testId: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition active:scale-[.98] disabled:opacity-45 ${danger ? 'border border-red-300/20 bg-red-400/10 text-red-200 hover:bg-red-400/15' : 'bg-[#0e78b2] text-white shadow-lg shadow-sky-950/20 hover:bg-[#168ac4]'}`}
    >
      {children}
    </button>
  );
}

function QuickAction({ label, icon: Icon, onClick, testId, tone = 'blue', disabled }: { label: string; icon: typeof CreditCard; onClick: () => void; testId: string; tone?: 'blue' | 'red' | 'slate' | 'violet'; disabled?: boolean }) {
  const toneClass = {
    blue: 'bg-sky-400/10 text-sky-300',
    red: 'bg-rose-400/10 text-rose-300',
    slate: 'bg-white/[.06] text-slate-300',
    violet: 'bg-violet-400/10 text-violet-300',
  }[tone];
  return (
    <button type="button" data-testid={testId} onClick={onClick} disabled={disabled} className="flex min-h-[74px] flex-col items-center justify-center gap-2 rounded-xl border border-white/[.07] bg-[#123553]/80 px-1.5 text-center text-[10px] font-bold text-white/90 transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-[#174363] active:scale-[.98] disabled:opacity-45">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${toneClass}`}><Icon className="h-4 w-4" strokeWidth={1.8} /></span>
      <span>{label}</span>
    </button>
  );
}

export default function CardsView({ clientId, clientName, clientPhone = '', onBack }: CardsViewProps) {
  const { snapshot, loading, error, refresh, adoptCard } = useClientCards(clientId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [amountMode, setAmountMode] = useState<'deposit' | 'withdraw' | null>(null);
  const [amount, setAmount] = useState('');
  const [kycOpen, setKycOpen] = useState(false);
  const [secureUrl, setSecureUrl] = useState<string | null>(null);
  const intentKeys = useRef<Record<string, string>>({});
  const card = snapshot?.cards?.[0];
  const customerKycStatus = String(snapshot?.customer?.kycStatus || snapshot?.customer?.status || '').toLowerCase();
  const customerApproved = ['approved', 'verified', 'active', 'completed'].includes(customerKycStatus);
  const status = mapStatus(card?.status, customerKycStatus);
  const meta = snapshot?.configured === false
    ? { label: 'Service en configuration', detail: 'L’espace est prêt. L’administration doit encore connecter les identifiants HeyQO.' }
    : statusCopy[status];
  const limit = card?.monthlyLimit || 0;
  const spent = card?.monthlySpent || 0;
  const progress = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  const transactions = useMemo(() => (snapshot?.cardTransactions || []).slice(0, 5), [snapshot?.cardTransactions]);
  const isUsable = status === 'active' || status === 'frozen';
  const intentKey = (intent: string) => {
    intentKeys.current[intent] ||= crypto.randomUUID();
    return intentKeys.current[intent];
  };

  const issueCard = async () => {
    setBusy(true); setActionError(null);
    try {
      const result = await createHeyQOCard('visa', intentKey('issue'));
      delete intentKeys.current.issue;
      if (result?.card) adoptCard(result.card);
      await refresh();
      setNotice(result?.processing ? 'Votre carte est en cours de création. Son statut sera actualisé automatiquement.' : 'Votre carte a bien été créée.');
    } catch (cause: any) {
      delete intentKeys.current.issue;
      setActionError(cause?.message || 'La demande n’a pas pu être envoyée.');
    } finally { setBusy(false); }
  };

  const submitKyc = async (value: HeyQOKycValue) => {
    setBusy(true); setActionError(null);
    try {
      const result = await submitHeyQOCustomerKyc(value as unknown as Record<string, string | boolean | File | null | undefined>, intentKey('kyc'));
      delete intentKeys.current.kyc;
      setKycOpen(false);
      await refresh();
      const kycStatus = String(result.customer?.kycStatus || result.customer?.status || '').toLowerCase();
      if (['approved', 'verified', 'active', 'completed'].includes(kycStatus)) {
        setNotice('KYC approuvé. Émission de votre carte en cours.');
        await issueCard();
      } else {
        setNotice(`Dossier KYC transmis à HeyQO. Statut : ${kycStatus || 'pending'}.`);
      }
    } catch (cause: any) {
      delete intentKeys.current.kyc;
      setActionError(cause?.message || 'Le dossier KYC n’a pas pu être envoyé.');
    } finally { setBusy(false); }
  };

  const doCardAction = async (action: 'freeze' | 'unfreeze' | 'terminate') => {
    if (!card) return;
    if (action === 'terminate' && !window.confirm('Clôturer cette carte ? Cette action est définitive.')) return;
    setBusy(true); setActionError(null);
    try {
      const key = intentKey(`${action}:${card.id}`);
      if (action === 'freeze') await freezeCard(card.id, key);
      if (action === 'unfreeze') await unfreezeCard(card.id, key);
      if (action === 'terminate') await terminateCard(card.id, key);
      delete intentKeys.current[`${action}:${card.id}`];
      setNotice(action === 'terminate' ? 'Carte clôturée.' : action === 'freeze' ? 'Carte gelée.' : 'Carte réactivée.');
      await refresh();
    } catch (cause: any) {
      setActionError(cause?.message || 'L’action n’a pas pu être finalisée.');
    } finally { setBusy(false); }
  };

  const submitMoney = async () => {
    const value = Number(amount);
    if (!card || !amountMode || !Number.isFinite(value) || value <= 0) return setActionError('Saisissez un montant valide.');
    if (!window.confirm(amountMode === 'deposit' ? `Confirmer la recharge de ${formatAmount(value)} depuis Wallet ?` : `Confirmer le retrait de ${formatAmount(value)} vers Wallet ?`)) return;
    setBusy(true); setActionError(null);
    const intent = `${amountMode}:${card.id}`;
    try {
      const key = intentKey(intent);
      if (amountMode === 'deposit') await depositToCard(card.id, value, key);
      else await withdrawFromCard(card.id, value, key);
      delete intentKeys.current[intent];
      setNotice(amountMode === 'deposit' ? 'Recharge envoyée vers HeyQO.' : 'Retrait envoyé vers Wallet.');
      setAmount(''); setAmountMode(null); await refresh();
    } catch (cause: any) {
      delete intentKeys.current[intent];
      setActionError(cause?.message || 'Cette opération n’a pas pu être effectuée.');
    } finally { setBusy(false); }
  };

  const openSecureView = async () => {
    if (!card) return;
    setBusy(true); setActionError(null);
    try {
      const result = await getSecureView(card.id) as { url?: string; secureViewUrl?: string };
      const url = result?.url || result?.secureViewUrl;
      if (!url || !url.startsWith('https://heyqo.cash/')) throw new Error('Vue sécurisée invalide.');
      setSecureUrl(url);
    } catch (cause: any) {
      setActionError(cause?.message || 'La vue sécurisée est indisponible.');
    } finally { setBusy(false); }
  };

  return (
    <main data-testid="cards-view" className="relative min-h-[100dvh] overflow-hidden bg-[#061d33] px-4 pb-12 text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,#174d6c_0%,transparent_42%),linear-gradient(180deg,#071e34_0%,#0b2a45_65%,#0a2740_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full border border-white/[.025]" />

      <div className="relative mx-auto max-w-xl">
        <header className="flex items-center justify-between py-4 sm:py-6">
          <div className="flex items-center gap-3">
            <button type="button" data-testid="button-back-cards" onClick={onBack} aria-label="Retour" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[.04] text-white/75 transition hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <CardLogo className="h-8 w-8" />
              <span className="text-[11px] font-black tracking-[.14em] text-white/90">SOLUTION PAM</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span data-testid="icon-card-notifications" aria-label="Notifications" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[.04] text-white/80"><Bell className="h-4 w-4" /></span>
            <div data-testid="img-card-avatar" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-sky-300/50 bg-gradient-to-br from-amber-300 to-orange-500 text-xs font-black text-[#10233b]">{clientName.charAt(0).toUpperCase() || 'S'}</div>
            <span data-testid="icon-card-more" aria-label="Plus d’options" className="flex h-9 w-7 items-center justify-center text-white/60"><MoreHorizontal className="h-5 w-5" /></span>
          </div>
        </header>

        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-3">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-sky-200/70">Espace cartes</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${status === 'active' ? 'bg-emerald-400/15 text-emerald-300' : status === 'frozen' ? 'bg-amber-400/15 text-amber-200' : 'bg-white/10 text-white/65'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status === 'active' ? 'bg-emerald-300' : status === 'frozen' ? 'bg-amber-300' : 'bg-white/50'}`} /> {cardStatusLabel(status)}
            </span>
          </div>
          <h1 data-testid="heading-cards" className="mt-2 text-[2rem] font-black tracking-[-.045em] sm:text-4xl">Ma carte</h1>
          <p className="mt-1.5 max-w-sm text-sm leading-5 text-sky-100/65">Gérez votre carte, consultez votre solde et vos transactions en toute sécurité.</p>
        </motion.section>

        <motion.section initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .08 }} className="mt-5">
          {loading ? (
            <div data-testid="loading-card" className="aspect-[1.58/1] animate-pulse rounded-[1.35rem] border border-white/10 bg-white/10" />
          ) : card ? (
            <CardVisual card={card} clientName={clientName} />
          ) : (
            <div data-testid="empty-card" className="flex aspect-[1.58/1] flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-sky-200/25 bg-white/[.06] px-8 text-center">
              <CardLogo className="mb-3 h-12 w-12" />
              <p className="font-bold">Votre carte vous attend</p>
              <p className="mt-1.5 text-xs leading-5 text-sky-100/55">Créez votre carte virtuelle Solution PAM en quelques étapes.</p>
            </div>
          )}
        </motion.section>

        {card && isUsable && (
          <button type="button" data-testid="button-secure-view" onClick={() => void openSecureView()} disabled={busy} className="mx-auto mt-2.5 flex items-center gap-2 text-xs font-semibold text-sky-100/65 transition hover:text-white disabled:opacity-45">
            <Eye className="h-4 w-4" /> Afficher les détails sécurisés <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}

        <section data-testid="panel-card-balance" className="mt-4 rounded-2xl border border-white/[.08] bg-[#103450]/90 shadow-lg shadow-[#031425]/20">
          <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-sky-100/55">Solde disponible</p>
              <p data-testid="text-card-balance" className="mt-1 text-xl font-black tracking-[-.02em]">{formatAmount(card?.balance || 0, card?.currency || 'USD')}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-white/45" />
          </div>
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between text-[10px] text-sky-100/55"><span>Limite mensuelle</span><span data-testid="text-card-limit" className="font-semibold text-sky-100/75">{limit ? `${formatAmount(spent, card?.currency)} / ${formatAmount(limit, card?.currency)}` : 'Non définie'}</span></div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[.08]"><div data-testid="progress-card-limit" className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} /></div>
              <span className="w-7 text-right text-[10px] font-semibold text-sky-100/55">{Math.round(progress)}%</span>
            </div>
          </div>
        </section>

        {card && isUsable && (
          <section className="mt-2.5 grid grid-cols-4 gap-2">
            <QuickAction label="Recharger" icon={ArrowDownToLine} tone="blue" testId="button-open-deposit" onClick={() => setAmountMode('deposit')} />
            <QuickAction label={status === 'frozen' ? 'Réactiver' : 'Bloquer'} icon={status === 'frozen' ? UnlockKeyhole : LockKeyhole} tone={status === 'frozen' ? 'blue' : 'red'} testId={status === 'frozen' ? 'button-unfreeze-card' : 'button-freeze-card'} onClick={() => void doCardAction(status === 'frozen' ? 'unfreeze' : 'freeze')} disabled={busy} />
            <QuickAction label="Détails" icon={Eye} tone="violet" testId="button-quick-secure-view" onClick={() => void openSecureView()} disabled={busy} />
            <QuickAction label="Clôturer" icon={LockKeyhole} tone="red" testId="button-terminate-card" onClick={() => void doCardAction('terminate')} disabled={busy} />
          </section>
        )}

        {(error || actionError) && <div data-testid="error-card-action" role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-red-300/20 bg-red-400/10 p-3 text-xs leading-5 text-red-100"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />{error || actionError}</div>}
        {notice && <div data-testid="notice-card-action" className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-xs leading-5 text-emerald-100"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />{notice}</div>}

        {!card && snapshot?.configured !== false && (status === 'none' || status === 'failed' || status === 'kyc_required') && (
          <section className="mt-3 rounded-2xl border border-white/[.08] bg-white/[.05] p-4">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-sky-100/55">{meta.label}</p>
            <p data-testid="text-card-status-detail" className="mt-1.5 text-xs leading-5 text-sky-100/65">{meta.detail}</p>
            <div className="mt-3">
              <ActionButton testId="button-request-card" onClick={() => { setActionError(null); if (customerApproved) void issueCard(); else setKycOpen(true); }} disabled={busy}>
                <ShieldCheck className="h-4 w-4" /> {customerApproved ? 'Créer ma carte Visa' : snapshot?.customer ? 'Mettre à jour mon KYC' : 'Commencer ma vérification'}
              </ActionButton>
            </div>
          </section>
        )}

        {card && (
          <section data-testid="panel-card-history" className="mt-3 overflow-hidden rounded-2xl border border-white/[.08] bg-[#103450]/90">
            <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3.5">
              <p className="text-xs font-bold text-white/85">Transactions récentes</p>
              <span className="text-[10px] font-semibold text-sky-300">{transactions.length ? `${transactions.length} opération${transactions.length > 1 ? 's' : ''}` : 'Aucune'}</span>
            </div>
            {transactions.length ? (
              <div className="divide-y divide-white/[.06]">
                {transactions.map((tx) => {
                  const txMeta = transactionMeta(tx);
                  const TxIcon = txMeta.icon;
                  return (
                    <div data-testid={`row-card-transaction-${tx.id}`} key={tx.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${txMeta.tone}`}><TxIcon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-white/90">{tx.description || (tx.type === 'deposit' ? 'Recharge de carte' : tx.type === 'withdrawal' ? 'Retrait vers Wallet' : 'Paiement')}</p>
                        <p className="mt-0.5 text-[10px] text-sky-100/45">{formatDate(tx.createdAt)} · <span className="text-emerald-300/80">{tx.status}</span></p>
                      </div>
                      <span className={`shrink-0 text-xs font-bold ${txMeta.positive ? 'text-emerald-300' : 'text-white/85'}`}>{txMeta.positive ? '+' : '−'}{formatAmount(tx.amount, tx.currency)}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/35" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p data-testid="empty-card-history" className="px-4 py-6 text-center text-xs text-sky-100/45">Aucune opération récente.</p>
            )}
          </section>
        )}

        {card && (
          <section className="mt-3 rounded-2xl border border-white/[.08] bg-white/[.04] p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-sky-100/45">Statut de la carte</p><p data-testid="status-card" className="mt-1 text-sm font-bold text-white/90">{meta.label}</p></div>
              <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-bold text-emerald-300">{snapshot?.stale ? 'Dernière mise à jour' : 'Protégée'}</span>
            </div>
            <p data-testid="text-card-status-detail" className="mt-2 text-xs leading-5 text-sky-100/55">{meta.detail}</p>
          </section>
        )}

        <details data-testid="panel-heyqo-diagnostics" className="mt-3 rounded-2xl border border-white/[.08] bg-white/[.035] p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] font-bold uppercase tracking-[.14em] text-sky-100/45">
            <span>Informations de sécurité</span><ShieldCheck className="h-4 w-4 text-emerald-300/70" />
          </summary>
          <p className="mt-3 text-xs leading-5 text-sky-100/45">Aucun token, document, PAN ou CVV n’est affiché ici.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {(snapshot?.diagnostics || []).map((item) => <div key={item.step} className="rounded-xl border border-white/[.06] bg-black/10 p-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-sky-100/35">{item.step.replaceAll('_', ' ')}</p><p className={`mt-1.5 text-xs font-bold ${['success', 'approved', 'active'].includes(item.status) ? 'text-emerald-300' : item.status === 'error' || item.status === 'rejected' ? 'text-red-300' : 'text-amber-200'}`}>{item.status}</p>{item.detail && <p className="mt-1 break-words text-[10px] leading-4 text-sky-100/40">{item.detail}</p>}</div>)}
          </div>
          {!snapshot?.webhookConfigured && <p data-testid="warning-heyqo-webhook" className="mt-3 flex gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-[10px] leading-4 text-amber-100"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />Le secret webhook HeyQO n’est pas encore configuré. Actualisez le statut pour relire les données Sandbox.</p>}
        </details>
      </div>

      {amountMode && createPortal(
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-end justify-center bg-[#031321]/85 p-3 backdrop-blur-sm sm:items-center">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#103450] p-5 text-white shadow-2xl">
            <div className="flex justify-between"><h2 className="text-lg font-black">{amountMode === 'deposit' ? 'Recharger depuis Wallet' : 'Retirer vers Wallet'}</h2><button type="button" aria-label="Fermer" data-testid="button-close-money-modal" onClick={() => setAmountMode(null)} className="text-white/65"><X className="h-5 w-5" /></button></div>
            <label className="mt-5 block text-xs font-semibold text-sky-100/65">Montant ({card?.currency || 'USD'})<input data-testid="input-card-amount" type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#061d33] p-3 text-lg text-white outline-none focus:border-sky-400" /></label>
            <div className="mt-5"><ActionButton testId="button-submit-card-money" onClick={() => void submitMoney()} disabled={busy}>{busy ? 'Traitement…' : 'Confirmer l’opération'}</ActionButton></div>
          </div>
        </div>,
        document.body,
      )}

      {kycOpen && <HeyQOKycWizard onSubmit={submitKyc} onClose={() => !busy && setKycOpen(false)} busy={busy} error={actionError} initialValue={{ phone: clientPhone }} sandboxPreview={snapshot?.environment === 'sandbox'} />}

      {secureUrl && createPortal(
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-end justify-center bg-[#031321]/85 p-3 backdrop-blur-sm sm:items-center">
          <div className="relative h-[80dvh] w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <button type="button" aria-label="Fermer" data-testid="button-close-secure-view" onClick={() => setSecureUrl(null)} className="absolute right-3 top-3 z-10 rounded-full bg-[#061d33] p-2 text-white"><X className="h-4 w-4" /></button>
            <iframe data-testid="iframe-secure-view" title="Vue sécurisée de la carte" src={secureUrl} className="h-full w-full border-0" referrerPolicy="no-referrer" sandbox="allow-scripts allow-forms allow-same-origin" />
          </div>
        </div>,
        document.body,
      )}
    </main>
  );
}