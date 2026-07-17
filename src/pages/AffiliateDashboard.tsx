import React, { useState, useEffect } from 'react';
import { 
  useAffiliateData, 
  useTopAffiliates, 
  submitWithdrawal, 
  useAffiliateWithdrawals,
  deleteWithdrawalHistory,
  useMonthlyRankings,
  useAllAffiliates,
  getAffiliateLevelInfo,
  ensureWalletId,
  ensureCommissionWalletId,
  submitTransfer,
  submitDepositRequest,
  useWalletTransactions,
  findAffiliateByWalletId
} from '../services/affiliateService';
import { useRealtimeNotifs } from '../hooks/useRealtimeNotifs';
import { useUniversalFCM } from '../hooks/useUniversalFCM';
import NotificationBell from '../components/NotificationBell';
import PhotoUrlEditor from '../components/PhotoUrlEditor';
import { getAgentByCode, submitAgentDepositRequest } from '../services/agentService';
import { Affiliate, WithdrawalRequest, WalletTransaction, TransactionStatus } from '../types';
import { Progress } from '../components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '../components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { 
  Wallet, 
  Users, 
  Trophy, 
  ArrowUpRight, 
  History, 
  LogOut,
  Loader2,
  X,
  AlertCircle,
  TrendingUp,
  Network,
  Bell,
  CheckCircle2,
  Star,
  ChevronRight,
  MapPin,
  ArrowUp,
  PlusCircle,
  MinusCircle,
  ArrowRightLeft,
  Send,
  Download,
  AlertTriangle,
  Fingerprint,
  Copy,
  Medal,
  Calendar,
  Home,
  ShoppingBag,
  User,
  PackageSearch,
  Search,
  Share2,
  ChevronDown,
  Phone,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  XCircle,
  QrCode,
  Camera,
  ScanLine,
  Building2,
  Coins,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/apiFetch';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSettings } from '../services/parcelService';

type Tab = 'accueil' | 'reseau' | 'gains' | 'historique' | 'profil';

interface AffiliateDashboardProps {
  affiliateId: string;
  onLogout: () => void;
}

export default function AffiliateDashboard({ affiliateId, onLogout }: AffiliateDashboardProps) {
  const { affiliate, loading: affiliateLoading } = useAffiliateData(affiliateId);
  const { topAffiliates, loading: topLoading } = useTopAffiliates();
  const { rankings: monthlyRankings, loading: rankingsLoading } = useMonthlyRankings();
  const { affiliates, loading: affiliatesLoading } = useAllAffiliates();
  const { notifications, unreadCount, loading: notificationsLoading, markRead, markAllRead, clearAll } = useRealtimeNotifs('affiliate', affiliateId);
  const { transactions, loading: transactionsLoading } = useWalletTransactions(affiliateId);
  const { settings } = useSettings();
  useUniversalFCM('affiliate', affiliateId);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<Tab>('accueil');

  // Withdrawal
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'MonCash' | 'NatCash' | 'Physical' | 'Agent' | 'Admin' | 'Virement'>('MonCash');
  const [accountNumber, setAccountNumber] = useState('');
  const [agentCodeWithdraw, setAgentCodeWithdraw] = useState('');
  const [verifiedAgentNameWithdraw, setVerifiedAgentNameWithdraw] = useState<string | null>(null);
  const [isValidatingAgentWithdraw, setIsValidatingAgentWithdraw] = useState(false);

  // Transfer
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferRecipientWalletId, setTransferRecipientWalletId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [verifiedRecipientName, setVerifiedRecipientName] = useState<string | null>(null);
  const [isValidatingRecipient, setIsValidatingRecipient] = useState(false);

  // Deposit
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('MonCash');
  const [agentCode, setAgentCode] = useState('');
  const [verifiedAgentName, setVerifiedAgentName] = useState<string | null>(null);
  const [isValidatingAgent, setIsValidatingAgent] = useState(false);

  // General
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearHistoryConfirmOpen, setIsClearHistoryConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Point de Service (Agent Mode)
  type PointTab = 'deposit' | 'scan' | 'requests';
  const [pointTab, setPointTab] = useState<PointTab>('deposit');

  // QR Scanner state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scannedTxInfo, setScannedTxInfo] = useState<{ clientName: string; type: string; amount: number } | null>(null);
  const [scanConfirmLoading, setScanConfirmLoading] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied' | 'unavailable'>('unknown');

  // Phone search (shared for deposit/withdrawal direct)
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneClient, setPhoneClient] = useState<{ clientId: string; name: string; phone: string; walletId: string; balance: number } | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [directAmount, setDirectAmount] = useState('');
  const [directNote, setDirectNote] = useState('');
  const [directSubmitting, setDirectSubmitting] = useState(false);

  // Pending requests
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  // Finances personnelles
  const [affWAmount, setAffWAmount] = useState('');
  const [affWMethod, setAffWMethod] = useState<'MonCash' | 'NatCash' | 'Physical'>('MonCash');
  const [affWAccount, setAffWAccount] = useState('');
  const [affWSubmitting, setAffWSubmitting] = useState(false);
  const [affWModalOpen, setAffWModalOpen] = useState(false);

  // Wallet selector for deposit / withdrawal dialogs
  const [depositWallet, setDepositWallet] = useState<'principal' | 'commissions'>('principal');
  const [withdrawWallet, setWithdrawWallet] = useState<'principal' | 'commissions'>('principal');

  // Legacy commandes state (kept for compatibility)
  const [agentClientWalletId, setAgentClientWalletId] = useState('');
  const [agentClientName, setAgentClientName] = useState<string | null>(null);
  const [agentClientLoading, setAgentClientLoading] = useState(false);
  const [agentAmount, setAgentAmount] = useState('');
  const [agentPaymentMethod, setAgentPaymentMethod] = useState('MonCash');
  const [agentSubmitting, setAgentSubmitting] = useState(false);

  useEffect(() => {
    if (affiliate && !affiliate.walletId) ensureWalletId(affiliate);
  }, [affiliate]);

  // Recipient validation for transfer
  useEffect(() => {
    const validate = async () => {
      const trimmed = transferRecipientWalletId.trim();
      if (trimmed.length === 8) {
        setIsValidatingRecipient(true);
        try {
          const recipient = await findAffiliateByWalletId(trimmed);
          setVerifiedRecipientName(recipient ? recipient.name : null);
        } catch { setVerifiedRecipientName(null); }
        finally { setIsValidatingRecipient(false); }
      } else { setVerifiedRecipientName(null); }
    };
    validate();
  }, [transferRecipientWalletId]);

  // Agent validation for deposit
  useEffect(() => {
    const validateAgent = async () => {
      if (depositMethod === 'Agent' && agentCode.length === 8) {
        setIsValidatingAgent(true);
        try {
          const agent = await getAgentByCode(agentCode);
          setVerifiedAgentName(agent ? agent.name : null);
        } catch { setVerifiedAgentName(null); }
        finally { setIsValidatingAgent(false); }
      } else { setVerifiedAgentName(null); }
    };
    validateAgent();
  }, [agentCode, depositMethod]);

  // Agent validation for withdrawal
  useEffect(() => {
    const validateAgent = async () => {
      if (withdrawMethod === 'Agent' && agentCodeWithdraw.length === 8) {
        setIsValidatingAgentWithdraw(true);
        try {
          const agent = await getAgentByCode(agentCodeWithdraw);
          setVerifiedAgentNameWithdraw(agent ? agent.name : null);
        } catch { setVerifiedAgentNameWithdraw(null); }
        finally { setIsValidatingAgentWithdraw(false); }
      } else { setVerifiedAgentNameWithdraw(null); }
    };
    validateAgent();
  }, [agentCodeWithdraw, withdrawMethod]);

  // Client lookup for commandes tab (legacy)
  useEffect(() => {
    if (agentClientWalletId.length >= 4) {
      setAgentClientLoading(true);
      fetch(`/api/client/lookup-wallet?walletId=${encodeURIComponent(agentClientWalletId)}`)
        .then(r => r.json())
        .then(d => setAgentClientName(d.name || null))
        .catch(() => setAgentClientName(null))
        .finally(() => setAgentClientLoading(false));
    } else { setAgentClientName(null); }
  }, [agentClientWalletId]);

  // Phone search for direct transactions
  const handlePhoneSearch = async () => {
    const q = phoneInput.trim();
    if (!q) { toast.error('Entrez un téléphone, nom ou ID Wallet.'); return; }
    setPhoneLoading(true);
    setPhoneClient(null);
    try {
      const data = await apiFetch(`/api/affiliate/client-search?q=${encodeURIComponent(q)}&affiliateId=${encodeURIComponent(affiliateId)}`);
      setPhoneClient(data.client || data.results?.[0] || null);
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setPhoneLoading(false); }
  };

  // Fetch pending requests
  const fetchRequests = async () => {
    setRequestsLoading(true);
    try {
      const [wRes, dRes] = await Promise.all([
        fetch(`/api/affiliate/client-withdrawal-requests/${encodeURIComponent(affiliateId)}`),
        fetch(`/api/affiliate/client-deposit-requests/${encodeURIComponent(affiliateId)}`),
      ]);
      const [wData, dData] = await Promise.all([wRes.json(), dRes.json()]);
      setWithdrawalRequests(wData.requests || []);
      setDepositRequests(dData.requests || []);
    } catch { /* silent */ }
    finally { setRequestsLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'accueil') fetchRequests();
  }, [activeTab]);

  // (Camera permission is no longer requested on mount — affiliates have no QR scan feature)

  // Direct transaction (deposit or withdrawal)
  const handleDirectTx = async (type: 'deposit' | 'withdrawal') => {
    const usd = parseFloat(directAmount);
    if (isNaN(usd) || usd <= 0) { toast.error('Montant invalide.'); return; }
    if (!phoneClient) { toast.error('Recherchez un client d\'abord.'); return; }
    setDirectSubmitting(true);
    try {
      await apiFetch('/api/affiliate/client-direct-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId, clientId: phoneClient.clientId, type, amount: usd, note: directNote.trim() || undefined }),
      });
      const label = type === 'deposit' ? 'Dépôt' : 'Retrait';
      toast.success(`${label} de $${usd.toFixed(2)} ${type === 'deposit' ? 'crédité' : 'débité'} pour ${phoneClient.name} !`);
      setPhoneInput(''); setPhoneClient(null); setDirectAmount(''); setDirectNote('');
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setDirectSubmitting(false); }
  };

  // Confirm/reject withdrawal request
  const handleConfirmWithdrawal = async (txId: string) => {
    setProcessingRequestId(txId);
    try {
      await apiFetch(`/api/affiliate/client-withdrawal/${txId}/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId }),
      });
      toast.success('Retrait confirmé ! Solde mis à jour.');
      fetchRequests();
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setProcessingRequestId(null); }
  };

  const handleRejectWithdrawal = async (txId: string) => {
    setProcessingRequestId(txId);
    try {
      await apiFetch(`/api/affiliate/client-withdrawal/${txId}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId, reason: 'Refusé par l\'affilié' }),
      });
      toast.success('Demande rejetée.');
      fetchRequests();
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setProcessingRequestId(null); }
  };

  // Confirm/reject deposit request
  const handleConfirmDeposit = async (txId: string) => {
    setProcessingRequestId(txId);
    try {
      await apiFetch(`/api/affiliate/client-deposit/${txId}/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId }),
      });
      toast.success('Dépôt confirmé ! Client crédité.');
      fetchRequests();
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setProcessingRequestId(null); }
  };

  const handleRejectDeposit = async (txId: string) => {
    setProcessingRequestId(txId);
    try {
      await apiFetch(`/api/affiliate/client-deposit/${txId}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId, reason: 'Refusé par l\'affilié' }),
      });
      toast.success('Demande rejetée.');
      fetchRequests();
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setProcessingRequestId(null); }
  };

  // QR scanner handlers
  const handleScannedCode = (raw: string) => {
    setScanResult(raw);
    // Parse display info from QR payload
    try {
      const parsed = JSON.parse(raw);
      if (parsed.ty && parsed.a !== undefined && parsed.cn) {
        setScannedTxInfo({ clientName: parsed.cn, type: parsed.ty, amount: parseFloat(parsed.a) });
      } else {
        setScannedTxInfo(null);
      }
    } catch { setScannedTxInfo(null); }
  };

  const handleConfirmScan = async () => {
    if (!scanResult) return;
    setScanConfirmLoading(true);
    try {
      const data = await apiFetch('/api/affiliate/scan-tx-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId, codeData: scanResult }),
      });
      toast.success(data.message || 'Transaction traitée avec succès !');
      setScanResult(null);
      setScannedTxInfo(null);
      setScanning(false);
      fetchRequests();
    } catch (e: any) { toast.error(e.message || 'Erreur réseau.'); }
    finally { setScanConfirmLoading(false); }
  };

  const startQrScanner = async () => {
    setScanResult(null);
    setScannedTxInfo(null);

    // Render the scanner div first — no preflight getUserMedia needed.
    // The double camera acquisition (preflight + Html5Qrcode) caused failures on many devices.
    // Html5Qrcode handles the permission request itself.
    setScanning(true);

    // Wait for React to commit the render before Html5Qrcode looks for the div
    await new Promise(r => setTimeout(r, 200));

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-scanner-affiliate');

      const onSuccess = (decodedText: string) => {
        scanner.stop().catch(() => {});
        setScanning(false);
        handleScannedCode(decodedText);
      };
      const onError = (_err: any) => { /* ignore per-frame scan errors */ };

      // Try back camera first, fall back to front camera
      try {
        await scanner.start(
          { facingMode: { ideal: 'environment' } },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          onSuccess, onError
        );
      } catch {
        await scanner.start(
          { facingMode: 'user' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          onSuccess, onError
        );
      }
    } catch (e: any) {
      setScanning(false);
      const name = (e?.name || '').toLowerCase();
      const msg  = (e?.message || '').toLowerCase();
      if (name.includes('notallowed') || name.includes('permission') || msg.includes('denied') || msg.includes('permission')) {
        toast.error('Permission caméra refusée. Allez dans les paramètres du navigateur et autorisez l\'accès caméra pour ce site.');
      } else if (name.includes('notfound') || msg.includes('not found') || msg.includes('no camera')) {
        toast.error('Aucune caméra détectée sur cet appareil.');
      } else if (name.includes('notreadable') || msg.includes('in use')) {
        toast.error('La caméra est déjà utilisée par une autre application. Fermez-la et réessayez.');
      } else {
        toast.error('Erreur d\'accès caméra. Vérifiez les autorisations dans les paramètres du navigateur.');
      }
    }
  };

  const copyWalletId = () => {
    if (affiliate?.walletId) {
      navigator.clipboard.writeText(affiliate.walletId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('ID Wallet copié !');
    }
  };

  const copyReferralCode = () => {
    if (affiliate?.code) {
      navigator.clipboard.writeText(affiliate.code);
      toast.success('Code de parrainage copié !');
    }
  };

  const levelInfo = React.useMemo(() => {
    if (!affiliate) return null;
    return getAffiliateLevelInfo(affiliate.points || 0);
  }, [affiliate?.points]);

  const rankingPosition = React.useMemo(() => {
    if (!affiliate) return 0;
    return topAffiliates.findIndex(a => a.id === affiliate.id) + 1;
  }, [topAffiliates, affiliate?.id]);

  const winnersQueue = React.useMemo(() => {
    return [...affiliates]
      .filter(a => (a.points || 0) > 0)
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 3);
  }, [affiliates]);

  // unreadCount comes from useRealtimeNotifs
  const recentTx = transactions.slice(0, 5);

  // Ensure both wallet IDs exist
  useEffect(() => {
    if (affiliate && !affiliateLoading) {
      if (!affiliate.walletId) ensureWalletId(affiliate).catch(() => {});
      if (!affiliate.commissionWalletId) ensureCommissionWalletId(affiliate).catch(() => {});
    }
  }, [affiliate?.id, affiliateLoading]);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Montant invalide.'); return; }
    const walletBalance = withdrawWallet === 'commissions' ? (affiliate!.commissionBalance || 0) : affiliate!.balance;
    if (amount > walletBalance) { toast.error('Solde insuffisant.'); return; }
    const exchangeRate = settings?.exchangeRate || 146;
    const minWithdrawUSD = 20 / exchangeRate;
    if (amount < minWithdrawUSD) { toast.error(`Montant minimum: ${(20 / exchangeRate).toFixed(2)} $`); return; }
    if (withdrawMethod === 'Agent' && !verifiedAgentNameWithdraw) { toast.error('Agent non identifié.'); return; }
    if (withdrawMethod !== 'Physical' && withdrawMethod !== 'Agent' && !accountNumber.trim()) { toast.error('Numéro de compte requis.'); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/affiliate/submit-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateId,
          amount,
          method: withdrawMethod,
          accountNumber: withdrawMethod === 'Physical' ? 'Bureau Juvénat' : withdrawMethod === 'Agent' ? `Agent: ${agentCodeWithdraw}` : accountNumber.trim(),
          walletType: withdrawWallet,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      toast.success("Demande de retrait soumise ! Vous recevrez un email de confirmation.");
      setIsWithdrawModalOpen(false); setWithdrawAmount(''); setAccountNumber(''); setWithdrawWallet('principal');
      setAgentCodeWithdraw(''); setVerifiedAgentNameWithdraw(null);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du retrait.');
    } finally { setIsSubmitting(false); }
  };

  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Montant invalide.'); return; }
    if (!verifiedRecipientName) { toast.error('Bénéficiaire non identifié.'); return; }
    setIsSubmitting(true);
    try {
      const recipientName = await submitTransfer(affiliate!, transferRecipientWalletId.trim(), amount);
      toast.success(`Transfert de ${amount} $ vers ${recipientName} soumis.`);
      setIsTransferModalOpen(false); setTransferAmount(''); setTransferRecipientWalletId(''); setVerifiedRecipientName(null);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du transfert.');
    } finally { setIsSubmitting(false); }
  };

  const handleDepositRequest = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Montant invalide.'); return; }
    if (depositMethod === 'Agent' && !verifiedAgentName) { toast.error('Agent non identifiable.'); return; }
    setIsSubmitting(true);
    try {
      const walletLabel = depositWallet === 'commissions' ? 'Wallet Commissions' : 'Wallet Principal';
      if (depositMethod === 'Agent') {
        await submitAgentDepositRequest(affiliateId, agentCode, amount);
        toast.success("Demande envoyée à l'agent !");
      } else {
        const res = await fetch('/api/affiliate/submit-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ affiliateId, amount, method: depositMethod, walletType: depositWallet }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur serveur');
        toast.success('Demande de dépôt soumise !');
        const adminPhone = settings?.whatsappAdminNumber || '+50944813185';
        const msg = `Bonjour Admin, je souhaite effectuer un dépôt sur mon compte Rena.\n\nMontant: ${amount} $\nMéthode: ${depositMethod}\nWallet: ${walletLabel}\nID Wallet: ${affiliate!.walletId}\nNom: ${affiliate!.name}`;
        window.open(`https://wa.me/${adminPhone}?text=${encodeURIComponent(msg)}`, '_blank');
      }
      setIsDepositModalOpen(false); setDepositAmount(''); setAgentCode(''); setDepositWallet('principal');
    } catch (error: any) {
      toast.error(error.message || "Échec de l'envoi.");
    } finally { setIsSubmitting(false); }
  };

  const handleClearTransactionHistory = async () => {
    setIsSubmitting(true);
    try {
      await deleteWithdrawalHistory(affiliateId);
      toast.success('Historique vidé !');
      setIsClearHistoryConfirmOpen(false);
    } catch { toast.error('Erreur.'); }
    finally { setIsSubmitting(false); }
  };

  const handleAgentSubmitDeposit = async () => {
    const amount = parseFloat(agentAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Montant invalide.'); return; }
    if (!agentClientName) { toast.error('Client non identifié.'); return; }
    setAgentSubmitting(true);
    try {
      const res = await fetch('/api/affiliate/submit-client-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId, clientWalletId: agentClientWalletId, amount, method: agentPaymentMethod }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      toast.success(`Dépôt de $${amount} soumis pour ${agentClientName} !`);
      setAgentClientWalletId(''); setAgentClientName(null); setAgentAmount('');
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de la soumission.');
    } finally { setAgentSubmitting(false); }
  };

  // Retrait personnel affilié (via API avec email)
  const handleAffiliateWithdraw = async () => {
    const amount = parseFloat(affWAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Montant invalide.'); return; }
    if (amount > (affiliate?.balance || 0)) { toast.error('Solde insuffisant.'); return; }
    if (affWMethod !== 'Physical' && !affWAccount.trim()) { toast.error('Numéro de compte requis.'); return; }
    setAffWSubmitting(true);
    try {
      const res = await fetch('/api/affiliate/submit-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateId,
          amount,
          method: affWMethod,
          accountNumber: affWMethod === 'Physical' ? 'Bureau Juvénat' : affWAccount.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      toast.success('Demande de retrait soumise ! Un email de confirmation a été envoyé.');
      setAffWModalOpen(false); setAffWAmount(''); setAffWAccount(''); setAffWMethod('MonCash');
    } catch (e: any) {
      toast.error(e.message || 'Erreur réseau.');
    } finally { setAffWSubmitting(false); }
  };

  const getTransactionStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case 'completed':
      case 'approved': return <Badge className="bg-green-100 text-green-700 border-green-200 text-[9px] font-black">Complété</Badge>;
      case 'rejected': return <Badge className="bg-red-100 text-red-700 border-red-200 text-[9px] font-black">Rejeté</Badge>;
      default: return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] font-black">En attente</Badge>;
    }
  };

  if (affiliateLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!affiliate) return null;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'accueil', label: 'Accueil', icon: Home },
    { id: 'reseau', label: 'Réseau', icon: Users },
    { id: 'gains', label: 'Gains', icon: TrendingUp },
    { id: 'historique', label: 'Historique', icon: History },
    { id: 'profil', label: 'Profil', icon: User },
  ];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Fixed Header ── */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 h-14">
        <div className="flex items-center justify-between h-full px-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-black text-sm shrink-0">
              {affiliate.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-black text-dark leading-none truncate max-w-[160px]">{affiliate.name}</p>
              <p className="text-[10px] text-gray-400 font-mono">#{affiliate.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              loading={notificationsLoading}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
              onClearAll={clearAll}
            />
            <button onClick={onLogout}
              className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="pt-14 pb-[68px] max-w-2xl mx-auto">

        {/* ═══ ACCUEIL ═══ */}
        {activeTab === 'accueil' && (
          <div className="p-4 space-y-4">

            {/* Dual Wallet Cards */}
            <div className="grid grid-cols-2 gap-3">

              {/* Wallet Principal */}
              <div className="relative rounded-[2rem] bg-gradient-to-br from-primary via-blue-600 to-indigo-700 p-4 text-white overflow-hidden shadow-xl shadow-primary/20">
                <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/5 rounded-full" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[8px] font-black text-white/60 uppercase tracking-widest">Wallet Principal</p>
                    <Badge className="bg-white/15 text-white border-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0">
                      {levelInfo?.level || 'Bronze'}
                    </Badge>
                  </div>
                  <p className="text-[8px] text-white/50 font-black uppercase tracking-widest">Solde Disponible</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl font-black tabular-nums leading-none">{(affiliate.balance || 0).toLocaleString()}</span>
                    <span className="text-sm font-bold text-white/60">$</span>
                  </div>
                  <p className="text-[9px] text-white/40 mt-0.5">≈ {Math.round((affiliate.balance || 0) * (settings?.exchangeRate || 146)).toLocaleString()} HTG</p>
                  <button onClick={copyWalletId} className="flex items-center gap-1 mt-3 pt-2.5 border-t border-white/10 group w-full">
                    <p className="text-[8px] text-white/40 font-black uppercase tracking-widest shrink-0">ID</p>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-mono font-black text-white/70 text-[9px] tracking-wider truncate">{affiliate.walletId || '........'}</span>
                      {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-300 shrink-0" /> : <Copy className="h-2.5 w-2.5 text-white/30 shrink-0 group-hover:text-white/60 transition-colors" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Wallet Commissions */}
              <div className="relative rounded-[2rem] bg-gradient-to-br from-amber-400 to-orange-500 p-4 text-white overflow-hidden shadow-xl shadow-amber-200">
                <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[8px] font-black text-amber-100 uppercase tracking-widest">Wallet Commissions</p>
                    <TrendingUp className="h-3.5 w-3.5 text-white/50" />
                  </div>
                  <p className="text-[8px] text-white/60 font-black uppercase tracking-widest">Gains Cumulés</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl font-black tabular-nums leading-none">{(affiliate.totalEarnings || 0).toLocaleString()}</span>
                    <span className="text-sm font-bold text-white/60">$</span>
                  </div>
                  <p className="text-[9px] text-amber-100/60 mt-0.5">≈ {Math.round((affiliate.totalEarnings || 0) * (settings?.exchangeRate || 146)).toLocaleString()} HTG</p>
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/10">
                    <p className="text-[8px] text-white/50 font-black uppercase tracking-widest">Score</p>
                    <p className="font-black text-white/80 text-sm">{affiliate.points || 0} pts</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-3">
              <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
                <DialogTrigger render={
                  <button className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200">
                      <PlusCircle className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Dépôt</span>
                  </button>
                } />
                <DialogContent className="w-[96%] sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl">
                  {/* Header */}
                  <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 p-6 pb-8">
                    <DialogClose className="absolute right-4 top-4 rounded-full bg-white/20 p-1.5 hover:bg-white/30 transition-colors">
                      <X className="h-4 w-4 text-white" />
                    </DialogClose>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center">
                        <PlusCircle className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <DialogTitle className="text-lg font-black text-white leading-tight">Recharger mon Compte</DialogTitle>
                        <DialogDescription className="text-emerald-100 text-[11px] font-medium">Choisissez votre méthode de paiement</DialogDescription>
                      </div>
                    </div>
                    {/* Wallet pills */}
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => setDepositWallet('principal')}
                        className={`flex-1 rounded-2xl px-3 py-2.5 text-left transition-all border-2 ${depositWallet === 'principal' ? 'bg-white border-white shadow-lg' : 'bg-white/15 border-white/30 hover:bg-white/25'}`}>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${depositWallet === 'principal' ? 'text-emerald-600' : 'text-white/70'}`}>Principal</p>
                        <p className={`text-base font-black ${depositWallet === 'principal' ? 'text-emerald-700' : 'text-white'}`}>{(affiliate.balance || 0).toFixed(2)} $</p>
                      </button>
                      <button onClick={() => setDepositWallet('commissions')}
                        className={`flex-1 rounded-2xl px-3 py-2.5 text-left transition-all border-2 ${depositWallet === 'commissions' ? 'bg-white border-white shadow-lg' : 'bg-white/15 border-white/30 hover:bg-white/25'}`}>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${depositWallet === 'commissions' ? 'text-amber-600' : 'text-white/70'}`}>Commissions</p>
                        <p className={`text-base font-black ${depositWallet === 'commissions' ? 'text-amber-700' : 'text-white'}`}>{(affiliate.commissionBalance || 0).toFixed(2)} $</p>
                        {affiliate.commissionWalletId && <p className={`text-[8px] font-mono mt-0.5 ${depositWallet === 'commissions' ? 'text-amber-500' : 'text-white/40'}`}>#{affiliate.commissionWalletId}</p>}
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
                    {/* Payment method cards */}
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Méthode de paiement</p>
                      <div className="grid grid-cols-2 gap-2.5">
                        {/* MonCash */}
                        <button onClick={() => setDepositMethod('MonCash')}
                          className={`relative rounded-2xl p-3.5 border-2 text-left transition-all ${depositMethod === 'MonCash' ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                          {depositMethod === 'MonCash' && <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle2 className="h-2.5 w-2.5 text-white fill-white" /></div>}
                          <div className="h-9 w-9 rounded-xl bg-red-50 flex items-center justify-center mb-2 overflow-hidden">
                            {settings?.moncashLogoUrl ? <img src={settings.moncashLogoUrl} alt="MonCash" className="h-7 w-7 object-contain" referrerPolicy="no-referrer" /> : <Smartphone className="h-5 w-5 text-red-500" />}
                          </div>
                          <p className="text-xs font-black text-gray-800">MonCash</p>
                          <p className="text-[10px] text-gray-400 font-medium">Digicel</p>
                        </button>

                        {/* NatCash */}
                        <button onClick={() => setDepositMethod('NatCash')}
                          className={`relative rounded-2xl p-3.5 border-2 text-left transition-all ${depositMethod === 'NatCash' ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                          {depositMethod === 'NatCash' && <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle2 className="h-2.5 w-2.5 text-white fill-white" /></div>}
                          <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center mb-2 overflow-hidden">
                            {settings?.natcashLogoUrl ? <img src={settings.natcashLogoUrl} alt="NatCash" className="h-7 w-7 object-contain" referrerPolicy="no-referrer" /> : <Smartphone className="h-5 w-5 text-blue-500" />}
                          </div>
                          <p className="text-xs font-black text-gray-800">NatCash</p>
                          <p className="text-[10px] text-gray-400 font-medium">Natcom</p>
                        </button>

                        {/* Via Agent */}
                        <button onClick={() => { setDepositMethod('Agent'); setAgentCode(''); setVerifiedAgentName(null); }}
                          className={`relative rounded-2xl p-3.5 border-2 text-left transition-all ${depositMethod === 'Agent' ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                          {depositMethod === 'Agent' && <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle2 className="h-2.5 w-2.5 text-white fill-white" /></div>}
                          <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center mb-2">
                            <Users className="h-5 w-5 text-indigo-500" />
                          </div>
                          <p className="text-xs font-black text-gray-800">Via Agent</p>
                          <p className="text-[10px] text-gray-400 font-medium">Physique</p>
                        </button>

                        {/* Virement */}
                        <button onClick={() => setDepositMethod('Virement')}
                          className={`relative rounded-2xl p-3.5 border-2 text-left transition-all ${depositMethod === 'Virement' ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                          {depositMethod === 'Virement' && <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle2 className="h-2.5 w-2.5 text-white fill-white" /></div>}
                          <div className="h-9 w-9 rounded-xl bg-violet-50 flex items-center justify-center mb-2">
                            <Building2 className="h-5 w-5 text-violet-500" />
                          </div>
                          <p className="text-xs font-black text-gray-800">Virement</p>
                          <p className="text-[10px] text-gray-400 font-medium">Bancaire</p>
                        </button>

                        {/* Crypto */}
                        <button onClick={() => setDepositMethod('Crypto')}
                          className={`relative rounded-2xl p-3.5 border-2 text-left transition-all ${depositMethod === 'Crypto' ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                          {depositMethod === 'Crypto' && <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle2 className="h-2.5 w-2.5 text-white fill-white" /></div>}
                          <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center mb-2">
                            <Coins className="h-5 w-5 text-amber-500" />
                          </div>
                          <p className="text-xs font-black text-gray-800">Crypto</p>
                          <p className="text-[10px] text-gray-400 font-medium">USDT / BTC</p>
                        </button>

                        {/* Admin */}
                        <button onClick={() => setDepositMethod('Admin')}
                          className={`relative rounded-2xl p-3.5 border-2 text-left transition-all ${depositMethod === 'Admin' ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                          {depositMethod === 'Admin' && <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle2 className="h-2.5 w-2.5 text-white fill-white" /></div>}
                          <div className="h-9 w-9 rounded-xl bg-rose-50 flex items-center justify-center mb-2">
                            <ShieldCheck className="h-5 w-5 text-rose-500" />
                          </div>
                          <p className="text-xs font-black text-gray-800">Admin</p>
                          <p className="text-[10px] text-gray-400 font-medium">Espèces directes</p>
                        </button>
                      </div>
                    </div>

                    {/* Agent code field */}
                    {depositMethod === 'Agent' && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Code Agent (8 chiffres)</Label>
                        <div className="relative">
                          <Input maxLength={8} placeholder="Entrez le code agent" value={agentCode}
                            onChange={e => setAgentCode(e.target.value)}
                            className="h-12 rounded-2xl border-gray-100 bg-gray-50 font-black text-lg tracking-[0.2em] pl-11" />
                          <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500" />
                          {isValidatingAgent && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-indigo-500" />}
                        </div>
                        {verifiedAgentName && (
                          <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <span className="text-xs font-black text-emerald-700">Agent : {verifiedAgentName}</span>
                          </div>
                        )}
                        {!verifiedAgentName && agentCode.length === 8 && !isValidatingAgent && (
                          <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-xs font-black text-red-700">Agent introuvable.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Amount */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant ($)</Label>
                      <div className="relative">
                        <Input type="number" placeholder="Ex: 50" value={depositAmount}
                          onChange={e => setDepositAmount(e.target.value)}
                          className="h-13 rounded-2xl border-gray-100 bg-gray-50 font-black text-xl pl-12 focus:ring-2 focus:ring-emerald-300" />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-lg">$</span>
                      </div>
                      {/* Quick amounts */}
                      <div className="flex gap-2 flex-wrap">
                        {[10, 25, 50, 100].map(v => (
                          <button key={v} onClick={() => setDepositAmount(String(v))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${depositAmount === String(v) ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-emerald-300 hover:text-emerald-600'}`}>
                            {v} $
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-2xl flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-800 font-bold leading-relaxed">L'admin contactera sur WhatsApp pour valider le transfert avant de créditer votre compte.</p>
                    </div>

                    <Button onClick={handleDepositRequest} disabled={isSubmitting} className="w-full h-13 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 text-base transition-all active:scale-[0.98]">
                      {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Envoyer la Demande →</>}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
                <DialogTrigger render={
                  <button className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-200">
                      <MinusCircle className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-700">Retrait</span>
                  </button>
                } />
                <DialogContent className="w-[96%] sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl">
                  {/* Header */}
                  <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 p-6 pb-8">
                    <DialogClose className="absolute right-4 top-4 rounded-full bg-white/20 p-1.5 hover:bg-white/30 transition-colors">
                      <X className="h-4 w-4 text-white" />
                    </DialogClose>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center">
                        <MinusCircle className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <DialogTitle className="text-lg font-black text-white leading-tight">Retrait de Fonds</DialogTitle>
                        <DialogDescription className="text-indigo-100 text-[11px] font-medium">Choisissez votre méthode de retrait</DialogDescription>
                      </div>
                    </div>
                    {/* Wallet pills */}
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => setWithdrawWallet('principal')}
                        className={`flex-1 rounded-2xl px-3 py-2.5 text-left transition-all border-2 ${withdrawWallet === 'principal' ? 'bg-white border-white shadow-lg' : 'bg-white/15 border-white/30 hover:bg-white/25'}`}>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${withdrawWallet === 'principal' ? 'text-indigo-600' : 'text-white/70'}`}>Principal</p>
                        <p className={`text-base font-black ${withdrawWallet === 'principal' ? 'text-indigo-700' : 'text-white'}`}>{(affiliate.balance || 0).toFixed(2)} $</p>
                      </button>
                      <button onClick={() => setWithdrawWallet('commissions')}
                        className={`flex-1 rounded-2xl px-3 py-2.5 text-left transition-all border-2 ${withdrawWallet === 'commissions' ? 'bg-white border-white shadow-lg' : 'bg-white/15 border-white/30 hover:bg-white/25'}`}>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${withdrawWallet === 'commissions' ? 'text-amber-600' : 'text-white/70'}`}>Commissions</p>
                        <p className={`text-base font-black ${withdrawWallet === 'commissions' ? 'text-amber-700' : 'text-white'}`}>{(affiliate.commissionBalance || 0).toFixed(2)} $</p>
                        {affiliate.commissionWalletId && <p className={`text-[8px] font-mono mt-0.5 ${withdrawWallet === 'commissions' ? 'text-amber-500' : 'text-white/40'}`}>#{affiliate.commissionWalletId}</p>}
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
                    {/* Payment method cards */}
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Méthode de retrait</p>
                      <div className="grid grid-cols-2 gap-2.5">
                        {/* MonCash */}
                        <button onClick={() => { setWithdrawMethod('MonCash'); setAccountNumber(''); setAgentCodeWithdraw(''); setVerifiedAgentNameWithdraw(null); }}
                          className={`relative rounded-2xl p-3.5 border-2 text-left transition-all ${withdrawMethod === 'MonCash' ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                          {withdrawMethod === 'MonCash' && <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center"><CheckCircle2 className="h-2.5 w-2.5 text-white fill-white" /></div>}
                          <div className="h-9 w-9 rounded-xl bg-red-50 flex items-center justify-center mb-2 overflow-hidden">
                            {settings?.moncashLogoUrl ? <img src={settings.moncashLogoUrl} alt="MonCash" className="h-7 w-7 object-contain" referrerPolicy="no-referrer" /> : <Smartphone className="h-5 w-5 text-red-500" />}
                          </div>
                          <p className="text-xs font-black text-gray-800">MonCash</p>
                          <p className="text-[10px] text-gray-400 font-medium">Digicel</p>
                        </button>

                        {/* NatCash */}
                        <button onClick={() => { setWithdrawMethod('NatCash'); setAccountNumber(''); setAgentCodeWithdraw(''); setVerifiedAgentNameWithdraw(null); }}
                          className={`relative rounded-2xl p-3.5 border-2 text-left transition-all ${withdrawMethod === 'NatCash' ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                          {withdrawMethod === 'NatCash' && <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center"><CheckCircle2 className="h-2.5 w-2.5 text-white fill-white" /></div>}
                          <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center mb-2 overflow-hidden">
                            {settings?.natcashLogoUrl ? <img src={settings.natcashLogoUrl} alt="NatCash" className="h-7 w-7 object-contain" referrerPolicy="no-referrer" /> : <Smartphone className="h-5 w-5 text-blue-500" />}
                          </div>
                          <p className="text-xs font-black text-gray-800">NatCash</p>
                          <p className="text-[10px] text-gray-400 font-medium">Natcom</p>
                        </button>

                        {/* Via Agent */}
                        <button onClick={() => { setWithdrawMethod('Agent'); setAccountNumber(''); setAgentCodeWithdraw(''); setVerifiedAgentNameWithdraw(null); }}
                          className={`relative rounded-2xl p-3.5 border-2 text-left transition-all ${withdrawMethod === 'Agent' ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                          {withdrawMethod === 'Agent' && <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center"><CheckCircle2 className="h-2.5 w-2.5 text-white fill-white" /></div>}
                          <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center mb-2">
                            <Users className="h-5 w-5 text-indigo-500" />
                          </div>
                          <p className="text-xs font-black text-gray-800">Via Agent</p>
                          <p className="text-[10px] text-gray-400 font-medium">Physique</p>
                        </button>

                        {/* Virement */}
                        <button onClick={() => { setWithdrawMethod('Virement'); setAccountNumber(''); setAgentCodeWithdraw(''); setVerifiedAgentNameWithdraw(null); }}
                          className={`relative rounded-2xl p-3.5 border-2 text-left transition-all ${withdrawMethod === 'Virement' ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                          {withdrawMethod === 'Virement' && <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center"><CheckCircle2 className="h-2.5 w-2.5 text-white fill-white" /></div>}
                          <div className="h-9 w-9 rounded-xl bg-violet-50 flex items-center justify-center mb-2">
                            <Building2 className="h-5 w-5 text-violet-500" />
                          </div>
                          <p className="text-xs font-black text-gray-800">Virement</p>
                          <p className="text-[10px] text-gray-400 font-medium">Bancaire</p>
                        </button>

                        {/* Admin */}
                        <button onClick={() => { setWithdrawMethod('Admin'); setAccountNumber(''); setAgentCodeWithdraw(''); setVerifiedAgentNameWithdraw(null); }}
                          className={`relative rounded-2xl p-3.5 border-2 text-left transition-all ${withdrawMethod === 'Admin' ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                          {withdrawMethod === 'Admin' && <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center"><CheckCircle2 className="h-2.5 w-2.5 text-white fill-white" /></div>}
                          <div className="h-9 w-9 rounded-xl bg-rose-50 flex items-center justify-center mb-2">
                            <ShieldCheck className="h-5 w-5 text-rose-500" />
                          </div>
                          <p className="text-xs font-black text-gray-800">Admin</p>
                          <p className="text-[10px] text-gray-400 font-medium">Espèces directes</p>
                        </button>

                        {/* Bureau Juvénat */}
                        <button onClick={() => { setWithdrawMethod('Physical'); setAccountNumber(''); setAgentCodeWithdraw(''); setVerifiedAgentNameWithdraw(null); }}
                          className={`relative rounded-2xl p-3.5 border-2 text-left transition-all ${withdrawMethod === 'Physical' ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                          {withdrawMethod === 'Physical' && <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center"><CheckCircle2 className="h-2.5 w-2.5 text-white fill-white" /></div>}
                          <div className="h-9 w-9 rounded-xl bg-teal-50 flex items-center justify-center mb-2">
                            <MapPin className="h-5 w-5 text-teal-500" />
                          </div>
                          <p className="text-xs font-black text-gray-800">Bureau</p>
                          <p className="text-[10px] text-gray-400 font-medium">Juvénat</p>
                        </button>
                      </div>
                    </div>

                    {/* Agent code */}
                    {withdrawMethod === 'Agent' && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Code Agent (8 chiffres)</Label>
                        <div className="relative">
                          <Input maxLength={8} placeholder="Entrez le code agent" value={agentCodeWithdraw}
                            onChange={e => setAgentCodeWithdraw(e.target.value)}
                            className="h-12 rounded-2xl border-gray-100 bg-gray-50 font-black text-lg tracking-[0.2em] pl-11" />
                          <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500" />
                          {isValidatingAgentWithdraw && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-indigo-500" />}
                        </div>
                        {verifiedAgentNameWithdraw && (
                          <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <span className="text-xs font-black text-emerald-700">Agent : {verifiedAgentNameWithdraw}</span>
                          </div>
                        )}
                        {!verifiedAgentNameWithdraw && agentCodeWithdraw.length === 8 && !isValidatingAgentWithdraw && (
                          <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-xs font-black text-red-700">Agent introuvable.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Numéro de compte (sauf Physical et Agent) */}
                    {withdrawMethod !== 'Physical' && withdrawMethod !== 'Agent' && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {withdrawMethod === 'Virement' ? 'Numéro de compte / IBAN' : 'Numéro de compte'}
                        </Label>
                        <Input
                          placeholder={withdrawMethod === 'Virement' ? 'IBAN ou n° de compte' : 'Ex: 44XXXXXX'}
                          value={accountNumber} onChange={e => setAccountNumber(e.target.value)}
                          className="h-12 rounded-2xl border-gray-100 bg-gray-50 font-black text-lg"
                        />
                      </div>
                    )}

                    {/* Info bureau */}
                    {withdrawMethod === 'Physical' && (
                      <div className="bg-teal-50 border border-teal-100 p-3.5 rounded-2xl flex items-start gap-2.5">
                        <MapPin className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-teal-800 font-bold leading-relaxed">Le retrait s'effectue à notre bureau de Juvénat sur présentation d'une pièce d'identité.</p>
                      </div>
                    )}

                    {/* Montant */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant ($)</Label>
                      <div className="relative">
                        <Input type="number" placeholder={`Min ${(20 / (settings?.exchangeRate || 146)).toFixed(2)}`}
                          value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                          className="h-13 rounded-2xl border-gray-100 bg-gray-50 font-black text-xl pl-12 focus:ring-2 focus:ring-indigo-300" />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 font-black text-lg">$</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {[10, 25, 50, 100].map(v => (
                          <button key={v} onClick={() => setWithdrawAmount(String(v))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${withdrawAmount === String(v) ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-indigo-300 hover:text-indigo-600'}`}>
                            {v} $
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold">
                        Solde {withdrawWallet === 'commissions' ? 'Commissions' : 'Principal'} : {withdrawWallet === 'commissions' ? (affiliate.commissionBalance || 0).toFixed(2) : (affiliate.balance || 0).toFixed(2)} $
                      </p>
                    </div>

                    <Button onClick={handleWithdraw} disabled={isSubmitting} className="w-full h-13 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 text-base transition-all active:scale-[0.98]">
                      {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Confirmer le Retrait →</>}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
                <DialogTrigger render={
                  <button className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95">
                    <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-200">
                      <ArrowRightLeft className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-700">Transfert</span>
                  </button>
                } />
                <DialogContent className="w-[94%] sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl">
                  <DialogHeader className="p-7 bg-blue-600 text-white relative">
                    <DialogTitle className="text-xl font-black">Transfert Entre Affiliés</DialogTitle>
                    <DialogDescription className="text-blue-100 text-sm">Envoyez des dollars instantanément à un autre membre.</DialogDescription>
                    <DialogClose className="absolute right-5 top-5 rounded-full bg-white/20 p-1.5 hover:bg-white/30 transition-colors">
                      <X className="h-4 w-4" />
                    </DialogClose>
                  </DialogHeader>
                  <div className="p-7 space-y-5 max-h-[70vh] overflow-y-auto">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ID Wallet Destinataire</Label>
                      <div className="relative">
                        <Input maxLength={8} placeholder="8 chiffres" value={transferRecipientWalletId}
                          onChange={e => setTransferRecipientWalletId(e.target.value)}
                          className="h-12 rounded-2xl border-gray-100 bg-gray-50 font-black text-lg tracking-[0.2em] pl-11" />
                        <Fingerprint className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
                        {isValidatingRecipient && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />}
                      </div>
                      {verifiedRecipientName && (
                        <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-xs font-black text-emerald-700">Destinataire : {verifiedRecipientName}</span>
                        </div>
                      )}
                      {!verifiedRecipientName && transferRecipientWalletId.length === 8 && !isValidatingRecipient && (
                        <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <span className="text-xs font-black text-red-700">Aucun affilié trouvé.</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant ($)</Label>
                      <div className="relative">
                        <Input type="number" placeholder="0.00" value={transferAmount}
                          onChange={e => setTransferAmount(e.target.value)}
                          className="h-12 rounded-2xl border-gray-100 bg-gray-50 font-black text-lg pl-11" />
                        <Send className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold">Solde disponible : {affiliate.balance} $</p>
                    </div>
                  </div>
                  <DialogFooter className="px-7 pb-7 flex-col gap-2">
                    <Button onClick={handleTransfer} disabled={isSubmitting || !verifiedRecipientName} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl">
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmer le Transfert'}
                    </Button>
                    <p className="text-[10px] text-center text-gray-400">La demande sera traitée par l'administration.</p>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* ── Demandes Clients (dépôts + retraits en attente) ── */}
            {(withdrawalRequests.length > 0 || depositRequests.length > 0) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-black text-dark text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" />
                    Demandes en attente
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                      {withdrawalRequests.length + depositRequests.length}
                    </span>
                  </h3>
                  <button onClick={fetchRequests} disabled={requestsLoading} className="text-gray-400 hover:text-gray-600 transition-colors">
                    {requestsLoading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <RefreshCw className="h-4 w-4" />}
                  </button>
                </div>

                {/* Dépôts */}
                {depositRequests.map(req => (
                  <div key={req.id} className="bg-white rounded-2xl border-l-4 border-l-emerald-400 border border-gray-100 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 font-black text-sm shrink-0">
                          {(req.clientName || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-dark text-sm">{req.clientName}</p>
                          <p className="text-[10px] text-gray-400">Dépôt</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-emerald-600">${(req.amount || 0).toFixed(2)}</p>
                        {req.message && <p className="text-[10px] text-gray-400 italic">"{req.message}"</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleRejectDeposit(req.id)}
                        disabled={processingRequestId === req.id}
                        variant="ghost"
                        className="flex-1 rounded-xl h-10 text-red-500 hover:bg-red-50 font-black text-xs uppercase tracking-widest"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Rejeter
                      </Button>
                      <Button
                        onClick={() => handleConfirmDeposit(req.id)}
                        disabled={processingRequestId === req.id}
                        className="flex-1 rounded-xl h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest border-0 shadow shadow-emerald-200"
                      >
                        {processingRequestId === req.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <><CheckCircle2 className="h-4 w-4 mr-1" />Approuver</>}
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Retraits */}
                {withdrawalRequests.map(req => (
                  <div key={req.id} className="bg-white rounded-2xl border-l-4 border-l-rose-400 border border-gray-100 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-700 font-black text-sm shrink-0">
                          {(req.clientName || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-dark text-sm">{req.clientName}</p>
                          <p className="text-[10px] text-gray-400">Retrait</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-rose-600">${(req.amount || 0).toFixed(2)}</p>
                        {req.message && <p className="text-[10px] text-gray-400 italic">"{req.message}"</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleRejectWithdrawal(req.id)}
                        disabled={processingRequestId === req.id}
                        variant="ghost"
                        className="flex-1 rounded-xl h-10 text-red-500 hover:bg-red-50 font-black text-xs uppercase tracking-widest"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Rejeter
                      </Button>
                      <Button
                        onClick={() => handleConfirmWithdrawal(req.id)}
                        disabled={processingRequestId === req.id}
                        className="flex-1 rounded-xl h-10 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs uppercase tracking-widest border-0 shadow shadow-rose-200"
                      >
                        {processingRequestId === req.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <><CheckCircle2 className="h-4 w-4 mr-1" />Approuver</>}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Transactions */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-black text-dark text-sm">Opérations Récentes</h3>
                {transactions.length > 0 && (
                  <button onClick={() => setActiveTab('gains')} className="text-[10px] font-black text-primary hover:underline flex items-center gap-0.5">
                    Voir tout <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
              {transactionsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : recentTx.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {recentTx.map(t => {
                    const isCredit = t.type === 'deposit' || t.type === 'transfer_received';
                    return (
                      <div key={t.id} className="px-5 py-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                            {isCredit ? <PlusCircle className="h-4 w-4" /> : <MinusCircle className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-black text-dark">{t.description || (t.type === 'deposit' ? 'Dépôt' : t.type === 'withdrawal' ? 'Retrait' : 'Transfert')}</p>
                            <p className="text-[10px] text-gray-400">
                              {t.createdAt?.toDate ? format(t.createdAt.toDate(), 'dd MMM', { locale: fr }) : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-black ${isCredit ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {isCredit ? '+' : '-'}{t.amount.toFixed(2)} $
                          </p>
                          <div className="flex justify-end mt-0.5">{getTransactionStatusBadge(t.status)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs font-medium">Aucune opération</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ RÉSEAU ═══ */}
        {activeTab === 'reseau' && (
          <div className="p-4 space-y-4">

            {/* Referral code card */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-lg shadow-emerald-200">
              <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-2">Mon Code de Parrainage</p>
              <div className="flex items-center justify-between">
                <span className="text-4xl font-black tracking-widest font-mono">{affiliate.code}</span>
                <div className="flex gap-2">
                  <button onClick={copyReferralCode}
                    className="h-10 w-10 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
                    <Copy className="h-4 w-4" />
                  </button>
                  <button onClick={() => {
                    const text = `Rejoignez-moi sur Rena ! Utilisez mon code ${affiliate.code} pour vous inscrire et profiter d'avantages exclusifs.`;
                    if (navigator.share) navigator.share({ text });
                    else { navigator.clipboard.writeText(text); toast.success('Message copié !'); }
                  }} className="h-10 w-10 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-white/60 mt-3">Partagez ce code pour inviter de nouveaux membres.</p>
            </div>

            {/* Team stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Membres Invités', value: affiliate.referredClients || 0, icon: Users, color: 'text-primary bg-primary/10' },
                { label: 'Points Totaux', value: affiliate.points || 0, icon: Star, color: 'text-amber-600 bg-amber-50' },
                { label: 'Gains Cumulés', value: `${(affiliate.totalEarnings || 0).toFixed(0)} $`, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
                { label: 'Total Retiré', value: `${(affiliate.totalWithdrawn || 0).toFixed(0)} $`, icon: ArrowUpRight, color: 'text-indigo-600 bg-indigo-50' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className={`h-8 w-8 rounded-xl ${stat.color} flex items-center justify-center mb-2`}>
                    <stat.icon className="h-4 w-4" />
                  </div>
                  <p className="text-xl font-black text-dark">{stat.value}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Niveau */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Niveau Actuel</p>
                  <p className="text-xl font-black text-dark mt-0.5">{levelInfo?.level || 'Bronze'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Progression</p>
                  <p className="text-lg font-black text-primary">{Math.round(levelInfo?.progress || 0)}%</p>
                </div>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${levelInfo?.progress || 0}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400"
                />
              </div>
              {levelInfo?.nextThreshold !== Infinity && (
                <p className="text-[10px] text-gray-400 font-bold text-center">
                  Plus que <span className="text-primary">{(levelInfo?.nextThreshold || 0) - (affiliate.points || 0)} points</span> pour le niveau suivant
                </p>
              )}
            </div>

            {/* Ranking position */}
            {rankingPosition > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
                  <Trophy className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Votre Classement</p>
                  <p className="font-black text-dark">#{rankingPosition} au classement global</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ GAINS ═══ */}
        {activeTab === 'gains' && (
          <div className="p-4 space-y-4">

            {/* Monthly Rankings */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Trophy className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-black text-dark text-sm">Élite du Mois</h3>
                  <p className="text-[10px] text-gray-400 font-medium">Les meilleurs performeurs</p>
                </div>
                <Badge className="ml-auto bg-amber-100 text-amber-700 border-0 text-[9px] font-black uppercase">Live</Badge>
              </div>
              <div className="p-5">
                {rankingsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-amber-500" /></div>
                ) : (
                  <div className="space-y-2">
                    {(monthlyRankings.length > 0 ? monthlyRankings : winnersQueue).slice(0, 5).map((a, idx) => (
                      <div key={a.id} className={`flex items-center gap-3 p-3 rounded-2xl ${a.id === affiliate.id ? 'bg-primary/5 border border-primary/10' : 'hover:bg-gray-50'} transition-colors`}>
                        <span className={`w-6 text-center font-black text-sm ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-500' : 'text-gray-300'}`}>
                          #{idx + 1}
                        </span>
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center font-black text-sm text-gray-600 shrink-0">
                          {a.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm text-dark truncate">{a.name} {a.id === affiliate.id && <span className="text-primary text-[10px]">(vous)</span>}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{a.code}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-sm text-emerald-600">{a.points || 0} pts</p>
                          <p className="text-[9px] text-gray-400">{idx === 0 ? '500 $' : idx === 1 ? '250 $' : idx === 2 ? '150 $' : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Full Transaction History */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center">
                    <History className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-dark text-sm">Historique Complet</h3>
                    <p className="text-[10px] text-gray-400">{transactions.length} opération(s)</p>
                  </div>
                </div>
                {transactions.length > 0 && (
                  <Dialog open={isClearHistoryConfirmOpen} onOpenChange={setIsClearHistoryConfirmOpen}>
                    <DialogTrigger render={
                      <button className="text-[10px] font-black text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors">
                        <AlertCircle className="h-3 w-3" /> Vider
                      </button>
                    } />
                    <DialogContent className="max-w-sm rounded-[2.5rem] p-7 border-0 shadow-2xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black">
                          <AlertCircle className="h-5 w-5 text-red-500" /> Supprimer l'historique ?
                        </DialogTitle>
                        <DialogDescription className="text-sm text-gray-500 pt-1">Cette action est irréversible.</DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="gap-2 mt-5">
                        <Button variant="outline" onClick={() => setIsClearHistoryConfirmOpen(false)} className="flex-1 h-11 rounded-2xl font-bold">Retour</Button>
                        <Button variant="destructive" onClick={handleClearTransactionHistory} disabled={isSubmitting} className="flex-1 h-11 rounded-2xl font-black">
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Effacer'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              {transactionsLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : transactions.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {transactions.map(t => {
                    const isCredit = t.type === 'deposit' || t.type === 'transfer_received';
                    return (
                      <div key={t.id} className="px-5 py-4 flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            t.type === 'deposit' ? 'bg-emerald-50 text-emerald-600' :
                            t.type === 'withdrawal' ? 'bg-indigo-50 text-indigo-600' :
                            t.type === 'transfer' || t.type === 'transfer_sent' ? 'bg-blue-50 text-blue-600' :
                            'bg-teal-50 text-teal-600'
                          }`}>
                            {isCredit ? <Download className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className={`text-sm font-black ${isCredit ? 'text-emerald-600' : 'text-rose-500'}`}>
                              {isCredit ? '+' : '-'}{t.amount.toFixed(2)} $
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{t.description || t.type}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-gray-400">
                                {t.createdAt?.toDate ? format(t.createdAt.toDate(), 'dd MMM yyyy • HH:mm', { locale: fr }) : ''}
                              </span>
                              {t.method && <Badge variant="outline" className="h-4 text-[8px] font-black">{t.method}</Badge>}
                            </div>
                            {t.status === 'rejected' && t.rejectionReason && (
                              <p className="text-[10px] text-red-500 mt-1 font-bold">{t.rejectionReason}</p>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 mt-0.5">{getTransactionStatusBadge(t.status)}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Fingerprint className="h-10 w-10 mx-auto mb-2 opacity-10" />
                  <p className="text-sm font-medium">Aucune opération</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ COMMANDES / POINT DE SERVICE ═══ */}
        {activeTab === 'historique' && (
          <div className="p-4 space-y-4">

            {/* Header */}
            <div className="bg-gradient-to-br from-primary to-indigo-700 rounded-3xl p-5 text-white shadow-lg shadow-primary/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">Historique</h2>
                    <p className="text-xs text-white/70">Toutes vos transactions</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="bg-white/10 rounded-2xl p-3">
                  <p className="text-[10px] text-white/60 font-black uppercase">Wallet Principal</p>
                  <p className="text-xl font-black">${(affiliate.balance || 0).toFixed(2)}</p>
                </div>
                <div className="bg-white/10 rounded-2xl p-3">
                  <p className="text-[10px] text-white/60 font-black uppercase">Commissions</p>
                  <p className="text-xl font-black">${(affiliate.commissionBalance || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Transaction list */}
            {transactionsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : transactions.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
                <History className="h-12 w-12 mx-auto mb-3 text-gray-200" />
                <p className="text-sm font-black text-gray-400">Aucune transaction</p>
                <p className="text-[10px] text-gray-300 mt-1">Vos dépôts et retraits apparaîtront ici</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {transactions.map((tx: WalletTransaction) => {
                    const isCredit = tx.type === 'deposit' || tx.type === 'commission' || tx.type === 'transfer_in';
                    const date = tx.createdAt
                      ? format(new Date((tx.createdAt as any)._seconds ? (tx.createdAt as any)._seconds * 1000 : tx.createdAt), 'dd MMM yyyy • HH:mm', { locale: fr })
                      : '';
                    const label = tx.type === 'deposit' ? 'Dépôt'
                      : tx.type === 'withdrawal' ? 'Retrait'
                      : tx.type === 'commission' ? 'Commission'
                      : tx.type === 'transfer_in' ? 'Transfert reçu'
                      : tx.type === 'transfer_out' ? 'Transfert envoyé'
                      : tx.type || 'Transaction';
                    return (
                      <div key={tx.id} className="p-4 flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          isCredit ? 'bg-emerald-50' : 'bg-rose-50'
                        }`}>
                          {isCredit
                            ? <ArrowDownToLine className="h-4 w-4 text-emerald-500" />
                            : <ArrowUpFromLine className="h-4 w-4 text-rose-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-dark text-sm truncate">{label}</p>
                          {tx.description && <p className="text-[10px] text-gray-400 truncate">{tx.description}</p>}
                          <p className="text-[10px] text-gray-300">{date}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-black text-sm ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isCredit ? '+' : '-'}${Math.abs(tx.amount || 0).toFixed(2)}
                          </p>
                          {getTransactionStatusBadge(tx.status as TransactionStatus)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ PROFIL ═══ */}
        {activeTab === 'profil' && (
          <div className="p-4 space-y-4">

            {/* Profile Card */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="relative shrink-0">
                {affiliate.photoUrl ? (
                  <img
                    src={affiliate.photoUrl}
                    alt={affiliate.name}
                    className="h-16 w-16 rounded-2xl object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                  />
                ) : null}
                <div className={`h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center ${affiliate.photoUrl ? 'hidden' : ''}`}>
                  <span className="text-3xl font-black text-primary">{affiliate.name.charAt(0)}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-dark text-lg truncate">{affiliate.name}</p>
                <p className="text-xs text-gray-400 font-mono">#{affiliate.code}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={`text-[9px] font-black ${
                    levelInfo?.level === 'VIP' ? 'bg-purple-100 text-purple-700' :
                    levelInfo?.level === 'Gold' ? 'bg-amber-100 text-amber-700' :
                    levelInfo?.level === 'Silver' ? 'bg-gray-100 text-gray-600' :
                    'bg-orange-100 text-orange-700'
                  } border-0`}>{levelInfo?.level || 'Bronze'}</Badge>
                  <span className="text-[10px] text-gray-400 font-bold">{affiliate.points || 0} pts</span>
                </div>
              </div>
            </div>

            {/* Photo update */}
            <PhotoUrlEditor
              currentUrl={affiliate.photoUrl}
              onSave={async (url) => {
                await fetch(`/api/affiliate/${affiliateId}/photo`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ photoUrl: url }),
                });
              }}
            />

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <TrendingUp className="h-5 w-5 text-emerald-500 mb-2" />
                <p className="text-xl font-black text-dark">{(affiliate.totalEarnings || 0).toFixed(0)} $</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Gains totaux</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <Users className="h-5 w-5 text-primary mb-2" />
                <p className="text-xl font-black text-dark">{affiliate.referredClients || 0}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Membres invités</p>
              </div>
            </div>

            {/* Level Progress */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-dark text-sm">Progression de Niveau</h3>
                <span className="text-xs font-black text-primary">{levelInfo?.level || 'Bronze'}</span>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${levelInfo?.progress || 0}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-400"
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                <span>0 pts</span>
                {levelInfo?.nextThreshold !== Infinity && <span>{levelInfo?.nextThreshold} pts</span>}
              </div>
            </div>

            {/* Wallet ID */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ID Wallet</p>
                <p className="font-mono font-black text-dark tracking-widest">{affiliate.walletId || '........'}</p>
              </div>
              <button onClick={copyWalletId} className="h-10 w-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">
                {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-gray-500" />}
              </button>
            </div>

            {/* Logout */}
            <button onClick={onLogout}
              className="w-full h-12 rounded-2xl border-2 border-red-100 bg-red-50 text-red-600 font-black text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors active:scale-[0.98]">
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </button>
          </div>
        )}
      </div>

      {/* ── Fixed Bottom Tab Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 safe-area-pb">
        <div className="flex max-w-2xl mx-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 transition-colors relative ${activeTab === tab.id ? 'text-primary' : 'text-gray-400'}`}
            >
              {activeTab === tab.id && (
                <motion.div layoutId="tab-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <tab.icon className="h-5 w-5" />
              <span className="text-[9px] font-black uppercase tracking-wider">{tab.label}</span>
              {/* no badge for historique tab */}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
