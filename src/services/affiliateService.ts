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
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Affiliate, WithdrawalRequest, AffiliateRequest } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
    });

    return () => unsubscribe();
  }, []);

  return { topAffiliates, loading };
};

export const submitWithdrawal = async (
  affiliate: Affiliate, 
  amount: number, 
  method: 'MonCash' | 'NatCash',
  accountNumber: string
) => {
  if (amount > affiliate.balance) {
    throw new Error("Montant supérieur au solde disponible.");
  }
  if (amount < 20) {
    throw new Error("Le montant minimum de retrait est de 20 Goud.");
  }
  if (!accountNumber) {
    throw new Error("Le numéro de compte est obligatoire.");
  }

  await addDoc(collection(db, 'withdrawals'), {
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
    });

    return () => unsubscribe();
  }, [affiliateId]);

  return { withdrawals, loading };
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
    handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, 'affiliates');
  }
};

/**
 * Updates the status of a withdrawal request and adjusts affiliate balance if approved.
 */
export const updateWithdrawalStatus = async (
  requestId: string, 
  status: 'approved' | 'rejected', 
  reason?: string
) => {
  const requestRef = doc(db, 'withdrawals', requestId);
  const requestSnap = await getDoc(requestRef);
  
  if (!requestSnap.exists()) return;
  const requestData = requestSnap.data() as WithdrawalRequest;

  if (status === 'approved') {
    // Deduct from affiliate balance
    const affiliateRef = doc(db, 'affiliates', requestData.affiliateId);
    const affiliateSnap = await getDoc(affiliateRef);
    
    if (affiliateSnap.exists()) {
      const affiliateData = affiliateSnap.data() as Affiliate;
      await updateDoc(affiliateRef, {
        balance: (affiliateData.balance || 0) - requestData.amount
      });
    }
  }

  await updateDoc(requestRef, {
    status,
    rejectionReason: reason || '',
    updatedAt: serverTimestamp()
  });
};

/**
 * Deletes an affiliate account.
 */
export const deleteAffiliate = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'affiliates', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'affiliates');
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
    handleFirestoreError(error, OperationType.CREATE, 'affiliate_requests');
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
    });

    return () => unsubscribe();
  }, []);

  return { requests, loading };
};

export const updateAffiliateRequestStatus = async (requestId: string, status: 'approved' | 'rejected') => {
  try {
    const requestRef = doc(db, 'affiliate_requests', requestId);
    await updateDoc(requestRef, {
      status,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'affiliate_requests');
  }
};

export const useMonthlyRankings = () => {
  const [rankings, setRankings] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all affiliates and filter/sort client-side to avoid index requirements
    const q = query(collection(db, 'affiliates'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Affiliate))
        .filter(a => a.isMonthlyWinner === true)
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, 3);
        
      setRankings(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching rankings:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { rankings, loading };
};

export const clearMonthlyWinners = async () => {
  try {
    const snapshot = await getDocs(query(collection(db, 'affiliates'), where('isMonthlyWinner', '==', true)));
    const promises = snapshot.docs.map(docSnap => 
      updateDoc(doc(db, 'affiliates', docSnap.id), {
        isMonthlyWinner: false,
        updatedAt: serverTimestamp()
      })
    );
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'affiliates');
  }
};

export const awardMonthlyPrizes = async () => {
  try {
    // 1. Clear all current monthly winners first to ensure a fresh start
    const winnersQuery = query(collection(db, 'affiliates'), where('isMonthlyWinner', '==', true));
    const winnersSnap = await getDocs(winnersQuery);
    const clearPromises = winnersSnap.docs.map(d => updateDoc(doc(db, 'affiliates', d.id), { 
      isMonthlyWinner: false,
      updatedAt: serverTimestamp() 
    }));
    await Promise.all(clearPromises);

    // 2. Get all affiliates to calculate new winners based on points
    const snapshot = await getDocs(collection(db, 'affiliates'));
    const affiliates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Affiliate[];

    // 3. Filter those with points > 0 and sort descending
    const eligible = affiliates
      .filter(a => (a.points || 0) > 0)
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 3);

    if (eligible.length === 0) return [];

    const prizes = [500, 250, 150];
    const promises = [];
    const awardedWinners: Affiliate[] = [];

    // 4. Award prizes and mark as winners
    for (let i = 0; i < eligible.length; i++) {
      const affiliateRef = doc(db, 'affiliates', eligible[i].id!);
      const prize = prizes[i];
      
      promises.push(updateDoc(affiliateRef, {
        balance: (eligible[i].balance || 0) + prize,
        isMonthlyWinner: true,
        updatedAt: serverTimestamp()
      }));
      
      awardedWinners.push({
        ...eligible[i],
        balance: (eligible[i].balance || 0) + prize,
        isMonthlyWinner: true
      });
    }

    await Promise.all(promises);
    return awardedWinners;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'affiliates');
    throw error;
  }
};

export const resetMonthlyStats = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'affiliates'));
    const promises = snapshot.docs.map(docSnap => 
      updateDoc(doc(db, 'affiliates', docSnap.id), {
        monthlyReferredClients: 0,
        monthlySales: 0,
        points: 0,
        isMonthlyWinner: false, // Reset winner status
        updatedAt: serverTimestamp()
      })
    );
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'affiliates');
  }
};
