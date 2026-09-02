import type { AdminAccount } from '../types';

export interface DiditChallenge {
  challengeId: string;
  sessionId: string;
  url: string;
  expiresAt: string;
  mode?: 'full' | 'biometric';
}

export type DiditVerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface DiditStatus {
  challengeId: string;
  status: DiditVerificationStatus;
  mode?: 'full' | 'biometric';
  expiresAt: string;
}

export const getDiditVerificationStatus = async (challengeId: string): Promise<DiditStatus> => {
  const res = await fetch(`/api/didit/status/${encodeURIComponent(challengeId)}`, { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Impossible de vérifier la session Didit.');
  return data as DiditStatus;
};

export const startClientDiditSession = async (
  purpose: 'card_issue' | 'card_details' | 'account_change' | 'financial_risk',
): Promise<DiditChallenge> => {
  const res = await fetch('/api/client/didit/session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purpose }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.challenge) throw new Error(data.error || 'La vérification Didit est indisponible.');
  return data.challenge as DiditChallenge;
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