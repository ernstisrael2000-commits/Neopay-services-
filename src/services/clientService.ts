import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  doc,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { signInWithGooglePopup, mapGoogleAuthError } from '../lib/google-auth';
import { Client, ClientTransaction, AdminClientNotification, ClientNotification } from '../types';

// ─── Deserialize API doc (converts {_seconds} timestamps back to {toDate()}) ──
function fromApi<T>(doc: any): T {
  const result: any = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value && typeof value === 'object' && '_seconds' in (value as any)) {
      result[key] = { toDate: () => new Date((value as any)._seconds * 1000) };
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

// ─── Register / Login ───────────────────────────────────────────────────────

export const registerClient = async (data: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  sponsorCode?: string;
}): Promise<Client> => {
  const res = await fetch('/api/client/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erreur inscription (${res.status})`);
  return json.client as Client;
};

export const registerClientWithGoogle = async (data: {
  firstName: string;
  lastName: string;
  phone: string;
  sponsorCode?: string;
  googleUser: { uid: string; email: string; name: string; photoUrl?: string };
}): Promise<Client> => {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Session Google expirée. Veuillez recommencer.');
  const res = await fetch('/api/client/register-google', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      sponsorCode: data.sponsorCode,
      idToken,
    })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erreur inscription Google (${res.status})`);
  return json.client as Client;
};

export const loginClient = async (email: string, password: string): Promise<Client | null> => {
  const res = await fetch('/api/client/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (res.status === 401) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erreur connexion (${res.status})`);
  return json.client as Client;
};

export const restoreClientSession = async (firebaseIdToken?: string): Promise<Client | null> => {
  const res = await fetch('/api/client/session', {
    credentials: 'include',
    headers: firebaseIdToken ? { Authorization: `Bearer ${firebaseIdToken}` } : undefined,
  });
  if (res.status === 401 || res.status === 404) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erreur session (${res.status})`);
  return json.client as Client;
};

export const completeClientIdentityName = async (
  firstName: string,
  lastName: string,
): Promise<Client> => {
  const res = await fetch('/api/client/identity-name', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, lastName }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Impossible d’enregistrer votre identité (${res.status})`);
  return json.client as Client;
};

export interface GoogleClientLoginResult {
  client: Client | null;
  googleEmail?: string;
  googleName?: string;
  googlePhotoUrl?: string;
  googleUid?: string;
  noAccount?: boolean;
  error?: string;
}

export const loginClientWithGoogle = async (): Promise<GoogleClientLoginResult> => {
  try {
    const result = await signInWithGooglePopup();
    const user = result.user;
    const email = user.email;

    if (!email) return { client: null, error: "L'email Google est requis." };
    const idToken = await user.getIdToken();
    const res = await fetch('/api/client/login-google', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const payload = await res.json().catch(() => ({}));
    if (res.status === 404 && payload.noAccount) {
      return {
        client: null,
        noAccount: true,
        googleEmail: email,
        googleName: user.displayName || '',
        googlePhotoUrl: user.photoURL || '',
        googleUid: user.uid
      };
    }
    if (!res.ok) return { client: null, error: payload.error || 'Connexion Google impossible.' };
    return { client: payload.client as Client };
  } catch (error: any) {
    const mapped = mapGoogleAuthError(error);
    if (!mapped) return { client: null, error: '' };
    console.error("Google client login error:", error);
    return { client: null, error: mapped };
  }
};


// ─── Client Data Hook ────────────────────────────────────────────────────────

export const useClientData = (clientId: string | null) => {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    const unsubscribe = onSnapshot(doc(db, 'clients', clientId), (snap) => {
      if (snap.exists()) setClient({ id: snap.id, ...snap.data() } as Client);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, [clientId]);

  return { client, loading };
};

// ─── API helper ──────────────────────────────────────────────────────────────

async function apiPost(path: string, body: object): Promise<any> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let data: any = {};
  try {
    const text = await res.text();
    data = JSON.parse(text);
  } catch {
    if (!res.ok) throw new Error(`Erreur serveur (${res.status}). Veuillez réessayer.`);
    return;
  }
  if (!res.ok) throw new Error(data.error || `Erreur serveur (${res.status})`);
  return data;
}

export const logoutClient = async (): Promise<void> => {
  await fetch('/api/client/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
};

// ─── Deposit ─────────────────────────────────────────────────────────────────

export const submitClientDeposit = async (
  client: Client,
  usdAmount: number,
  method: string,
  txId?: string,
  captchaToken?: string,
  message?: string,
  htgAmount?: number,
  exchangeRate?: number,
  proofImageBase64?: string
) => {
  if (usdAmount <= 0) throw new Error("Montant invalide.");
  await apiPost('/api/client/deposit', {
    clientId: client.id,
    clientName: client.name,
    clientWalletId: client.walletId || '',
    amount: usdAmount,
    usdAmount,
    ...(htgAmount !== undefined && { htgAmount }),
    ...(exchangeRate !== undefined && { exchangeRate }),
    method,
    ...(txId && { txId }),
    ...(message && { message }),
    ...(captchaToken && captchaToken !== 'bypass' && { captchaToken }),
    ...(proofImageBase64 && { proofImageBase64 }),
  });
};

// ─── Withdrawal ──────────────────────────────────────────────────────────────

export const submitClientWithdrawal = async (
  client: Client,
  usdAmount: number,
  method: string,
  accountNumber: string,
  captchaToken?: string,
  message?: string,
  accountName?: string,
  exchangeRate?: number,
  diditChallengeId?: string,
) => {
  if (usdAmount <= 0) throw new Error("Montant invalide.");
  if (usdAmount > client.balance) throw new Error("Solde insuffisant.");
  if (!accountNumber) throw new Error("Numéro de compte requis.");
  const htgEquivalent = exchangeRate ? Math.round(usdAmount * exchangeRate) : undefined;
  await apiPost('/api/client/withdrawal', {
    clientId: client.id,
    clientName: client.name,
    clientPhone: client.phone || '',
    clientWalletId: client.walletId || '',
    amount: usdAmount,
    usdAmount,
    ...(htgEquivalent !== undefined && { htgEquivalent }),
    ...(exchangeRate !== undefined && { exchangeRate }),
    method,
    accountNumber,
    ...(accountName && { accountName }),
    ...(message && { message }),
    ...(captchaToken && captchaToken !== 'bypass' && { captchaToken }),
    ...(diditChallengeId && { diditChallengeId }),
  });
};

// ─── Client-to-Client Transfer ───────────────────────────────────────────────

export const submitClientTransfer = async (
  senderClientId: string,
  recipientWalletId: string,
  amount: number,
  message?: string,
  diditChallengeId?: string,
): Promise<{ recipientName: string; amount: number }> => {
  if (amount <= 0) throw new Error("Montant invalide.");
  if (!recipientWalletId.trim()) throw new Error("ID Wallet du destinataire requis.");
  const data = await apiPost('/api/client/transfer', {
    senderClientId,
    recipientWalletId: recipientWalletId.trim(),
    amount,
    ...(message && { message }),
    ...(diditChallengeId && { diditChallengeId }),
  });
  return { recipientName: data.recipientName || '', amount: data.amount || amount };
};

// ─── Purchase (pending — requires admin approval) ─────────────────────────────

export const submitClientPurchase = async (
  client: Client,
  productName: string,
  productPrice: string,
  amount: number
) => {
  if (amount <= 0) throw new Error("Montant invalide.");
  if (amount > client.balance) throw new Error("Solde insuffisant pour cet achat.");
  await apiPost('/api/client/purchase', {
    clientId: client.id,
    clientName: client.name,
    clientPhone: client.phone || '',
    clientWalletId: client.walletId || '',
    amount,
    productName,
    productPrice,
    directSponsorId: client.directSponsorId || null
  });
};

// ─── Admin: approve a pending purchase ───────────────────────────────────────

export const approvePurchaseRequest = async (
  notifId: string,
  transactionId: string,
  clientId: string,
  amount: number,
  directSponsorId?: string | null,
  credentials?: { email: string; password: string } | null,
  productName?: string
) => {
  await apiPost('/api/admin/purchase/approve', {
    notifId,
    transactionId,
    clientId,
    amount,
    directSponsorId: directSponsorId || null,
    credentials: credentials || null,
    productName: productName || '',
  });
};

// ─── Promo Codes ─────────────────────────────────────────────────────────────

export const usePromoCodes = () => {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/promo-codes')
      .then(r => r.json())
      .then(d => { setCodes(d.codes || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/promo-codes');
      const d = await r.json();
      setCodes(d.codes || []);
    } finally { setLoading(false); }
  };

  return { codes, loading, refresh };
};

export const savePromoCode = async (data: {
  code: string; serviceName: string; discountPercent: number;
  maxUses: number; active: boolean;
}, id?: string): Promise<void> => {
  if (id) {
    await apiPost(`/api/promo-codes/${id}`, data);
  } else {
    await apiPost('/api/promo-codes', data);
  }
};

// Use fetch directly for DELETE since apiPost doesn't support DELETE
export const deletePromoCode = async (id: string): Promise<void> => {
  const r = await fetch(`/api/promo-codes/${id}`, { method: 'DELETE' });
  if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Erreur serveur.'); }
};

export const validatePromoCode = async (
  code: string, serviceName: string
): Promise<{ valid: boolean; id?: string; discountPercent?: number; serviceName?: string; error?: string }> => {
  const r = await fetch('/api/promo-codes/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, serviceName }),
  });
  return r.json();
};

export const usePromoCode = async (codeId: string): Promise<void> => {
  await fetch(`/api/promo-codes/${codeId}/use`, { method: 'POST' });
};

// ─── Admin: decline a pending purchase ───────────────────────────────────────

export const declinePurchaseRequest = async (
  notifId: string,
  transactionId: string
) => {
  await apiPost('/api/admin/purchase/decline', { notifId, transactionId });
};

// ─── Hook: does this client have a pending purchase? ────────────────────────

// purchases are now instant — this hook always returns false
export const useClientPendingPurchase = (_clientId: string | null) => false;

// ─── Transaction Hooks (real-time via onSnapshot) ────────────────────────────

export const useClientTransactions = (clientId: string | null) => {
  const [transactions, setTransactions] = useState<ClientTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) { setTransactions([]); setLoading(false); return; }
    let cancelled = false;
    const loadTransactions = async () => {
      try {
        const response = await fetch(`/api/client/transactions/${encodeURIComponent(clientId)}`, { credentials: 'include' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Impossible de charger les transactions.');
        if (!cancelled) setTransactions((payload.transactions || []).map(fromApi<ClientTransaction>));
      } catch {
        if (!cancelled) setTransactions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    setLoading(true);
    void loadTransactions();
    const interval = window.setInterval(() => { void loadTransactions(); }, 20_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [clientId]);

  return { transactions, loading };
};

export const useAllClientTransactions = () => {
  const [transactions, setTransactions] = useState<ClientTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'client_transactions'),
      orderBy('createdAt', 'desc'),
      limit(500)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientTransaction)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, []);

  return { transactions, loading };
};

export const useAllClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, []);

  return { clients, loading };
};

// ─── Update transaction status (deposits & withdrawals) ──────────────────────

export const updateClientTransactionStatus = async (
  txId: string,
  status: 'approved' | 'rejected',
  reason?: string
) => {
  await apiPost('/api/admin/transaction/status', { txId, status, reason });
};

// ─── Misc Hooks & Utils (real-time via onSnapshot) ───────────────────────────

export const usePendingClientCount = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const q = query(
      collection(db, 'client_transactions'),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setCount(snap.size);
    }, () => {});
    return () => unsubscribe();
  }, []);
  return count;
};

export const useAdminClientNotifications = () => {
  const [notifications, setNotifications] = useState<AdminClientNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'admin_notifications'),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminClientNotification)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, []);

  return { notifications, loading };
};

export const markAdminNotificationRead = async (notifId: string) => {
  await fetch(`/api/admin/notifications/${notifId}/read`, { method: 'PATCH' });
};

export const markAllAdminNotificationsRead = async () => {
  await fetch('/api/admin/notifications/read-all', { method: 'PATCH' });
};

export const clearAllAdminNotifications = async () => {
  await fetch('/api/admin/notifications/clear-all', { method: 'DELETE' });
};

// ─── Client Notifications ────────────────────────────────────────────────────

export const useClientNotifications = (clientId: string | null) => {
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    let cancelled = false;

    const fetchNotifications = async () => {
      try {
        const res = await fetch(`/api/client/notifications/${clientId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setNotifications((data.notifications || []).map(fromApi<ClientNotification>));
      } catch { } finally { if (!cancelled) setLoading(false); }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [clientId]);

  const unreadCount = notifications.filter(n => !n.read).length;
  return { notifications, loading, unreadCount };
};

export const markClientNotificationRead = async (notifId: string) => {
  await fetch(`/api/client/notifications/${notifId}/read`, { method: 'PATCH' });
};

export const markAllClientNotificationsRead = async (clientId: string) => {
  await fetch(`/api/client/notifications/read-all/${clientId}`, { method: 'PATCH' });
};

export const clearAllClientNotifications = async (clientId: string) => {
  const res = await fetch(`/api/client/notifications/clear-all/${clientId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Erreur lors de la suppression.');
};
