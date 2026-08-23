import { CryptoMarketOffer, CryptoMarketRequest, CryptoMarketRequestStatus } from '../types';

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Erreur serveur (${response.status})`);
  return payload as T;
}

export const getCryptoMarketOffers = async (): Promise<CryptoMarketOffer[]> => {
  const data = await requestJson<{ offers: CryptoMarketOffer[] }>('/api/crypto-market/offers');
  return data.offers || [];
};

export const getClientCryptoMarketRequests = async (): Promise<CryptoMarketRequest[]> => {
  const data = await requestJson<{ requests: CryptoMarketRequest[] }>('/api/client/crypto-market/requests');
  return data.requests || [];
};

export const submitCryptoMarketRequest = async (input: {
  offerId: string;
  amountUSD: number;
  destinationAddress: string;
  consent: boolean;
  idempotencyKey: string;
}): Promise<CryptoMarketRequest> => {
  const data = await requestJson<{ request: CryptoMarketRequest }>('/api/client/crypto-market/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.request;
};

export const getAdminCryptoMarketOffers = async (): Promise<CryptoMarketOffer[]> => {
  const data = await requestJson<{ offers: CryptoMarketOffer[] }>('/api/admin/crypto-market/offers');
  return data.offers || [];
};

export const saveCryptoMarketOffer = async (offer: Partial<CryptoMarketOffer>, id?: string): Promise<string> => {
  const data = await requestJson<{ id: string }>('/api/admin/crypto-market/offers', {
    method: 'POST',
    body: JSON.stringify({ ...offer, ...(id ? { id } : {}) }),
  });
  return data.id;
};

export const deleteCryptoMarketOffer = async (id: string): Promise<void> => {
  await requestJson(`/api/admin/crypto-market/offers/${id}`, { method: 'DELETE' });
};

export const getAdminCryptoMarketRequests = async (status?: CryptoMarketRequestStatus | 'all'): Promise<CryptoMarketRequest[]> => {
  const suffix = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
  const data = await requestJson<{ requests: CryptoMarketRequest[] }>(`/api/admin/crypto-market/requests${suffix}`);
  return data.requests || [];
};

export const updateCryptoMarketRequest = async (
  id: string,
  input: { status: CryptoMarketRequestStatus; adminNote?: string; transactionHash?: string },
): Promise<CryptoMarketRequest> => {
  const data = await requestJson<{ request: CryptoMarketRequest }>(`/api/admin/crypto-market/requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.request;
};