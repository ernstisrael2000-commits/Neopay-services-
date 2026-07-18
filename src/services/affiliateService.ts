import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp, 
  orderBy, 
  limit, 
  onSnapshot,
  setDoc,
  increment,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError } from '../lib/firebase-errors';
import { Affiliate, WithdrawalRequest, AffiliateRequest, AffiliateNotification, Client } from '../types';

export const loginAffiliate = async (username: string, password: string): Promise<Affiliate | null> => {
  const q = query(
    collection(db, 'affiliates'), 
    where('username', '==', username), 
    where('password', '==', password)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docData = snapshot.docs[0];
  return { id: docData.id, ...docData.data() } as Affiliate;
};

export const getAffiliateByEmail = async (email: string): Promise<Affiliate | null> => {
  const q = query(
    collection(db, 'affiliates'), 
    where('email', '==', email)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    // Try checking info object if email was stored there
    const qInfo = query(
      collection(db, 'affiliates'),
      where('info.email', '==', email)
    );
    const snapInfo = await getDocs(qInfo);
    if (snapInfo.empty) return null;
    return { id: snapInfo.docs[0].id, ...snapInfo.docs[0].data() } as Affiliate;
  }
  const docData = snapshot.docs[0];
  return { id: docData.id, ...docData.data() } as Affiliate;
};

export const useAffiliateData = (affiliateId: string | null) => {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!affiliateId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'affiliates', affiliateId), (docSnap) => {
      if (docSnap.exists()) {
        setAffiliate({ id: docSnap.id, ...docSnap.data() } as Affiliate);
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
      try { handleFirestoreError(error, 'get', `affiliates/${affiliateId}`, auth); } catch (e) {}
    });

    return () => unsubscribe();
  }, [affiliateId]);

  return { affiliate, loading };
};

export const useTopAffiliates = () => {
  const [topAffiliates, setTopAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'affiliates'), 
      orderBy('referredClients', 'desc'), 
      limit(10)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Affiliate[];
      setTopAffiliates(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      try { handleFirestoreError(error, 'list', 'affiliates', auth); } catch (e) {}
    });

    return () => unsubscribe();
  }, []);

  return { topAffiliates, loading };
};

export const submitWithdrawal = async (
  affiliate: Affiliate, 
  amount: number, 
  method: 'MonCash' | 'NatCash' | 'Physical',
  accountNumber: string
) => {
  if (amount > affiliate.balance) {
    throw new Error("Montant supérieur au solde disponible.");
  }
  if (amount < 0.1) { // Very low limit to allow Gourdes-based withdrawal
    throw new Error("Montant trop faible (Min 20 HTG).");
  }
  if (!accountNumber) {
    throw new Error("Le numéro de compte est obligatoire.");
  }

  try {
    const batch = writeBatch(db);
    
    // Create legacy withdrawal request
    const withdrawalRef = doc(collection(db, 'withdrawals'));
    batch.set(withdrawalRef, {
      affiliateId: affiliate.id,
      affiliateName: affiliate.name,
      affiliateCode: affiliate.code,
      amount,
      method,
      accountNumber,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Create unified wallet transaction
    const transactionRef = doc(collection(db, 'wallet_transactions'));
    batch.set(transactionRef, {
      affiliateId: affiliate.id,
      type: 'withdrawal',
      amount,
      status: 'pending',
      method,
      accountNumber,
      description: `Retrait via ${method}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'create', 'withdrawals', auth);
  }
};

export const useAffiliateWithdrawals = (affiliateId: string | null) => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!affiliateId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'withdrawals'), 
      where('affiliateId', '==', affiliateId),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WithdrawalRequest[];
      setWithdrawals(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      try { handleFirestoreError(error, 'list', 'withdrawals', auth); } catch (e) {}
    });

    return () => unsubscribe();
  }, [affiliateId]);

  return { withdrawals, loading };
};

export const deleteWithdrawalHistory = async (affiliateId: string) => {
  try {
    // 1. Clear legacy withdrawals
    const qWith = query(
      collection(db, 'withdrawals'),
      where('affiliateId', '==', affiliateId)
    );
    const snapshotWith = await getDocs(qWith);
    
    // 2. Clear unified transactions
    const qTx = query(
      collection(db, 'wallet_transactions'),
      where('affiliateId', '==', affiliateId)
    );
    const snapshotTx = await getDocs(qTx);
    
    const batch = writeBatch(db);
    snapshotWith.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    snapshotTx.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    
    await batch.commit();
  } catch (error) {
    console.error("Error clearing history:", error);
  }
};

// Admin Services
export const useAllAffiliates = () => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'affiliates'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Affiliate[];
      setAffiliates(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      try { handleFirestoreError(error, 'list', 'affiliates', auth); } catch (e) {}
    });

    return () => unsubscribe();
  }, []);

  return { affiliates, loading };
};

export const useAllWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WithdrawalRequest[];
      setWithdrawals(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      try { handleFirestoreError(error, 'list', 'withdrawals', auth); } catch (e) {}
    });

    return () => unsubscribe();
  }, []);

  return { withdrawals, loading };
};

export const saveAffiliate = async (affiliateData: Partial<Affiliate>, id?: string) => {
  // Filter out undefined values and the id field
  const dataToSave = Object.keys(affiliateData).reduce((acc: any, key) => {
    if (key !== 'id' && affiliateData[key as keyof Affiliate] !== undefined) {
      acc[key] = affiliateData[key as keyof Affiliate];
    }
    return acc;
  }, {});

  try {
    if (id) {
      const affiliateRef = doc(db, 'affiliates', id);
      await updateDoc(affiliateRef, {
        ...dataToSave,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, 'affiliates'), {
        balance: 0,
        referredClients: 0,
        monthlyReferredClients: 0,
        monthlySales: 0,
        points: 0,
        ...dataToSave,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, id ? 'update' : 'create', 'affiliates', auth);
  }
};

/**
 * Updates the status of a withdrawal request and adjusts affiliate balance if approved.
 * Uses the backend API (Admin SDK) to bypass Firestore security rules.
 */
export const updateWithdrawalStatus = async (
  requestId: string,
  status: 'approved' | 'rejected',
  reason?: string
) => {
  const endpoint = status === 'approved'
    ? `/api/admin/withdrawal/${requestId}/approve`
    : `/api/admin/withdrawal/${requestId}/reject`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(data.error || `Erreur serveur (${res.status})`);
  }
};

/**
 * Deletes an affiliate account.
 */
export const deleteAffiliate = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'affiliates', id));
  } catch (error) {
    handleFirestoreError(error, 'delete', 'affiliates', auth);
  }
};

// Affiliate Request Services
export const submitAffiliateRequest = async (requestData: Partial<AffiliateRequest>) => {
  try {
    await addDoc(collection(db, 'affiliate_requests'), {
      ...requestData,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'create', 'affiliate_requests', auth);
  }
};

export const useAllAffiliateRequests = () => {
  const [requests, setRequests] = useState<AffiliateRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'affiliate_requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AffiliateRequest[];
      setRequests(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      try { handleFirestoreError(error, 'list', 'affiliate_requests', auth); } catch (e) {}
    });

    return () => unsubscribe();
  }, []);

  return { requests, loading };
};

export const updateAffiliateRequestStatus = async (requestId: string, status: 'approved' | 'rejected') => {
  try {
    const requestRef = doc(db, 'affiliate_requests', requestId);
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) return;
    const requestData = requestSnap.data() as AffiliateRequest;

    await updateDoc(requestRef, {
      status,
      updatedAt: serverTimestamp()
    });

    if (status === 'approved') {
      // Check if affiliate already exists (by email or username)
      const q = query(collection(db, 'affiliates'), where('username', '==', requestData.name.toLowerCase().replace(/\s/g, '')));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        // Create new affiliate account with data from request
        const username = requestData.name.toLowerCase().replace(/\s/g, '') + Math.floor(1000 + Math.random() * 9000);
        const password = Math.random().toString(36).slice(-8); // Random temporary password
        const code = 'AFF' + Math.floor(100000 + Math.random() * 900000);
        const walletId = Math.floor(10000000 + Math.random() * 90000000).toString();

        await addDoc(collection(db, 'affiliates'), {
          name: requestData.name,
          username,
          password,
          code,
          walletId,
          email: requestData.email,
          ...(requestData.uid && { uid: requestData.uid }),
          balance: 0,
          referredClients: 0,
          monthlyReferredClients: 0,
          monthlySales: 0,
          points: 0,
          level: 'Bronze',
          directRevenue: 0,
          indirectRevenue: 0,
          totalEarnings: 0,
          info: {
            phone: requestData.phone,
            email: requestData.email,
            message: requestData.message || '',
            requestId: requestId,
            approvedAt: new Date().toISOString()
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, 'update', 'affiliate_requests', auth);
  }
};

export const usePendingCounts = (enabled: boolean = false) => {
  const [counts, setCounts] = useState({ registrations: 0, withdrawals: 0, deposits: 0, total: 0 });

  useEffect(() => {
    if (!enabled) {
      setCounts({ registrations: 0, withdrawals: 0, deposits: 0, total: 0 });
      return;
    }

    // ── OPTIMISÉ : 3 listeners PLATS au lieu de 3 niveaux imbriqués ──────────
    // Avant : les listeners internes n'étaient jamais nettoyés (fuite mémoire).
    // Après : ref partagé, tous les unsubs trackés et nettoyés ensemble.
    const latest = { reg: 0, with: 0, dep: 0 };
    const update = () => setCounts({
      registrations: latest.reg,
      withdrawals:   latest.with,
      deposits:      latest.dep,
      total:         latest.reg + latest.with + latest.dep,
    });

    const qReg  = query(collection(db, 'affiliate_requests'),  where('status', '==', 'pending'));
    const qWith = query(collection(db, 'withdrawals'),          where('status', '==', 'pending'));
    const qDep  = query(collection(db, 'wallet_transactions'),  where('type', '==', 'deposit'), where('status', '==', 'pending'));

    const unsubs = [
      onSnapshot(qReg,  snap => { latest.reg  = snap.size; update(); }, err => console.error('[Counts] reg:',  err)),
      onSnapshot(qWith, snap => { latest.with = snap.size; update(); }, err => console.error('[Counts] with:', err)),
      onSnapshot(qDep,  snap => { latest.dep  = snap.size; update(); }, err => console.error('[Counts] dep:',  err)),
    ];

    return () => unsubs.forEach(u => u());
  }, [enabled]);

  return counts;
};

export const useMonthlyRankings = () => {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'global');
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        setRankings(data.officialWinners || []);
      } else {
        setRankings([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching rankings:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { rankings, loading };
};

// Notification Services
export const useNotifications = (affiliateId: string | null) => {
  const [notifications, setNotifications] = useState<AffiliateNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!affiliateId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('affiliateId', '==', affiliateId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AffiliateNotification[];
      setNotifications(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notifications:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [affiliateId]);

  return { notifications, loading };
};

export const markNotificationAsRead = async (notificationId: string) => {
  const ref = doc(db, 'notifications', notificationId);
  await updateDoc(ref, { read: true });
};

export const createNotification = async (
  affiliateId: string, 
  title: string, 
  message: string, 
  type: AffiliateNotification['type']
) => {
  await addDoc(collection(db, 'notifications'), {
    affiliateId,
    title,
    message,
    type,
    read: false,
    createdAt: serverTimestamp()
  });
};

// Level Calculation Helper
export const getAffiliateLevelInfo = (points: number) => {
  if (points >= 5000) return { level: 'VIP', nextThreshold: Infinity, progress: 100 };
  if (points >= 2500) return { level: 'Elite', nextThreshold: 5000, progress: ((points - 2500) / 2500) * 100 };
  if (points >= 1000) return { level: 'Gold', nextThreshold: 2500, progress: ((points - 1000) / 1500) * 100 };
  if (points >= 250) return { level: 'Silver', nextThreshold: 1000, progress: ((points - 250) / 750) * 100 };
  return { level: 'Bronze', nextThreshold: 250, progress: (points / 250) * 100 };
};

export const clearMonthlyWinners = async () => {
  try {
    // 1. Clear flags on affiliates
    const snapshot = await getDocs(query(collection(db, 'affiliates'), where('isMonthlyWinner', '==', true)));
    const promises = snapshot.docs.map(docSnap => 
      updateDoc(doc(db, 'affiliates', docSnap.id), {
        isMonthlyWinner: false,
        updatedAt: serverTimestamp()
      })
    );
    await Promise.all(promises);

    // 2. Clear official winners in settings
    const settingsRef = doc(db, 'settings', 'global');
    await setDoc(settingsRef, {
      officialWinners: [],
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, 'update', 'affiliates', auth);
  }
};

export const awardMonthlyPrizes = async () => {
  try {
    // 0. Lire la config du concours depuis settings/global
    const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const metric: string  = settings.affiliateContestMetric || 'points';
    const prize1 = settings.prize1 || { amount: 500, label: '1er Prix',  emoji: '🥇' };
    const prize2 = settings.prize2 || { amount: 250, label: '2ème Prix', emoji: '🥈' };
    const prize3 = settings.prize3 || { amount: 150, label: '3ème Prix', emoji: '🥉' };
    const prizeConfigs = [prize1, prize2, prize3];

    // 1. Clear all current monthly winners
    const winnersQuery = query(collection(db, 'affiliates'), where('isMonthlyWinner', '==', true));
    const winnersSnap = await getDocs(winnersQuery);
    const clearPromises = winnersSnap.docs.map(d => updateDoc(doc(db, 'affiliates', d.id), {
      isMonthlyWinner: false, updatedAt: serverTimestamp()
    }));
    await Promise.all(clearPromises);

    // 2. Get all affiliates, sort by chosen metric
    const snapshot = await getDocs(collection(db, 'affiliates'));
    const affiliates = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Affiliate[];

    const eligible = affiliates
      .filter(a => ((a as any)[metric] || 0) > 0)
      .sort((a, b) => ((b as any)[metric] || 0) - ((a as any)[metric] || 0))
      .slice(0, 3);

    if (eligible.length === 0) return [];

    const promises: Promise<void>[] = [];
    const awardedWinners: Affiliate[] = [];
    const officialWinners = [];

    // 3. Award prizes
    for (let i = 0; i < eligible.length; i++) {
      const affiliateRef = doc(db, 'affiliates', eligible[i].id!);
      const pcfg = prizeConfigs[i];
      const prizeHTG = pcfg.amount || 0;

      const isWalletPrize = (pcfg.type || 'wallet') !== 'physical';
      promises.push(updateDoc(affiliateRef, {
        ...(isWalletPrize && prizeHTG > 0 && { balance: (eligible[i].balance || 0) + prizeHTG }),
        isMonthlyWinner: true,
        updatedAt: serverTimestamp()
      }));

      officialWinners.push({
        id: eligible[i].id!,
        name: eligible[i].name,
        score: (eligible[i] as any)[metric] || 0,
        metric,
        prize: prizeHTG,
        prizeLabel: pcfg.label || '',
        prizeEmoji: pcfg.emoji || '',
        prizeType: pcfg.type || 'wallet',
        prizeImageUrl: (pcfg as any).imageUrl || null,
        prizeDescription: (pcfg as any).description || null,
        points: eligible[i].points || 0,
        monthlySales: eligible[i].monthlySales || 0,
        monthlyReferredClients: eligible[i].monthlyReferredClients || 0,
      });

      awardedWinners.push({ ...eligible[i], isMonthlyWinner: true });
    }

    // 4. Persist to settings/global
    const settingsRef = doc(db, 'settings', 'global');
    promises.push(setDoc(settingsRef, { officialWinners, updatedAt: serverTimestamp() }, { merge: true }) as any);

    await Promise.all(promises);
    return awardedWinners;
  } catch (error) {
    handleFirestoreError(error, 'update', 'affiliates', auth);
    throw error;
  }
};

// ── Décerne les prix aux top 3 agents ────────────────────────────────────────
export const awardAgentMonthlyPrizes = async () => {
  try {
    // 0. Config concours
    const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const metric: string  = settings.agentContestMetric || 'monthlyTransactions';
    const prize1 = settings.prize1 || { amount: 500, label: '1er Prix',  emoji: '🥇' };
    const prize2 = settings.prize2 || { amount: 250, label: '2ème Prix', emoji: '🥈' };
    const prize3 = settings.prize3 || { amount: 150, label: '3ème Prix', emoji: '🥉' };
    const prizeConfigs = [prize1, prize2, prize3];

    // 1. Get all agents, sort by chosen metric
    const snapshot = await getDocs(collection(db, 'agents'));
    const agents = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const eligible = agents
      .filter((a: any) => (a[metric] || 0) > 0)
      .sort((a: any, b: any) => (b[metric] || 0) - (a[metric] || 0))
      .slice(0, 3);

    if (eligible.length === 0) return [];

    const promises: Promise<void>[] = [];
    const officialAgentWinners = [];

    for (let i = 0; i < eligible.length; i++) {
      const agentRef = doc(db, 'agents', eligible[i].id!);
      const pcfg = prizeConfigs[i];
      const prizeHTG = pcfg.amount || 0;

      const isWalletPrize = (pcfg.type || 'wallet') !== 'physical';
      if (isWalletPrize && prizeHTG > 0) {
        promises.push(updateDoc(agentRef, {
          commissionBalance: ((eligible[i] as any).commissionBalance || 0) + prizeHTG,
          updatedAt: serverTimestamp()
        }));
      }

      officialAgentWinners.push({
        id: eligible[i].id!,
        name: (eligible[i] as any).name || 'Agent',
        score: (eligible[i] as any)[metric] || 0,
        metric,
        prize: prizeHTG,
        prizeLabel: pcfg.label || '',
        prizeEmoji: pcfg.emoji || '',
        prizeType: pcfg.type || 'wallet',
        prizeImageUrl: (pcfg as any).imageUrl || null,
        prizeDescription: (pcfg as any).description || null,
      });
    }

    const settingsRef = doc(db, 'settings', 'global');
    promises.push(setDoc(settingsRef, { officialAgentWinners, updatedAt: serverTimestamp() }, { merge: true }) as any);

    await Promise.all(promises);
    return eligible;
  } catch (error) {
    console.error('awardAgentMonthlyPrizes error:', error);
    throw error;
  }
};

export const resetMonthlyStats = async () => {
  try {
    // Réinitialiser affiliés
    const affSnap = await getDocs(collection(db, 'affiliates'));
    const affPromises = affSnap.docs.map(docSnap =>
      updateDoc(doc(db, 'affiliates', docSnap.id), {
        monthlyReferredClients: 0,
        monthlySales: 0,
        points: 0,
        isMonthlyWinner: false,
        updatedAt: serverTimestamp()
      })
    );
    // Réinitialiser agents
    const agentSnap = await getDocs(collection(db, 'agents'));
    const agentPromises = agentSnap.docs.map(docSnap =>
      updateDoc(doc(db, 'agents', docSnap.id), {
        monthlyTransactions: 0,
        updatedAt: serverTimestamp()
      })
    );
    await Promise.all([...affPromises, ...agentPromises]);
  } catch (error) {
    handleFirestoreError(error, 'update', 'affiliates', auth);
  }
};

export const recordPurchase = async (
  affiliateId: string,
  type: 'purchase' | 'subscription' | 'virtual_card',
  itemName?: string,
  transactionAmountUSD?: number   // used when commissionMode === 'percentage'
) => {
  try {
    const affiliateRef = doc(db, 'affiliates', affiliateId);
    const affiliateSnap = await getDoc(affiliateRef);

    if (!affiliateSnap.exists()) throw new Error("Affilié non trouvé");

    const affiliateData = affiliateSnap.data() as Affiliate;

    const settingsRef = doc(db, 'settings', 'global');
    const settingsSnap = await getDoc(settingsRef);
    const settings = settingsSnap.exists() ? settingsSnap.data() : { exchangeRate: 146 };
    const exchangeRate = settings.exchangeRate || 146;
    const commissionMode = settings.commissionMode || 'fixed';

    const isStreamingSub = itemName && (
      itemName.toLowerCase().includes('netflix') ||
      itemName.toLowerCase().includes('prime') ||
      itemName.toLowerCase().includes('paramount') ||
      itemName.toLowerCase().includes('disney') ||
      itemName.toLowerCase().includes('hbo') ||
      itemName.toLowerCase().includes('iptv') ||
      itemName.toLowerCase().includes('spotify') ||
      itemName.toLowerCase().includes('video') ||
      itemName.toLowerCase().includes('streaming')
    );

    let directCommissionHTG: number;
    let parentCommissionHTG: number;
    let grandparentCommissionHTG: number;
    let directCommissionUSD: number;
    let parentCommissionUSD: number;
    let grandparentCommissionUSD: number;
    let pointsEarned = 1;

    if (commissionMode === 'percentage' && transactionAmountUSD && transactionAmountUSD > 0) {
      // ── Percentage of transaction amount ──
      let dPct: number, pPct: number, gpPct: number;
      if (type === 'virtual_card') {
        dPct  = settings.commissionVirtualCardPct       || 0;
        pPct  = settings.commissionVirtualCardParentPct || 0;
        gpPct = settings.commissionVirtualCardGpPct     || 0;
        pointsEarned = 25;
      } else if (type === 'subscription') {
        dPct  = settings.commissionSubscriptionPct       || 0;
        pPct  = settings.commissionSubscriptionParentPct || 0;
        gpPct = settings.commissionSubscriptionGpPct     || 0;
        pointsEarned = isStreamingSub ? 5 : 10;
      } else {
        dPct  = settings.commissionPurchasePct       || 0;
        pPct  = settings.commissionPurchaseParentPct || 0;
        gpPct = settings.commissionPurchaseGpPct     || 0;
        pointsEarned = 1;
      }
      directCommissionUSD      = parseFloat((transactionAmountUSD * dPct  / 100).toFixed(4));
      parentCommissionUSD      = parseFloat((transactionAmountUSD * pPct  / 100).toFixed(4));
      grandparentCommissionUSD = parseFloat((transactionAmountUSD * gpPct / 100).toFixed(4));
      // HTG equivalents for display/logs
      directCommissionHTG      = parseFloat((directCommissionUSD      * exchangeRate).toFixed(2));
      parentCommissionHTG      = parseFloat((parentCommissionUSD      * exchangeRate).toFixed(2));
      grandparentCommissionHTG = parseFloat((grandparentCommissionUSD * exchangeRate).toFixed(2));
    } else {
      // ── Fixed HTG amounts (default) ──
      if (type === 'subscription') {
        directCommissionHTG      = settings.commissionSubscriptionHTG       || 75;
        parentCommissionHTG      = settings.commissionSubscriptionParentHTG || 15;
        grandparentCommissionHTG = settings.commissionSubscriptionGpHTG     || 10;
        pointsEarned = isStreamingSub ? 5 : 10;
      } else if (type === 'virtual_card') {
        directCommissionHTG      = settings.commissionVirtualCardHTG       || 350;
        parentCommissionHTG      = settings.commissionVirtualCardParentHTG || 40;
        grandparentCommissionHTG = settings.commissionVirtualCardGpHTG     || 10;
        pointsEarned = 25;
      } else {
        directCommissionHTG      = settings.commissionPurchaseHTG       || 2;
        parentCommissionHTG      = settings.commissionPurchaseParentHTG || 0.5;
        grandparentCommissionHTG = settings.commissionPurchaseGpHTG     || 0.5;
        pointsEarned = 1;
      }
      directCommissionUSD      = directCommissionHTG      / exchangeRate;
      parentCommissionUSD      = parentCommissionHTG      / exchangeRate;
      grandparentCommissionUSD = grandparentCommissionHTG / exchangeRate;
    }
    
    const batch = writeBatch(db);
    
    // 1. Update Direct Affiliate
    batch.update(affiliateRef, {
      balance: increment(directCommissionUSD),
      directRevenue: increment(directCommissionUSD),
      totalEarnings: increment(directCommissionUSD),
      points: increment(pointsEarned),
      monthlySales: increment(1),
      updatedAt: serverTimestamp()
    });

    // 1b. Record in Sales collection for analytics
    const saleRef = doc(collection(db, 'sales'));
    batch.set(saleRef, {
      affiliateId,
      affiliateName: affiliateData.name,
      type,
      itemName: itemName || (type === 'virtual_card' ? 'Carte MasterCard' : 'Produit Rapide'),
      commission: directCommissionUSD,
      commissionHTG: directCommissionHTG, // Log original HTG
      points: pointsEarned,
      createdAt: serverTimestamp()
    });
    
    // 2. Update Parent Affiliate (Direct Sponsor)
    if (affiliateData.parentAffiliateId) {
      const parentRef = doc(db, 'affiliates', affiliateData.parentAffiliateId);
      const parentSnap = await getDoc(parentRef);
      
      if (parentSnap.exists()) {
        batch.update(parentRef, {
          balance: increment(parentCommissionUSD),
          indirectRevenue: increment(parentCommissionUSD),
          totalEarnings: increment(parentCommissionUSD),
          updatedAt: serverTimestamp()
        });
        
        // Notification for parent (Level 1)
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          affiliateId: affiliateData.parentAffiliateId,
          title: "Commission Directe (Filleul)",
          message: `Niveau 1: Vous avez reçu ${parentCommissionHTG} Goud (~${parentCommissionUSD.toFixed(2)} $) suite à une vente de ${affiliateData.name}.`,
          type: 'revenue',
          read: false,
          createdAt: serverTimestamp()
        });
      }
    }

    // 3. Update Grandparent Affiliate (Indirect Sponsor)
    if (affiliateData.grandparentAffiliateId) {
      const grandparentRef = doc(db, 'affiliates', affiliateData.grandparentAffiliateId);
      const grandparentSnap = await getDoc(grandparentRef);
      
      if (grandparentSnap.exists()) {
        batch.update(grandparentRef, {
          balance: increment(grandparentCommissionUSD),
          indirectRevenue: increment(grandparentCommissionUSD),
          totalEarnings: increment(grandparentCommissionUSD),
          updatedAt: serverTimestamp()
        });
        
        // Notification for grandparent (Level 2)
        const gNotifRef = doc(collection(db, 'notifications'));
        batch.set(gNotifRef, {
          affiliateId: affiliateData.grandparentAffiliateId,
          title: "Commission Indirecte (Filleul N2)",
          message: `Niveau 2: Vous avez reçu ${grandparentCommissionHTG} Goud (~${grandparentCommissionUSD.toFixed(2)} $) via l'affilié ${affiliateData.name}.`,
          type: 'revenue',
          read: false,
          createdAt: serverTimestamp()
        });
      }
    }

    // 4. Update Additional Sponsors (Flexible Direct/Indirect)
    if (affiliateData.additionalSponsors && affiliateData.additionalSponsors.length > 0) {
      for (const sponsorReq of affiliateData.additionalSponsors) {
        const extraRef = doc(db, 'affiliates', sponsorReq.id);
        const isDirectSponsor = sponsorReq.type === 'direct';
        const commissionHTG = isDirectSponsor ? parentCommissionHTG : grandparentCommissionHTG;
        const commissionUSD = commissionHTG / exchangeRate;

        batch.update(extraRef, {
          balance: increment(commissionUSD),
          indirectRevenue: increment(commissionUSD),
          totalEarnings: increment(commissionUSD),
          updatedAt: serverTimestamp()
        });

        // Notification for extra sponsor
        const exNotifRef = doc(collection(db, 'notifications'));
        batch.set(exNotifRef, {
          affiliateId: sponsorReq.id,
          title: isDirectSponsor ? "Commission Directe" : "Commission Indirecte",
          message: `Vous avez reçu ${commissionHTG} Goud (~${commissionUSD.toFixed(2)} $) via l'affilié ${affiliateData.name}.`,
          type: 'revenue',
          read: false,
          createdAt: serverTimestamp()
        });
      }
    }

    // Create notification for direct affiliate
    const directNotifRef = doc(collection(db, 'notifications'));
    batch.set(directNotifRef, {
      affiliateId: affiliateId,
      title: "Nouvelle Vente !",
      message: `Félicitations ! Vous avez gagné ${directCommissionHTG} Goud et ${pointsEarned} points.`,
      type: 'revenue',
      read: false,
      createdAt: serverTimestamp()
    });
    
    await batch.commit();
    
    // Check for level up (async)
    const updatedAffiliateSnap = await getDoc(affiliateRef);
    if (updatedAffiliateSnap.exists()) {
      const updatedData = updatedAffiliateSnap.data() as Affiliate;
      const { level: newLevel } = getAffiliateLevelInfo(updatedData.points || 0);
      
      if (newLevel !== updatedData.level) {
        await updateDoc(affiliateRef, { level: newLevel });
        await createNotification(affiliateId, "Niveau Supérieur !", `Félicitations ! Vous êtes maintenant au niveau ${newLevel}.`, 'level_up');
      }
    }
  } catch (error) {
    handleFirestoreError(error, 'update', 'affiliates', auth);
  }
};

/**
 * Searches for an affiliate by name (case-insensitive partial match).
 */
export const searchAffiliatesByName = async (name: string): Promise<Affiliate[]> => {
  try {
    const q = query(
      collection(db, 'affiliates'),
      orderBy('name'),
      where('name', '>=', name),
      where('name', '<=', name + '\uf8ff')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Affiliate));
  } catch (error) {
    // Silently fail or log
    console.error("Search error:", error);
    return [];
  }
};

/**
 * Searches for a client by phone number.
 */
export const searchClientsByPhone = async (phone: string): Promise<Client[]> => {
  try {
    const q = query(
      collection(db, 'clients'),
      where('phone', '==', phone)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
  } catch (error) {
    console.error("Client search error:", error);
    return [];
  }
};

/**
 * Hooks for managing clients.
 */
export const useAllClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      try { handleFirestoreError(error, 'list', 'clients', auth); } catch (e) {}
    });

    return () => unsubscribe();
  }, []);

  return { clients, loading };
};

export const saveClient = async (clientData: Partial<Client>, id?: string) => {
  const dataToSave = { ...clientData };
  delete dataToSave.id;

  try {
    if (id) {
      const clientRef = doc(db, 'clients', id);
      await updateDoc(clientRef, {
        ...dataToSave,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, 'clients'), {
        ...dataToSave,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, id ? 'update' : 'create', 'clients', auth);
  }
};

export const deleteClient = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'clients', id));
  } catch (error) {
    handleFirestoreError(error, 'delete', 'clients', auth);
  }
};

/**
 * Gets direct and indirect referrals for an affiliate.
 */
export const getAffiliateReferrals = async (affiliateId: string) => {
  try {
    // Direct Referrals (parentAffiliateId == affiliateId)
    const directQ = query(collection(db, 'affiliates'), where('parentAffiliateId', '==', affiliateId));
    const directSnap = await getDocs(directQ);
    const directReferrals = directSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Affiliate));

    // Indirect Referrals (grandparentAffiliateId == affiliateId)
    const indirectQ = query(collection(db, 'affiliates'), where('grandparentAffiliateId', '==', affiliateId));
    const indirectSnap = await getDocs(indirectQ);
    const indirectReferrals = indirectSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Affiliate));

    return { directReferrals, indirectReferrals };
  } catch (error) {
    console.error("Error fetching referrals:", error);
    return { directReferrals: [], indirectReferrals: [] };
  }
};

/**
 * Admin hook to see all unified wallet transactions
 */
export const useAllWalletTransactions = () => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'wallet_transactions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txList: WalletTransaction[] = [];
      snapshot.forEach((doc) => {
        txList.push({ id: doc.id, ...doc.data() } as WalletTransaction);
      });
      setTransactions(txList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { transactions, loading };
};

/**
 * Admin action to approve/reject a wallet transaction (specifically for deposits)
 */
export const updateWalletTransactionStatus = async (transactionId: string, status: 'approved' | 'rejected') => {
  try {
    const txRef = doc(db, 'wallet_transactions', transactionId);
    const txSnap = await getDoc(txRef);
    
    if (!txSnap.exists()) throw new Error("Transaction not found");
    const txData = txSnap.data() as WalletTransaction;
    if (txData.status !== 'pending') throw new Error("Transaction is not pending");

    const batch = writeBatch(db);
    batch.update(txRef, { status, updatedAt: serverTimestamp() });

    // If it's a deposit and approved, add to affiliate balance
    if (txData.type === 'deposit' && status === 'approved') {
      const affRef = doc(db, 'affiliates', txData.affiliateId);
      const affSnap = await getDoc(affRef);
      if (affSnap.exists()) {
        const affData = affSnap.data() as Affiliate;
        batch.update(affRef, {
          balance: (affData.balance || 0) + txData.amount,
          updatedAt: serverTimestamp()
        });
      }
    }

    await batch.commit();
  } catch (error) {
    console.error("Error updating transaction status:", error);
    throw error;
  }
};

/**
 * Ensures an affiliate has a unique 8-digit wallet ID.
 */
export const ensureWalletId = async (affiliate: Affiliate) => {
  if (affiliate.walletId) return affiliate.walletId;

  // Generate a random 8-digit string
  let isUnique = false;
  let newWalletId = '';

  while (!isUnique) {
    newWalletId = Math.floor(10000000 + Math.random() * 90000000).toString();
    const q = query(collection(db, 'affiliates'), where('walletId', '==', newWalletId));
    const snap = await getDocs(q);
    if (snap.empty) {
      isUnique = true;
    }
  }

  if (affiliate.id) {
    await updateDoc(doc(db, 'affiliates', affiliate.id), {
      walletId: newWalletId,
      updatedAt: serverTimestamp()
    });
  }

  return newWalletId;
};

/**
 * Ensures an affiliate has a unique 8-digit commission wallet ID.
 */
export const ensureCommissionWalletId = async (affiliate: Affiliate) => {
  if (affiliate.commissionWalletId) return affiliate.commissionWalletId;

  let isUnique = false;
  let newId = '';

  while (!isUnique) {
    newId = 'C' + Math.floor(1000000 + Math.random() * 9000000).toString();
    const q = query(collection(db, 'affiliates'), where('commissionWalletId', '==', newId));
    const snap = await getDocs(q);
    if (snap.empty) isUnique = true;
  }

  if (affiliate.id) {
    await updateDoc(doc(db, 'affiliates', affiliate.id), {
      commissionWalletId: newId,
      updatedAt: serverTimestamp(),
    });
  }

  return newId;
};

/**
 * Searches for an affiliate by wallet ID.
 */
export const findAffiliateByWalletId = async (walletId: string): Promise<Affiliate | null> => {
  const q = query(collection(db, 'affiliates'), where('walletId', '==', walletId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Affiliate;
};

/**
 * Submits a transfer request between affiliates (pending admin approval).
 */
export const submitTransfer = async (sender: Affiliate, recipientWalletId: string, amount: number): Promise<string> => {
  if (amount > sender.balance) throw new Error("Solde insuffisant.");
  if (amount <= 0) throw new Error("Montant invalide.");

  const recipient = await findAffiliateByWalletId(recipientWalletId);
  if (!recipient) throw new Error("Destinataire introuvable.");
  if (recipient.id === sender.id) throw new Error("Vous ne pouvez pas vous envoyer d'argent à vous-même.");

  // Create a pending transfer transaction
  try {
    await addDoc(collection(db, 'wallet_transactions'), {
      affiliateId: sender.id,
      type: 'transfer',
      amount: amount,
      status: 'pending',
      description: `Demande de transfert vers ${recipient.name} (${recipientWalletId})`,
      relatedAffiliateId: recipient.id,
      relatedAffiliateName: recipient.name,
      recipientWalletId: recipientWalletId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'create', 'wallet_transactions', auth);
  }

  return recipient.name;
};

/**
 * Approves a transfer request and updates balances.
 */
export const approveTransfer = async (transaction: WalletTransaction) => {
  if (transaction.status !== 'pending' || transaction.type !== 'transfer') {
    throw new Error("Cette transaction ne peut pas être approuvée.");
  }

  const senderRef = doc(db, 'affiliates', transaction.affiliateId);
  const recipientRef = doc(db, 'affiliates', transaction.relatedAffiliateId!);

  await runTransaction(db, async (transaction_db) => {
    const senderSnap = await transaction_db.get(senderRef);
    const recipientSnap = await transaction_db.get(recipientRef);

    if (!senderSnap.exists() || !recipientSnap.exists()) {
      throw new Error("Expéditeur ou destinataire introuvable.");
    }

    const senderData = senderSnap.data() as Affiliate;
    if (senderData.balance < transaction.amount) {
      throw new Error("Solde de l'expéditeur insuffisant pour approuver ce transfert.");
    }

    // Deduct from sender
    transaction_db.update(senderRef, {
      balance: increment(-transaction.amount),
      updatedAt: serverTimestamp()
    });

    // Add to recipient
    transaction_db.update(recipientRef, {
      balance: increment(transaction.amount),
      updatedAt: serverTimestamp()
    });

    // Mark original request as approved
    transaction_db.update(doc(db, 'wallet_transactions', transaction.id!), {
      status: 'approved',
      updatedAt: serverTimestamp()
    });

    // Create a corresponding 'received' transaction for the recipient
    const recipientTxRef = doc(collection(db, 'wallet_transactions'));
    transaction_db.set(recipientTxRef, {
      affiliateId: transaction.relatedAffiliateId,
      type: 'transfer_received',
      amount: transaction.amount,
      status: 'completed',
      description: `Transfert reçu de ${senderData.name}`,
      relatedAffiliateId: transaction.affiliateId,
      relatedAffiliateName: senderData.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });
};

/**
 * Rejects a transfer request.
 */
export const rejectTransfer = async (transactionId: string) => {
  const transactionRef = doc(db, 'wallet_transactions', transactionId);
  await updateDoc(transactionRef, {
    status: 'rejected',
    updatedAt: serverTimestamp()
  });
};

/**
 * Submits a deposit request.
 */
export const submitDepositRequest = async (affiliate: Affiliate, amount: number, method: string) => {
  if (amount <= 0) throw new Error("Montant invalide.");

  try {
    await addDoc(collection(db, 'wallet_transactions'), {
      affiliateId: affiliate.id,
      type: 'deposit',
      amount: amount,
      status: 'pending',
      method: method,
      description: `Demande de dépôt via ${method}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'create', 'wallet_transactions', auth);
  }
};

/**
 * Unified way to get all wallet transactions.
 */
import { WalletTransaction } from '../types';

export const useWalletTransactions = (affiliateId: string | null) => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!affiliateId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'wallet_transactions'),
      where('affiliateId', '==', affiliateId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WalletTransaction[];
      setTransactions(data);
      setLoading(false);
    }, (error) => {
      console.error("Transactions fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [affiliateId]);

  return { transactions, loading };
};
