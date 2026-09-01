import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import ContestPodium from '../components/ContestPodium';
import { Html5Qrcode } from 'html5-qrcode';
import {
  useAgentDataByUid,
  useAgentWithdrawals,
  approveAgentDeposit,
  rejectAgentDeposit,
} from '../services/agentService';
import { useWalletTransactions } from '../services/affiliateService';
import { useRealtimeNotifs } from '../hooks/useRealtimeNotifs';
import { useUniversalFCM } from '../hooks/useUniversalFCM';
import NotificationBell from '../components/NotificationBell';
import PhotoUrlEditor from '../components/PhotoUrlEditor';
import { Agent, WalletTransaction } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Wallet, CheckCircle2, XCircle, Loader2, History, LogOut,
  Clock, User, ArrowRightLeft, Search, ArrowDownLeft, ArrowUpRight,
  Phone, RefreshCw, TrendingUp, BarChart3, Users, Settings,
  Home, AlertCircle, BadgeDollarSign, ChevronRight, Star,
  ArrowDownToLine, ArrowUpFromLine, StickyNote, ShieldCheck, PlusCircle, AlertTriangle, X,
  QrCode, Scan, LayoutGrid, ListOrdered, Banknote, MinusCircle, Check, Gamepad2, Trophy,
} from 'lucide-react';
import FreeFireResellerSection from '../components/agent/FreeFireResellerSection';
import PinSetupModal from '../components/PinSetupModal';
import PinEntryModal from '../components/PinEntryModal';
import { usePinGuard } from '../hooks/usePinGuard';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/apiFetch';
import { useSettingsCtx } from '../contexts/SettingsContext';
import ErnstChat from '../components/ErnstChat';
import { AgentDashboardSkeleton } from '../components/skeletons/AgentDashboardSkeleton';
import { TransactionListSkeleton } from '../components/skeletons/TransactionListSkeleton';
import { AdminContentSkeleton } from '../components/skeletons/AdminContentSkeleton';

interface AgentDashboardProps {
  agentUid: string;
  onLogout: () => void;
}

interface FoundClient {
  clientId: string;
  name: string;
  phone: string;
  walletId: string;
  balance: number;
}

interface AgentStats {
  totalDeposits: number;
  totalWithdrawals: number;
  totalCommissions: number;
  depositCount: number;
  withdrawalCount: number;
  totalTransactions: number;
}

interface ClientWithdrawRequest {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  usdAmount?: number;
  message?: string;
  agentCode: string;
  agentName?: string;
  createdAt: any;
  status: string;
}

interface FeeRecord {
  id: string;
  clientName: string;
  operationType: string;
  baseAmount: number;
  agentShare: number;
  createdAt: any;
}

interface AgentTransaction {
  id: string;
  clientId?: string;
  clientName: string;
  type: string;
  amount: number;
  status: string;
  method: string;
  description?: string;
  source?: string;
  createdAt: any;
}

type ActiveSection = 'overview' | 'contest' | 'requests' | 'deposit' | 'commissions' | 'clients' | 'finances' | 'settings' | 'free-fire';

const sectionNav = [
  { key: 'overview',     label: 'Accueil',      icon: Home },
  { key: 'requests',     label: 'Demandes',      icon: Clock },
  { key: 'deposit',      label: 'Dépôt',         icon: ArrowDownLeft },
  { key: 'commissions',  label: 'Commissions',   icon: BadgeDollarSign },
  { key: 'clients',      label: 'Clients',       icon: Users },
  { key: 'finances',     label: 'Mes Finances',  icon: Wallet },
  { key: 'settings',     label: 'Paramètres',    icon: Settings },
] as const;

function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts?.toDate) return ts.toDate();
  if (ts?._seconds) return new Date(ts._seconds * 1000);
  return null;
}
function fmtDate(ts: any, fmt = 'dd MMM yyyy HH:mm') {
  const d = toDate(ts);
  return d ? format(d, fmt, { locale: fr }) : '—';
}

export default function AgentDashboard({ agentUid, onLogout }: AgentDashboardProps) {
  const { agent, loading: agentLoading } = useAgentDataByUid(agentUid);
  const { transactions: agentHistory, loading: historyLoading } = useAgentWithdrawals(agent?.id || null);
  const { settings } = useSettingsCtx();
  const { notifications: notifs, unreadCount: notifCount, loading: notifsLoading, markRead, markAllRead, clearAll } = useRealtimeNotifs('agent', agent?.id || null);
  useUniversalFCM('agent', agent?.id || null);

  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [isProcessing, setIsProcessing] = useState(false);

  // PIN security
  const { pinModalOpen, pinModalTitle, pinModalDesc, requirePin, handlePinConfirm, handlePinCancel } = usePinGuard();
  const [pinSetupOpen, setPinSetupOpen] = useState(false);

  // Direct tx state (deposit/withdraw by phone, name or wallet ID)
  const [clientSearch, setClientSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FoundClient[]>([]);
  const [foundClient, setFoundClient] = useState<FoundClient | null>(null);
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Success modal (shown after completing a direct transaction or confirming withdrawal)
  const [agentSuccessModal, setAgentSuccessModal] = useState<{
    type: 'deposit' | 'withdrawal';
    clientName: string;
    htg: number;
    usd: number;
  } | null>(null);

  // Client withdrawal requests
  const [withdrawRequests, setWithdrawRequests] = useState<ClientWithdrawRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Full transaction history
  const [allTransactions, setAllTransactions] = useState<AgentTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Commission records
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);

  // Stats
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Reject reason state
  const [rejectReasonMap, setRejectReasonMap] = useState<Record<string, string>>({});

  // Barcode / QR scanner
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'rena-qr-scanner-container';

  // Scanned QR tx-code pending confirmation
  const [scannedTxCode, setScannedTxCode] = useState<{ id: string; tk: string; ty: 'deposit' | 'withdrawal'; a: number; cn: string } | null>(null);
  const [processingTx, setProcessingTx] = useState(false);

  // Self-deposit (agent recharges own balance)
  const [isSelfDepositOpen, setIsSelfDepositOpen] = useState(false);
  const [selfDepositAmount, setSelfDepositAmount] = useState('');
  const [selfDepositMethod, setSelfDepositMethod] = useState('MonCash');
  const [selfDepositSubmitting, setSelfDepositSubmitting] = useState(false);

  // Personal finances (agent deposits into own wallet / withdraws commissions)
  const [personalTxs, setPersonalTxs] = useState<any[]>([]);
  const [loadingPersonalTxs, setLoadingPersonalTxs] = useState(false);
  const [personalDepositOpen, setPersonalDepositOpen] = useState(false);
  const [personalWithdrawalOpen, setPersonalWithdrawalOpen] = useState(false);
  const [pAmount, setPAmount] = useState('');
  const [pMethod, setPMethod] = useState('MonCash');
  const [pAccount, setPAccount] = useState('');
  const [pAccountName, setPAccountName] = useState('');
  const [pMessage, setPMessage] = useState('');
  const [pSubmitting, setPSubmitting] = useState(false);

  // Payment method for client transactions
  const [txPaymentMethod, setTxPaymentMethod] = useState('MonCash');

  // Client deposit requests (client submits via agent code, agent confirms)
  const [clientDepositReqs, setClientDepositReqs] = useState<any[]>([]);
  const [clientDepReqLoading, setClientDepReqLoading] = useState(false);
  const [clientDepReqActionLoading, setClientDepReqActionLoading] = useState<string | null>(null);

  const rate = settings?.exchangeRate || 146;
  const pendingAffiliateRequests = agentHistory.filter(t => t.status === 'pending_agent');

  const totalPendingCount = pendingAffiliateRequests.length + withdrawRequests.length + clientDepositReqs.length;

  // Load client withdrawal requests
  const loadWithdrawRequests = useCallback(async () => {
    if (!agent?.agentCode) return;
    setLoadingRequests(true);
    try {
      const res = await fetch(`/api/agent/withdrawal-requests/${encodeURIComponent(agent.agentCode)}`);
      const data = await res.json();
      if (res.ok) setWithdrawRequests(data.requests || []);
    } catch {}
    finally { setLoadingRequests(false); }
  }, [agent?.agentCode]);

  // Load full tx history
  const loadTransactions = useCallback(async () => {
    if (!agent?.agentCode) return;
    setLoadingTx(true);
    try {
      const res = await fetch(`/api/agent/transactions/${encodeURIComponent(agent.agentCode)}`);
      const data = await res.json();
      if (res.ok) setAllTransactions(data.transactions || []);
    } catch {}
    finally { setLoadingTx(false); }
  }, [agent?.agentCode]);

  // Load fee records
  const loadFeeRecords = useCallback(async () => {
    if (!agent?.id) return;
    setLoadingFees(true);
    try {
      const res = await fetch(`/api/agent/fee-records/${encodeURIComponent(agent.id)}`);
      const data = await res.json();
      if (res.ok) setFeeRecords(data.records || []);
    } catch {}
    finally { setLoadingFees(false); }
  }, [agent?.id]);

  // Load stats
  const loadStats = useCallback(async () => {
    if (!agent?.agentCode) return;
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/agent/stats/${encodeURIComponent(agent.agentCode)}`);
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch {}
    finally { setLoadingStats(false); }
  }, [agent?.agentCode]);

  // Load personal transactions
  const loadPersonalTxs = useCallback(async () => {
    if (!agent?.id) return;
    setLoadingPersonalTxs(true);
    try {
      const res = await fetch(`/api/agent/personal-transactions/${encodeURIComponent(agent.id)}`);
      const data = await res.json();
      if (res.ok) setPersonalTxs(data.transactions || []);
    } catch {}
    finally { setLoadingPersonalTxs(false); }
  }, [agent?.id]);

  // Load client deposit requests
  const loadClientDepositReqs = useCallback(async () => {
    if (!agent?.id) return;
    setClientDepReqLoading(true);
    try {
      const res = await fetch(`/api/agent/client-deposit-requests/${encodeURIComponent(agent.id)}`);
      const data = await res.json();
      if (res.ok) setClientDepositReqs(data.requests || []);
    } catch {}
    finally { setClientDepReqLoading(false); }
  }, [agent?.id]);

  useEffect(() => {
    if (!agent) return;
    loadWithdrawRequests();
    loadClientDepositReqs();
    loadStats();
  }, [agent?.agentCode, agent?.id]);

  // Check if agent has a PIN set; show setup modal on first login
  useEffect(() => {
    if (!agent?.agentCode) return;
    fetch(`/api/agent/has-pin/${encodeURIComponent(agent.agentCode)}`)
      .then(r => r.json())
      .then(d => { if (!d.hasPin) setPinSetupOpen(true); })
      .catch(() => {});
  }, [agent?.agentCode]);

  useEffect(() => {
    if (activeSection === 'commissions') loadFeeRecords();
    if (activeSection === 'clients' || activeSection === 'overview') loadTransactions();
    if (activeSection === 'requests') { loadWithdrawRequests(); loadClientDepositReqs(); }
    if (activeSection === 'finances') loadPersonalTxs();
  }, [activeSection, agent?.agentCode, agent?.id]);

  // Approve affiliate deposit
  const handleApproveAffiliate = async (tx: WalletTransaction) => {
    if (!agent) return;
    if (agent.balance < tx.amount) { toast.error('Solde insuffisant pour valider ce dépôt.'); return; }
    let pin: string;
    try { pin = await requirePin('Valider le dépôt affilié', `Saisissez votre PIN pour valider le dépôt de $${tx.amount}.`); }
    catch { return; }
    setIsProcessing(true);
    try {
      await approveAgentDeposit(tx);
      toast.success('Dépôt affilié validé !');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la validation.');
    } finally { setIsProcessing(false); }
  };

  const handleRejectAffiliate = async (txId: string) => {
    let pin: string;
    try { pin = await requirePin('Rejeter le dépôt affilié', 'Saisissez votre PIN pour rejeter ce dépôt.'); }
    catch { return; }
    setIsProcessing(true);
    try {
      await rejectAgentDeposit(txId);
      toast.success('Dépôt affilié rejeté.');
    } catch { toast.error('Erreur lors du rejet.'); }
    finally { setIsProcessing(false); }
  };

  // Client deposit requests: approve / reject
  const handleApproveClientDeposit = async (req: any) => {
    let pin: string;
    try { pin = await requirePin('Approuver le dépôt', `Saisissez votre PIN pour approuver le dépôt de ${req.clientName}.`); }
    catch { return; }
    setClientDepReqActionLoading(req.id);
    try {
      const res = await apiFetch(`/api/agent/client-deposit/${req.id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
      toast.success(`Dépôt de ${req.clientName} approuvé !`);
      setClientDepositReqs(prev => prev.filter(r => r.id !== req.id));
    } catch (e: any) { toast.error(e.message || 'Solde agent insuffisant ou erreur.'); }
    finally { setClientDepReqActionLoading(null); }
  };

  const handleRejectClientDeposit = async (req: any) => {
    let pin: string;
    try { pin = await requirePin('Refuser le dépôt', `Saisissez votre PIN pour refuser la demande de ${req.clientName}.`); }
    catch { return; }
    setClientDepReqActionLoading(req.id);
    try {
      await apiFetch(`/api/agent/client-deposit/${req.id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
      toast.success('Demande refusée.');
      setClientDepositReqs(prev => prev.filter(r => r.id !== req.id));
    } catch (e: any) { toast.error(e.message || 'Erreur.'); }
    finally { setClientDepReqActionLoading(null); }
  };

  // Confirm client withdrawal request
  const handleConfirmWithdraw = async (req: ClientWithdrawRequest) => {
    if (!agent?.agentCode) return;
    let pin: string;
    try { pin = await requirePin('Confirmer le retrait client', `Saisissez votre PIN pour confirmer le retrait de ${req.clientName}.`); }
    catch { return; }
    setIsProcessing(true);
    try {
      await apiFetch(`/api/agent/withdrawal-request/${req.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentCode: agent.agentCode }),
      });
      const htg = Math.round(req.amount * rate);
      setAgentSuccessModal({ type: 'withdrawal', clientName: req.clientName, htg, usd: req.amount });
      await loadWithdrawRequests();
      await loadStats();
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setIsProcessing(false); }
  };

  // Reject client withdrawal request
  const handleRejectWithdraw = async (req: ClientWithdrawRequest) => {
    if (!agent?.agentCode) return;
    let pin: string;
    try { pin = await requirePin('Refuser le retrait client', `Saisissez votre PIN pour refuser la demande de ${req.clientName}.`); }
    catch { return; }
    const reason = rejectReasonMap[req.id] || '';
    setIsProcessing(true);
    try {
      await apiFetch(`/api/agent/withdrawal-request/${req.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentCode: agent.agentCode, ...(reason && { reason }) }),
      });
      toast.success('Demande refusée.');
      await loadWithdrawRequests();
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setIsProcessing(false); }
  };

  // Personal deposit (agent rechts own balance via payment to admin)
  const handlePersonalDeposit = async () => {
    const usd = parseFloat(pAmount);
    if (isNaN(usd) || usd <= 0) { toast.error('Montant invalide.'); return; }
    if (!agent?.agentCode) return;
    let pinPD: string;
    try { pinPD = await requirePin('Dépôt personnel', 'Saisissez votre PIN pour soumettre cette demande de dépôt.'); }
    catch { return; }
    setPSubmitting(true);
    try {
      const res = await fetch('/api/agent/personal-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentCode: agent.agentCode, amount: usd, method: pMethod, accountNumber: pAccount || undefined, accountName: pAccountName || undefined, message: pMessage || undefined, pin: pinPD }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur.'); return; }
      toast.success('Demande de dépôt envoyée ! L\'admin validera sous peu.');
      setPersonalDepositOpen(false);
      setPAmount(''); setPMethod('MonCash'); setPAccount(''); setPAccountName(''); setPMessage('');
      loadPersonalTxs();
    } catch { toast.error('Erreur réseau.'); }
    finally { setPSubmitting(false); }
  };

  // Personal withdrawal (agent withdraws from commission balance)
  const handlePersonalWithdrawal = async () => {
    const usd = parseFloat(pAmount);
    if (isNaN(usd) || usd <= 0) { toast.error('Montant invalide.'); return; }
    if (!pAccount.trim()) { toast.error('Numéro de compte requis.'); return; }
    if (!agent?.agentCode) return;
    const available = agent.commissionBalance || 0;
    if (usd > available) { toast.error(`Solde commissions insuffisant. Disponible: $${available.toFixed(2)}`); return; }
    let pinPW: string;
    try { pinPW = await requirePin('Retrait commissions', 'Saisissez votre PIN pour confirmer ce retrait.'); }
    catch { return; }
    setPSubmitting(true);
    try {
      const res = await fetch('/api/agent/personal-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentCode: agent.agentCode, amount: usd, method: pMethod, accountNumber: pAccount, accountName: pAccountName || undefined, message: pMessage || undefined, pin: pinPW }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur.'); return; }
      toast.success('Demande de retrait envoyée ! L\'admin traitera votre retrait.');
      setPersonalWithdrawalOpen(false);
      setPAmount(''); setPMethod('MonCash'); setPAccount(''); setPAccountName(''); setPMessage('');
      loadPersonalTxs();
    } catch { toast.error('Erreur réseau.'); }
    finally { setPSubmitting(false); }
  };

  // Search client by phone, name or wallet ID
  const handleSearchClient = async () => {
    const q = clientSearch.trim();
    if (!q) { toast.error('Entrez un téléphone, un nom ou un ID Wallet.'); return; }
    if (!agent?.agentCode) return;
    setSearching(true);
    setFoundClient(null);
    setSearchResults([]);
    try {
      const data = await apiFetch(`/api/agent/client-search?q=${encodeURIComponent(q)}&agentCode=${encodeURIComponent(agent.agentCode)}`);
      if (data.results?.length > 1) {
        setSearchResults(data.results);
      } else {
        setFoundClient(data.client || data.results?.[0] || null);
      }
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setSearching(false); }
  };

  // Agent self-deposit request (recharge own balance)
  const handleAgentSelfDeposit = async () => {
    const usd = parseFloat(selfDepositAmount);
    if (isNaN(usd) || usd <= 0) { toast.error('Montant invalide.'); return; }
    if (!agent?.agentCode) return;
    let pin: string;
    try { pin = await requirePin('Recharge de solde', `Saisissez votre PIN pour soumettre une recharge de $${usd.toFixed(2)}.`); }
    catch { return; }
    setSelfDepositSubmitting(true);
    try {
      await apiFetch('/api/agent/personal-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentCode: agent.agentCode, amount: usd, method: selfDepositMethod }),
      });
      const adminPhone = settings?.whatsappAdminNumber || '+50944813185';
      const msg = `Bonjour Admin, je souhaite recharger mon solde agent.\n\n💰 Montant: $${usd.toFixed(2)}\n💳 Méthode: ${selfDepositMethod}\n🔑 Code Agent: ${agent.agentCode}\n👤 Nom: ${agent.name}`;
      window.open(`https://wa.me/${adminPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
      toast.success('Demande enregistrée ! Continuez sur WhatsApp.');
      setIsSelfDepositOpen(false);
      setSelfDepositAmount('');
      setSelfDepositMethod('MonCash');
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setSelfDepositSubmitting(false); }
  };

  // Confirm a scanned QR tx-code transaction
  const handleConfirmScanTx = async () => {
    if (!scannedTxCode || !agent?.agentCode) return;
    setProcessingTx(true);
    try {
      const data = await apiFetch('/api/agent/scan-tx-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentCode: agent.agentCode, codeData: JSON.stringify(scannedTxCode) }),
      });
      const isWd = scannedTxCode.ty === 'withdrawal';
      const wdPct = isWd ? (settings?.agentWithdrawPercent ?? 0) : 0;
      const netUsd = isWd ? scannedTxCode.a * (1 - wdPct / 100) : scannedTxCode.a;
      const htg = Math.round(netUsd * rate);
      setAgentSuccessModal({ type: scannedTxCode.ty, clientName: scannedTxCode.cn, htg, usd: netUsd });
      setScannedTxCode(null);
      await loadStats();
    } catch (e: any) { toast.error(e.message || 'Erreur lors du traitement du code QR.'); }
    finally { setProcessingTx(false); }
  };

  // Submit direct deposit (instant, no confirmation needed)
  const handleSubmitDeposit = async () => {
    if (!foundClient || !agent?.agentCode) return;
    const htg = parseFloat(txAmount);
    if (isNaN(htg) || htg <= 0) { toast.error('Montant invalide.'); return; }
    const usd = htg / rate;
    if (agent.balance < usd) { toast.error('Solde agent insuffisant pour ce dépôt.'); return; }
    let pinCT: string;
    try { pinCT = await requirePin('Confirmer la transaction', `Saisissez votre PIN pour effectuer cette transaction pour ${foundClient.name}.`); }
    catch { return; }
    setSubmitting(true);
    try {
      await apiFetch('/api/agent/client-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentCode: agent.agentCode, clientId: foundClient.clientId, type: 'deposit', amount: usd, note: txNote.trim() || undefined, paymentMethod: txPaymentMethod, pin: pinCT }),
      });
      setAgentSuccessModal({ type: 'deposit', clientName: foundClient.name, htg, usd });
      setFoundClient(null); setClientSearch(''); setSearchResults([]); setTxAmount(''); setTxNote(''); setTxPaymentMethod('MonCash');
      await loadStats();
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setSubmitting(false); }
  };

  // Unique clients from tx history
  const uniqueClients = React.useMemo(() => {
    const map = new Map<string, { clientId: string; clientName: string; lastTx: any; txCount: number }>();
    allTransactions.forEach(tx => {
      if (!tx.clientId) return;
      const existing = map.get(tx.clientId);
      if (!existing) {
        map.set(tx.clientId, { clientId: tx.clientId, clientName: tx.clientName, lastTx: tx.createdAt, txCount: 1 });
      } else {
        existing.txCount++;
      }
    });
    return Array.from(map.values());
  }, [allTransactions]);

  if (agentLoading) {
    return <AgentDashboardSkeleton />;
  }

  if (!agent) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-4 px-4">
        <XCircle className="h-16 w-16 text-red-500 mx-auto" />
        <h2 className="text-2xl font-black">Accès Refusé</h2>
        <p className="text-gray-500">Vous n'êtes pas enregistré en tant qu'agent Solutionpam.</p>
        <Button onClick={onLogout} variant="outline" className="rounded-2xl h-12 w-full">Retour au Login</Button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col bg-[#F8FAFC] animate-in fade-in duration-500">

      {/* ── Header ── */}
      <header className="shrink-0 pt-14 px-6 pb-20 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0A3D91 0%, #06214D 100%)' }}>
        {/* Decorative blur circles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-green-500/10 rounded-full -ml-12 -mb-12 blur-2xl" />

        {/* Top row */}
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shrink-0">
              <span className="text-[#0A3D91] font-black text-xl">{(agent.name || 'A').charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-white font-bold text-lg">{agent.name}</h1>
                <ShieldCheck className="h-4 w-4 text-blue-400" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                <span className="text-white/60 text-xs font-medium uppercase tracking-wider">Agent Vérifié • En Ligne</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 relative z-10">
            <NotificationBell
              notifications={notifs}
              unreadCount={notifCount}
              loading={notifsLoading}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
              onClearAll={clearAll}
            />
          </div>
        </div>

        {/* Floating Balance Card */}
        <div className="absolute left-6 right-6 bottom-[-60px] z-20">
          <div className="bg-white rounded-3xl p-6 shadow-2xl shadow-blue-900/10 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mb-1">Solde Principal Agent</p>
                <h2 className="text-[#0A3D91] text-3xl font-black">
                  {((agent.balance || 0) * rate).toLocaleString()} <span className="text-lg font-bold opacity-50">HTG</span>
                </h2>
                {agent.walletLocked && (
                  <span className="text-[10px] font-black text-red-500 mt-0.5 block">🔒 Verrouillé</span>
                )}
              </div>
              <div className="p-2 bg-blue-50 rounded-xl">
                <Wallet className="h-5 w-5 text-[#0A3D91]" />
              </div>
            </div>
            <div className="h-px bg-slate-100 w-full" />
            <button
              onClick={() => setActiveSection('finances')}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-[#00C853]">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold leading-none">Commissions totales</p>
                  <p className="text-slate-900 font-bold text-sm">${(agent.commissionBalance || 0).toFixed(2)}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto px-6 pt-[80px] pb-36 space-y-8" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>

      <AnimatePresence mode="wait">

        {/* ── OVERVIEW ── */}
        {activeSection === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">

            {/* Contest Podium */}
            <div className="-mx-6">
              <ContestPodium participantId={agentUid} participantType="agent" />
            </div>

            {/* Actions Rapides */}
            <section>
              <h3 className="text-slate-900 font-bold text-lg mb-4">Actions Rapides</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Scanner */}
                <button
                  onClick={() => setActiveSection('deposit')}
                  className="bg-slate-900 rounded-3xl p-5 flex flex-col gap-3 active:scale-95 transition-transform text-left"
                >
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
                    <QrCode className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-white font-bold">Scanner</p>
                    <p className="text-white/40 text-xs">Client / Code</p>
                  </div>
                </button>
                {/* Dépôt */}
                <button
                  onClick={() => setActiveSection('deposit')}
                  className="bg-white border border-slate-100 rounded-3xl p-5 flex flex-col gap-3 active:scale-95 transition-transform shadow-sm text-left"
                >
                  <div className="w-12 h-12 bg-[#00C853]/10 rounded-2xl flex items-center justify-center text-[#00C853]">
                    <PlusCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-slate-900 font-bold">Dépôt</p>
                    <p className="text-slate-400 text-xs">Vers client</p>
                  </div>
                </button>
                {/* Retrait */}
                <button
                  onClick={() => setActiveSection('requests')}
                  className="bg-white border border-slate-100 rounded-3xl p-5 flex flex-col gap-3 active:scale-95 transition-transform shadow-sm text-left"
                >
                  <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500">
                    <MinusCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-slate-900 font-bold">Retrait</p>
                    <p className="text-slate-400 text-xs">Cash-out client</p>
                  </div>
                </button>
                {/* Historique */}
                <button
                  onClick={() => { setActiveSection('clients'); loadTransactions(); }}
                  className="bg-white border border-slate-100 rounded-3xl p-5 flex flex-col gap-3 active:scale-95 transition-transform shadow-sm text-left"
                >
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
                    <History className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-slate-900 font-bold">Historique</p>
                    <p className="text-slate-400 text-xs">Détails flux</p>
                  </div>
                </button>
                {/* Free Fire Revendeur */}
                <button
                  onClick={() => setActiveSection('free-fire')}
                  className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl p-5 flex flex-col gap-3 active:scale-95 transition-transform text-left"
                >
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white">
                    <Gamepad2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-white font-bold">Free Fire</p>
                    <p className="text-white/60 text-xs">Diamants</p>
                  </div>
                </button>
                {/* Concours */}
                <button
                  onClick={() => setActiveSection('contest')}
                  className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-5 flex flex-col gap-3 active:scale-95 transition-transform text-left"
                >
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-white font-bold">Concours</p>
                    <p className="text-white/60 text-xs">Classement & prix</p>
                  </div>
                </button>
              </div>
            </section>

            {/* Pending alert */}
            {totalPendingCount > 0 && (
              <button
                onClick={() => setActiveSection('requests')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-amber-50 border-2 border-amber-200 hover:bg-amber-100 transition-all group active:scale-[0.99]"
              >
                <div className="h-10 w-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 animate-pulse">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-black text-amber-800">{totalPendingCount} demande{totalPendingCount > 1 ? 's' : ''} en attente</p>
                  <p className="text-xs text-amber-600">Cliquez pour traiter</p>
                </div>
                <ChevronRight className="h-5 w-5 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}

            {/* Résumé du Mois */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-slate-900 font-bold text-lg">Résumé du Mois</h3>
                <button onClick={() => setActiveSection('commissions')} className="text-[#0A3D91] text-xs font-bold">Voir tout</button>
              </div>
              {loadingStats ? (
                <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="min-w-[140px] bg-white border border-slate-100 rounded-2xl p-4 space-y-2 shrink-0">
                      <div className="skeleton h-4 w-4 rounded" />
                      <div className="skeleton h-2.5 w-20 rounded-full" />
                      <div className="skeleton h-6 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
                  <div className="min-w-[140px] bg-[#0A3D91] rounded-2xl p-4 text-white flex flex-col gap-1 shrink-0">
                    <ArrowRightLeft className="h-4 w-4 text-white/40 mb-1" />
                    <p className="text-white/60 text-[10px] uppercase font-bold tracking-wider">Transactions</p>
                    <p className="text-xl font-bold">{stats?.totalTransactions ?? 0}</p>
                  </div>
                  <div className="min-w-[140px] bg-white border border-slate-100 rounded-2xl p-4 flex flex-col gap-1 shrink-0">
                    <TrendingUp className="h-4 w-4 text-[#00C853] mb-1" />
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Commissions</p>
                    <p className="text-slate-900 text-xl font-bold">
                      {stats
                        ? (stats.totalCommissions * rate >= 1000
                          ? `${(stats.totalCommissions * rate / 1000).toFixed(1)}K`
                          : Math.round(stats.totalCommissions * rate).toLocaleString())
                        : '0'} <span className="text-xs text-slate-400">HTG</span>
                    </p>
                  </div>
                  <div className="min-w-[140px] bg-white border border-slate-100 rounded-2xl p-4 flex flex-col gap-1 shrink-0">
                    <ShieldCheck className="h-4 w-4 text-blue-500 mb-1" />
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Score</p>
                    <p className="text-slate-900 text-xl font-bold">
                      {stats && stats.totalTransactions > 0 ? '98%' : '—'}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Dernières Opérations */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-slate-900 font-bold text-lg">Dernières Opérations</h3>
                <button
                  onClick={() => { setActiveSection('clients'); loadTransactions(); }}
                  className="text-[#0A3D91] text-xs font-bold uppercase tracking-wider"
                >
                  Historique
                </button>
              </div>
              {loadingTx ? (
                <TransactionListSkeleton variant="agent" count={4} />
              ) : allTransactions.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
                  <History className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm font-bold">Aucune transaction</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allTransactions.slice(0, 5).map(tx => (
                    <div key={tx.id} className="bg-white p-4 rounded-2xl flex items-center gap-4 shadow-sm border border-slate-50">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                        tx.type === 'deposit' ? 'bg-green-50 text-[#00C853]' : 'bg-orange-50 text-orange-500'
                      }`}>
                        {tx.type === 'deposit'
                          ? <ArrowDownLeft className="h-5 w-5" />
                          : <ArrowUpRight className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2">
                          <p className="font-bold text-slate-900 truncate">{tx.type === 'deposit' ? 'Dépôt Solutionpam' : 'Retrait Cash'}</p>
                          <p className={`font-bold shrink-0 ${tx.type === 'deposit' ? 'text-[#00C853]' : 'text-slate-900'}`}>
                            {tx.type === 'deposit' ? '+' : '-'}{Math.round((tx.amount || 0) * rate).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex justify-between items-baseline gap-2">
                          <p className="text-xs text-slate-400 truncate">Client: {tx.clientName}</p>
                          <p className="text-[10px] text-slate-300 font-medium uppercase shrink-0">{fmtDate(tx.createdAt, 'HH:mm')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Security Banner */}
            <section className="bg-blue-50/50 rounded-3xl p-5 border border-blue-100 flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-slate-900 font-bold text-sm">Sécurité Renforcée</p>
                <p className="text-slate-500 text-xs">Chiffrement AES-256 actif. Vos données et fonds sont protégés par Solutionpam Safe.</p>
              </div>
            </section>

          </motion.div>
        )}

        {/* ── CONCOURS ── */}
        {activeSection === 'contest' && (
          <motion.div key="contest" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <Trophy className="h-6 w-6 text-amber-500" />
              <div>
                <h2 className="text-xl font-black text-slate-900">Concours</h2>
                <p className="text-xs text-slate-400">Classement des agents et récompenses</p>
              </div>
            </div>
            <ContestPodium participantId={agentUid} participantType="agent" />
          </motion.div>
        )}

        {/* ── REQUESTS ── */}
        {activeSection === 'requests' && (
          <motion.div key="requests" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">

            {/* Client withdrawal requests */}
            <div>
              <div className="flex items-center justify-between px-1 mb-3">
                <h3 className="text-base font-black text-dark flex items-center gap-2">
                  <ArrowUpFromLine className="h-5 w-5 text-rose-500" />
                  Retraits clients
                  {withdrawRequests.length > 0 && (
                    <span className="bg-rose-100 text-rose-700 text-[10px] px-2 py-0.5 rounded-full font-black">{withdrawRequests.length}</span>
                  )}
                </h3>
                <button onClick={loadWithdrawRequests} disabled={loadingRequests} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <RefreshCw className={`h-4 w-4 ${loadingRequests ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingRequests ? (
                <AdminContentSkeleton variant="cards" rows={2} />
              ) : withdrawRequests.length === 0 ? (
                <div className="bg-gray-50 rounded-[2rem] p-10 text-center border-2 border-dashed border-gray-200">
                  <CheckCircle2 className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Aucune demande de retrait</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {withdrawRequests.map(req => (
                    <Card key={req.id} className="rounded-3xl border-0 shadow-md overflow-hidden border-l-4 border-l-rose-400">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 font-black text-base shrink-0">
                              {(req.clientName || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-black text-dark">{req.clientName}</p>
                              <p className="text-[10px] text-gray-400">{fmtDate(req.createdAt)}</p>
                              {req.message && <p className="text-xs text-gray-500 mt-0.5 italic">"{req.message}"</p>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-rose-600">${(req.amount || 0).toFixed(2)}</p>
                            <p className="text-[10px] text-gray-400">≈ {((req.amount || 0) * rate).toLocaleString()} HTG</p>
                          </div>
                        </div>

                        {/* Fee breakdown preview */}
                        {(() => {
                          const amt = req.amount || 0;
                          const wdPct = settings?.agentWithdrawPercent || 0;
                          const agentSharePct = settings?.agentWithdrawAgentSharePercent ?? 100;
                          if (amt <= 0 || wdPct <= 0) return null;
                          const fee = parseFloat((amt * wdPct / 100).toFixed(4));
                          const agentShare = parseFloat((fee * agentSharePct / 100).toFixed(4));
                          const netClient = parseFloat((amt - fee).toFixed(4));
                          return (
                            <div className="rounded-2xl border border-gray-100 overflow-hidden">
                              <div className="flex justify-between items-center px-3 py-2 bg-white border-b border-gray-50">
                                <span className="text-[10px] text-gray-400 font-medium">Frais ({wdPct}%)</span>
                                <span className="text-xs font-black text-red-400">−${fee.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center px-3 py-2 bg-rose-50 border-b border-rose-100">
                                <span className="text-[10px] font-black text-rose-700 uppercase tracking-wide">À remettre</span>
                                <span className="text-sm font-black text-rose-700">${netClient.toFixed(2)} USD</span>
                              </div>
                              {agentShare > 0 && (
                                <div className="flex justify-between items-center px-3 py-2 bg-emerald-50">
                                  <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wide">Votre commission</span>
                                  <span className="text-xs font-black text-emerald-700">+${agentShare.toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Reject reason */}
                        <div>
                          <Input
                            value={rejectReasonMap[req.id] || ''}
                            onChange={e => setRejectReasonMap(prev => ({ ...prev, [req.id]: e.target.value }))}
                            placeholder="Raison du refus (optionnel)"
                            className="h-9 rounded-xl bg-gray-50 border-0 text-xs"
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleRejectWithdraw(req)}
                            disabled={isProcessing}
                            variant="ghost"
                            className="flex-1 rounded-xl h-10 text-red-500 hover:bg-red-50 font-black text-xs uppercase tracking-widest"
                          >
                            <XCircle className="h-4 w-4 mr-1.5" />
                            Refuser
                          </Button>
                          <Button
                            onClick={() => handleConfirmWithdraw(req)}
                            disabled={isProcessing}
                            className="flex-1 rounded-xl h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest border-0 shadow-lg shadow-emerald-500/20"
                          >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                              <><CheckCircle2 className="h-4 w-4 mr-1.5" />Confirmer</>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Affiliate deposit requests */}
            <div>
              <h3 className="text-base font-black text-dark flex items-center gap-2 px-1 mb-3">
                <ArrowDownToLine className="h-5 w-5 text-amber-500" />
                Dépôts affiliés
                {pendingAffiliateRequests.length > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">{pendingAffiliateRequests.length}</span>
                )}
              </h3>

              {pendingAffiliateRequests.length === 0 ? (
                <div className="bg-gray-50 rounded-[2rem] p-10 text-center border-2 border-dashed border-gray-200">
                  <CheckCircle2 className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Aucun dépôt affilié en attente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingAffiliateRequests.map(request => (
                    <Card key={request.id} className="rounded-3xl border-0 shadow-md overflow-hidden border-l-4 border-l-amber-400">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
                              <ArrowRightLeft className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Affilié</p>
                              <p className="font-black text-dark">ID: {request.affiliateId.slice(-6)}</p>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-xl font-black text-primary">${request.amount.toLocaleString()}</p>
                            <p className="text-[10px] font-bold text-gray-400">{((request.amount || 0) * rate).toLocaleString()} HTG</p>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => handleRejectAffiliate(request.id!)} disabled={isProcessing}
                              variant="ghost" className="rounded-xl h-9 px-3 text-red-500 hover:bg-red-50 font-black text-xs">
                              Refuser
                            </Button>
                            <Button onClick={() => handleApproveAffiliate(request)} disabled={isProcessing}
                              className="rounded-xl h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs border-0 shadow shadow-emerald-500/20">
                              {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Valider'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Client deposit requests */}
            <div>
              <div className="flex items-center justify-between px-1 mb-3">
                <h3 className="text-base font-black text-dark flex items-center gap-2">
                  <ArrowDownLeft className="h-5 w-5 text-emerald-500" />
                  Dépôts clients (via code agent)
                  {clientDepositReqs.length > 0 && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">{clientDepositReqs.length}</span>
                  )}
                </h3>
                <button onClick={loadClientDepositReqs} disabled={clientDepReqLoading} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <RefreshCw className={`h-4 w-4 ${clientDepReqLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {clientDepReqLoading && clientDepositReqs.length === 0 ? (
                <AdminContentSkeleton variant="cards" rows={2} />
              ) : clientDepositReqs.length === 0 ? (
                <div className="bg-gray-50 rounded-[2rem] p-10 text-center border-2 border-dashed border-gray-200">
                  <CheckCircle2 className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Aucune demande de dépôt client</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clientDepositReqs.map(req => (
                    <Card key={req.id} className="rounded-3xl border-0 shadow-md overflow-hidden border-l-4 border-l-emerald-400">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-base shrink-0">
                              {(req.clientName || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-black text-dark">{req.clientName || 'Client'}</p>
                              <p className="text-[10px] text-gray-400">{fmtDate(req.createdAt)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-emerald-600">${(req.amount || 0).toFixed(2)}</p>
                            <p className="text-[10px] text-gray-400">≈ {Math.round((req.amount || 0) * rate).toLocaleString()} HTG</p>
                          </div>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5 text-[11px] text-amber-700 font-medium">
                          ⚠️ Approuver déduira <strong>${(req.amount || 0).toFixed(2)}</strong> de votre wallet agent et créditera le client.
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleRejectClientDeposit(req)}
                            disabled={clientDepReqActionLoading === req.id}
                            variant="ghost"
                            className="flex-1 rounded-xl h-10 text-red-500 hover:bg-red-50 font-black text-xs uppercase tracking-widest"
                          >
                            <XCircle className="h-4 w-4 mr-1.5" />
                            Refuser
                          </Button>
                          <Button
                            onClick={() => handleApproveClientDeposit(req)}
                            disabled={clientDepReqActionLoading === req.id}
                            className="flex-1 rounded-xl h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest border-0 shadow-lg shadow-emerald-500/20"
                          >
                            {clientDepReqActionLoading === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                              <><CheckCircle2 className="h-4 w-4 mr-1.5" />Approuver</>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── DEPOSIT (direct) ── */}
        {activeSection === 'deposit' && (
          <motion.div key="deposit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <h3 className="text-lg font-black text-dark flex items-center gap-2 px-1">
              <ArrowDownLeft className="h-5 w-5 text-emerald-500" />
              {scannedTxCode ? 'Confirmation QR' : 'Dépôt pour un client'}
            </h3>

            {/* ── QR scan confirmation card ── */}
            {scannedTxCode ? (
              <motion.div
                key="qr-confirm"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-3xl overflow-hidden shadow-xl ${scannedTxCode.ty === 'deposit' ? 'shadow-emerald-200' : 'shadow-violet-200'}`}
              >
                {/* Header */}
                <div className={`px-6 py-5 text-white ${scannedTxCode.ty === 'deposit' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-violet-500 to-purple-700'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-11 w-11 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                      <QrCode className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Code QR scanné</p>
                      <p className="font-black text-base leading-tight">{scannedTxCode.cn}</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black">{Math.round(scannedTxCode.a * rate).toLocaleString('fr-FR')}</span>
                    <span className="text-xl text-white/60 font-bold">HTG</span>
                  </div>
                  <p className="text-white/50 text-xs font-bold mt-0.5">≈ ${scannedTxCode.a.toFixed(2)} USD · {scannedTxCode.ty === 'deposit' ? 'Dépôt' : 'Retrait'}</p>
                </div>

                {/* Details */}
                <div className="bg-white px-6 py-4 space-y-3">
                  {/* Fee breakdown */}
                  {(() => {
                    const usd = scannedTxCode.a;
                    const isDeposit = scannedTxCode.ty === 'deposit';
                    const depPct   = settings?.agentDepositCommissionPercent ?? 0;
                    const wdPct    = settings?.agentWithdrawPercent ?? 0;
                    const agentPct = settings?.agentWithdrawAgentSharePercent ?? 100;
                    if (isDeposit) {
                      const commission = usd > 0 ? parseFloat((usd * depPct / 100).toFixed(4)) : 0;
                      return (
                        <div className="rounded-2xl border border-gray-100 overflow-hidden text-xs">
                          <div className="flex justify-between items-center px-3.5 py-2 bg-white border-b border-gray-50">
                            <span className="text-gray-500 font-medium">Crédité au client</span>
                            <span className="font-black text-gray-800">{Math.round(usd * rate).toLocaleString('fr-FR')} HTG</span>
                          </div>
                          <div className="flex justify-between items-center px-3.5 py-2 bg-white border-b border-gray-50">
                            <span className="text-gray-500 font-medium">Débité de votre solde</span>
                            <span className="font-black text-red-500">−${usd.toFixed(2)} USD</span>
                          </div>
                          {commission > 0 && (
                            <div className="flex justify-between items-center px-3.5 py-2 bg-emerald-50">
                              <span className="font-black text-emerald-800 uppercase tracking-wide">Votre commission ({depPct}%)</span>
                              <span className="font-black text-emerald-700">+${commission.toFixed(2)} USD</span>
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      if (wdPct <= 0) return null;
                      const fee       = parseFloat((usd * wdPct / 100).toFixed(4));
                      const agentShare = parseFloat((fee * agentPct / 100).toFixed(4));
                      const netUsd    = parseFloat((usd - fee).toFixed(4));
                      const netHtg    = Math.round(netUsd * rate);
                      return (
                        <div className="rounded-2xl border border-gray-100 overflow-hidden text-xs">
                          <div className="flex justify-between items-center px-3.5 py-2 bg-white border-b border-gray-50">
                            <span className="text-gray-500 font-medium">Débité du client</span>
                            <span className="font-black text-gray-800">${usd.toFixed(2)} USD</span>
                          </div>
                          <div className="flex justify-between items-center px-3.5 py-2 bg-white border-b border-gray-50">
                            <span className="text-red-500 font-medium">Frais ({wdPct}%)</span>
                            <span className="font-black text-red-500">−${fee.toFixed(2)} USD</span>
                          </div>
                          <div className="flex justify-between items-center px-3.5 py-2 bg-rose-50 border-b border-rose-100">
                            <span className="font-black text-rose-800 uppercase tracking-wide">À remettre au client</span>
                            <span className="font-black text-rose-700">{netHtg.toLocaleString('fr-FR')} HTG ≈ ${netUsd.toFixed(2)}</span>
                          </div>
                          {agentShare > 0 && (
                            <div className="flex justify-between items-center px-3.5 py-2 bg-emerald-50">
                              <span className="font-black text-emerald-800 uppercase tracking-wide">Votre commission</span>
                              <span className="font-black text-emerald-700">+${agentShare.toFixed(2)} USD</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                  })()}
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-2xl p-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      {scannedTxCode.ty === 'deposit'
                        ? `Le client vous a remis ${Math.round(scannedTxCode.a * rate).toLocaleString('fr-FR')} HTG en espèces. Confirmez pour créditer son compte.`
                        : (() => {
                            const wdPct = settings?.agentWithdrawPercent ?? 0;
                            const net   = scannedTxCode.a * (1 - wdPct / 100);
                            return `Remettez ${Math.round(net * rate).toLocaleString('fr-FR')} HTG en espèces au client (montant après frais).`;
                          })()
                      }
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setScannedTxCode(null)}
                      disabled={processingTx}
                      className="h-12 rounded-2xl border-2 border-gray-200 font-black text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleConfirmScanTx}
                      disabled={processingTx}
                      className={`h-12 rounded-2xl font-black text-white flex items-center justify-center gap-2 transition-opacity ${processingTx ? 'opacity-60' : ''} ${scannedTxCode.ty === 'deposit' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-violet-500 hover:bg-violet-600'}`}
                    >
                      {processingTx ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Confirmer
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 flex items-start gap-3">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Le montant sera <strong>déduit de votre wallet commissions</strong> et crédité instantanément au client.
                  </p>
                </div>

            <DirectTxForm
              type="deposit"
              agent={agent}
              rate={rate}
              clientSearch={clientSearch}
              setClientSearch={setClientSearch}
              searching={searching}
              searchResults={searchResults}
              setSearchResults={setSearchResults}
              foundClient={foundClient}
              setFoundClient={setFoundClient}
              txAmount={txAmount}
              setTxAmount={setTxAmount}
              txNote={txNote}
              setTxNote={setTxNote}
              txPaymentMethod={txPaymentMethod}
              setTxPaymentMethod={setTxPaymentMethod}
              submitting={submitting}
              onSearch={handleSearchClient}
              onSubmit={handleSubmitDeposit}
              agentDepositCommissionPercent={settings?.agentDepositCommissionPercent ?? 0}
              agentWithdrawPercent={settings?.agentWithdrawPercent ?? 0}
              agentWithdrawAgentSharePercent={settings?.agentWithdrawAgentSharePercent ?? 100}
            />
              </>
            )}
          </motion.div>
        )}

        {/* ── COMMISSIONS ── */}
        {activeSection === 'commissions' && (
          <motion.div key="commissions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-black text-dark flex items-center gap-2">
                <BadgeDollarSign className="h-5 w-5 text-amber-500" />
                Historique Commissions
              </h3>
              <button onClick={loadFeeRecords} disabled={loadingFees} className="text-gray-400 hover:text-gray-600 transition-colors">
                <RefreshCw className={`h-4 w-4 ${loadingFees ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Summary card */}
            <Card className="rounded-[2rem] border-0 shadow-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white overflow-hidden">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Total gagné</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">{(agent.commissionBalance || 0).toFixed(2)}</span>
                    <span className="text-base font-black text-white/50">$</span>
                  </div>
                  <p className="text-[10px] text-white/50 mt-0.5">≈ {((agent.commissionBalance || 0) * rate).toLocaleString()} HTG</p>
                </div>
                <Star className="h-16 w-16 text-white/10" />
              </CardContent>
            </Card>

            {loadingFees ? (
              <TransactionListSkeleton variant="agent" count={4} />
            ) : feeRecords.length === 0 ? (
              <div className="bg-gray-50 rounded-[2rem] p-16 text-center border-2 border-dashed border-gray-200">
                <BadgeDollarSign className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Aucune commission enregistrée</p>
              </div>
            ) : (
              <div className="space-y-2">
                {feeRecords.map(rec => (
                  <div key={rec.id} className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                      <BadgeDollarSign className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-dark text-sm truncate">{rec.clientName}</p>
                      <p className="text-[10px] text-gray-400 capitalize">
                        {rec.operationType === 'deposit' ? 'Dépôt' : 'Retrait'} — base: ${(rec.baseAmount || 0).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-300">{fmtDate(rec.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-amber-600 text-sm">+${(rec.agentShare || 0).toFixed(4)}</p>
                      <p className="text-[10px] text-gray-400">commission</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── CLIENTS ── */}
        {activeSection === 'clients' && (
          <motion.div key="clients" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-black text-dark flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Clients gérés
                <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-black">{uniqueClients.length}</span>
              </h3>
              <button onClick={loadTransactions} disabled={loadingTx} className="text-gray-400 hover:text-gray-600">
                <RefreshCw className={`h-4 w-4 ${loadingTx ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingTx ? (
              <TransactionListSkeleton variant="agent" count={4} />
            ) : uniqueClients.length === 0 ? (
              <div className="bg-gray-50 rounded-[2rem] p-16 text-center border-2 border-dashed border-gray-200">
                <Users className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Aucun client servi</p>
              </div>
            ) : (
              <div className="space-y-2">
                {uniqueClients.map(c => (
                  <div key={c.clientId} className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-base shrink-0">
                      {(c.clientName || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-dark truncate">{c.clientName}</p>
                      <p className="text-[10px] text-gray-400">{c.txCount} transaction{c.txCount > 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-gray-400">Dernière</p>
                      <p className="text-[10px] font-bold text-gray-600">{fmtDate(c.lastTx, 'dd MMM yyyy')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Full tx history */}
            {allTransactions.length > 0 && (
              <div className="mt-2">
                <p className="font-black text-dark text-sm px-1 mb-3">Toutes les transactions</p>
                <div className="space-y-2">
                  {allTransactions.map(tx => (
                    <div key={tx.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.type === 'deposit' ? 'bg-emerald-100' : 'bg-rose-100'
                      }`}>
                        {tx.type === 'deposit'
                          ? <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
                          : <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-dark text-sm truncate">{tx.clientName}</p>
                        <p className="text-[10px] text-gray-400 truncate">{tx.description || ''}</p>
                        <p className="text-[10px] text-gray-300">{fmtDate(tx.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-black text-sm ${tx.type === 'deposit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.type === 'deposit' ? '+' : '-'}${(tx.amount || 0).toFixed(2)}
                        </p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          tx.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          tx.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {tx.status === 'approved' ? 'Validé' : tx.status === 'pending' ? 'En attente' : 'Refusé'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── FINANCES PERSONNELLES ── */}
        {activeSection === 'finances' && (
          <motion.div key="finances" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            <h3 className="text-lg font-black text-dark flex items-center gap-2 px-1">
              <Wallet className="h-5 w-5 text-primary" />
              Mes Finances
            </h3>

            {/* ── WALLET AGENT ── */}
            <div className="rounded-[2rem] border-2 border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Wallet Agent</p>
                  <p className="text-2xl font-black mt-0.5">${(agent.balance || 0).toFixed(2)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">≈ {((agent.balance || 0) * rate).toLocaleString()} HTG</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-slate-300" />
                </div>
              </div>
              <div className="p-4">
                <p className="text-[10px] text-slate-500 font-bold mb-3">Caisse opérationnelle — utilisée pour les dépôts clients.</p>
                {agent.walletLocked && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-2.5 mb-3">
                    <span className="text-red-500 text-xs font-black">🔒 Ce wallet est verrouillé par l'admin. Contactez l'administrateur.</span>
                  </div>
                )}
                <button
                  onClick={() => { setPAmount(''); setPMethod('MonCash'); setPAccount(''); setPAccountName(''); setPMessage(''); setPersonalDepositOpen(true); }}
                  disabled={!!agent.walletLocked}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  Recharger Wallet Agent
                </button>
              </div>
            </div>

            {/* ── WALLET AFFILIÉ ── */}
            <div className="rounded-[2rem] border-2 border-amber-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-100">Wallet Affilié</p>
                  <p className="text-2xl font-black mt-0.5">${(agent.commissionBalance || 0).toFixed(2)}</p>
                  <p className="text-[10px] text-amber-100 mt-0.5">≈ {((agent.commissionBalance || 0) * rate).toLocaleString()} HTG</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="p-4">
                <p className="text-[10px] text-amber-700 font-bold mb-3">Commissions accumulées sur vos transactions clients.</p>
                <button
                  onClick={() => { setPAmount(''); setPMethod('MonCash'); setPAccount(''); setPAccountName(''); setPMessage(''); setPersonalWithdrawalOpen(true); }}
                  disabled={(agent.commissionBalance || 0) <= 0}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-500 text-white font-black text-sm hover:bg-amber-600 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowUpFromLine className="h-4 w-4" />
                  Retirer mes Commissions
                </button>
              </div>
            </div>

            {/* Transaction history */}
            <div>
              <div className="flex items-center justify-between px-1 mb-3">
                <p className="font-black text-dark text-sm">Historique personnel</p>
                <button onClick={loadPersonalTxs} disabled={loadingPersonalTxs} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <RefreshCw className={`h-4 w-4 ${loadingPersonalTxs ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {loadingPersonalTxs ? (
                <TransactionListSkeleton variant="agent" count={4} />
              ) : personalTxs.length === 0 ? (
                <div className="bg-gray-50 rounded-[2rem] p-10 text-center border-2 border-dashed border-gray-200">
                  <History className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm font-bold">Aucune transaction personnelle</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {personalTxs.map((tx: any) => (
                    <div key={tx.id} className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.type === 'deposit' ? 'bg-slate-100' : 'bg-amber-100'
                      }`}>
                        {tx.type === 'deposit'
                          ? <ArrowDownToLine className="h-4 w-4 text-slate-600" />
                          : <ArrowUpFromLine className="h-4 w-4 text-amber-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-dark text-sm truncate">
                          {tx.type === 'deposit' ? '↓ Recharge Wallet Agent' : '↑ Retrait Wallet Affilié'}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">{tx.method}{tx.accountNumber ? ` — ${tx.accountNumber}` : ''}</p>
                        <p className="text-[10px] text-gray-300">{fmtDate(tx.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-black text-sm ${tx.type === 'deposit' ? 'text-slate-700' : 'text-amber-600'}`}>
                          {tx.type === 'deposit' ? '+' : '-'}${(tx.amount || 0).toFixed(2)}
                        </p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          tx.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          tx.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {tx.status === 'approved' ? 'Validé' : tx.status === 'pending' ? 'En attente' : 'Refusé'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── SETTINGS ── */}
        {activeSection === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <h3 className="text-lg font-black text-dark flex items-center gap-2 px-1">
              <Settings className="h-5 w-5 text-gray-500" />
              Paramètres Agent
            </h3>

            {/* Profile photo */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="relative shrink-0">
                {agent.photoUrl ? (
                  <img
                    src={agent.photoUrl}
                    alt={agent.name}
                    className="h-16 w-16 rounded-2xl object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                  />
                ) : null}
                <div className={`h-16 w-16 rounded-2xl bg-[#0A3D91]/10 flex items-center justify-center ${agent.photoUrl ? 'hidden' : ''}`}>
                  <span className="text-3xl font-black text-[#0A3D91]">{agent.name.charAt(0)}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-dark text-lg truncate">{agent.name}</p>
                <p className="text-xs text-gray-400 font-mono">#{agent.agentCode}</p>
                <PhotoUrlEditor
                  currentUrl={agent.photoUrl}
                  onSave={async (url) => {
                    await fetch(`/api/agent/${agent.id}/photo`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ photoUrl: url }),
                    });
                  }}
                  className="mt-2"
                />
              </div>
            </div>

            <Card className="rounded-[2rem] border-0 shadow-sm border border-gray-100">
              <CardContent className="p-5 space-y-4">
                {[
                  { label: 'Nom complet', value: agent.name, icon: User },
                  { label: 'Code agent', value: `#${agent.agentCode}`, icon: ShieldCheck, mono: true },
                  { label: 'Téléphone', value: agent.phone || '—', icon: Phone },
                  { label: 'Wallet ID', value: agent.walletId || '—', icon: Wallet, mono: true },
                  { label: 'Statut', value: agent.status === 'active' ? 'Actif' : 'Inactif', icon: CheckCircle2,
                    valueClass: agent.status === 'active' ? 'text-emerald-600' : 'text-red-500' },
                  { label: 'Email', value: agent.email || '—', icon: StickyNote },
                ].map(({ label, value, icon: Icon, mono, valueClass }) => (
                  <div key={label} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
                    <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
                      <p className={`font-black text-dark truncate ${mono ? 'font-mono' : ''} ${valueClass || ''}`}>{value}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-blue-50 border border-blue-100">
              <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />
              <p className="text-xs text-blue-700 leading-relaxed">
                Pour modifier vos informations ou votre solde, contactez l'administrateur Solutionpam.
              </p>
            </div>

            <Button onClick={onLogout} variant="outline"
              className="w-full rounded-2xl h-12 text-red-500 border-red-200 hover:bg-red-50 font-black">
              <LogOut className="h-4 w-4 mr-2" /> Déconnexion
            </Button>
          </motion.div>
        )}

        {/* ── FREE FIRE REVENDEUR ── */}
        {activeSection === 'free-fire' && (
          <FreeFireResellerSection agentId={agent.id} agentName={agent.name} agentBalance={agent.balance || 0} />
        )}

      </AnimatePresence>

      </main>

      {/* ── Bottom Navigation — portaled to body to escape motion.div containing block ── */}
      {createPortal(
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50 pb-safe">
          <nav className="flex justify-between items-center px-6 py-4">
            {/* Accueil */}
            <button
              onClick={() => setActiveSection('overview')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeSection === 'overview' ? 'text-[#0A3D91]' : 'text-slate-400'}`}
            >
              <LayoutGrid className="h-6 w-6" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Accueil</span>
            </button>
            {/* Activités */}
            <button
              onClick={() => { setActiveSection('requests'); loadWithdrawRequests(); loadClientDepositReqs(); }}
              className={`flex flex-col items-center gap-1 relative transition-colors ${activeSection === 'clients' || activeSection === 'requests' ? 'text-[#0A3D91]' : 'text-slate-400'}`}
            >
              <ListOrdered className="h-6 w-6" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Activités</span>
              {totalPendingCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                  {totalPendingCount}
                </span>
              )}
            </button>
            {/* Center Scan button — fixed at the top of the nav bar */}
            <div className="-mt-12">
              <button
                onClick={() => { setScannerError(null); setScannerOpen(true); }}
                className="w-14 h-14 bg-[#0A3D91] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/40 ring-4 ring-white active:scale-90 transition-transform"
              >
                <Scan className="h-7 w-7" />
              </button>
            </div>
            {/* Portefeuille */}
            <button
              onClick={() => setActiveSection('finances')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeSection === 'finances' ? 'text-[#0A3D91]' : 'text-slate-400'}`}
            >
              <Banknote className="h-6 w-6" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Portefeuille</span>
            </button>
            {/* Profil */}
            <button
              onClick={() => setActiveSection('settings')}
              className={`flex flex-col items-center gap-1 transition-colors ${activeSection === 'settings' || activeSection === 'commissions' ? 'text-[#0A3D91]' : 'text-slate-400'}`}
            >
              <User className="h-6 w-6" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Profil</span>
            </button>
          </nav>
        </footer>,
        document.body
      )}

      {/* ── Personal Deposit Dialog ───────────────────────────────────────── */}
      <Dialog open={personalDepositOpen} onOpenChange={v => { if (!v) { setPAmount(''); setPMethod('MonCash'); setPAccount(''); setPAccountName(''); setPMessage(''); } setPersonalDepositOpen(v); }}>
        <DialogContent className="w-[94%] sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl">
          <DialogHeader className="p-6 bg-emerald-600 text-white relative">
            <DialogTitle className="text-xl font-black">Dépôt — Solde Agent</DialogTitle>
            <DialogDescription className="text-emerald-100 text-sm mt-1">Demandez à créditer votre solde agent.</DialogDescription>
            <DialogClose className="absolute right-5 top-5 rounded-full bg-white/20 p-1.5 hover:bg-white/30 transition-colors">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Méthode de paiement</Label>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {[
                  { v: 'MonCash', label: 'MonCash', sub: 'Digicel', color: '#dc2626' },
                  { v: 'NatCash', label: 'NatCash', sub: 'Natcom', color: '#2563eb' },
                  { v: 'Lajan Cash', label: 'Lajan Cash', sub: '', color: '#16a34a' },
                  { v: 'Virement', label: 'Virement', sub: 'Bancaire', color: '#4f46e5' },
                  { v: 'Physical', label: 'Bureau', sub: 'En personne', color: '#374151' },
                ].map(m => (
                  <button key={m.v} type="button" onClick={() => setPMethod(m.v)}
                    className={`flex-shrink-0 flex flex-col items-center justify-center rounded-2xl px-3 py-2 min-w-[68px] border-2 transition-all ${pMethod === m.v ? 'text-white shadow-md scale-105 border-transparent' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
                    style={pMethod === m.v ? { background: m.color } : {}}>
                    <span className={`text-[11px] font-black leading-tight ${pMethod === m.v ? 'text-white' : 'text-gray-700'}`}>{m.label}</span>
                    {m.sub && <span className={`text-[8px] font-medium mt-0.5 ${pMethod === m.v ? 'text-white/70' : 'text-gray-400'}`}>{m.sub}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant (USD)</Label>
              <div className="relative">
                <Input type="number" placeholder="Ex: 100" value={pAmount} onChange={e => setPAmount(e.target.value)}
                  className="h-12 rounded-2xl border-gray-100 bg-gray-50 font-black text-lg pl-11" min="1" step="1" />
                <ArrowDownToLine className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
              </div>
              {pAmount && !isNaN(parseFloat(pAmount)) && parseFloat(pAmount) > 0 && (
                <p className="text-xs text-gray-400 font-bold text-center">≈ {Math.round(parseFloat(pAmount) * rate).toLocaleString()} HTG</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Numéro de référence (optionnel)</Label>
              <Input placeholder="Ex: N° transaction MonCash" value={pAccount} onChange={e => setPAccount(e.target.value)}
                className="h-11 rounded-2xl border-gray-100 bg-gray-50 font-medium" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Message (optionnel)</Label>
              <Input placeholder="Note pour l'admin..." value={pMessage} onChange={e => setPMessage(e.target.value)}
                className="h-11 rounded-2xl border-gray-100 bg-gray-50 font-medium" maxLength={200} />
            </div>
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                L'admin recevra un email de notification et créditera votre solde après vérification.
              </p>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <Button onClick={handlePersonalDeposit}
              disabled={pSubmitting || !pAmount || isNaN(parseFloat(pAmount)) || parseFloat(pAmount) <= 0}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl border-0">
              {pSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Envoyer la demande →'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Personal Withdrawal Dialog ────────────────────────────────────── */}
      <Dialog open={personalWithdrawalOpen} onOpenChange={v => { if (!v) { setPAmount(''); setPMethod('MonCash'); setPAccount(''); setPAccountName(''); setPMessage(''); } setPersonalWithdrawalOpen(v); }}>
        <DialogContent className="w-[94%] sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl">
          <DialogHeader className="p-6 bg-rose-600 text-white relative">
            <DialogTitle className="text-xl font-black">Retrait — Commissions</DialogTitle>
            <DialogDescription className="text-rose-100 text-sm mt-1">Retirez vos commissions accumulées.</DialogDescription>
            <DialogClose className="absolute right-5 top-5 rounded-full bg-white/20 p-1.5 hover:bg-white/30 transition-colors">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>
          <div className="p-6 space-y-4">
            {/* Available balance */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Commissions disponibles</p>
              <p className="text-3xl font-black text-amber-700">${(agent.commissionBalance || 0).toFixed(2)}</p>
              <p className="text-[10px] text-amber-500 mt-0.5">≈ {((agent.commissionBalance || 0) * rate).toLocaleString()} HTG</p>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Méthode de paiement</Label>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {[
                  { v: 'MonCash', label: 'MonCash', sub: 'Digicel', color: '#dc2626' },
                  { v: 'NatCash', label: 'NatCash', sub: 'Natcom', color: '#2563eb' },
                  { v: 'Lajan Cash', label: 'Lajan Cash', sub: '', color: '#16a34a' },
                  { v: 'Virement', label: 'Virement', sub: 'Bancaire', color: '#4f46e5' },
                  { v: 'Physical', label: 'Bureau', sub: 'En personne', color: '#374151' },
                ].map(m => (
                  <button key={m.v} type="button" onClick={() => setPMethod(m.v)}
                    className={`flex-shrink-0 flex flex-col items-center justify-center rounded-2xl px-3 py-2 min-w-[68px] border-2 transition-all ${pMethod === m.v ? 'text-white shadow-md scale-105 border-transparent' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
                    style={pMethod === m.v ? { background: m.color } : {}}>
                    <span className={`text-[11px] font-black leading-tight ${pMethod === m.v ? 'text-white' : 'text-gray-700'}`}>{m.label}</span>
                    {m.sub && <span className={`text-[8px] font-medium mt-0.5 ${pMethod === m.v ? 'text-white/70' : 'text-gray-400'}`}>{m.sub}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Numéro de compte *</Label>
              <Input placeholder="Ex: +509 XXXX XXXX" value={pAccount} onChange={e => setPAccount(e.target.value)}
                className="h-12 rounded-2xl border-gray-100 bg-gray-50 font-bold" required />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nom du bénéficiaire</Label>
              <Input placeholder="Nom sur le compte" value={pAccountName} onChange={e => setPAccountName(e.target.value)}
                className="h-11 rounded-2xl border-gray-100 bg-gray-50 font-medium" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant (USD) *</Label>
              <div className="relative">
                <Input type="number" placeholder="0.00" value={pAmount} onChange={e => setPAmount(e.target.value)}
                  className="h-12 rounded-2xl border-gray-100 bg-gray-50 font-black text-lg pl-11"
                  min="0.01" step="0.01" max={agent.commissionBalance || 0} />
                <ArrowUpFromLine className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-500" />
              </div>
              {pAmount && !isNaN(parseFloat(pAmount)) && parseFloat(pAmount) > (agent.commissionBalance || 0) && (
                <p className="text-xs text-red-500 font-bold">Montant supérieur à votre solde commissions</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Message (optionnel)</Label>
              <Input placeholder="Note pour l'admin..." value={pMessage} onChange={e => setPMessage(e.target.value)}
                className="h-11 rounded-2xl border-gray-100 bg-gray-50 font-medium" maxLength={200} />
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <Button onClick={handlePersonalWithdrawal}
              disabled={pSubmitting || !pAmount || !pAccount.trim() || isNaN(parseFloat(pAmount)) || parseFloat(pAmount) <= 0 || parseFloat(pAmount) > (agent.commissionBalance || 0)}
              className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl border-0">
              {pSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Demander le retrait →'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Self-Deposit Dialog ───────────────────────────────────────────── */}
      <Dialog open={isSelfDepositOpen} onOpenChange={v => { if (!v) { setSelfDepositAmount(''); setSelfDepositMethod('MonCash'); } setIsSelfDepositOpen(v); }}>
        <DialogContent className="w-[94%] sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl">
          <DialogHeader className="p-6 bg-emerald-600 text-white relative">
            <DialogTitle className="text-xl font-black">Recharger mon Solde</DialogTitle>
            <DialogDescription className="text-emerald-100 text-sm mt-1">Via MonCash, NatCash ou Bureau / Proxy.</DialogDescription>
            <DialogClose className="absolute right-5 top-5 rounded-full bg-white/20 p-1.5 hover:bg-white/30 transition-colors">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          <div className="p-6 space-y-5">
            {/* Method */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Méthode de paiement</Label>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {[
                  { v: 'MonCash',   label: 'MonCash',    sub: 'Digicel',      color: '#dc2626', logo: settings?.moncashLogoUrl },
                  { v: 'NatCash',   label: 'NatCash',    sub: 'Natcom',       color: '#2563eb', logo: settings?.natcashLogoUrl },
                  { v: 'Lajan Cash',label: 'Lajan Cash', sub: '',             color: '#16a34a', logo: undefined },
                  { v: 'Sogebank',  label: 'Sogebank',   sub: 'Banque',       color: '#1e3a5f', logo: undefined },
                  { v: 'Unibank',   label: 'Unibank',    sub: 'Banque',       color: '#7c3aed', logo: undefined },
                  { v: 'Virement',  label: 'Virement',   sub: 'Bancaire',     color: '#4f46e5', logo: undefined },
                  { v: 'Physical',  label: 'Bureau',     sub: 'En personne',  color: '#374151', logo: undefined },
                ].map(m => (
                  <button key={m.v} type="button" onClick={() => setSelfDepositMethod(m.v)}
                    className={`flex-shrink-0 flex flex-col items-center justify-center rounded-2xl px-3 py-2 min-w-[72px] border-2 transition-all gap-0.5 ${selfDepositMethod === m.v ? 'text-white shadow-md scale-105 border-transparent' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
                    style={selfDepositMethod === m.v ? { background: m.color } : {}}>
                    {m.logo && selfDepositMethod === m.v
                      ? <img src={m.logo} alt="" className="h-4 w-auto mb-0.5" referrerPolicy="no-referrer" />
                      : null}
                    <span className={`text-[11px] font-black leading-tight ${selfDepositMethod === m.v ? 'text-white' : 'text-gray-700'}`}>{m.label}</span>
                    {m.sub && <span className={`text-[8px] font-medium ${selfDepositMethod === m.v ? 'text-white/70' : 'text-gray-400'}`}>{m.sub}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant (USD)</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Ex: 50"
                  value={selfDepositAmount}
                  onChange={e => setSelfDepositAmount(e.target.value)}
                  className="h-12 rounded-2xl border-gray-100 bg-gray-50 font-black text-lg pl-11"
                  min="1" step="1"
                />
                <PlusCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
              </div>
              {selfDepositAmount && !isNaN(parseFloat(selfDepositAmount)) && parseFloat(selfDepositAmount) > 0 && (
                <p className="text-xs text-gray-400 font-bold text-center">
                  ≈ {Math.round(parseFloat(selfDepositAmount) * rate).toLocaleString()} HTG
                </p>
              )}
            </div>

            {/* Info notice */}
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                Vous serez redirigé sur WhatsApp pour envoyer votre preuve de paiement. L'admin créditera votre solde après vérification.
              </p>
            </div>
          </div>

          <DialogFooter className="px-6 pb-6">
            <Button
              onClick={handleAgentSelfDeposit}
              disabled={selfDepositSubmitting || !selfDepositAmount || isNaN(parseFloat(selfDepositAmount)) || parseFloat(selfDepositAmount) <= 0}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl border-0"
            >
              {selfDepositSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Envoyer la Demande →'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Agent Success Modal ── */}
      {agentSuccessModal && (
        <Dialog open={true} onOpenChange={() => setAgentSuccessModal(null)}>
          <DialogContent className="max-w-sm rounded-3xl border-0 p-0 overflow-hidden shadow-2xl">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="overflow-hidden rounded-3xl"
            >
              <div className={`p-8 text-center ${agentSuccessModal.type === 'deposit' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-violet-500 to-purple-700'}`}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.12, type: 'spring', stiffness: 400, damping: 18 }}>
                  <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-10 w-10 text-white" />
                  </div>
                </motion.div>
                <h2 className="text-2xl font-black text-white">Transaction réussie !</h2>
                <p className="text-5xl font-black text-white mt-3 tracking-tight">
                  {Math.round(agentSuccessModal.htg).toLocaleString()} <span className="text-2xl opacity-60">HTG</span>
                </p>
                <p className="text-white/55 text-sm font-bold mt-1.5">≈ ${agentSuccessModal.usd.toFixed(2)} USD</p>
              </div>
              <div className="bg-white p-6 text-center space-y-4">
                <p className="text-gray-600 text-sm leading-relaxed">
                  {agentSuccessModal.type === 'deposit'
                    ? `Dépôt crédité sur le compte de ${agentSuccessModal.clientName}.`
                    : `Retrait confirmé pour ${agentSuccessModal.clientName}. Remettez le cash au client.`}
                </p>
                <Button
                  onClick={() => setAgentSuccessModal(null)}
                  className={`w-full h-12 rounded-2xl font-black border-0 text-white ${agentSuccessModal.type === 'deposit' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-violet-500 hover:bg-violet-600'}`}
                >
                  Fermer
                </Button>
              </div>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── QR / Barcode Scanner Modal — portaled to body so it covers the full viewport ── */}
      {scannerOpen && createPortal(
        <ScannerModal
          containerId={scannerContainerId}
          scannerRef={scannerRef}
          error={scannerError}
          setError={setScannerError}
          onClose={() => setScannerOpen(false)}
          onScan={(code) => {
            setScannerOpen(false);
            // Try to detect a structured QR tx-code (JSON produced by the client app)
            try {
              const parsed = JSON.parse(code.trim());
              if (parsed && parsed.id && parsed.tk && parsed.ty && typeof parsed.a === 'number') {
                // It's a valid client transaction QR → show confirmation flow
                setScannedTxCode({ id: parsed.id, tk: parsed.tk, ty: parsed.ty, a: parsed.a, cn: parsed.cn || 'Client' });
                setActiveSection('deposit');
                return;
              }
            } catch { /* not JSON — fall through to text search */ }
            // Plain walletId, phone, or name barcode → existing search flow
            setClientSearch(code.trim());
            setActiveSection('deposit');
            setTimeout(() => handleSearchClient(), 80);
          }}
        />,
        document.body
      )}

      {/* ── Ernst AI Assistant ── */}
      <ErnstChat agentName={agent.name} />

      {/* PIN modals */}
      <PinSetupModal
        open={pinSetupOpen}
        role="agent"
        identifier={agent?.agentCode || ''}
        onSuccess={() => setPinSetupOpen(false)}
      />
      <PinEntryModal
        open={pinModalOpen}
        title={pinModalTitle}
        description={pinModalDesc}
        onConfirm={handlePinConfirm}
        onCancel={handlePinCancel}
      />

    </div>
  );
}

// ─── QR / Barcode Scanner Modal ───────────────────────────────────────────────

interface ScannerModalProps {
  containerId: string;
  scannerRef: React.MutableRefObject<Html5Qrcode | null>;
  error: string | null;
  setError: (e: string | null) => void;
  onClose: () => void;
  onScan: (code: string) => void;
}

function ScannerModal({ containerId, scannerRef, error, setError, onClose, onScan }: ScannerModalProps) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;
    let unmounted = false;

    const start = async () => {
      try {
        // Try to resolve the camera ID without triggering a new permission prompt.
        // Html5Qrcode.getCameras() uses enumerateDevices under the hood:
        //   - If permission is already granted → returns devices with labels immediately (no prompt).
        //   - If not yet granted → triggers getUserMedia once (normal first-time prompt).
        // Using a device ID instead of { facingMode } avoids repeated permission dialogs
        // on subsequent opens because the browser doesn't re-prompt for a known device.
        let cameraConstraint: string | { facingMode: string } = { facingMode: 'environment' };
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            // Prefer the rear/back camera
            const rear = cameras.find(c =>
              /back|rear|arrière|environment/i.test(c.label)
            );
            cameraConstraint = (rear ?? cameras[cameras.length - 1]).id;
          }
        } catch {
          // getCameras failed (e.g. permission denied here already) — fall through to facingMode
        }

        if (unmounted) return;

        scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        await scanner.start(
          cameraConstraint,
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText) => {
            onScan(decodedText.trim());
          },
          () => { /* ignore per-frame errors */ }
        );
        if (!unmounted) setStarted(true);
      } catch (err: any) {
        if (unmounted) return;
        const msg: string = err?.message || String(err);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('notallowed')) {
          setError("Accès à la caméra refusé. Veuillez autoriser l'accès dans les paramètres de votre navigateur.");
        } else if (msg.toLowerCase().includes('notfound') || msg.toLowerCase().includes('no camera')) {
          setError("Aucune caméra détectée sur cet appareil.");
        } else {
          setError("Impossible de démarrer la caméra : " + msg);
        }
      }
    };

    start();

    return () => {
      unmounted = true;
      if (scanner) {
        scanner.isScanning
          ? scanner.stop().catch(() => {}).finally(() => scanner?.clear())
          : scanner.clear();
        scannerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4 bg-black/70">
        <div>
          <p className="text-white font-bold text-lg">Scanner un code client</p>
          <p className="text-white/50 text-xs mt-0.5">Pointez la caméra sur le QR code ou code-barres</p>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Viewfinder or error */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {error ? (
          <div className="text-center space-y-4 max-w-xs">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
            <p className="text-white font-bold">{error}</p>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white text-[#0A3D91] font-bold rounded-2xl active:scale-95 transition-transform"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            {/* Scanner container — html5-qrcode renders the video here */}
            <div
              id={containerId}
              className="w-full max-w-[320px] rounded-3xl overflow-hidden"
              style={{ minHeight: 320 }}
            />
            {!started && (
              <div className="flex items-center gap-3 text-white/60">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Démarrage de la caméra…</span>
              </div>
            )}
            {/* Corner guides overlay */}
            {started && (
              <p className="text-white/40 text-xs text-center">
                Alignez le code dans le cadre
              </p>
            )}
          </>
        )}
      </div>

      {/* Footer hint */}
      {!error && (
        <div className="px-6 pb-12 text-center">
          <p className="text-white/30 text-xs">
            Le scan est automatique dès que le code est détecté
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Shared Direct Transaction Form ──────────────────────────────────────────

interface DirectTxFormProps {
  type: 'deposit' | 'withdrawal';
  agent: Agent;
  rate: number;
  clientSearch: string;
  setClientSearch: (v: string) => void;
  searching: boolean;
  searchResults: FoundClient[];
  setSearchResults: (v: FoundClient[]) => void;
  foundClient: FoundClient | null;
  setFoundClient: (v: FoundClient | null) => void;
  txAmount: string;
  setTxAmount: (v: string) => void;
  txNote: string;
  setTxNote: (v: string) => void;
  txPaymentMethod: string;
  setTxPaymentMethod: (v: string) => void;
  submitting: boolean;
  onSearch: () => void;
  onSubmit: () => void;
  agentDepositCommissionPercent?: number;
  agentWithdrawPercent?: number;
  agentWithdrawAgentSharePercent?: number;
}

const PAYMENT_METHODS = [
  { value: 'MonCash',   label: 'MonCash',   sub: 'Digicel',  color: '#e53e3e' },
  { value: 'NatCash',   label: 'NatCash',   sub: 'Natcom',   color: '#2b6cb0' },
  { value: 'Lajan Cash',label: 'Lajan Cash',sub: '',         color: '#276749' },
  { value: 'Sogebank',  label: 'Sogebank',  sub: 'Banque',   color: '#1a365d' },
  { value: 'BNC',       label: 'BNC',       sub: 'Banque',   color: '#c05621' },
  { value: 'Unibank',   label: 'Unibank',   sub: 'Banque',   color: '#553c9a' },
  { value: 'BH',        label: 'BH',        sub: 'Banque',   color: '#97266d' },
  { value: 'BUH',       label: 'BUH',       sub: 'Banque',   color: '#2c7a7b' },
  { value: 'Capital Bank',label:'Capital',  sub: 'Bank',     color: '#285e61' },
  { value: 'PSB',       label: 'PSB',       sub: 'Services', color: '#744210' },
  { value: 'Virement',  label: 'Virement',  sub: 'Bancaire', color: '#4a5568' },
  { value: 'Bureau',    label: 'Bureau',    sub: 'En personne',color:'#2d3748'},
];

function DirectTxForm({
  type, agent, rate,
  clientSearch, setClientSearch, searching,
  searchResults, setSearchResults,
  foundClient, setFoundClient,
  txAmount, setTxAmount,
  txNote, setTxNote,
  txPaymentMethod, setTxPaymentMethod,
  submitting, onSearch, onSubmit,
  agentDepositCommissionPercent = 0,
  agentWithdrawPercent = 0,
  agentWithdrawAgentSharePercent = 100,
}: DirectTxFormProps) {
  const isDeposit = type === 'deposit';
  const htg = parseFloat(txAmount) || 0;
  const usd = htg > 0 ? htg / rate : 0;
  const color = isDeposit ? 'emerald' : 'rose';

  // Fee preview (authoritative calculation happens server-side)
  const depositCommission  = usd > 0 ? parseFloat((usd * agentDepositCommissionPercent / 100).toFixed(4)) : 0;
  const withdrawTotalFee   = usd > 0 ? parseFloat((usd * agentWithdrawPercent / 100).toFixed(4)) : 0;
  const withdrawAgentShare = parseFloat((withdrawTotalFee * agentWithdrawAgentSharePercent / 100).toFixed(4));
  const withdrawAdminShare = parseFloat((withdrawTotalFee - withdrawAgentShare).toFixed(4));
  const withdrawNetClient  = usd > 0 ? parseFloat((usd - withdrawTotalFee).toFixed(4)) : 0;
  const withdrawNetHTG     = htg > 0 ? Math.max(0, Math.round(htg - htg * agentWithdrawPercent / 100)) : 0;

  return (
    <Card className="rounded-[2rem] border-0 shadow-sm border border-gray-100">
      <CardContent className="p-5 space-y-4">
        {/* Multi-field client search */}
        <div>
          <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">
            Rechercher le client (téléphone, nom ou ID Wallet)
          </Label>
          <div className="flex gap-2">
            <Input
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSearch()}
              placeholder="Ex: +509..., Jean Dupont, W-..."
              className="h-12 rounded-2xl bg-gray-50 border-0 font-bold flex-1"
            />
            <Button onClick={onSearch} disabled={searching}
              className="h-12 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black border-0 shrink-0">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Multiple results list */}
        <AnimatePresence>
          {searchResults.length > 1 && !foundClient && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sélectionnez un client</p>
              {searchResults.map(r => (
                <button key={r.clientId} onClick={() => { setFoundClient(r); setSearchResults([]); }}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 border-gray-100 hover:border-primary/40 hover:bg-primary/5 text-left transition-all">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary text-sm shrink-0">
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-dark text-sm truncate">{r.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{r.phone} · {r.walletId}</p>
                  </div>
                  <p className="text-sm font-black text-emerald-600 shrink-0">${r.balance.toFixed(2)}</p>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {foundClient && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Client card */}
              <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center text-white font-black text-lg shrink-0">
                  {foundClient.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-dark truncate">{foundClient.name}</p>
                  <p className="text-xs text-gray-500 font-medium">{foundClient.phone}</p>
                  <p className="text-[10px] text-gray-400 font-mono">{foundClient.walletId}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Solde client</p>
                  <p className="text-xl font-black text-primary">${foundClient.balance.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-400">{(foundClient.balance * rate).toLocaleString()} HTG</p>
                </div>
                <button onClick={() => setFoundClient(null)} className="text-gray-300 hover:text-gray-500 ml-1">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {/* Payment method */}
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">
                  Méthode de paiement
                </Label>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                  {PAYMENT_METHODS.map(m => {
                    const active = txPaymentMethod === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setTxPaymentMethod(m.value)}
                        className={`flex-shrink-0 flex flex-col items-center justify-center rounded-2xl px-3 py-2 min-w-[64px] border-2 transition-all ${
                          active
                            ? 'border-transparent text-white shadow-lg scale-105'
                            : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'
                        }`}
                        style={active ? { background: m.color, borderColor: m.color } : {}}
                      >
                        <span className={`text-[11px] font-black leading-tight ${active ? 'text-white' : 'text-gray-700'}`}>{m.label}</span>
                        {m.sub && <span className={`text-[8px] font-medium leading-tight mt-0.5 ${active ? 'text-white/70' : 'text-gray-400'}`}>{m.sub}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount */}
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">
                  Montant (HTG)
                </Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={txAmount}
                  onChange={e => setTxAmount(e.target.value)}
                  placeholder="Ex: 2 700"
                  className="h-14 rounded-2xl bg-gray-50 border-0 font-black text-2xl text-center focus:ring-2 focus:ring-primary/20"
                />
                {htg > 0 && (
                  <div className="mt-2 rounded-2xl border border-gray-100 overflow-hidden">
                    {isDeposit ? (
                      <>
                        <div className="flex justify-between items-center px-3.5 py-2 bg-white border-b border-gray-50">
                          <span className="text-[11px] text-gray-500 font-medium">Montant crédité au client</span>
                          <span className="text-sm font-black text-gray-800">
                            {Math.round(htg).toLocaleString()} HTG
                            <span className="text-[10px] text-gray-400 ml-1">≈ ${usd.toFixed(2)}</span>
                          </span>
                        </div>
                        <div className="flex justify-between items-center px-3.5 py-2 bg-white border-b border-gray-50">
                          <span className="text-[11px] text-gray-500 font-medium">Débité sur votre solde</span>
                          <span className="text-sm font-black text-red-500">−${usd.toFixed(2)} USD</span>
                        </div>
                        {depositCommission > 0 && (
                          <div className="flex justify-between items-center px-3.5 py-2 bg-emerald-50">
                            <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wide">Votre commission</span>
                            <span className="text-sm font-black text-emerald-700">+${depositCommission.toFixed(2)} USD</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center px-3.5 py-2 bg-white border-b border-gray-50">
                          <span className="text-[11px] text-gray-500 font-medium">Débité du client</span>
                          <span className="text-sm font-black text-gray-800">
                            {Math.round(htg).toLocaleString()} HTG
                            <span className="text-[10px] text-gray-400 ml-1">≈ ${usd.toFixed(2)}</span>
                          </span>
                        </div>
                        {agentWithdrawPercent > 0 && (
                          <div className="flex justify-between items-center px-3.5 py-2 bg-white border-b border-gray-50">
                            <span className="text-[11px] text-red-500 font-medium">Frais ({agentWithdrawPercent}%)</span>
                            <span className="text-sm font-black text-red-500">−{Math.round(htg * agentWithdrawPercent / 100).toLocaleString()} HTG</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center px-3.5 py-2 bg-rose-50 border-b border-rose-100">
                          <span className="text-[11px] font-black text-rose-800 uppercase tracking-wide">À remettre au client</span>
                          <span className="text-base font-black text-rose-700">
                            {withdrawNetHTG.toLocaleString()} HTG
                            <span className="text-[10px] text-gray-400 ml-1">≈ ${withdrawNetClient.toFixed(2)}</span>
                          </span>
                        </div>
                        {withdrawAgentShare > 0 && (
                          <div className="flex justify-between items-center px-3.5 py-2 bg-emerald-50">
                            <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wide">Votre commission</span>
                            <span className="text-sm font-black text-emerald-700">+${withdrawAgentShare.toFixed(2)} USD</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {htg <= 0 && (
                  <p className="text-[11px] text-gray-400 text-center mt-1 font-medium">Saisissez un montant pour voir le détail</p>
                )}
              </div>

              {/* Warnings */}
              {isDeposit && htg > 0 && usd > agent.balance && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-600 font-bold">Votre solde agent est insuffisant (${agent.balance.toFixed(2)} disponible)</p>
                </div>
              )}
              {!isDeposit && htg > 0 && usd > foundClient.balance && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-600 font-bold">Solde client insuffisant (${foundClient.balance.toFixed(2)} disponible)</p>
                </div>
              )}

              {/* Note */}
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Note (optionnel)</Label>
                <Input
                  value={txNote}
                  onChange={e => setTxNote(e.target.value)}
                  placeholder="Ex: Remboursement, service..."
                  className="h-11 rounded-2xl bg-gray-50 border-0 font-medium"
                  maxLength={150}
                />
              </div>

              {/* Submit */}
              <Button
                onClick={onSubmit}
                disabled={submitting || !txAmount || isNaN(parseFloat(txAmount)) || parseFloat(txAmount) <= 0}
                className={`w-full h-14 rounded-2xl font-black text-white uppercase text-[11px] tracking-widest border-0 shadow-lg transition-all ${
                  isDeposit
                    ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                    : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
                }`}
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  <>
                    {isDeposit ? <ArrowDownLeft className="h-4 w-4 mr-2" /> : <ArrowUpRight className="h-4 w-4 mr-2" />}
                    {isDeposit
                      ? `Confirmer le dépôt${htg > 0 ? ` — ${Math.round(htg).toLocaleString()} HTG` : ''}`
                      : `Envoyer la demande${htg > 0 ? ` — ${Math.round(htg).toLocaleString()} HTG` : ''}`
                    }
                  </>
                )}
              </Button>
              {!isDeposit && (
                <p className="text-[10px] text-center text-rose-400 font-medium">
                  Le retrait sera effectué uniquement après confirmation du client.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
