import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
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
  method: 'MonCash' | 'Natcash'
) => {
  if (amount > affiliate.balance) {
    throw new Error("Montant supérieur au solde disponible.");
  }
  if (amount < 20) {
    throw new Error("Le montant minimum de retrait est de 20 Goud.");
  }

  await addDoc(collection(db, 'withdrawals'), {
    affiliateId: affiliate.id,
    affiliateName: affiliate.name,
    affiliateCode: affiliate.code,
    amount,
    method,
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
        ...dataToSave,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, 'affiliates');
  }
};

export const updateWithdrawalStatus = async (
  requestId: string, 
  status: 'approved' | 'rejected', 
  reason?: string
) => {
  const requestRef = doc(db, 'withdrawals', requestId);
  const requestSnap = await getDocs(query(collection(db, 'withdrawals'), where('__name__', '==', requestId)));
  
  if (requestSnap.empty) return;
  const requestData = requestSnap.docs[0].data() as WithdrawalRequest;

  if (status === 'approved') {
    // Deduct from affiliate balance
    const affiliateRef = doc(db, 'affiliates', requestData.affiliateId);
    const affiliateSnap = await getDocs(query(collection(db, 'affiliates'), where('__name__', '==', requestData.affiliateId)));
    
    if (!affiliateSnap.empty) {
      const affiliateData = affiliateSnap.docs[0].data() as Affiliate;
      await updateDoc(affiliateRef, {
        balance: affiliateData.balance - requestData.amount
      });
    }
  }

  await updateDoc(requestRef, {
    status,
    rejectionReason: reason || '',
    updatedAt: serverTimestamp()
  });
};

export const deleteAffiliate = async (id: string) => {
  try {
    const { deleteDoc } = await import('firebase/firestore');
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
