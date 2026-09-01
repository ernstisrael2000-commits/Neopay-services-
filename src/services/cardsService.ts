import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';
import type { HeyQOCard, HeyQOCardTransaction, HeyQOCustomer } from '../types';

export interface CardsSnapshot {
  configured: boolean;
  customer: HeyQOCustomer | null;
  cards: HeyQOCard[];
  cardTransactions: HeyQOCardTransaction[];
  stale?: boolean;
}

async function post(path: string, body: object = {}, idempotencyKey: string = crypto.randomUUID()) {
  return apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  });
}

export const getCards = () => apiFetch<CardsSnapshot>('/api/client/cards');
export const createHeyQOCard = (brand: 'visa' | 'mastercard', kyc: Record<string, string>, idempotencyKey?: string) =>
  post('/api/client/cards', { brand, kyc }, idempotencyKey);
export const getSecureView = (cardId: string) => post(`/api/client/cards/${encodeURIComponent(cardId)}/secure-view`);
export const depositToCard = (cardId: string, amount: number, idempotencyKey?: string) =>
  post(`/api/client/cards/${encodeURIComponent(cardId)}/deposit`, { amount }, idempotencyKey);
export const withdrawFromCard = (cardId: string, amount: number, idempotencyKey?: string) =>
  post(`/api/client/cards/${encodeURIComponent(cardId)}/withdraw`, { amount }, idempotencyKey);
export const freezeCard = (cardId: string, idempotencyKey?: string) => post(`/api/client/cards/${encodeURIComponent(cardId)}/freeze`, {}, idempotencyKey);
export const unfreezeCard = (cardId: string, idempotencyKey?: string) => post(`/api/client/cards/${encodeURIComponent(cardId)}/unfreeze`, {}, idempotencyKey);
export const terminateCard = (cardId: string, idempotencyKey?: string) => post(`/api/client/cards/${encodeURIComponent(cardId)}/terminate`, {}, idempotencyKey);

export function useClientCards(clientId: string | null) {
  const [snapshot, setSnapshot] = useState<CardsSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(clientId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!clientId) {
      setSnapshot(null);
      setLoading(false);
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
  }, [clientId]);

  useEffect(() => {
    void refresh();
    const interval = clientId ? window.setInterval(() => void refresh(), 30_000) : undefined;
    return () => { if (interval) window.clearInterval(interval); };
  }, [clientId, refresh]);

  return { snapshot, loading, error, refresh };
}