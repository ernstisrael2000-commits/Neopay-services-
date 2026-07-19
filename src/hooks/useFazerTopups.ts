import { useState, useEffect } from 'react';

export interface FazerCategory {
  category_id: string;
  name: string;
  imageurl?: string;
  slug?: string;
}

export interface FazerOffer {
  offer_id: string;
  name: string;
  price: number;       // USD
  currency: string;
  imageurl?: string;
}

export interface FazerField {
  key: string;
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
}

export interface FazerValidateGame {
  category_id: string;
  name: string;
  fields: FazerField[];
}

// ── Fetch helpers ────────────────────────────────────────────────
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Erreur ${res.status}`);
  }
  return res.json();
}

// ── Hook: list of game categories ────────────────────────────────
export function useFazerTopups() {
  const [categories, setCategories] = useState<FazerCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<{ items: FazerCategory[] }>('/api/fazer/topups')
      .then(data => { if (!cancelled) setCategories(data.items || []); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { categories, loading, error };
}

// ── Hook: offers for one category ────────────────────────────────
export function useFazerOffers(categoryId: string | null) {
  const [offers, setOffers] = useState<FazerOffer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!categoryId) { setOffers([]); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch<{ items: FazerOffer[] }>(`/api/fazer/topups/offers?category_id=${encodeURIComponent(categoryId)}`)
      .then(data => { if (!cancelled) setOffers(data.items || []); })
      .catch(() => { if (!cancelled) setOffers([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [categoryId]);

  return { offers, loading };
}

// ── Hook: games that support ID validation ────────────────────────
export function useFazerValidatableGames() {
  const [games, setGames] = useState<FazerValidateGame[]>([]);
  useEffect(() => {
    apiFetch<FazerValidateGame[]>('/api/fazer/topups/validate-id')
      .then(data => setGames(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);
  return games;
}

// ── Hook: custom HTG price overrides (set by admin) ───────────────
// Returns { [offerId]: customPriceHTG }
export function useFazerPriceOverrides() {
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  useEffect(() => {
    fetch('/api/fazer/price-overrides')
      .then(r => r.json())
      .then(data => setOverrides(data.overrides || {}))
      .catch(() => {});
  }, []);
  return overrides;
}
