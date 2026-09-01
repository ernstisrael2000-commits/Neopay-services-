import { useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpFromLine,
  Bell,
  Check,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Eye,
  Home,
  LockKeyhole,
  Radio,
  RefreshCw,
  Settings,
  ShieldCheck,
  Snowflake,
  TriangleAlert,
  UnlockKeyhole,
  UserRound,
  WalletCards,
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
  provisioning: { label: 'Création en cours', detail: 'HeyQO prépare votre carte. Cela peut prendre quelques instants.' },
  kyc_required: { label: 'Vérification requise', detail: 'Une vérification d’identité est nécessaire avant l’émission.' },
  active: { label: 'Carte active', detail: 'Votre carte est prête pour vos paiements en ligne.' },
  frozen: { label: 'Carte gelée', detail: 'Les paiements sont temporairement suspendus.' },
  terminated: { label: 'Carte clôturée', detail: 'Cette carte ne peut plus être utilisée.' },
  failed: { label: 'Émission impossible', detail: 'HeyQO n’a pas pu émettre cette carte. Réessayez ou contactez-nous.' },
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
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value || 0);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'SP';
}

function formatCardNumber(card: HeyQOCard) {
  if (card.maskedNumber) return card.maskedNumber.replace(/\s+/g, ' ').trim();
  return `••••  ••••  ••••  ${card.last4 || '••••'}`;
}

function CardVisual({ card, clientName }: { card: HeyQOCard; clientName: string }) {
  return (
    <div data-testid="card-visual" className="relative aspect-[1.59/1] w-full overflow-hidden rounded-[25px] border border-white/10 bg-[radial-gradient(circle_at_12%_0%,rgba(64,177,221,.36),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(3,35,68,.95),transparent_52%),linear-gradient(135deg,#155b7b_0%,#0c344e_48%,#071c34_100%)] p-5 text-white shadow-[0_24px_55px_rgba(0,0,0,.35)] sm:rounded-[29px] sm:p-7">
      <div className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full border border-white/[.08]" />
      <div className="pointer-events-none absolute -left-4 -top-14 h-64 w-64 rounded-full border border-white/[.06]" />
      <div className="pointer-events-none absolute bottom-[-35%] right-[-18%] h-64 w-64 rounded-full border border-cyan-100/[.07]" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <img src="/solutionpam-icon.svg" alt="Solution PAM" className="h-11 w-11 rounded-xl object-cover brightness-125 sm:h-14 sm:w-14" />
          <div className="text-right">
            <p className="text-[25px] font-black italic uppercase leading-none tracking-[-.08em] sm:text-[32px]">{card.brand || 'VISA'}</p>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[.2em] text-white/70 sm:text-[10px]">Virtuelle</p>
          </div>
        </div>
        <div className="mt-4">
          <p data-testid="text-card-last4" className="font-mono text-[clamp(1rem,4.4vw,1.55rem)] tracking-[.12em] text-white/95">{formatCardNumber(card)}</p>
          <p className="mt-1 font-mono text-[10px] text-white/60">{card.last4 || '••••'}</p>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-[.14em] text-white/55">Titulaire</p>
            <p data-testid="text-card-holder" className="mt-1 max-w-[180px] truncate font-mono text-xs font-medium uppercase tracking-[.1em] sm:text-sm">{card.cardholderName || clientName}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[.14em] text-white/55">Expire en</p>
            <p className="mt-1 font-mono text-xs font-medium tracking-[.1em] sm:text-sm">••/••</p>
          </div>
          <Radio className="h-7 w-7 rotate-90 text-white/85 sm:h-8 sm:w-8" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

function ActionTile({ icon, label, onClick, disabled, danger, testId }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; testId: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45',
        danger ? 'border-red-300/15 bg-red-400/[.07] text-red-200 hover:bg-red-400/[.13]' : 'border-white/[.08] bg-white/[.035] text-white/85 hover:border-cyan-200/25 hover:bg-white/[.07]',
      ].join(' ')}
    >
      <span className={danger ? 'text-red-300' : 'text-cyan-200'}>{icon}</span>
      <span className="max-w-[90px] text-[11px] font-semibold leading-4">{label}</span>
    </button>
  );
}

function transactionLabel(tx: HeyQOCardTransaction) {
  if (tx.description) return tx.description;
  if (tx.type === 'deposit') return 'Recharge de carte';
  if (tx.type === 'withdrawal') return 'Retrait vers le Wallet';
  return 'Paiement par carte';
}

function transactionIcon(tx: HeyQOCardTransaction) {
  if (tx.type === 'deposit' || tx.type === 'refund') return <ArrowDownToLine className="h-4 w-4" />;
  if (tx.type === 'withdrawal') return <ArrowUpFromLine className="h-4 w-4" />;
  return <CircleDollarSign className="h-4 w-4" />;
}

function transactionStatus(status: string) {
  const normalized = status.toLowerCase();
  if (['completed', 'approved', 'success', 'succeeded'].includes(normalized)) return { label: 'Réussi', className: 'text-emerald-300 bg-emerald-400/10' };
  if (['pending', 'processing'].includes(normalized)) return { label: 'En attente', className: 'text-amber-300 bg-amber-400/10' };
  return { label: status, className: 'text-white/55 bg-white/[.06]' };
}

export default function CardsView({ clientId, clientName, clientPhone = '', onBack, onRequestAuth: _onRequestAuth }: CardsViewProps) {
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
  const pendingTransactions = transactions.filter(tx => ['pending', 'processing'].includes(String(tx.status).toLowerCase())).length;
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
    const intent = `${action}:${card.id}`;
    try {
      const key = intentKey(intent);
      if (action === 'freeze') await freezeCard(card.id, key);
      if (action === 'unfreeze') await unfreezeCard(card.id, key);
      if (action === 'terminate') await terminateCard(card.id, key);
      delete intentKeys.current[intent];
      setNotice(action === 'terminate' ? 'Carte clôturée.' : action === 'freeze' ? 'Carte gelée.' : 'Carte dégelée.');
      await refresh();
    } catch (cause: any) {
      delete intentKeys.current[intent];
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
    <main data-testid="cards-view" className="min-h-[100dvh] bg-[#06192b] px-4 pb-28 text-white sm:px-6 lg:pb-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between py-5 sm:py-7">
          <button type="button" data-testid="button-back-cards" onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-white/65 transition hover:text-white lg:hidden">
            <ArrowLeft className="h-4 w-4" /> Retour
          </button>
          <div className="flex items-center gap-3">
            <img src="/solutionpam-icon.svg" alt="Solution PAM" className="h-10 w-10 rounded-xl object-cover shadow-lg shadow-cyan-950/40" />
            <div className="hidden sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[.24em] text-cyan-200/70">Solution PAM</p>
              <p className="text-sm font-semibold text-white/85">Espace sécurisé</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Notifications" className="relative rounded-full p-2 text-white/75 transition hover:bg-white/10 hover:text-white">
              <Bell className="h-5 w-5" />
              {pendingTransactions > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">{pendingTransactions}</span>}
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-cyan-100/40 bg-gradient-to-br from-[#e8c99c] to-[#9a6d4d] text-xs font-black text-[#10263a] shadow-lg">
              {initials(clientName)}
            </div>
          </div>
        </header>

        <section className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-[.22em] text-cyan-200/65">Votre espace financier</p>
          <div className="mt-2 flex items-center gap-3">
            <h1 data-testid="heading-cards" className="text-[2rem] font-semibold tracking-[-.045em] sm:text-4xl">Ma carte</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-bold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {status === 'active' ? 'Active' : meta.label}
            </span>
          </div>
          <p className="mt-2 max-w-md text-sm leading-5 text-white/60">Gérez votre carte, consultez votre solde et vos transactions en toute sécurité.</p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)] lg:items-start">
          <div>
            <div className="rounded-[29px] border border-white/[.07] bg-[#0a2840]/80 p-2 shadow-[0_22px_60px_rgba(0,0,0,.18)] sm:p-3">
              {loading ? <div data-testid="loading-card" className="aspect-[1.59/1] animate-pulse rounded-[25px] bg-white/[.08]" /> : card ? <CardVisual card={card} clientName={clientName} /> : <div data-testid="empty-card" className="flex aspect-[1.59/1] flex-col items-center justify-center rounded-[25px] border border-dashed border-cyan-200/25 bg-[#0a2840] px-8 text-center"><CreditCard className="mb-4 h-9 w-9 text-cyan-200" /><p className="font-semibold">Votre carte vous attend</p><p className="mt-2 text-sm text-white/50">Demandez votre carte virtuelle en quelques étapes.</p></div>}
            </div>
            {card && (status === 'active' || status === 'frozen') && <button type="button" data-testid="button-secure-view" onClick={() => void openSecureView()} disabled={busy} className="mx-auto mt-3 flex items-center gap-2 text-[11px] font-medium text-white/55 transition hover:text-cyan-200 disabled:opacity-50"><Eye className="h-4 w-4" /> Afficher les détails</button>}
          </div>

          <div className="space-y-4">
            <div data-testid="panel-card-balance" className="rounded-2xl border border-white/[.1] bg-[#123551]/75 p-4 shadow-[0_15px_35px_rgba(0,0,0,.12)] sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-white/55">Solde disponible</p>
                  <p data-testid="text-card-balance" className="mt-1 text-xl font-semibold tracking-[-.02em]">{formatAmount(card?.balance || 0, card?.currency || 'USD')}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/40" />
              </div>
              <div className="mt-4 flex items-end justify-between text-[11px] text-white/55">
                <span>Limite mensuelle</span>
                <span data-testid="text-card-limit">{limit ? formatAmount(limit, card?.currency) : 'Non définie'}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[.08]"><div data-testid="progress-card-limit" className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} /></div>
                <span className="w-8 text-right text-[11px] text-white/55">{Math.round(progress)}%</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {card && (status === 'active' || status === 'frozen') && <>
                <ActionTile testId="button-open-deposit" label="Recharger" icon={<ArrowDownToLine className="h-5 w-5" />} onClick={() => setAmountMode('deposit')} disabled={busy} />
                <ActionTile testId="button-terminate-card" label="Bloquer carte" icon={<LockKeyhole className="h-5 w-5" />} onClick={() => void doCardAction('terminate')} disabled={busy} danger />
                <ActionTile testId={status === 'frozen' ? 'button-unfreeze-card' : 'button-freeze-card'} label={status === 'frozen' ? 'Débloquer' : 'Geler temporairement'} icon={status === 'frozen' ? <UnlockKeyhole className="h-5 w-5" /> : <Snowflake className="h-5 w-5" />} onClick={() => void doCardAction(status === 'frozen' ? 'unfreeze' : 'freeze')} disabled={busy} />
                <ActionTile testId="button-card-settings" label="Paramètres" icon={<Settings className="h-5 w-5" />} onClick={() => void openSecureView()} disabled={busy} />
              </>}
              {snapshot?.configured !== false && (status === 'none' || status === 'failed' || status === 'kyc_required') && <ActionTile testId="button-request-card" label={customerApproved ? 'Créer ma carte' : snapshot?.customer ? 'Mettre à jour mon KYC' : 'Commencer'} icon={<ShieldCheck className="h-5 w-5" />} onClick={() => { setActionError(null); if (customerApproved) void issueCard(); else setKycOpen(true); }} disabled={busy} />}
              {status === 'provisioning' && <ActionTile testId="button-refresh-card" label="Actualiser" icon={<RefreshCw className="h-5 w-5" />} onClick={() => void refresh()} disabled={loading} />}
            </div>
            {card && (status === 'active' || status === 'frozen') && <button type="button" data-testid="button-open-withdraw" onClick={() => setAmountMode('withdraw')} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[.08] bg-white/[.025] py-2.5 text-xs font-semibold text-white/60 transition hover:bg-white/[.06] hover:text-white disabled:opacity-45"><ArrowUpFromLine className="h-4 w-4" /> Retirer vers le Wallet</button>}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/[.1] bg-[#0d2b46]/80 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Transactions récentes</p>
            <span className="text-xs font-medium text-cyan-300/80">Voir toutes</span>
          </div>
          <div data-testid="panel-card-history" className="mt-2 divide-y divide-white/[.07]">
            {transactions.length ? transactions.map((tx: HeyQOCardTransaction) => {
              const state = transactionStatus(String(tx.status));
              const isDebit = tx.type === 'withdrawal' || tx.type === 'charge';
              return <div data-testid={`row-card-transaction-${tx.id}`} key={tx.id} className="flex items-center gap-3 py-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isDebit ? 'bg-white/[.08] text-white/70' : 'bg-cyan-400/15 text-cyan-200'}`}>{transactionIcon(tx)}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white/90">{transactionLabel(tx)}</p><p className="mt-0.5 text-[10px] text-white/45">{tx.createdAt ? new Date(tx.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Aujourd’hui'}</p></div>
                <span className={`hidden rounded-full px-2 py-1 text-[9px] font-bold sm:inline ${state.className}`}>{state.label}</span>
                <div className="text-right"><p className={`font-mono text-xs font-semibold ${isDebit ? 'text-white/85' : 'text-emerald-300'}`}>{isDebit ? '−' : '+'}{formatAmount(tx.amount, tx.currency)}</p><ChevronRight className="ml-auto mt-1 h-3.5 w-3.5 text-white/35" /></div>
              </div>;
            }) : <p data-testid="empty-card-history" className="py-7 text-center text-sm text-white/45">Aucune opération récente.</p>}
          </div>
        </section>

        {(error || actionError) && <div data-testid="error-card-action" role="alert" className="mt-4 flex gap-2 rounded-2xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-200"><TriangleAlert className="h-4 w-4 shrink-0" />{error || actionError}</div>}
        {notice && <div data-testid="notice-card-action" className="mt-4 flex gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-200"><Check className="h-4 w-4 shrink-0" />{notice}</div>}
        <p data-testid="text-card-status-detail" className="mt-4 text-center text-xs text-white/40">{meta.detail}</p>
        {!snapshot?.webhookConfigured && <p data-testid="warning-heyqo-webhook" className="mt-3 flex gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/[.08] p-3 text-xs leading-5 text-amber-100"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />Le statut Sandbox peut nécessiter une actualisation manuelle.</p>}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[.08] bg-[#06192b]/95 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:hidden" aria-label="Navigation principale">
        <div className="mx-auto flex max-w-md items-center justify-between">
          {[
            { label: 'Accueil', icon: <Home className="h-5 w-5" />, active: false, onClick: onBack },
            { label: 'Cartes', icon: <WalletCards className="h-5 w-5" />, active: true },
            { label: 'Wallet', icon: <CreditCard className="h-5 w-5" />, active: false },
            { label: 'Transactions', icon: <ArrowLeftRight className="h-5 w-5" />, active: false },
            { label: 'Profil', icon: <UserRound className="h-5 w-5" />, active: false },
          ].map(item => <button key={item.label} type="button" onClick={item.onClick} className={`flex min-w-12 flex-col items-center gap-1 text-[10px] font-medium ${item.active ? 'text-cyan-300' : 'text-white/45'}`}>{item.icon}<span>{item.label}</span></button>)}
        </div>
      </nav>

      {amountMode && createPortal(<div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-end justify-center bg-[#020b14]/85 p-3 backdrop-blur-sm sm:items-center"><div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[26px] border border-white/10 bg-[#0d2b46] p-6 text-white shadow-2xl"><div className="flex justify-between"><h2 className="text-xl font-semibold">{amountMode === 'deposit' ? 'Recharger depuis Wallet' : 'Retirer vers Wallet'}</h2><button type="button" aria-label="Fermer" data-testid="button-close-money-modal" onClick={() => setAmountMode(null)}><X className="h-5 w-5" /></button></div><label className="mt-6 block text-sm text-white/60">Montant ({card?.currency || 'USD'})<input data-testid="input-card-amount" type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#06192b] p-3 text-lg text-white outline-none focus:border-cyan-300" /></label><div className="mt-5"><button type="button" onClick={() => void submitMoney()} disabled={busy} className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-cyan-300 px-4 text-sm font-bold text-[#06192b] transition hover:bg-cyan-200 disabled:opacity-50">{busy ? 'Traitement…' : 'Confirmer l’opération'}</button></div></div></div>, document.body)}
      {kycOpen && <HeyQOKycWizard onSubmit={submitKyc} onClose={() => !busy && setKycOpen(false)} busy={busy} error={actionError} initialValue={{ phone: clientPhone }} sandboxPreview={snapshot?.environment === 'sandbox'} />}
      {secureUrl && createPortal(<div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-end justify-center bg-[#020b14]/85 p-3 backdrop-blur-sm sm:items-center"><div className="relative h-[80dvh] w-full max-w-lg overflow-hidden rounded-[26px] bg-white shadow-2xl"><button type="button" aria-label="Fermer" data-testid="button-close-secure-view" onClick={() => setSecureUrl(null)} className="absolute right-3 top-3 z-10 rounded-full bg-[#06192b] p-2 text-white"><X className="h-4 w-4" /></button><iframe data-testid="iframe-secure-view" title="Vue sécurisée de la carte" src={secureUrl} className="h-full w-full border-0" referrerPolicy="no-referrer" sandbox="allow-scripts allow-forms allow-same-origin" /></div></div>, document.body)}
    </main>
  );
}