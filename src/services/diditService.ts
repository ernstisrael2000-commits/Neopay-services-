import type { AdminAccount } from '../types';

export interface DiditChallenge {
  challengeId: string;
  sessionId: string;
  url: string;
  expiresAt: string;
}

export type DiditVerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface DiditStatus {
  challengeId: string;
  status: DiditVerificationStatus;
  expiresAt: string;
}

export const getDiditVerificationStatus = async (challengeId: string): Promise<DiditStatus> => {
  const res = await fetch(`/api/didit/status/${encodeURIComponent(challengeId)}`, { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Impossible de vérifier la session Didit.');
  return data as DiditStatus;
};

export const completeAdminDidit = async (challengeId: string): Promise<{ admin: AdminAccount; firebaseToken: string }> => {
  const res = await fetch('/api/admin/didit/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || 'La vérification faciale administrateur n’a pas été validée.');
  return { admin: data.admin as AdminAccount, firebaseToken: data.firebaseToken as string };
};