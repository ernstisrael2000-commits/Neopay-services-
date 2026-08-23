import {
  CryptoAsset,
  CryptoMarketOffer,
  CryptoMarketRequest,
  CryptoMarketRequestStatus,
  CryptoNetwork,
  CryptoOrder,
  CryptoOrderStatus,
} from '../types';

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

// ─── Catalogue et commandes crypto (modèle séparé) ───────────────────────────
export const getCryptoOrderCatalog = async (): Promise<{ cryptos: CryptoAsset[]; networks: CryptoNetwork[] }> => {
  const data = await requestJson<{ cryptos: CryptoAsset[]; networks: CryptoNetwork[] }>('/api/crypto-orders/catalog');
  return { cryptos: data.cryptos || [], networks: data.networks || [] };
};

export const getClientCryptoOrders = async (): Promise<CryptoOrder[]> => {
  const data = await requestJson<{ orders: CryptoOrder[] }>('/api/client/crypto-orders');
  return data.orders || [];
};

export const getClientCryptoOrder = async (id: string): Promise<CryptoOrder> => {
  const data = await requestJson<{ order: CryptoOrder }>(`/api/client/crypto-orders/${encodeURIComponent(id)}`);
  return data.order;
};

export const submitCryptoOrder = async (input: {
  cryptoId: string;
  networkId: string;
  amount: number;
  walletAddress: string;
  consent: boolean;
  idempotencyKey: string;
}): Promise<{ order: CryptoOrder; balanceAfter: number }> => {
  const data = await requestJson<{ order: CryptoOrder; balanceAfter: number }>('/api/client/crypto-orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return { order: data.order, balanceAfter: data.balanceAfter };
};

export const getAdminCryptoOrderCatalog = async (): Promise<{ cryptos: CryptoAsset[]; networks: CryptoNetwork[] }> => {
  const data = await requestJson<{ cryptos: CryptoAsset[]; networks: CryptoNetwork[] }>('/api/admin/crypto-orders/catalog');
  return { cryptos: data.cryptos || [], networks: data.networks || [] };
};

export const saveCryptoAsset = async (asset: Partial<CryptoAsset>, id?: string): Promise<string> => {
  const data = await requestJson<{ id: string }>('/api/admin/crypto-orders/cryptos', {
    method: 'POST',
    body: JSON.stringify({ ...asset, ...(id ? { id } : {}) }),
  });
  return data.id;
};

export const saveCryptoNetwork = async (network: Partial<CryptoNetwork>, id?: string): Promise<string> => {
  const data = await requestJson<{ id: string }>('/api/admin/crypto-orders/networks', {
    method: 'POST',
    body: JSON.stringify({ ...network, ...(id ? { id } : {}) }),
  });
  return data.id;
};

export const getAdminCryptoOrders = async (status?: CryptoOrderStatus | 'all'): Promise<CryptoOrder[]> => {
  const suffix = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
  const data = await requestJson<{ orders: CryptoOrder[] }>(`/api/admin/crypto-orders/orders${suffix}`);
  return data.orders || [];
};

export const updateCryptoOrder = async (
  id: string,
  input: { status: CryptoOrderStatus; adminNote?: string; transactionHash?: string },
): Promise<CryptoOrder> => {
  const data = await requestJson<{ order: CryptoOrder }>(`/api/admin/crypto-orders/orders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.order;
};

export const syncCoinGeckoCryptos = async (): Promise<{ synced: number; failed?: number }> => {
  return requestJson('/api/admin/crypto-orders/sync-coingecko', { method: 'POST', body: '{}' });
};

export const migrateLegacyCryptoMarket = async (): Promise<{ cryptos: number; networks: number; orders: number }> => {
  return requestJson('/api/admin/crypto-orders/migrate-legacy', { method: 'POST', body: '{}' });
};