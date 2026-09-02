import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';
import { fileToBase64 } from '../lib/fileToBase64';
import type { HeyQOCard, HeyQOCardTransaction, HeyQOCustomer } from '../types';
import type { DiditChallenge } from './diditService';

export interface CardsSnapshot {
  configured: boolean;
  environment?: 'sandbox' | 'production' | 'custom';
  webhookConfigured?: boolean;
  customer: HeyQOCustomer | null;
  cards: HeyQOCard[];
  cardTransactions: HeyQOCardTransaction[];
  diagnostics?: Array<{ step: string; status: string; detail?: string }>;
  stale?: boolean;
}

export interface CardsSecuritySnapshot {
  pinConfigured: boolean;
  emailTwoFactorEnabled: boolean;
  unlocked: boolean;
  identityMatched: boolean;
  maskedEmail: string;
}

export interface SecureCardDetails {
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
  cardholderName?: string;
  brand?: string;
  secureViewUrl?: string;
  expiresAt?: string;
}

export interface CreateCardResult {
  success: boolean;
  processing?: boolean;
  fundingStatus?: 'completed' | 'refunded' | 'reconciliation_required';
  existing?: boolean;
  card?: HeyQOCard;
}

async function post<T = any>(
  path: string,
  body: object = {},
  idempotencyKey: string = crypto.randomUUID(),
  timeoutMs = 20_000,
): Promise<T> {
  return apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  }, timeoutMs);
}

export const getCards = () => apiFetch<CardsSnapshot>('/api/client/cards');
export const getCardsSecurity = () => apiFetch<{ security: CardsSecuritySnapshot }>('/api/client/cards/security');
export const startCardsDiditSession = () =>
  apiFetch<{ challenge: DiditChallenge }>('/api/client/cards/security/didit/session', { method: 'POST' });
export const confirmCardsDidit = (challengeId: string) =>
  apiFetch<{ success: boolean }>('/api/client/cards/security/didit/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId }),
  });
export const setCardsSecurityPin = (pin: string, confirmPin: string) =>
  post<{ success: boolean; security: CardsSecuritySnapshot }>('/api/client/cards/security/pin', { pin, confirmPin });
export const requestCardsEmailTwoFactor = () =>
  post<{ success: boolean; sessionId: string; maskedEmail: string; purpose: 'setup' | 'unlock'; expiresInSeconds: number }>(
    '/api/client/cards/security/email-2fa/request',
  );
export const verifyCardsEmailTwoFactor = (sessionId: string, code: string, diditChallengeId: string) =>
  post<{ success: boolean; security: CardsSecuritySnapshot }>(
    '/api/client/cards/security/email-2fa/verify',
    { sessionId, code, diditChallengeId },
  );
export const unlockCards = (sessionId: string, pin: string, code: string, diditChallengeId: string) =>
  post<{ success: boolean; security: CardsSecuritySnapshot }>(
    '/api/client/cards/security/unlock',
    { sessionId, pin, code, diditChallengeId },
  );
export const createHeyQOCard = (brand: 'visa' | 'mastercard', idempotencyKey?: string) =>
  post<CreateCardResult>('/api/client/cards', { brand }, idempotencyKey, 60_000);

export async function submitHeyQOCustomerKyc(
  value: Record<string, string | boolean | File | null | undefined>,
  idempotencyKey?: string,
) {
  const {
    documentFrontFile,
    documentBackFile,
    proofOfAddressFile,
    documentFrontBase64: cachedDocumentFrontBase64,
    documentBackBase64: cachedDocumentBackBase64,
    proofOfAddressBase64: cachedProofOfAddressBase64,
    ...fields
  } = value;
  const [documentFrontBase64, documentBackBase64, proofOfAddressBase64] = await Promise.all([
    cachedDocumentFrontBase64 as string | undefined || fileToBase64(documentFrontFile as File | null),
    cachedDocumentBackBase64 as string | undefined || fileToBase64(documentBackFile as File | null),
    cachedProofOfAddressBase64 as string | undefined || fileToBase64(proofOfAddressFile as File | null),
  ]);
  return post<{
    success: boolean;
    customer: HeyQOCustomer;
    diagnostics?: CardsSnapshot['diagnostics'];
  }>('/api/client/cards/customer', {
    kyc: { ...fields, documentFrontBase64, documentBackBase64, proofOfAddressBase64 },
  }, idempotencyKey, 90_000);
}
export const getSecureCardDetails = (cardId: string, pin: string) =>
  post<{ success: boolean; details: SecureCardDetails; secureViewUrl?: string; expiresAt?: string }>(
    `/api/client/cards/${encodeURIComponent(cardId)}/secure-details`,
    { pin },
  );
export const depositToCard = (cardId: string, amount: number, idempotencyKey?: string) =>
  post(`/api/client/cards/${encodeURIComponent(cardId)}/deposit`, { amount }, idempotencyKey);
export const withdrawFromCard = (cardId: string, amount: number, idempotencyKey?: string) =>
  post(`/api/client/cards/${encodeURIComponent(cardId)}/withdraw`, { amount }, idempotencyKey);
export const freezeCard = (cardId: string, idempotencyKey?: string) => post(`/api/client/cards/${encodeURIComponent(cardId)}/freeze`, {}, idempotencyKey);
export const unfreezeCard = (cardId: string, idempotencyKey?: string) => post(`/api/client/cards/${encodeURIComponent(cardId)}/unfreeze`, {}, idempotencyKey);
export const terminateCard = (cardId: string, idempotencyKey?: string) => post(`/api/client/cards/${encodeURIComponent(cardId)}/terminate`, {}, idempotencyKey);

export function useClientCards(clientId: string | null, enabled = true) {
  const [snapshot, setSnapshot] = useState<CardsSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(clientId && enabled));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!clientId || !enabled) {
      setSnapshot(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      setError(null);
      setSnapshot(await getCards());
    } catch (cause: any) {
      setError(cause?.message || 'Impossible de charger vos cartes.');
    } finally {
      setLoading(false);
    }
  }, [clientId, enabled]);

  const adoptCard = useCallback((card: HeyQOCard) => {
    setSnapshot((current) => {
      if (!current) return current;
      const cards = [card, ...current.cards.filter((item) => item.id !== card.id)];
      return { ...current, cards };
    });
  }, []);

  useEffect(() => {
    void refresh();
    const interval = clientId && enabled ? window.setInterval(() => void refresh(), 30_000) : undefined;
    return () => { if (interval) window.clearInterval(interval); };
  }, [clientId, enabled, refresh]);

  return { snapshot, loading, error, refresh, adoptCard };
}