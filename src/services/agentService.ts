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
  increment,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError } from '../lib/firebase-errors';
import { Agent, WalletTransaction, Affiliate } from '../types';

/**
 * Creates a new agent with an automatic 8-digit ID.
 */
export const createAgent = async (name: string, phone: string, email?: string) => {
  try {
    let agentCode = '';
    let isUnique = false;
    while (!isUnique) {
      agentCode = Math.floor(10000000 + Math.random() * 90000000).toString();
      const q = query(collection(db, 'agents'), where('agentCode', '==', agentCode));
      const snap = await getDocs(q);
      if (snap.empty) isUnique = true;
    }

    const agentData: Partial<Agent> = {
      agentCode,
      name,
      phone,
      ...(email && { email }),
      balance: 0,
      status: 'active',
      walletId: `W-AGT-${agentCode}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await addDoc(collection(db, 'agents'), agentData);
    return agentCode;
  } catch (error) {
    handleFirestoreError(error, 'create', 'agents', auth);
  }
};

export const useAllAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'agents'), orderBy('createdAt', 'desc'), limit(200));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as Agent[];
      setAgents(data);
      setLoading(false);
    }, (error: any) => {
      setLoading(false);
      try { handleFirestoreError(error, 'list', 'agents', auth); } catch (e) {}
    });

    return () => unsubscribe();
  }, []);

  return { agents, loading };
};

export const updateAgentBalance = async (agentId: string, amount: number) => {
  try {
    const agentRef = doc(db, 'agents', agentId);
    await updateDoc(agentRef, {
      balance: increment(amount),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'update', 'agents', auth);
  }
};

export const getAgentByEmail = async (email: string): Promise<Agent | null> => {
  try {
    const q = query(collection(db, 'agents'), where('email', '==', email));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Agent;
  } catch (error) {
    handleFirestoreError(error, 'get', 'agents', auth);
    return null;
  }
};

export const getAgentByCode = async (agentCode: string): Promise<Agent | null> => {
  try {
    const q = query(collection(db, 'agents'), where('agentCode', '==', agentCode));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Agent;
  } catch (error) {
    handleFirestoreError(error, 'get', 'agents', auth);
    return null;
  }
};

/**
 * Basic login for agents using their code and phone.
 * In a real app, this should involve proper authentication.
 */
export const loginAgent = async (agentCode: string, phone: string): Promise<Agent | null> => {
  try {
    const q = query(
      collection(db, 'agents'), 
      where('agentCode', '==', agentCode),
      where('phone', '==', phone),
      where('status', '==', 'active')
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Agent;
  } catch (error) {
    handleFirestoreError(error, 'get', 'agents', auth);
    return null;
  }
};

/**
 * Submits a deposit request via an agent.
 */
export const submitAgentDepositRequest = async (affiliateId: string, agentCode: string, amount: number) => {
  try {
    const agent = await getAgentByCode(agentCode);
    if (!agent) throw new Error("Agent non trouvé.");
    if (agent.status === 'inactive') throw new Error("Cet agent est actuellement inactif.");

    const transactionData = {
      affiliateId,
      agentId: agent.id,
      agentCode: agent.agentCode,
      type: 'agent_deposit',
      amount,
      status: 'pending_agent',
      description: `Dépôt via Agent ${agent.name}`,
      method: `Agent: ${agent.name}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await addDoc(collection(db, 'wallet_transactions'), transactionData);
  } catch (error) {
    handleFirestoreError(error, 'create', 'wallet_transactions', auth);
    throw error;
  }
};

/**
 * Agent approves a deposit request.
 * Uses a transaction to ensure atomicity.
 */
export const approveAgentDeposit = async (transaction: WalletTransaction) => {
  if (!transaction.id || !transaction.agentId || !transaction.affiliateId) return;

  try {
    await runTransaction(db, async (txn) => {
      const agentRef = doc(db, 'agents', transaction.agentId!);
      const affiliateRef = doc(db, 'affiliates', transaction.affiliateId);
      const txRef = doc(db, 'wallet_transactions', transaction.id!);

      const agentSnap = await txn.get(agentRef);
      const affiliateSnap = await txn.get(affiliateRef);

      if (!agentSnap.exists()) throw new Error("Agent non trouvé.");
      if (!affiliateSnap.exists()) throw new Error("Affilié non trouvé.");

      const agentData = agentSnap.data() as Agent;
      if (agentData.balance < transaction.amount) {
        throw new Error("Solde agent insuffisant.");
      }

      // Update Agent balance
      txn.update(agentRef, {
        balance: increment(-transaction.amount),
        updatedAt: serverTimestamp()
      });

      // Update Affiliate balance
      txn.update(affiliateRef, {
        balance: increment(transaction.amount),
        updatedAt: serverTimestamp()
      });

      // Update transaction status
      txn.update(txRef, {
        status: 'approved',
        updatedAt: serverTimestamp()
      });

      // Create notification for affiliate
      const notifRef = doc(collection(db, 'notifications'));
      txn.set(notifRef, {
        affiliateId: transaction.affiliateId,
        title: "Dépôt Réussi",
        message: `Votre dépôt de ${transaction.amount} Goud via l'agent ${agentData.name} a été validé.`,
        type: 'bonus',
        read: false,
        createdAt: serverTimestamp()
      });
    });
  } catch (error) {
    handleFirestoreError(error, 'update', 'wallet_transactions', auth);
    throw error;
  }
};

export const rejectAgentDeposit = async (transactionId: string) => {
  try {
    const txRef = doc(db, 'wallet_transactions', transactionId);
    await updateDoc(txRef, {
      status: 'rejected',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'update', 'wallet_transactions', auth);
  }
};

export const useAgentDataByUid = (uid: string | null) => {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'agents'), where('uid', '==', uid));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      if (!snapshot.empty) {
        setAgent({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Agent);
      } else {
        setAgent(null);
      }
      setLoading(false);
    }, (error: any) => {
      setLoading(false);
      try { handleFirestoreError(error, 'get', 'agents', auth); } catch (e) {}
    });

    return () => unsubscribe();
  }, [uid]);

  return { agent, loading };
};

export const useAgentWithdrawals = (agentId: string | null) => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'wallet_transactions'),
      where('agentId', '==', agentId),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as WalletTransaction[];
      setTransactions(data);
      setLoading(false);
    }, (error: any) => {
      setLoading(false);
      try { handleFirestoreError(error, 'list', 'wallet_transactions', auth); } catch (e) {}
    });

    return () => unsubscribe();
  }, [agentId]);

  return { transactions, loading };
};
