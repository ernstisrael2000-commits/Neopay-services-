import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Wallet, ArrowDownToLine, ArrowUpFromLine, History,
  LogOut, Loader2, X, Copy, CheckCircle2, AlertCircle,
  Clock, XCircle, Shield, Trash2,
  TrendingUp, Globe, Smartphone, CreditCard as CardIcon,
  Building2, Bitcoin, Info, ChevronDown, ChevronLeft,
  Eye, EyeOff, Send, User, QrCode, Search, MapPin, Phone,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import ReCAPTCHA from 'react-google-recaptcha';
import { CaptchaWidget } from '../components/CaptchaWidget';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useClientData, useClientTransactions,
  submitClientDeposit, submitClientWithdrawal, submitClientTransfer,
} from '../services/clientService';
import { apiFetch } from '../lib/apiFetch';
import { useSettingsCtx } from '../contexts/SettingsContext';
import { Client, PaymentMethod, DEFAULT_PAYMENT_METHODS } from '../types';
import CryptoDepositFlow from '../components/CryptoDepositFlow';

interface ClientDashboardProps {
  clientId: string;
  onLogout: () => void;
  open?: boolean;
  onClose?: () => void;
  asPage?: boolean;
  onBack?: () => void;
}

const WHATSAPP_NUMBER = '+50944813185';
const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || '';

const statusConfig = {
  pending:   { label: 'En attente', color: 'bg-amber-100 text-amber-700 border border-amber-200',     icon: <Clock className="h-3 w-3" /> },
  approved:  { label: 'Approuvé',   color: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected:  { label: 'Refusé',     color: 'bg-red-100 text-red-600 border border-red-200',           icon: <XCircle className="h-3 w-3" /> },
  completed: { label: 'Complété',   color: 'bg-blue-100 text-blue-700 border border-blue-200',        icon: <CheckCircle2 className="h-3 w-3" /> },
};

const typeLabel: Record<string, string> = {
  deposit:           'Dépôt',
  withdrawal:        'Retrait',
  purchase:          'Achat',
  transfer_received: 'Reçu',
  refund:            'Remboursement',
};

function getMethodIcon(type: string) {
  switch (type) {
    case 'mobile_money':  return <Smartphone className="h-4 w-4" />;
    case 'crypto':        return <Bitcoin className="h-4 w-4" />;
    case 'bank_transfer': return <Building2 className="h-4 w-4" />;
    case 'payment_app':   return <Globe className="h-4 w-4" />;
    case 'card':          return <CardIcon className="h-4 w-4" />;
    default:              return <Wallet className="h-4 w-4" />;
  }
}

const methodColors: Record<string, string> = {
  mobile_money:  'text-rose-500 bg-rose-50',
  crypto:        'text-amber-500 bg-amber-50',
  bank_transfer: 'text-blue-500 bg-blue-50',
  payment_app:   'text-violet-500 bg-violet-50',
  card:          'text-emerald-500 bg-emerald-50',
};

// ─── Virtual Card ─────────────────────────────────────────────────────────────

function VirtualCard({
  client, balance, rate, copied, onCopy, hidden, onToggleHide,
}: {
  client: Client; balance: number; rate: number;
  copied: boolean; onCopy: () => void;
  hidden: boolean; onToggleHide: () => void;
}) {
  return (
    <div
      className="relative w-full rounded-[1.75rem] overflow-hidden select-none shadow-2xl shadow-violet-900/40"
      style={{
        aspectRatio: '1.75 / 1',
        background: 'linear-gradient(135deg, #3B0F8C 0%, #5B1FD4 30%, #7C3AED 60%, #6027C0 100%)',
      }}
    >
      {/* Radial glow top-left */}
      <div className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 20% 20%, rgba(160,130,255,0.25) 0%, transparent 60%)' }} />
      {/* Grid overlay */}
      <div className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
      {/* Large decorative arcs */}
      <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full border border-white/[0.06]" />
      <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full border border-white/[0.08]" />
      <div className="absolute -right-2 bottom-0 w-28 h-28 rounded-full border border-white/[0.05]" />
      {/* Bottom-right glow */}
      <div className="absolute bottom-0 right-0 w-32 h-20 rounded-tl-full"
        style={{ background: 'radial-gradient(ellipse at 80% 90%, rgba(120,80,255,0.3) 0%, transparent 70%)' }} />

      <div className="relative z-10 h-full flex flex-col justify-between p-5">
        {/* Top row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Solutionpam Wallet</p>
            <p className="text-white font-black text-base leading-tight tracking-wide">{client.name}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={onToggleHide} className="text-white/35 hover:text-white/65 transition-colors">
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            {/* Chip */}
            <div className="h-7 w-10 rounded-lg overflow-hidden shadow-lg"
              style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #F59E0B 100%)' }}>
              <div className="w-full h-full grid grid-cols-2 gap-[1.5px] p-[3px]">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-[2px]"
                    style={{ background: 'rgba(120,60,0,0.35)' }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div>
          <p className="text-white/40 text-[8px] font-black uppercase tracking-[0.3em] mb-1.5">Solde disponible</p>
          {hidden ? (
            <p className="text-white font-black text-4xl tracking-widest leading-none">••••••</p>
          ) : (
            <p className="text-white font-black leading-none" style={{ fontSize: '2rem' }}>
              ${balance.toFixed(2)}
              <span className="text-white/50 text-base font-bold ml-2">USD</span>
            </p>
          )}
          {!hidden && (
            <p className="text-white/35 text-[10px] font-semibold mt-1">
              ≈ {Math.round(balance * rate).toLocaleString()} HTG
            </p>
          )}
        </div>

        {/* Bottom row */}
        <div className="flex items-end justify-between">
          <button onClick={onCopy} className="flex items-center gap-2 group">
            <span className="text-white/30 text-[10px] font-mono tracking-[0.2em] group-hover:text-white/55 transition-colors">
              {client.walletId?.match(/.{1,4}/g)?.join(' ') || client.walletId}
            </span>
            {copied
              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
              : <Copy className="h-3.5 w-3.5 text-white/25 group-hover:text-white/60 transition-colors" />}
          </button>
          {/* Mastercard circles */}
          <div className="flex -space-x-3">
            <div className="h-9 w-9 rounded-full shadow-lg" style={{ background: 'rgba(220,38,38,0.85)' }} />
            <div className="h-9 w-9 rounded-full shadow-lg" style={{ background: 'rgba(251,191,36,0.9)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function ClientDashboard({ clientId, onLogout, open, onClose, asPage, onBack }: ClientDashboardProps) {
  const { client, loading } = useClientData(clientId);
  const { transactions, loading: txLoading } = useClientTransactions(clientId);
  const { settings } = useSettingsCtx();

  const rate    = settings?.exchangeRate || 135;
  const balance = client?.balance || 0;
  const cardRates = (settings as any)?.cardRates as Record<string, number> | undefined;

  const paymentMethods: PaymentMethod[] = useMemo(() => {
    if (settings?.paymentMethods && settings.paymentMethods.length > 0) return settings.paymentMethods;
    return DEFAULT_PAYMENT_METHODS;
  }, [settings?.paymentMethods]);

  const depositMethods    = paymentMethods.filter(m => m.enabled && m.forDeposit);
  const withdrawalMethods = paymentMethods.filter(m => m.enabled && m.forWithdrawal);

  const [copied,            setCopied]           = useState(false);
  const [balanceHidden,     setBalanceHidden]     = useState(false);
  const [historyOpen,       setHistoryOpen]       = useState(false);
  const [isDepositOpen,     setIsDepositOpen]     = useState(false);
  const [isWithdrawOpen,    setIsWithdrawOpen]    = useState(false);
  const [isTransferOpen,    setIsTransferOpen]    = useState(false);
  const [actionLoading,     setActionLoading]     = useState(false);
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);

  // Deposit state
  const [depositMethod,       setDepositMethod]       = useState<PaymentMethod | null>(null);
  const [htgAmount,           setHtgAmount]           = useState('');
  const [depositTxId,         setDepositTxId]         = useState('');
  const [depositMessage,      setDepositMessage]      = useState('');
  const [depositCaptchaToken, setDepositCaptchaToken] = useState<string | null>(null);
  const depositCaptchaRef = useRef<ReCAPTCHA>(null);
  const [depositProofFile,    setDepositProofFile]    = useState<File | null>(null);
  const [depositProofPreview, setDepositProofPreview] = useState<string | null>(null);
  const depositProofRef = useRef<HTMLInputElement>(null);

  // Withdrawal state
  const [withdrawMethod,       setWithdrawMethod]       = useState<PaymentMethod | null>(null);
  const [withdrawUSD,          setWithdrawUSD]          = useState('');
  const [withdrawAccount,      setWithdrawAccount]      = useState('');
  const [withdrawAccountName,  setWithdrawAccountName]  = useState('');
  const [withdrawMessage,      setWithdrawMessage]      = useState('');
  const [withdrawCaptchaToken, setWithdrawCaptchaToken] = useState<string | null>(null);
  const withdrawCaptchaRef = useRef<ReCAPTCHA>(null);

  // Transfer state
  const [transferWalletId,  setTransferWalletId]  = useState('');
  const [transferUSD,       setTransferUSD]       = useState('');
  const [transferMessage,   setTransferMessage]   = useState('');
  const [transferPreview,   setTransferPreview]   = useState<string | null>(null);
  const [lookupLoading,     setLookupLoading]     = useState(false);

  // Agent QR mode state
  const [depositMode,    setDepositMode]    = useState<'standard' | 'agent-qr' | 'agent-request' | 'crypto'>('standard');
  // Agent deposit request state (client requests deposit confirmation from agent)
  const [agentReqCode,   setAgentReqCode]   = useState('');
  const [agentReqAmount, setAgentReqAmount] = useState('');
  const [agentReqInfo,   setAgentReqInfo]   = useState<{ name: string } | null>(null);
  const [agentReqSearchLoading, setAgentReqSearchLoading] = useState(false);
  const [agentReqSubmitting, setAgentReqSubmitting] = useState(false);
  const [withdrawMode,         setWithdrawMode]         = useState<'standard' | 'agent-qr' | 'agent-code'>('standard');
  const [agentQrAmount,        setAgentQrAmount]        = useState('');
  const [txCode,               setTxCode]               = useState<{ codeData: string; expiresAt: number; type: 'deposit' | 'withdrawal' } | null>(null);
  const [txCodeLoading,        setTxCodeLoading]        = useState(false);
  const [txCountdown,          setTxCountdown]          = useState(0);
  // Agent-code withdrawal state
  const [wdAgentCodeInput,     setWdAgentCodeInput]     = useState('');
  const [wdAgentSearchLoading, setWdAgentSearchLoading] = useState(false);
  const [wdAgentInfo,          setWdAgentInfo]          = useState<{ name: string; phone: string; agentCode: string | null; affiliateCode: string | null; affiliateId: string | null; available: boolean } | null>(null);
  const [withdrawSuccessInfo,  setWithdrawSuccessInfo]  = useState<{ name: string; phone: string; code: string; amountHTG: string } | null>(null);
  const [wdAgentAmount,        setWdAgentAmount]        = useState('');
  const [wdAgentMsg,           setWdAgentMsg]           = useState('');
  const [wdAgentLoading,       setWdAgentLoading]       = useState(false);

  // Agent-initiated withdrawal confirmations (agent wants to withdraw from client account)
  const [pendingConfirmations,     setPendingConfirmations]     = useState<any[]>([]);
  const [confirmActionLoading,     setConfirmActionLoading]     = useState<string | null>(null);
  const [otpInputs,                setOtpInputs]                = useState<Record<string, string>>({});

  // Success modal (shown when a deposit/withdrawal is approved)
  const [txSuccessModal, setTxSuccessModal] = useState<{
    type: 'deposit' | 'withdrawal';
    agentName?: string;
    htg: number;
    usd: number;
  } | null>(null);

  // Use method-specific rate if configured, otherwise fall back to global rate
  const effectiveDepositRate = (depositMethod?.id && cardRates?.[depositMethod.id]) || rate;
  const usdPreview = htgAmount && !isNaN(parseFloat(htgAmount)) ? parseFloat(htgAmount) / effectiveDepositRate : 0;
  const transferHtgPreview = transferUSD && !isNaN(parseFloat(transferUSD)) ? parseFloat(transferUSD) * rate : 0;

  // Fee computation (preview only – server calculates authoritatively at approval)
  // All withdrawal/QR inputs are in HTG; server always receives USD
  const depositFeePercent    = settings?.depositFeePercent    || 0;
  const withdrawalFeePercent = settings?.withdrawalFeePercent || 0;
  const depositFeeAmount  = usdPreview > 0 ? parseFloat((usdPreview * depositFeePercent / 100).toFixed(4)) : 0;
  const depositNetAmount  = usdPreview > 0 ? parseFloat((usdPreview - depositFeeAmount).toFixed(4)) : 0;
  // Standard withdrawal — input is HTG
  const withdrawHTGNum    = parseFloat(withdrawUSD) || 0;
  const withdrawUSDNum    = withdrawHTGNum > 0 ? withdrawHTGNum / rate : 0;
  const withdrawFeeHTG    = withdrawHTGNum > 0 ? Math.round(withdrawHTGNum * withdrawalFeePercent / 100) : 0;
  const withdrawFeeAmount = withdrawFeeHTG / rate;
  const withdrawNetHTG    = Math.max(0, withdrawHTGNum - withdrawFeeHTG);
  const withdrawNetAmount = withdrawNetHTG / rate;
  // Agent QR deposit/withdrawal — input is HTG
  const agentQrHTGNum        = parseFloat(agentQrAmount) || 0;
  const agentQrUSDNum        = agentQrHTGNum > 0 ? agentQrHTGNum / rate : 0;
  const agentQrDepositFeeHTG = agentQrHTGNum > 0 ? Math.round(agentQrHTGNum * depositFeePercent / 100) : 0;
  const agentQrDepositNetHTG = Math.max(0, agentQrHTGNum - agentQrDepositFeeHTG);
  const agentQrDepositFee    = agentQrDepositFeeHTG / rate;
  const agentQrDepositNet    = agentQrDepositNetHTG / rate;
  const agentQrWithdrawFeeHTG= agentQrHTGNum > 0 ? Math.round(agentQrHTGNum * withdrawalFeePercent / 100) : 0;
  const agentQrWithdrawNetHTG= Math.max(0, agentQrHTGNum - agentQrWithdrawFeeHTG);
  const agentQrWithdrawFee   = agentQrWithdrawFeeHTG / rate;
  const agentQrWithdrawNet   = agentQrWithdrawNetHTG / rate;
  // Agent-code withdrawal — input is HTG
  const wdAgentHTGNum    = parseFloat(wdAgentAmount) || 0;
  const wdAgentAmountNum = wdAgentHTGNum > 0 ? wdAgentHTGNum / rate : 0;
  const wdAgentCodeFeeHTG= wdAgentHTGNum > 0 ? Math.round(wdAgentHTGNum * withdrawalFeePercent / 100) : 0;
  const wdAgentCodeNetHTG= Math.max(0, wdAgentHTGNum - wdAgentCodeFeeHTG);
  const wdAgentCodeFee   = wdAgentCodeFeeHTG / rate;
  const wdAgentCodeNet   = wdAgentCodeNetHTG / rate;

  const minDeposit  = settings?.minDepositUSD    || 0.01;
  const maxDeposit  = settings?.maxDepositUSD    || 10000;
  const minWithdraw = settings?.minWithdrawalUSD || 0.01;
  const maxWithdraw = settings?.maxWithdrawalUSD || 10000;

  const copyWalletId = () => {
    if (client?.walletId) {
      navigator.clipboard.writeText(client.walletId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('ID Wallet copié !');
    }
  };

  const openWhatsApp = (message: string) => {
    const num = settings?.whatsappAdminNumber || WHATSAPP_NUMBER;
    window.open(`https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const resetDeposit = () => {
    setHtgAmount(''); setDepositTxId(''); setDepositMessage('');
    setDepositCaptchaToken(null); depositCaptchaRef.current?.reset();
    setDepositMode('standard'); setAgentQrAmount(''); setTxCode(null);
    setDepositProofFile(null); setDepositProofPreview(null);
    setAgentReqCode(''); setAgentReqAmount(''); setAgentReqInfo(null);
    if (depositProofRef.current) depositProofRef.current.value = '';
  };

  // Agent deposit request handlers
  const handleAgentReqLookup = async () => {
    const code = agentReqCode.trim();
    if (!code) { toast.error('Entrez le code agent.'); return; }
    setAgentReqSearchLoading(true);
    setAgentReqInfo(null);
    try {
      const data = await apiFetch(`/api/agent/lookup?code=${encodeURIComponent(code)}`);
      if (data.available === false) { toast.error('Agent indisponible.'); return; }
      setAgentReqInfo({ name: data.name || code });
    } catch (e: any) { toast.error(e.message || 'Agent introuvable.'); }
    finally { setAgentReqSearchLoading(false); }
  };

  const handleAgentReqSubmit = async () => {
    const htg = parseFloat(agentReqAmount);
    if (isNaN(htg) || htg <= 0) { toast.error('Montant invalide.'); return; }
    const usd = htg / rate;
    if (!agentReqInfo) { toast.error("Recherchez un agent d'abord."); return; }
    setAgentReqSubmitting(true);
    try {
      const res = await apiFetch('/api/client/agent-deposit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentCode: agentReqCode.trim(), clientId, clientName: client?.name || '', amount: usd }),
      });
      toast.success(`Demande envoyée à ${agentReqInfo.name}. Attendez la confirmation de l'agent.`);
      setAgentReqCode(''); setAgentReqAmount(''); setAgentReqInfo(null);
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setAgentReqSubmitting(false); }
  };

  const handleDepositProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image trop lourde (max 2 Mo). Veuillez compresser l\'image.');
      e.target.value = '';
      return;
    }
    setDepositProofFile(file);
    const reader = new FileReader();
    reader.onload = ev => setDepositProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const resetWithdraw = () => {
    setWithdrawUSD(''); setWithdrawAccount(''); setWithdrawAccountName('');
    setWithdrawMessage(''); setWithdrawCaptchaToken(null); withdrawCaptchaRef.current?.reset();
    setWithdrawMode('standard'); setAgentQrAmount(''); setTxCode(null);
    setWdAgentCodeInput(''); setWdAgentInfo(null); setWdAgentAmount(''); setWdAgentMsg('');
  };

  const resetTransfer = () => {
    setTransferWalletId(''); setTransferUSD(''); setTransferMessage(''); setTransferPreview(null);
  };

  // Agent-code withdrawal handlers
  const handleWdAgentLookup = async () => {
    const code = wdAgentCodeInput.trim();
    if (!code) { toast.error('Entrez le code agent.'); return; }
    setWdAgentSearchLoading(true);
    setWdAgentInfo(null);
    try {
      const data = await apiFetch(`/api/agent/lookup?code=${encodeURIComponent(code)}`);
      setWdAgentInfo(data);
    } catch (e: any) { toast.error(e.message || 'Agent introuvable.'); }
    finally { setWdAgentSearchLoading(false); }
  };

  const handleWdAgentWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wdAgentInfo) { toast.error("Recherchez un agent d'abord."); return; }
    if (!wdAgentInfo.available) { toast.error('Cet agent est indisponible.'); return; }
    const htg = parseFloat(wdAgentAmount);
    if (isNaN(htg) || htg <= 0) { toast.error('Montant invalide.'); return; }
    const usd = htg / rate;
    if (usd > balance) { toast.error('Solde insuffisant.'); return; }
    if (usd < minWithdraw) { toast.error(`Montant minimum: ${Math.round(minWithdraw * rate).toLocaleString()} HTG`); return; }
    if (usd > maxWithdraw) { toast.error(`Montant maximum: ${Math.round(maxWithdraw * rate).toLocaleString()} HTG`); return; }
    setWdAgentLoading(true);
    try {
      await apiFetch('/api/client/agent-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          clientName: client?.name || '',
          amount: usd,
          ...(wdAgentInfo.agentCode ? { agentCode: wdAgentInfo.agentCode } : {}),
          ...(wdAgentInfo.affiliateCode ? { affiliateCode: wdAgentInfo.affiliateCode } : {}),
          ...(wdAgentInfo.affiliateId ? { affiliateId: wdAgentInfo.affiliateId } : {}),
          ...(wdAgentMsg.trim() && { message: wdAgentMsg.trim() }),
        }),
      });
      setWithdrawSuccessInfo({
        name: wdAgentInfo.name,
        phone: wdAgentInfo.phone || '',
        code: wdAgentInfo.agentCode || wdAgentInfo.affiliateCode || '',
        amountHTG: htg.toLocaleString(),
      });
      setIsWithdrawOpen(false);
      resetWithdraw();
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setWdAgentLoading(false); }
  };

  // Countdown timer for QR codes
  useEffect(() => {
    if (!txCode) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, txCode.expiresAt - Date.now());
      setTxCountdown(Math.ceil(remaining / 1000));
      if (remaining <= 0) { setTxCode(null); setTxCountdown(0); toast.error('Code QR expiré.'); }
    }, 1000);
    return () => clearInterval(interval);
  }, [txCode]);

  const handleGenerateTxCode = async (type: 'deposit' | 'withdrawal') => {
    const htg = parseFloat(agentQrAmount);
    if (isNaN(htg) || htg <= 0) { toast.error('Entrez un montant valide.'); return; }
    const usd = htg / rate;
    if (type === 'withdrawal' && usd > balance) { toast.error('Solde insuffisant.'); return; }
    setTxCodeLoading(true);
    try {
      const data = await apiFetch('/api/client/generate-tx-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, type, amount: usd }),
      });
      setTxCode({ codeData: data.codeData, expiresAt: data.expiresAt, type });
      setTxCountdown(Math.ceil((data.expiresAt - Date.now()) / 1000));
    } catch (e: any) { toast.error(e.message || 'Erreur de connexion. Veuillez réessayer.'); }
    finally { setTxCodeLoading(false); }
  };

  // Load pending confirmations once on mount, then use SSE for real-time updates
  React.useEffect(() => {
    if (!clientId) return;

    // Initial fetch (loads any confirmations that existed before connecting)
    fetch(`/api/client/pending-confirmations/${encodeURIComponent(clientId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setPendingConfirmations(data.confirmations || []))
      .catch(() => {});

    // SSE connection for real-time push events
    const es = new EventSource(`/api/client/events/${encodeURIComponent(clientId)}`);

    es.addEventListener('withdrawal_pending', (e: Event) => {
      try {
        const conf = JSON.parse((e as MessageEvent).data);
        setPendingConfirmations(prev => {
          if (prev.some((c: any) => c.id === conf.id)) return prev;
          return [conf, ...prev];
        });
        toast('⚠️ Confirmation de retrait requise', {
          description: `L'agent ${conf.agentName} souhaite retirer $${Number(conf.amount).toFixed(2)} de votre compte.`,
          duration: 8000,
        });
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener('withdrawal_resolved', (e: Event) => {
      try {
        const { id } = JSON.parse((e as MessageEvent).data);
        setPendingConfirmations(prev => prev.filter((c: any) => c.id !== id));
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener('tx_approved', (e: Event) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setTxSuccessModal(data);
      } catch { /* ignore parse errors */ }
    });

    // Auto-reconnect is handled natively by EventSource
    return () => { es.close(); };
  }, [clientId]);

  const handleConfirmWithdrawal = async (confirmId: string) => {
    const otp = (otpInputs[confirmId] || '').trim();
    if (!otp) { toast.error('Veuillez saisir le code OTP reçu par email.'); return; }
    setConfirmActionLoading(confirmId + ':confirm');
    try {
      const data = await apiFetch(`/api/client/confirm-withdrawal/${confirmId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, otpCode: otp }),
      });
      toast.success(`Retrait de $${Number(data.amount).toFixed(2)} confirmé.`);
      setPendingConfirmations(prev => prev.filter(c => c.id !== confirmId));
      setOtpInputs(prev => { const n = { ...prev }; delete n[confirmId]; return n; });
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setConfirmActionLoading(null); }
  };

  const handleRejectWithdrawal = async (confirmId: string) => {
    setConfirmActionLoading(confirmId + ':reject');
    try {
      await apiFetch(`/api/client/reject-withdrawal/${confirmId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      toast.success('Demande de retrait refusée.');
      setPendingConfirmations(prev => prev.filter(c => c.id !== confirmId));
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setConfirmActionLoading(null); }
  };

  // Lookup recipient name as user types wallet ID
  const handleWalletIdChange = async (val: string) => {
    setTransferWalletId(val);
    setTransferPreview(null);
    if (val.trim().length < 4) return;
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/client/lookup-wallet?walletId=${encodeURIComponent(val.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.name) setTransferPreview(data.name);
      }
    } catch { /* silent */ }
    finally { setLookupLoading(false); }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const htg = parseFloat(htgAmount);
    if (isNaN(htg) || htg <= 0) { toast.error('Montant invalide.'); return; }
    const usd = htg / effectiveDepositRate;
    if (usd < minDeposit) { toast.error(`Montant minimum: $${minDeposit.toFixed(2)} USD`); return; }
    if (usd > maxDeposit) { toast.error(`Montant maximum: $${maxDeposit.toFixed(2)} USD`); return; }
    if (!depositMethod) { toast.error('Choisissez une méthode de paiement.'); return; }
    if (RECAPTCHA_SITE_KEY && !depositCaptchaToken) { toast.error('Validez le captcha.'); return; }
    setActionLoading(true);
    try {
      let proofImageBase64: string | undefined;
      if (depositProofFile) {
        proofImageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = ev => resolve(ev.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(depositProofFile);
        });
      }
      await submitClientDeposit(client!, usd, depositMethod.name, depositTxId || undefined,
        depositCaptchaToken || undefined, depositMessage || undefined, htg, effectiveDepositRate, proofImageBase64);
      const msg = `Bonjour Solutionpam 👋,\n\nDemande de *DÉPÔT* :\n` +
        `👤 Nom: *${client!.name}*\n🔑 ID Wallet: *${client!.walletId}*\n` +
        `💵 Montant: *$${usd.toFixed(2)} USD*\n≈ *${htg.toLocaleString()} HTG* (taux: ${effectiveDepositRate})\n` +
        `💳 Via: *${depositMethod.name}*` +
        (depositMethod.number ? `\n📞 Numéro: *${depositMethod.number}*` : '') +
        (depositTxId ? `\n🔖 Référence: *${depositTxId}*` : '') +
        (depositMessage ? `\n💬 Message: *${depositMessage}*` : '') +
        `\n\nMerci de valider mon dépôt. 🙏`;
      openWhatsApp(msg);
      toast.success('Demande envoyée ! En attente de validation.');
      setIsDepositOpen(false); resetDeposit();
    } catch (err: any) {
      toast.error(err.message);
      depositCaptchaRef.current?.reset(); setDepositCaptchaToken(null);
    } finally { setActionLoading(false); }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const htg = parseFloat(withdrawUSD);
    if (isNaN(htg) || htg <= 0)  { toast.error('Montant invalide.'); return; }
    const usd = htg / rate;
    if (usd < minWithdraw)        { toast.error(`Montant minimum: ${Math.round(minWithdraw * rate).toLocaleString()} HTG`); return; }
    if (usd > maxWithdraw)        { toast.error(`Montant maximum: ${Math.round(maxWithdraw * rate).toLocaleString()} HTG`); return; }
    if (usd > balance)            { toast.error('Solde insuffisant.'); return; }
    if (!withdrawMethod)          { toast.error('Choisissez une méthode de retrait.'); return; }
    if (!withdrawAccount)         { toast.error('Numéro/adresse de réception requis.'); return; }
    if (RECAPTCHA_SITE_KEY && !withdrawCaptchaToken) { toast.error('Validez le captcha.'); return; }
    setActionLoading(true);
    try {
      await submitClientWithdrawal(client!, usd, withdrawMethod.name, withdrawAccount,
        withdrawCaptchaToken || undefined, withdrawMessage || undefined,
        withdrawAccountName || undefined, rate);
      const num = settings?.whatsappAdminNumber || WHATSAPP_NUMBER;
      const msg = `Bonjour Solutionpam 👋,\n\nDemande de *RETRAIT* :\n` +
        `👤 Nom: *${client!.name}*\n🔑 ID Wallet: *${client!.walletId}*\n` +
        `💰 Montant: *${htg.toLocaleString()} HTG*\n≈ *$${usd.toFixed(2)} USD* (taux: ${rate})\n` +
        `💳 Via: *${withdrawMethod.name}*\n📞 Compte: *${withdrawAccount}*` +
        (withdrawAccountName ? `\n👤 Bénéficiaire: *${withdrawAccountName}*` : '') +
        (withdrawMessage ? `\n💬 Message: *${withdrawMessage}*` : '') +
        `\n\nMerci de traiter ma demande. 🙏`;
      window.open(`https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
      toast.success('Demande de retrait soumise !');
      setIsWithdrawOpen(false); resetWithdraw();
    } catch (err: any) {
      toast.error(err.message);
      withdrawCaptchaRef.current?.reset(); setWithdrawCaptchaToken(null);
    } finally { setActionLoading(false); }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const usd = parseFloat(transferUSD);
    if (isNaN(usd) || usd <= 0)      { toast.error('Montant invalide.'); return; }
    if (usd > balance)                { toast.error('Solde insuffisant.'); return; }
    if (!transferWalletId.trim())     { toast.error('Entrez l\'ID Wallet du destinataire.'); return; }
    if (transferWalletId.trim() === client?.walletId) {
      toast.error('Vous ne pouvez pas vous transférer à vous-même.'); return;
    }
    setActionLoading(true);
    try {
      const result = await submitClientTransfer(
        clientId, transferWalletId.trim(), usd, transferMessage || undefined
      );
      toast.success(`$${result.amount.toFixed(2)} envoyé à ${result.recipientName || 'destinataire'} !`);
      setIsTransferOpen(false); resetTransfer();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setActionLoading(false); }
  };

  const handleDeleteHistory = async () => {
    if (!window.confirm("Supprimer tout l'historique ? Action irréversible.")) return;
    setIsDeletingHistory(true);
    try {
      const res = await fetch(`/api/client/transactions/${clientId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur.');
      toast.success('Historique supprimé.');
    } catch { toast.error("Impossible de supprimer l'historique."); }
    finally { setIsDeletingHistory(false); }
  };

  const pendingCount = transactions.filter(t => t.status === 'pending').length;

  if (!asPage && !open) return null;

  return (
    <div className={asPage
      ? 'flex flex-col min-h-full bg-white'
      : 'fixed inset-x-0 top-0 bottom-[58px] sm:inset-0 z-[200] flex items-end sm:items-center justify-center'
    }>
      {!asPage && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <div className={asPage
        ? 'flex flex-col flex-1 overflow-hidden w-full'
        : 'relative z-10 w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] max-h-full sm:max-h-[95vh] overflow-hidden flex flex-col shadow-2xl shadow-black/20'
      }>
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-2xl bg-violet-100 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-violet-600" />
            </div>
            <span className="font-black text-gray-900 text-sm">Mon Wallet</span>
          </div>
          <button
            onClick={asPage ? onBack : onClose}
            className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            {asPage
              ? <ChevronLeft className="h-4 w-4 text-gray-500" />
              : <X className="h-4 w-4 text-gray-500" />}
          </button>
        </div>

        {/* Card */}
        <div className="px-3 pb-2 shrink-0">
          {loading ? (
            <div className="w-full rounded-[1.75rem] bg-violet-100 animate-pulse" style={{ aspectRatio: '2 / 1' }} />
          ) : client ? (
            <VirtualCard
              client={client} balance={balance} rate={rate}
              copied={copied} onCopy={copyWalletId}
              hidden={balanceHidden} onToggleHide={() => setBalanceHidden(v => !v)}
            />
          ) : (
            <div className="w-full rounded-[1.75rem] bg-gray-100 flex items-center justify-center" style={{ aspectRatio: '2 / 1' }}>
              <AlertCircle className="h-8 w-8 text-gray-300" />
            </div>
          )}

          {/* Balance strip skeleton */}
          {loading && (
            <div className="mt-2 grid grid-cols-3 gap-2 px-1 animate-pulse">
              <div><div className="h-2.5 bg-gray-200 rounded-full w-16 mb-1.5" /><div className="h-5 bg-gray-300 rounded-full w-20" /></div>
              <div><div className="h-2.5 bg-gray-200 rounded-full w-16 mb-1.5" /><div className="h-5 bg-gray-300 rounded-full w-20" /></div>
              <div className="text-right"><div className="h-2.5 bg-gray-200 rounded-full w-10 ml-auto mb-1.5" /><div className="h-5 bg-violet-200 rounded-full w-16 ml-auto" /></div>
            </div>
          )}
          {/* Balance strip */}
          {client && (
            <div className="mt-2 grid grid-cols-3 gap-2 px-1">
              <div>
                <p className="text-[10px] text-gray-400 font-semibold">Solde USD</p>
                <p className="text-base font-black text-gray-900">
                  {balanceHidden ? '••••' : `$${balance.toFixed(2)}`}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-semibold">Équivalent HTG</p>
                <p className="text-base font-black text-gray-900">
                  {balanceHidden ? '••••' : Math.round(balance * rate).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-semibold">Taux</p>
                <p className="text-sm font-black text-violet-600">1$ = {rate} HTG</p>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* ── Skeleton while client data loads ── */}
          {loading && (
            <div className="px-3 pb-3 space-y-2.5 animate-pulse">
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 rounded-2xl bg-emerald-100" />
                <div className="h-20 rounded-2xl bg-red-100" />
              </div>
              <div className="h-14 rounded-2xl bg-gray-100" />
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <div className="h-9 bg-gray-50 border-b border-gray-100" />
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="h-8 w-8 rounded-xl bg-gray-200 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-gray-200 rounded-full w-2/3" />
                      <div className="h-2.5 bg-gray-100 rounded-full w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-10 rounded-2xl bg-gray-100" />
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-gray-100 bg-white">
                  <div className="h-9 w-9 rounded-xl bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-200 rounded-full w-3/5" />
                    <div className="h-2.5 bg-gray-100 rounded-full w-2/5" />
                  </div>
                  <div className="h-4 w-14 bg-gray-200 rounded-full" />
                </div>
              ))}
            </div>
          )}
          <div className={`px-3 pb-3 space-y-2.5${loading ? ' hidden' : ''}`}>

            {/* ── Pending withdrawal confirmations (agent-initiated) */}
            <AnimatePresence>
              {pendingConfirmations.map((conf: any) => (
                <motion.div
                  key={conf.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertCircle className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-amber-800 text-sm leading-tight">⚠️ Confirmation de retrait requise</p>
                      <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        L'agent <strong>{conf.agentName}</strong> souhaite retirer <strong>${Number(conf.amount).toFixed(2)}</strong> de votre compte.
                        {conf.note && <span className="block text-amber-600 mt-0.5 text-[11px]">Note : {conf.note}</span>}
                      </p>
                      <p className="text-[10px] text-amber-500 mt-1">Expire dans 30 min à partir de la demande</p>
                    </div>
                  </div>
                  {/* OTP input */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5">
                      <Shield className="h-3 w-3" />
                      Code de sécurité reçu par email
                    </p>
                    <Input
                      value={otpInputs[conf.id] || ''}
                      onChange={e => setOtpInputs(prev => ({ ...prev, [conf.id]: e.target.value }))}
                      placeholder="Entrez le code à 6 chiffres"
                      maxLength={6}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="h-10 rounded-xl border-2 border-amber-200 bg-white text-center text-lg font-black tracking-widest focus-visible:ring-amber-400 text-amber-900 placeholder:text-amber-300 placeholder:text-sm placeholder:font-normal placeholder:tracking-normal"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleConfirmWithdrawal(conf.id)}
                      disabled={confirmActionLoading !== null}
                      className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs border-0 shadow-sm shadow-emerald-200"
                    >
                      {confirmActionLoading === conf.id + ':confirm' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Confirmer</>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleRejectWithdrawal(conf.id)}
                      disabled={confirmActionLoading !== null}
                      variant="outline"
                      className="flex-1 h-11 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 font-black text-xs"
                    >
                      {confirmActionLoading === conf.id + ':reject' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><XCircle className="h-3.5 w-3.5 mr-1.5" />Refuser</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* ── Action buttons: 3 columns ── */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={() => { setDepositMethod(depositMethods[0] || null); setIsDepositOpen(true); }}
                className="group relative overflow-hidden flex flex-col items-center justify-center gap-1 py-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-200 hover:from-emerald-600 hover:to-emerald-700 transition-all active:scale-95"
              >
                <div className="absolute -right-3 -bottom-3 w-12 h-12 rounded-full bg-white/10" />
                <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center mb-0.5">
                  <ArrowDownToLine className="h-4 w-4 text-white" />
                </div>
                <p className="font-black text-white text-xs">Déposer</p>
              </button>

              <button
                onClick={() => { setWithdrawMethod(withdrawalMethods[0] || null); setIsWithdrawOpen(true); }}
                className="group relative overflow-hidden flex flex-col items-center justify-center gap-1 py-4 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-200 hover:from-red-600 hover:to-rose-700 transition-all active:scale-95"
              >
                <div className="absolute -right-3 -bottom-3 w-12 h-12 rounded-full bg-white/10" />
                <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center mb-0.5">
                  <ArrowUpFromLine className="h-4 w-4 text-white" />
                </div>
                <p className="font-black text-white text-xs">Retirer</p>
              </button>

              <button
                onClick={() => { resetTransfer(); setIsTransferOpen(true); }}
                className="group relative overflow-hidden flex flex-col items-center justify-center gap-1 py-4 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-700 shadow-lg shadow-violet-200 hover:from-violet-700 hover:to-violet-800 transition-all active:scale-95"
              >
                <div className="absolute -right-3 -bottom-3 w-12 h-12 rounded-full bg-white/10" />
                <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center mb-0.5">
                  <Send className="h-4 w-4 text-white" />
                </div>
                <p className="font-black text-white text-xs">Transférer</p>
              </button>
            </div>

            {/* Payment Methods */}
            {depositMethods.length > 0 && (
              <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <CardIcon className="h-3.5 w-3.5 text-gray-400" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Méthodes acceptées</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {depositMethods.slice(0, 6).map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${methodColors[m.type] || 'text-gray-400 bg-gray-50'}`}>
                        {getMethodIcon(m.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-800">{m.icon} {m.name}</p>
                        {m.number  && <p className="text-[10px] text-gray-400 font-mono">{m.number}</p>}
                        {m.address && <p className="text-[10px] text-gray-400 font-mono truncate max-w-[140px]">{m.address}</p>}
                      </div>
                      {m.qrUrl && (
                        <img src={m.qrUrl} alt="QR" className="h-9 w-9 rounded-xl object-cover border border-gray-100"
                          onError={e => (e.currentTarget.style.display = 'none')} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Security */}
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-violet-50 border border-violet-100">
              <div className="h-8 w-8 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-violet-600" />
              </div>
              <p className="text-xs text-violet-700 leading-relaxed">
                Toutes les transactions sont vérifiées par notre équipe sous 24h. Vos fonds sont sécurisés par Solutionpam.
              </p>
            </div>

            {/* History */}
            <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
              <button
                onClick={() => setHistoryOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-gray-400" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Historique</span>
                  {pendingCount > 0 && (
                    <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-300 transition-transform duration-300 ${historyOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence initial={false}>
                {historyOpen && (
                  <motion.div
                    key="history"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden border-t border-gray-100"
                  >
                    <div className="p-3 space-y-2">
                      {txLoading ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                        </div>
                      ) : transactions.length === 0 ? (
                        <div className="text-center py-8">
                          <History className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                          <p className="text-gray-400 text-sm">Aucune transaction.</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-end mb-1">
                            <button onClick={handleDeleteHistory} disabled={isDeletingHistory}
                              className="flex items-center gap-1.5 text-[11px] font-bold text-red-400 hover:text-red-600 transition-colors disabled:opacity-50">
                              {isDeletingHistory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              Supprimer l'historique
                            </button>
                          </div>
                          {transactions.map(tx => {
                            const sc = statusConfig[tx.status as keyof typeof statusConfig] || statusConfig.pending;
                            const isCredit = tx.type === 'deposit' || tx.type === 'transfer_received' || tx.type === 'refund';
                            const usdAmt = tx.usdAmount ?? tx.amount;
                            const htgEq  = tx.htgAmount ?? tx.htgEquivalent;
                            const isTransfer = tx.type === 'transfer_received' || (tx.method === 'Transfert Wallet');
                            return (
                              <div key={tx.id}
                                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                                  isTransfer ? 'bg-violet-100' : isCredit ? 'bg-emerald-100' : 'bg-red-100'
                                }`}>
                                  {isTransfer
                                    ? <Send className="h-4 w-4 text-violet-600" />
                                    : isCredit
                                      ? <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                                      : <ArrowUpFromLine className="h-4 w-4 text-red-500" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-sm text-gray-800 truncate">
                                    {tx.method === 'Transfert Wallet' && !isCredit
                                      ? 'Transfert envoyé'
                                      : typeLabel[tx.type] || tx.type}
                                  </p>
                                  <p className="text-[10px] text-gray-400 truncate">{tx.description || tx.method || ''}</p>
                                  {tx.createdAt?.toDate && (
                                    <p className="text-[10px] text-gray-300 mt-0.5">
                                      {format(tx.createdAt.toDate(), 'dd MMM yyyy HH:mm', { locale: fr })}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={`font-black text-sm ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {isCredit ? '+' : '-'}${usdAmt.toFixed(2)}
                                  </p>
                                  {htgEq && htgEq > 0 && (
                                    <p className="text-[10px] text-gray-400">
                                      ≈ {Math.round(htgEq).toLocaleString()} HTG
                                    </p>
                                  )}
                                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sc.color}`}>
                                    {sc.icon}{sc.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 bg-white shrink-0">
          <Button
            variant="ghost"
            onClick={onLogout}
            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl h-10 font-bold"
          >
            <LogOut className="h-4 w-4 mr-2" /> Déconnexion
          </Button>
        </div>
      </div>

      {/* ── DEPOSIT MODAL ──────────────────────────────────────────────────────── */}
      <Dialog open={isDepositOpen} onOpenChange={v => { if (!v) resetDeposit(); setIsDepositOpen(v); }}>
        <DialogContent className="max-w-sm rounded-[2rem] border-0 shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center">
                <ArrowDownToLine className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-white">Faire un dépôt</DialogTitle>
                <DialogDescription className="text-emerald-100/70 text-xs">Rechargez votre wallet en HTG</DialogDescription>
              </div>
            </div>
          </div>

          <form onSubmit={depositMode === 'agent-qr' ? (e: React.FormEvent) => e.preventDefault() : handleDeposit} className="p-5 space-y-4 bg-white overflow-y-auto flex-1">

            {/* ── Mode selector ── */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-gray-100 rounded-2xl">
              <button type="button" onClick={() => { setDepositMode('standard'); setTxCode(null); setAgentQrAmount(''); }}
                className={`flex items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${depositMode === 'standard' ? 'bg-white shadow text-emerald-700' : 'text-gray-400 hover:text-gray-600'}`}>
                <Smartphone className="h-3 w-3" />Standard
              </button>
              <button type="button" onClick={() => { setDepositMode('agent-qr'); setDepositMethod(null); }}
                className={`flex items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${depositMode === 'agent-qr' ? 'bg-white shadow text-emerald-700' : 'text-gray-400 hover:text-gray-600'}`}>
                <QrCode className="h-3 w-3" />QR Agent
              </button>
              <button type="button" onClick={() => { setDepositMode('agent-request'); setDepositMethod(null); setTxCode(null); }}
                className={`flex items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${depositMode === 'agent-request' ? 'bg-white shadow text-emerald-700' : 'text-gray-400 hover:text-gray-600'}`}>
                <Send className="h-3 w-3" />Via Code
              </button>
              <button type="button" onClick={() => { setDepositMode('crypto'); setDepositMethod(null); setTxCode(null); }}
                className={`flex items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${depositMode === 'crypto' ? 'bg-white shadow text-amber-600' : 'text-gray-400 hover:text-gray-600'}`}>
                <Bitcoin className="h-3 w-3" />Crypto
              </button>
            </div>

            {/* ── Mode Agent QR ── */}
            {depositMode === 'agent-qr' && (
              <div className="space-y-4">
                {!txCode ? (
                  <>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
                      <QrCode className="h-8 w-8 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-black text-emerald-800 text-sm">Dépôt via Agent QR</p>
                        <p className="text-[11px] text-emerald-600 mt-1 leading-relaxed">L'agent scanne le code, votre solde est crédité immédiatement. Valide 60 min.</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant à déposer (HTG)</Label>
                      <Input type="number" placeholder="Ex: 2 700" value={agentQrAmount}
                        onChange={e => setAgentQrAmount(e.target.value)}
                        className="h-12 rounded-xl text-lg font-black" min="1" step="1" />
                      {agentQrHTGNum > 0 && (
                        <div className="rounded-2xl border border-emerald-100 overflow-hidden">
                          <div className="flex justify-between items-center px-3.5 py-2.5 bg-white border-b border-emerald-50">
                            <span className="text-[11px] text-gray-500 font-medium">Montant déposé</span>
                            <span className="text-sm font-black text-gray-800">
                              {agentQrHTGNum.toLocaleString()} HTG
                              <span className="text-[10px] font-medium text-gray-400 ml-1">≈ ${agentQrUSDNum.toFixed(2)}</span>
                            </span>
                          </div>
                          {depositFeePercent > 0 && (
                            <div className="flex justify-between items-center px-3.5 py-2.5 bg-white border-b border-emerald-50">
                              <span className="text-[11px] text-red-500 font-medium">Frais ({depositFeePercent}%)</span>
                              <span className="text-sm font-black text-red-500">−{agentQrDepositFeeHTG.toLocaleString()} HTG</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center px-3.5 py-2.5 bg-emerald-50">
                            <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wide">Vous recevrez</span>
                            <span className="text-base font-black text-emerald-700">
                              {agentQrDepositNetHTG.toLocaleString()} HTG
                              <span className="text-[10px] font-medium text-gray-400 ml-1">≈ ${agentQrDepositNet.toFixed(2)}</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button type="button" onClick={() => handleGenerateTxCode('deposit')}
                      disabled={txCodeLoading || !agentQrAmount || parseFloat(agentQrAmount) <= 0}
                      className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl border-0">
                      {txCodeLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><QrCode className="h-4 w-4 mr-2" />Générer le Code QR</>}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col items-center gap-3 text-center py-2">
                      <div className="bg-white p-4 rounded-2xl border-2 border-emerald-200 shadow-lg">
                        <QRCode value={txCode.codeData} size={200} />
                      </div>
                      <div>
                        <p className="font-black text-gray-800">Dépôt de <span className="text-emerald-600">{agentQrHTGNum.toLocaleString()} HTG</span><span className="text-gray-400 text-xs font-normal ml-1.5">≈ ${agentQrUSDNum.toFixed(2)}</span></p>
                        <p className="text-xs text-gray-400 mt-0.5">Présentez ce code à l'agent pour qu'il le scanne</p>
                      </div>
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black ${txCountdown < 120 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        <Clock className="h-4 w-4" />
                        Expire dans {Math.floor(txCountdown / 60)}:{String(txCountdown % 60).padStart(2, '0')}
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-800">Après le scan, la transaction est traitée instantanément. Fermez ce dialog et vérifiez votre solde.</p>
                    </div>
                    <Button type="button" onClick={() => { setTxCode(null); setAgentQrAmount(''); }}
                      variant="outline" className="w-full h-11 rounded-xl border-gray-200 text-gray-500 text-sm font-bold">
                      Annuler / Régénérer
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* ── Mode Via Code Agent ── */}
            {depositMode === 'agent-request' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                  <Send className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-black text-blue-800 text-sm">Demande de dépôt via agent</p>
                    <p className="text-[11px] text-blue-600 mt-1 leading-relaxed">Entrez le code de votre agent. Il recevra la demande et devra l'approuver depuis son tableau de bord.</p>
                  </div>
                </div>

                {/* Agent code lookup */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Code de l'agent</Label>
                  <div className="flex gap-2">
                    <Input
                      value={agentReqCode}
                      onChange={e => { setAgentReqCode(e.target.value); setAgentReqInfo(null); }}
                      placeholder="Ex: 12345678"
                      className="flex-1 h-12 rounded-xl text-base font-mono"
                    />
                    <Button type="button" onClick={handleAgentReqLookup} disabled={agentReqSearchLoading || !agentReqCode.trim()}
                      className="h-12 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black border-0">
                      {agentReqSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {agentReqInfo && (
                  <>
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <p className="font-black text-emerald-800">Agent : {agentReqInfo.name}</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant (HTG)</Label>
                      <Input type="number" placeholder="Ex: 2 700" value={agentReqAmount}
                        onChange={e => setAgentReqAmount(e.target.value)}
                        className="h-12 rounded-xl text-lg font-black" min="1" step="1" />
                      {parseFloat(agentReqAmount) > 0 && (
                        <p className="text-xs text-gray-400 font-medium pl-1">≈ ${(parseFloat(agentReqAmount) / rate).toFixed(2)} USD</p>
                      )}
                    </div>

                    <Button type="button" onClick={handleAgentReqSubmit}
                      disabled={agentReqSubmitting || !agentReqAmount || parseFloat(agentReqAmount) <= 0}
                      className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl border-0">
                      {agentReqSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Envoyer la demande</>}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* ── Mode Crypto ── */}
            {depositMode === 'crypto' && (
              <CryptoDepositFlow
                clientId={client!.id!}
                clientName={client!.name || ''}
                clientWalletId={client!.walletId || ''}
                feePercent={depositFeePercent}
                minAmountUSD={minDeposit}
                onSuccess={(amount) => {
                  toast.success(`✅ Compte rechargé de ${amount.toFixed(2)} USD !`);
                  setIsDepositOpen(false);
                }}
              />
            )}

            {depositMode === 'standard' && (<>
            {/* ── 1. Méthode de paiement ── */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Méthode de paiement</Label>
              {depositMethods.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <Info className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700">Aucune méthode de dépôt activée.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {depositMethods.map(m => {
                    const logoUrl = m.id === 'moncash' ? (settings as any)?.moncashLogoUrl
                      : m.id === 'natcash' ? (settings as any)?.natcashLogoUrl
                      : null;
                    return (
                      <button key={m.id} type="button" onClick={() => setDepositMethod(m)}
                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 transition-all text-center ${
                          depositMethod?.id === m.id
                            ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                            : 'border-gray-100 bg-white hover:border-gray-200'
                        }`}>
                        {logoUrl ? (
                          <div className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50">
                            <img src={logoUrl} alt={m.name} className="h-7 w-7 object-contain" referrerPolicy="no-referrer" />
                          </div>
                        ) : (
                          <span className="text-lg">{m.icon}</span>
                        )}
                        <span className="text-[10px] font-black text-gray-700 leading-tight">{m.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── 2. Infos compte + QR (s'affiche après sélection) ── */}
            {(() => {
              if (!depositMethod) return null;
              const num = depositMethod.number || depositMethod.address
                || (depositMethod.id === 'moncash' ? (settings as any)?.moncashNumber : null)
                || (depositMethod.id === 'natcash' ? (settings as any)?.natcashNumber : null)
                || (depositMethod.id === 'admi' ? (settings as any)?.admiNumber : null)
                || null;
              const qr = depositMethod.qrUrl
                || (depositMethod.id === 'moncash' ? (settings as any)?.moncashQR : null)
                || (depositMethod.id === 'natcash' ? (settings as any)?.natcashQR : null)
                || (depositMethod.id === 'admi' ? (settings as any)?.admiQR : null)
                || null;
              const accountName = depositMethod.accountName || null;
              if (!num && !qr) return null;
              return (
                <div className="rounded-2xl overflow-hidden border border-emerald-100">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600">
                    <Smartphone className="h-3.5 w-3.5 text-white" />
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Compte {depositMethod.name}</p>
                  </div>
                  <div className="p-3 space-y-3 bg-emerald-50">
                    {num && (
                      <div className="flex items-center justify-between gap-3 bg-white rounded-xl p-3 border border-emerald-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl shrink-0">{depositMethod.icon}</span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide leading-none">{depositMethod.name}</p>
                            {accountName && (
                              <p className="text-[11px] font-bold text-gray-700 leading-tight mt-0.5">{accountName}</p>
                            )}
                            <p className="font-black text-gray-900 font-mono text-base mt-0.5 tracking-wider">{num}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(num); toast.success(`Numéro ${depositMethod.name} copié !`); }}
                          className="shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition-colors active:scale-95"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {qr && (
                      <div className="flex flex-col items-center gap-2 bg-white rounded-xl p-3 border border-emerald-100 text-center">
                        <div className="relative">
                          <img src={qr} alt="QR Code" className="h-28 w-28 object-contain rounded-lg border border-gray-100 mx-auto"
                            onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                          <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-600 text-white p-1 rounded-md shadow">
                            <QrCode className="h-3 w-3" />
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">QR Code</p>
                          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">Scannez ce code pour envoyer le paiement directement</p>
                        </div>
                      </div>
                    )}
                    {depositMethod.instructions && (
                      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                        <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-blue-700 leading-relaxed">{depositMethod.instructions}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant envoyé (HTG)</Label>
                <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                  1$ = {effectiveDepositRate} HTG
                  {cardRates?.[depositMethod?.id || ''] ? ' ✦' : ''}
                </span>
              </div>
              <Input type="number" value={htgAmount} onChange={e => setHtgAmount(e.target.value)}
                placeholder="Ex: 1 000" className="h-12 rounded-xl text-lg font-black" min="1" step="1" required />
              {usdPreview > 0 && (
                <div className="rounded-2xl border border-emerald-100 overflow-hidden">
                  <div className="flex justify-between items-center px-3.5 py-2.5 bg-white border-b border-emerald-50">
                    <span className="text-[11px] text-gray-500 font-medium">Montant déposé</span>
                    <span className="text-sm font-black text-gray-800">${usdPreview.toFixed(2)} USD</span>
                  </div>
                  {depositFeePercent > 0 && (
                    <div className="flex justify-between items-center px-3.5 py-2.5 bg-white border-b border-emerald-50">
                      <span className="text-[11px] text-red-500 font-medium">Frais ({depositFeePercent}%)</span>
                      <span className="text-sm font-black text-red-500">−${depositFeeAmount.toFixed(2)} USD</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center px-3.5 py-2.5 bg-emerald-50">
                    <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wide">Vous recevrez</span>
                    <span className="text-base font-black text-emerald-700">${depositNetAmount.toFixed(2)} USD</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Référence / ID transaction</Label>
              <Input value={depositTxId} onChange={e => setDepositTxId(e.target.value)}
                placeholder="Ex: TX-1234567890" className="h-11 rounded-xl font-mono" />
            </div>

            {/* ── Proof image upload (MonCash / NatCash only) ── */}
            {depositMethod && (depositMethod.id === 'moncash' || depositMethod.id === 'natcash' || depositMethod.type === 'mobile_money') && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Preuve de paiement <span className="text-emerald-600">(capture d'écran)</span>
                </Label>
                {depositProofPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-200">
                    <img src={depositProofPreview} alt="Preuve" className="w-full h-32 object-cover" />
                    <button
                      type="button"
                      onClick={() => { setDepositProofFile(null); setDepositProofPreview(null); if (depositProofRef.current) depositProofRef.current.value = ''; }}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 text-white text-[10px] font-black text-center py-1 uppercase tracking-wider">
                      Preuve sélectionnée ✓
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
                    <div className="h-10 w-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
                      <Send className="h-5 w-5 text-emerald-600 rotate-[-45deg]" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black text-emerald-700">Téléverser la preuve</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG · max 2 Mo</p>
                    </div>
                    <input
                      ref={depositProofRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleDepositProofChange}
                    />
                  </label>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Message (optionnel)</Label>
              <textarea value={depositMessage} onChange={e => setDepositMessage(e.target.value)}
                placeholder="Informations supplémentaires..."
                className="w-full min-h-[60px] px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300 transition-all"
                maxLength={300} />
              <p className="text-[10px] text-gray-400">{depositMessage.length}/300</p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
              <strong>Étape suivante :</strong> Vous serez redirigé sur WhatsApp pour envoyer votre preuve de paiement.
            </div>

            {RECAPTCHA_SITE_KEY && (
              <div className="flex flex-col items-center">
                <CaptchaWidget sitekey={RECAPTCHA_SITE_KEY} captchaRef={depositCaptchaRef}
                  onChange={t => setDepositCaptchaToken(t)} onExpired={() => setDepositCaptchaToken(null)} />
              </div>
            )}

            <Button type="submit"
              disabled={actionLoading || !depositMethod || (!!RECAPTCHA_SITE_KEY && !depositCaptchaToken)}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black">
              {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmer et envoyer preuve →'}
            </Button>
            </>)}
          </form>
        </DialogContent>
      </Dialog>

      {/* ── WITHDRAW MODAL ────────────────────────────────────────────────────── */}
      <Dialog open={isWithdrawOpen} onOpenChange={v => { if (!v) resetWithdraw(); setIsWithdrawOpen(v); }}>
        <DialogContent className="max-w-sm rounded-[2rem] border-0 shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-br from-red-500 to-rose-700 p-5 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center">
                <ArrowUpFromLine className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-white">Retirer des fonds</DialogTitle>
                <DialogDescription className="text-red-100/70 text-xs">
                  Solde: <strong>${balance.toFixed(2)} USD</strong> ≈ {Math.round(balance * rate).toLocaleString()} HTG
                </DialogDescription>
              </div>
            </div>
          </div>

          <form onSubmit={withdrawMode === 'agent-qr' ? (e: React.FormEvent) => e.preventDefault() : withdrawMode === 'agent-code' ? handleWdAgentWithdraw : handleWithdraw} className="p-5 space-y-4 bg-white overflow-y-auto flex-1">

            {/* ── Mode selector ── */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-2xl">
              <button type="button" onClick={() => { setWithdrawMode('standard'); setTxCode(null); setAgentQrAmount(''); }}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black transition-all ${withdrawMode === 'standard' ? 'bg-white shadow text-rose-700' : 'text-gray-400 hover:text-gray-600'}`}>
                <Smartphone className="h-3 w-3" />Standard
              </button>
              <button type="button" onClick={() => { setWithdrawMode('agent-qr'); setWithdrawMethod(null); }}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black transition-all ${withdrawMode === 'agent-qr' ? 'bg-white shadow text-rose-700' : 'text-gray-400 hover:text-gray-600'}`}>
                <QrCode className="h-3 w-3" />QR Agent
              </button>
              <button type="button" onClick={() => { setWithdrawMode('agent-code'); setTxCode(null); setAgentQrAmount(''); setWithdrawMethod(null); }}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black transition-all ${withdrawMode === 'agent-code' ? 'bg-white shadow text-rose-700' : 'text-gray-400 hover:text-gray-600'}`}>
                <MapPin className="h-3 w-3" />Code Agent
              </button>
            </div>

            {/* ── Mode Agent QR ── */}
            {withdrawMode === 'agent-qr' && (
              <div className="space-y-4">
                {!txCode ? (
                  <>
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3">
                      <QrCode className="h-8 w-8 text-rose-600 shrink-0" />
                      <div>
                        <p className="font-black text-rose-800 text-sm">Retrait via Agent QR</p>
                        <p className="text-[11px] text-rose-600 mt-1 leading-relaxed">L'agent scanne le code, votre solde est débité et vous recevez le cash. Valide 60 min.</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant à retirer (HTG)</Label>
                      <Input type="number" placeholder="Ex: 2 700" value={agentQrAmount}
                        onChange={e => setAgentQrAmount(e.target.value)}
                        className="h-12 rounded-xl text-lg font-black" min="1" step="1"
                        max={Math.floor(balance * rate)}
                      />
                      {agentQrHTGNum > 0 && agentQrUSDNum > balance && (
                        <p className="text-[10px] text-red-500 font-bold">Solde insuffisant (disponible: {Math.floor(balance * rate).toLocaleString()} HTG)</p>
                      )}
                      {agentQrHTGNum > 0 && agentQrUSDNum <= balance && (
                        <div className="rounded-2xl border border-rose-100 overflow-hidden">
                          <div className="flex justify-between items-center px-3.5 py-2.5 bg-white border-b border-rose-50">
                            <span className="text-[11px] text-gray-500 font-medium">Montant demandé</span>
                            <span className="text-sm font-black text-gray-800">
                              {agentQrHTGNum.toLocaleString()} HTG
                              <span className="text-[10px] font-medium text-gray-400 ml-1">≈ ${agentQrUSDNum.toFixed(2)}</span>
                            </span>
                          </div>
                          {withdrawalFeePercent > 0 && (
                            <div className="flex justify-between items-center px-3.5 py-2.5 bg-white border-b border-rose-50">
                              <span className="text-[11px] text-red-500 font-medium">Frais ({withdrawalFeePercent}%)</span>
                              <span className="text-sm font-black text-red-500">−{agentQrWithdrawFeeHTG.toLocaleString()} HTG</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center px-3.5 py-2.5 bg-rose-50">
                            <span className="text-[11px] font-black text-rose-800 uppercase tracking-wide">Vous recevrez</span>
                            <span className="text-base font-black text-rose-700">
                              {agentQrWithdrawNetHTG.toLocaleString()} HTG
                              <span className="text-[10px] font-medium text-gray-400 ml-1">≈ ${agentQrWithdrawNet.toFixed(2)}</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button type="button" onClick={() => handleGenerateTxCode('withdrawal')}
                      disabled={txCodeLoading || !agentQrAmount || parseFloat(agentQrAmount) <= 0 || agentQrUSDNum > balance}
                      className="w-full h-12 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl border-0">
                      {txCodeLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><QrCode className="h-4 w-4 mr-2" />Générer le Code QR</>}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col items-center gap-3 text-center py-2">
                      <div className="bg-white p-4 rounded-2xl border-2 border-rose-200 shadow-lg">
                        <QRCode value={txCode.codeData} size={200} />
                      </div>
                      <div>
                        <p className="font-black text-gray-800">Retrait de <span className="text-rose-600">{agentQrHTGNum.toLocaleString()} HTG</span><span className="text-gray-400 text-xs font-normal ml-1.5">≈ ${agentQrUSDNum.toFixed(2)}</span></p>
                        <p className="text-xs text-gray-400 mt-0.5">Présentez ce code à l'agent pour qu'il le scanne</p>
                      </div>
                      {agentQrWithdrawFeeHTG > 0 && (
                        <div className="w-full rounded-2xl border border-rose-100 overflow-hidden text-left">
                          <div className="flex justify-between items-center px-3.5 py-2 bg-white border-b border-rose-50">
                            <span className="text-[11px] text-red-500 font-medium">Frais ({withdrawalFeePercent}%)</span>
                            <span className="text-sm font-black text-red-500">−{agentQrWithdrawFeeHTG.toLocaleString()} HTG</span>
                          </div>
                          <div className="flex justify-between items-center px-3.5 py-2.5 bg-rose-50">
                            <span className="text-[11px] font-black text-rose-800 uppercase tracking-wide">Vous recevrez</span>
                            <span className="text-base font-black text-rose-700">
                              {agentQrWithdrawNetHTG.toLocaleString()} HTG
                              <span className="text-[10px] font-medium text-gray-400 ml-1">≈ ${agentQrWithdrawNet.toFixed(2)}</span>
                            </span>
                          </div>
                        </div>
                      )}
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black ${txCountdown < 120 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        <Clock className="h-4 w-4" />
                        Expire dans {Math.floor(txCountdown / 60)}:{String(txCountdown % 60).padStart(2, '0')}
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-800">Après le scan, l'agent vous remet exactement <span className="font-black">{agentQrWithdrawNetHTG.toLocaleString()} HTG</span> en cash et votre solde est débité instantanément.</p>
                    </div>
                    <Button type="button" onClick={() => { setTxCode(null); setAgentQrAmount(''); }}
                      variant="outline" className="w-full h-11 rounded-xl border-gray-200 text-gray-500 text-sm font-bold">
                      Annuler / Régénérer
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* ── Mode Code Agent ── */}
            {withdrawMode === 'agent-code' && (
              <div className="space-y-4">
                <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 flex items-start gap-3">
                  <MapPin className="h-8 w-8 text-teal-600 shrink-0" />
                  <div>
                    <p className="font-black text-teal-800 text-sm">Retrait via Code Agent</p>
                    <p className="text-[11px] text-teal-600 mt-1 leading-relaxed">Entrez le code de votre agent. Il confirmera la demande et vous remettra le cash.</p>
                  </div>
                </div>

                {/* Agent code search */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Code Agent</Label>
                  <div className="flex gap-2">
                    <Input
                      value={wdAgentCodeInput}
                      onChange={e => { setWdAgentCodeInput(e.target.value); setWdAgentInfo(null); }}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleWdAgentLookup())}
                      placeholder="Ex: SPM001 ou 12345678"
                      className="h-11 rounded-xl font-mono flex-1"
                      maxLength={12}
                    />
                    <Button type="button" onClick={handleWdAgentLookup}
                      disabled={wdAgentSearchLoading || !wdAgentCodeInput.trim()}
                      className="h-11 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 border-0 text-white shrink-0">
                      {wdAgentSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {wdAgentInfo && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl border p-3.5 flex items-center gap-3 ${wdAgentInfo.available ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'}`}>
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0 ${wdAgentInfo.available ? 'bg-teal-500' : 'bg-red-400'}`}>
                        {wdAgentInfo.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-800">{wdAgentInfo.name}</p>
                        <p className="text-[10px] font-mono text-gray-400">#{wdAgentInfo.agentCode || wdAgentInfo.affiliateCode}</p>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${wdAgentInfo.available ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-600'}`}>
                        {wdAgentInfo.available ? '● Disponible' : '● Inactif'}
                      </span>
                    </motion.div>
                  )}
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant à retirer (HTG)</Label>
                  <Input type="number" value={wdAgentAmount} onChange={e => setWdAgentAmount(e.target.value)}
                    placeholder="Ex: 2 700" className="h-12 rounded-xl text-lg font-black"
                    min="1" max={Math.floor(balance * rate)} step="1" />
                  {wdAgentHTGNum > 0 && (
                    <div className="rounded-2xl border border-teal-100 overflow-hidden">
                      <div className="flex justify-between items-center px-3.5 py-2.5 bg-white border-b border-teal-50">
                        <span className="text-[11px] text-gray-500 font-medium">Montant demandé</span>
                        <span className="text-sm font-black text-gray-800">
                          {wdAgentHTGNum.toLocaleString()} HTG
                          <span className="text-[10px] font-medium text-gray-400 ml-1">≈ ${wdAgentAmountNum.toFixed(2)}</span>
                        </span>
                      </div>
                      {withdrawalFeePercent > 0 && (
                        <div className="flex justify-between items-center px-3.5 py-2.5 bg-white border-b border-teal-50">
                          <span className="text-[11px] text-red-500 font-medium">Frais ({withdrawalFeePercent}%)</span>
                          <span className="text-sm font-black text-red-500">−{wdAgentCodeFeeHTG.toLocaleString()} HTG</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center px-3.5 py-2.5 bg-teal-50">
                        <span className="text-[11px] font-black text-teal-800 uppercase tracking-wide">Vous recevrez</span>
                        <span className="text-base font-black text-teal-700">
                          {wdAgentCodeNetHTG.toLocaleString()} HTG
                          <span className="text-[10px] font-medium text-gray-400 ml-1">≈ ${wdAgentCodeNet.toFixed(2)}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Message */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Message (optionnel)</Label>
                  <textarea value={wdAgentMsg} onChange={e => setWdAgentMsg(e.target.value)}
                    placeholder="Notes pour l'agent..."
                    className="w-full min-h-[60px] px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-300 transition-all"
                    maxLength={200} />
                  <p className="text-[10px] text-gray-400">{wdAgentMsg.length}/200</p>
                </div>

                <Button type="submit"
                  disabled={wdAgentLoading || !wdAgentInfo || !wdAgentInfo.available || !wdAgentAmount}
                  className="w-full h-12 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black border-0">
                  {wdAgentLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Soumettre la demande →'}
                </Button>
              </div>
            )}

            {withdrawMode === 'standard' && (<>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Méthode de retrait</Label>
              {withdrawalMethods.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <Info className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700">Aucune méthode de retrait activée.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {withdrawalMethods.map(m => {
                    const logoUrl = m.id === 'moncash' ? (settings as any)?.moncashLogoUrl
                      : m.id === 'natcash' ? (settings as any)?.natcashLogoUrl
                      : null;
                    return (
                      <button key={m.id} type="button" onClick={() => setWithdrawMethod(m)}
                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 transition-all text-center ${
                          withdrawMethod?.id === m.id
                            ? 'border-red-400 bg-red-50 ring-2 ring-red-200'
                            : 'border-gray-100 bg-white hover:border-gray-200'
                        }`}>
                        {logoUrl ? (
                          <div className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50">
                            <img src={logoUrl} alt={m.name} className="h-7 w-7 object-contain" referrerPolicy="no-referrer" />
                          </div>
                        ) : (
                          <span className="text-lg">{m.icon}</span>
                        )}
                        <span className="text-[10px] font-black text-gray-700 leading-tight">{m.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant à retirer (HTG)</Label>
              <Input type="number" value={withdrawUSD} onChange={e => setWithdrawUSD(e.target.value)}
                placeholder="Ex: 1 350" className="h-12 rounded-xl text-lg font-black"
                min="1" max={Math.floor(balance * rate)} step="1" required />
              {withdrawHTGNum > 0 && (
                <div className="rounded-2xl border border-red-100 overflow-hidden">
                  <div className="flex justify-between items-center px-3.5 py-2.5 bg-white border-b border-red-50">
                    <span className="text-[11px] text-gray-500 font-medium">Montant demandé</span>
                    <span className="text-sm font-black text-gray-800">
                      {withdrawHTGNum.toLocaleString()} HTG
                      <span className="text-[10px] font-medium text-gray-400 ml-1">≈ ${withdrawUSDNum.toFixed(2)}</span>
                    </span>
                  </div>
                  {withdrawalFeePercent > 0 && (
                    <div className="flex justify-between items-center px-3.5 py-2.5 bg-white border-b border-red-50">
                      <span className="text-[11px] text-red-500 font-medium">Frais ({withdrawalFeePercent}%)</span>
                      <span className="text-sm font-black text-red-500">−{withdrawFeeHTG.toLocaleString()} HTG</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center px-3.5 py-2.5 bg-red-50">
                    <span className="text-[11px] font-black text-red-800 uppercase tracking-wide">Vous recevrez</span>
                    <span className="text-base font-black text-red-700">
                      {withdrawNetHTG.toLocaleString()} HTG
                      <span className="text-[10px] font-medium text-gray-400 ml-1">≈ ${withdrawNetAmount.toFixed(2)}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {withdrawMethod?.type === 'crypto' ? 'Adresse crypto' : 'Numéro / Compte de réception'}
              </Label>
              <Input value={withdrawAccount} onChange={e => setWithdrawAccount(e.target.value)}
                placeholder={withdrawMethod?.type === 'crypto' ? '0x...' : 'Numéro de réception'}
                className="h-11 rounded-xl" required />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nom du bénéficiaire</Label>
              <Input value={withdrawAccountName} onChange={e => setWithdrawAccountName(e.target.value)}
                placeholder="Nom complet" className="h-11 rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Message (optionnel)</Label>
              <textarea value={withdrawMessage} onChange={e => setWithdrawMessage(e.target.value)}
                placeholder="Informations supplémentaires..."
                className="w-full min-h-[60px] px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300 transition-all"
                maxLength={300} />
              <p className="text-[10px] text-gray-400">{withdrawMessage.length}/300</p>
            </div>

            {RECAPTCHA_SITE_KEY && (
              <div className="flex flex-col items-center">
                <CaptchaWidget sitekey={RECAPTCHA_SITE_KEY} captchaRef={withdrawCaptchaRef}
                  onChange={t => setWithdrawCaptchaToken(t)} onExpired={() => setWithdrawCaptchaToken(null)} />
              </div>
            )}

            <Button type="submit"
              disabled={actionLoading || !withdrawMethod || (!!RECAPTCHA_SITE_KEY && !withdrawCaptchaToken)}
              className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black">
              {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Soumettre la demande'}
            </Button>
            </>)}
          </form>
        </DialogContent>
      </Dialog>


      {/* ── TRANSFER MODAL ────────────────────────────────────────────────────── */}
      <Dialog open={isTransferOpen} onOpenChange={v => { if (!v) resetTransfer(); setIsTransferOpen(v); }}>
        <DialogContent className="max-w-sm rounded-[2rem] border-0 shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-br from-violet-600 to-purple-700 p-5 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-white">Transfert Wallet</DialogTitle>
                <DialogDescription className="text-violet-200/70 text-xs">
                  Solde disponible: <strong>${balance.toFixed(2)} USD</strong>
                </DialogDescription>
              </div>
            </div>
          </div>

          <form onSubmit={handleTransfer} className="p-5 space-y-4 bg-white overflow-y-auto flex-1">

            {/* Recipient Wallet ID */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                ID Wallet du destinataire
              </Label>
              <div className="relative">
                <Input
                  value={transferWalletId}
                  onChange={e => handleWalletIdChange(e.target.value)}
                  placeholder="Ex: NP-XXXX-XXXX"
                  className="h-12 rounded-xl font-mono pr-10"
                  required
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {lookupLoading
                    ? <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
                    : transferPreview
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <User className="h-4 w-4 text-gray-300" />}
                </div>
              </div>
              {/* Recipient preview */}
              <AnimatePresence>
                {transferPreview && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-100"
                  >
                    <div className="h-7 w-7 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700 font-black text-xs shrink-0">
                      {transferPreview.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-black text-emerald-800">{transferPreview}</p>
                      <p className="text-[10px] text-emerald-500">Destinataire trouvé ✓</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant à envoyer (USD)</Label>
              <Input type="number" value={transferUSD} onChange={e => setTransferUSD(e.target.value)}
                placeholder="Ex: 5.00" className="h-12 rounded-xl text-lg font-black"
                min="0.01" max={balance} step="0.01" required />
              {transferHtgPreview > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-violet-50 border border-violet-100">
                  <TrendingUp className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                  <p className="text-xs font-black text-violet-700">
                    ≈ <span className="text-base">{Math.round(transferHtgPreview).toLocaleString()} HTG</span>
                  </p>
                </div>
              )}
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Note (optionnel)</Label>
              <textarea value={transferMessage} onChange={e => setTransferMessage(e.target.value)}
                placeholder="Ex: Remboursement, cadeau..."
                className="w-full min-h-[60px] px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 transition-all"
                maxLength={200} />
              <p className="text-[10px] text-gray-400">{transferMessage.length}/200</p>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Les transferts entre wallets sont <strong>instantanés et irréversibles</strong>. Vérifiez bien l'ID du destinataire.
              </p>
            </div>

            <Button type="submit"
              disabled={actionLoading || !transferWalletId.trim() || !transferUSD}
              className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black">
              {actionLoading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <><Send className="h-4 w-4 mr-2" />Envoyer maintenant</>}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Agent Withdrawal Confirmation Popup ── */}
      {withdrawSuccessInfo && (
        <Dialog open={true} onOpenChange={() => setWithdrawSuccessInfo(null)}>
          <DialogContent className="max-w-sm rounded-3xl border-0 p-0 overflow-hidden shadow-2xl">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="overflow-hidden rounded-3xl"
            >
              {/* Header */}
              <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-7 text-center relative">
                <button onClick={() => setWithdrawSuccessInfo(null)} className="absolute top-4 right-4 rounded-full bg-white/20 p-1.5 hover:bg-white/30 transition-colors">
                  <X className="h-4 w-4 text-white" />
                </button>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.12, type: 'spring', stiffness: 400, damping: 18 }}>
                  <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <CheckCircle2 className="h-10 w-10 text-white" />
                  </div>
                </motion.div>
                <h2 className="text-xl font-black text-white">Demande envoyée !</h2>
                <p className="text-4xl font-black text-white mt-2 tracking-tight">
                  {withdrawSuccessInfo.amountHTG} <span className="text-xl opacity-60">HTG</span>
                </p>
                <p className="text-white/70 text-sm font-semibold mt-1">Retrait via Agent</p>
              </div>

              {/* Body */}
              <div className="bg-white p-6 space-y-4">
                <p className="text-center text-gray-500 text-sm leading-relaxed">
                  Votre demande de retrait a été transmise à l'agent ci-dessous. Il vous contactera pour finaliser la transaction.
                </p>

                {/* Agent card */}
                <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-teal-500 flex items-center justify-center text-white font-black text-lg shrink-0 shadow-md shadow-teal-200">
                    {withdrawSuccessInfo.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-900 text-base">{withdrawSuccessInfo.name}</p>
                    {withdrawSuccessInfo.code && (
                      <p className="text-xs font-mono text-gray-400 mt-0.5">Code : #{withdrawSuccessInfo.code}</p>
                    )}
                    {withdrawSuccessInfo.phone && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Phone className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                        <span className="text-sm font-black text-teal-700">{withdrawSuccessInfo.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-teal-100 text-teal-700">● Disponible</span>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
                  <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 font-semibold leading-relaxed">
                    L'agent confirmera et vous remettra les fonds en personne. Votre solde sera débité à la confirmation.
                  </p>
                </div>

                <Button
                  onClick={() => setWithdrawSuccessInfo(null)}
                  className="w-full h-12 rounded-2xl font-black border-0 text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 shadow-lg shadow-teal-100"
                >
                  Compris, merci !
                </Button>
              </div>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Success Modal — shown when a deposit/withdrawal is approved ── */}
      {txSuccessModal && (
        <Dialog open={true} onOpenChange={() => setTxSuccessModal(null)}>
          <DialogContent className="max-w-sm rounded-3xl border-0 p-0 overflow-hidden shadow-2xl">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="overflow-hidden rounded-3xl"
            >
              <div className={`p-8 text-center ${txSuccessModal.type === 'deposit' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-violet-500 to-purple-700'}`}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.12, type: 'spring', stiffness: 400, damping: 18 }}>
                  <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-10 w-10 text-white" />
                  </div>
                </motion.div>
                <h2 className="text-2xl font-black text-white">Transaction réussie !</h2>
                <p className="text-5xl font-black text-white mt-3 tracking-tight">
                  {Math.round(txSuccessModal.htg).toLocaleString()} <span className="text-2xl opacity-60">HTG</span>
                </p>
                <p className="text-white/55 text-sm font-bold mt-1.5">≈ ${Number(txSuccessModal.usd).toFixed(2)} USD</p>
              </div>
              <div className="bg-white p-6 text-center space-y-4">
                <p className="text-gray-600 text-sm leading-relaxed">
                  {txSuccessModal.type === 'deposit'
                    ? `Votre dépôt${txSuccessModal.agentName ? ` via l'agent ${txSuccessModal.agentName}` : ''} a été crédité sur votre compte.`
                    : `Votre retrait${txSuccessModal.agentName ? ` chez l'agent ${txSuccessModal.agentName}` : ''} a été traité avec succès.`}
                  {' '}Merci de faire confiance à Solutionpam ! 🙏
                </p>
                <Button
                  onClick={() => setTxSuccessModal(null)}
                  className={`w-full h-12 rounded-2xl font-black border-0 text-white ${txSuccessModal.type === 'deposit' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-violet-500 hover:bg-violet-600'}`}
                >
                  Fermer
                </Button>
              </div>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
