import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';
import type { HeyQOCard, HeyQOCardTransaction, HeyQOCustomer } from '../types';

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
export const createHeyQOCard = (brand: 'visa' | 'mastercard', idempotencyKey?: string) =>
  post<CreateCardResult>('/api/client/cards', { brand }, idempotencyKey, 60_000);

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function fileToBase64(file: File | null | undefined): Promise<string | undefined> {
  if (!file) return undefined;

  // Android browsers can expose a valid selected File while failing
  // FileReader.readAsDataURL for files returned by the document picker.
  // Reading the bytes directly is more reliable and avoids retaining a data
  // URL longer than necessary. The FileReader path remains as a fallback for
  // older WebViews.
  try {
    if (typeof file.arrayBuffer === 'function') {
      return bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    }
  } catch {
    // Try the compatibility path below before reporting a real read failure.
  }

  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Impossible de lire ${file.name}. Vérifiez que le fichier est toujours disponible, puis réessayez.`));
      reader.onload = () => {
        const result = String(reader.result || '');
        resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
      };
      reader.readAsDataURL(file);
    });
  }

  throw new Error(`Impossible de lire ${file.name}. Vérifiez que le fichier est toujours disponible, puis réessayez.`);
}

export async function submitHeyQOCustomerKyc(
  value: Record<string, string | boolean | File | null | undefined>,
  idempotencyKey?: string,
) {
  const { documentFrontFile, documentBackFile, proofOfAddressFile, ...fields } = value;
  const [documentFrontBase64, documentBackBase64, proofOfAddressBase64] = await Promise.all([
    fileToBase64(documentFrontFile as File | null),
    fileToBase64(documentBackFile as File | null),
    fileToBase64(proofOfAddressFile as File | null),
  ]);
  return post<{
    success: boolean;
    customer: HeyQOCustomer;
    diagnostics?: CardsSnapshot['diagnostics'];
  }>('/api/client/cards/customer', {
    kyc: { ...fields, documentFrontBase64, documentBackBase64, proofOfAddressBase64 },
  }, idempotencyKey, 90_000);
}
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

  const adoptCard = useCallback((card: HeyQOCard) => {
    setSnapshot((current) => {
      if (!current) return current;
      const cards = [card, ...current.cards.filter((item) => item.id !== card.id)];
      return { ...current, cards };
    });
  }, []);

  useEffect(() => {
    void refresh();
    const interval = clientId ? window.setInterval(() => void refresh(), 30_000) : undefined;
    return () => { if (interval) window.clearInterval(interval); };
  }, [clientId, refresh]);

  return { snapshot, loading, error, refresh, adoptCard };
}