import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  serverTimestamp,
  setDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { signInWithGooglePopup, mapGoogleAuthError } from '../lib/google-auth';
import { AdminAccount, AdminLog } from '../types';
import { useState, useEffect } from 'react';

const ADMINS_COLLECTION = 'admin_accounts';
const LOGS_COLLECTION = 'admin_login_logs';

// ── Admin API helper ──────────────────────────────────────────────────────────
async function adminApi(method: string, path: string, body?: object): Promise<any> {
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024'),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur serveur (${res.status})`);
  return data;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export const useAdminAccounts = () => {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, ADMINS_COLLECTION), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAdmins(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AdminAccount[]);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching admin accounts:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { admins, loading };
};

export const useAdminLogs = (max: number = 50) => {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, LOGS_COLLECTION), orderBy('timestamp', 'desc'), limit(max));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AdminLog[]);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, [max]);

  return { logs, loading };
};

// ── Account CRUD (all via Admin SDK API) ──────────────────────────────────────

export const saveAdminAccount = async (adminData: Partial<AdminAccount>, id?: string) => {
  await adminApi('POST', '/api/admin/account', { ...adminData, ...(id && { id }) });
};

export const deleteAdminAccount = async (id: string) => {
  await adminApi('DELETE', `/api/admin/account/${id}`);
};

// ── Helper: setup client-side admin session for real-time reads ───────────────
// After server confirms login, we try to establish an anonymous Firebase Auth
// session and write to admin_uids so isAdmin() works for client SDK onSnapshot hooks.
async function setupClientAdminSession(adminId: string, fullName: string): Promise<void> {
  try {
    if (!auth.currentUser) await signInAnonymously(auth);
    const uid = auth.currentUser?.uid;
    if (uid) {
      await setDoc(doc(db, 'admin_uids', uid), {
        adminId,
        fullName,
        updatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    // Non-critical: server login already succeeded.
    // Only real-time reads requiring isAdmin() will be affected.
    console.warn('Could not establish client-side admin session (anonymous auth may be disabled):', err);
  }
}

// ── Admin Login (credentials verified server-side, no Firestore rules needed) ─

export const checkAdminLogin = async (
  fullName: string,
  password: string,
  loginCode?: string
): Promise<{ success: boolean; admin?: AdminAccount; error?: string }> => {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, password, loginCode })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) return { success: false, error: data.error || 'Erreur de connexion.' };

    const adminData = data.admin as AdminAccount;
    await setupClientAdminSession(adminData.id!, adminData.fullName);

    return { success: true, admin: adminData };
  } catch (error) {
    console.error("Login Error:", error);
    return { success: false, error: "Une erreur est survenue lors de la connexion." };
  }
};

// ── Admin: Link Google account to existing admin (first-time setup) ──────────

export const linkAdminGoogle = async (
  loginCode: string,
  googleEmail: string,
  googleUid: string
): Promise<{ success: boolean; admin?: AdminAccount; error?: string }> => {
  try {
    const res = await fetch('/api/admin/link-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginCode, email: googleEmail, uid: googleUid }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data.error || 'Erreur de liaison.' };

    const adminData = data.admin as AdminAccount;
    try {
      await setDoc(doc(db, 'admin_uids', googleUid), {
        adminId: adminData.id,
        fullName: adminData.fullName,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Could not write admin_uids after link:', err);
    }
    return { success: true, admin: adminData };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur lors de la liaison.' };
  }
};

// ── Admin Google Login ────────────────────────────────────────────────────────

export const loginAdminWithGoogle = async (): Promise<{ success: boolean; admin?: AdminAccount; error?: string; googleEmail?: string; googleUid?: string }> => {
  try {
    const result = await signInWithGooglePopup();
    const googleEmail = result.user.email?.toLowerCase() || '';
    const googleUid = result.user.uid;

    // Verify server-side (writes handled by Admin SDK)
    const res = await fetch('/api/admin/verify-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: googleEmail, uid: googleUid })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { success: false, error: data.error || 'Accès refusé.', googleEmail, googleUid };
    }

    const adminData = data.admin as AdminAccount;

    // Google user already has Firebase Auth session — write admin_uids
    try {
      await setDoc(doc(db, 'admin_uids', googleUid), {
        adminId: adminData.id,
        fullName: adminData.fullName,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Could not write admin_uids for Google admin:', err);
    }

    return { success: true, admin: adminData };
  } catch (error: any) {
    const mapped = mapGoogleAuthError(error);
    if (!mapped) return { success: false, error: '' };
    console.error('Google admin login error:', error);
    return { success: false, error: mapped };
  }
};
