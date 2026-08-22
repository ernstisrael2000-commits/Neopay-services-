import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy,
  limit,
} from 'firebase/firestore';
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
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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
): Promise<{ success: boolean; admin?: AdminAccount; error?: string; pending2fa?: boolean; sessionId?: string; maskedEmail?: string }> => {
  try {
    const res = await fetch('/api/admin/link-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginCode, idToken: await auth.currentUser?.getIdToken() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data.error || 'Erreur de liaison.' };

    // 2FA pending: return session info for OTP step
    if (data.pending2fa) {
      return { success: false, pending2fa: true, sessionId: data.sessionId, maskedEmail: data.maskedEmail };
    }

    return { success: true, admin: data.admin as AdminAccount };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur lors de la liaison.' };
  }
};

// ── Admin Google Login ────────────────────────────────────────────────────────

export const loginAdminWithGoogle = async (): Promise<{
  success: boolean;
  admin?: AdminAccount;
  error?: string;
  googleEmail?: string;
  googleUid?: string;
  pending2fa?: boolean;
  sessionId?: string;
  maskedEmail?: string;
}> => {
  try {
    const result = await signInWithGooglePopup();
    const googleEmail = result.user.email?.toLowerCase() || '';
    const googleUid = result.user.uid;

    // Verify server-side (writes handled by Admin SDK)
    const res = await fetch('/api/admin/verify-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: await result.user.getIdToken() })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { success: false, error: data.error || 'Accès refusé.', googleEmail, googleUid };
    }

    // 2FA pending
    if (data.pending2fa) {
      return { success: false, pending2fa: true, sessionId: data.sessionId, maskedEmail: data.maskedEmail, googleEmail, googleUid };
    }

    return { success: true, admin: data.admin as AdminAccount };
  } catch (error: any) {
    const mapped = mapGoogleAuthError(error);
    if (!mapped) return { success: false, error: '' };
    console.error('Google admin login error:', error);
    return { success: false, error: mapped };
  }
};
