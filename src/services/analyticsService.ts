/**
 * analyticsService.ts — OPTIMISÉ
 *
 * Problème original : 6 niveaux de onSnapshot imbriqués.
 * - Les 5 listeners internes n'étaient JAMAIS désabonnés (fuite mémoire critique).
 * - Chaque mise à jour du listener externe recréait 5 nouveaux listeners.
 * - Sur 1000 mises à jour de `sales`, = 5000 listeners zombies en mémoire.
 *
 * Solution : 6 listeners PLATS et indépendants, tous correctement nettoyés.
 * Les données de chaque collection sont stockées dans un ref partagé.
 * La fonction recompute() est appelée après chaque mise à jour.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  limit,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Parcel, WithdrawalRequest, Affiliate } from '../types';
import {
  subDays,
  startOfDay,
  format,
  subMonths,
} from 'date-fns';

export interface DashboardStats {
  totalRevenue: number;
  totalProfit: number;
  adminBudget: number;
  totalParcels: number;
  totalWithdrawals: number;
  totalAffiliates: number;
  totalAffiliateBalances: number;
  dailyRevenue: { name: string; value: number }[];
  monthlyRevenue: { name: string; value: number }[];
  topProducts: { name: string; value: number }[];
  peakHours: { name: string; value: number }[];
  stuckParcels: Parcel[];
  suspiciousWithdrawals: WithdrawalRequest[];
  lowStockItems: { name: string; stock: number; type: string }[];
}

export const useAnalytics = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Refs hold the latest snapshot data — avoids stale closures in listeners
  const data = useRef({
    sales:       [] as any[],
    parcels:     [] as Parcel[],
    withdrawals: [] as WithdrawalRequest[],
    affiliates:  [] as Affiliate[],
    products:    [] as any[],
    cards:       [] as any[],
  });
  // Track which collections have loaded at least once
  const loaded = useRef({
    sales: false, parcels: false, withdrawals: false,
    affiliates: false, products: false, cards: false,
  });

  const recompute = useCallback(() => {
    // Wait until all 6 collections have fired at least once
    if (!Object.values(loaded.current).every(Boolean)) return;

    const { sales, parcels, withdrawals, affiliates, products, cards } = data.current;
    const now = new Date();

    // ── Revenue ───────────────────────────────────────────────────────────────
    const totalRevenue = sales.reduce((s, sale) => s + (sale.price || 0), 0);
    const totalProfit  = totalRevenue * 0.4;
    const adminBudget  = totalProfit  * 0.3;

    // ── Daily Revenue (last 7 days) ────────────────────────────────────────────
    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(now, 6 - i));
    const dailyRevenue = last7Days.map(day => {
      const key = format(day, 'yyyy-MM-dd');
      const val = sales
        .filter(s => format(s.createdAt?.toDate?.() ?? new Date(), 'yyyy-MM-dd') === key)
        .reduce((sum, s) => sum + (s.price || 0), 0);
      return { name: format(day, 'EEE'), value: val };
    });

    // ── Monthly Revenue (last 6 months) ──────────────────────────────────────
    const last6Months = Array.from({ length: 6 }, (_, i) => subMonths(now, 5 - i));
    const monthlyRevenue = last6Months.map(month => {
      const key = format(month, 'yyyy-MM');
      const val = sales
        .filter(s => format(s.createdAt?.toDate?.() ?? new Date(), 'yyyy-MM') === key)
        .reduce((sum, s) => sum + (s.price || 0), 0);
      return { name: format(month, 'MMM'), value: val };
    });

    // ── Top Products ──────────────────────────────────────────────────────────
    const productCounts: Record<string, number> = {};
    sales.forEach(s => { productCounts[s.itemName] = (productCounts[s.itemName] || 0) + 1; });
    const topProducts = Object.entries(productCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // ── Peak Hours ────────────────────────────────────────────────────────────
    const hourCounts: Record<number, number> = {};
    sales.forEach(s => {
      const h = (s.createdAt?.toDate?.() ?? new Date()).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const peakHours = Array.from({ length: 24 }, (_, i) => ({
      name: `${i}h`,
      value: hourCounts[i] || 0,
    }));

    // ── Stuck Parcels (not delivered, > 5 days old) ──────────────────────────
    const fiveDaysAgo = subDays(now, 5);
    const stuckParcels = parcels.filter(p => {
      const upd = p.updatedAt?.toDate?.() ?? new Date();
      return p.status !== 'Livré' && upd < fiveDaysAgo;
    });

    // ── Suspicious Withdrawals (≥ 3 from same affiliate today) ───────────────
    const today = startOfDay(now);
    const affiliateDailyCount: Record<string, number> = {};
    withdrawals.forEach(w => {
      const d = w.createdAt?.toDate?.() ?? new Date();
      if (d >= today) affiliateDailyCount[w.affiliateId] = (affiliateDailyCount[w.affiliateId] || 0) + 1;
    });
    const suspiciousIds = Object.keys(affiliateDailyCount).filter(id => affiliateDailyCount[id] >= 3);
    const suspiciousWithdrawals = withdrawals.filter(
      w => suspiciousIds.includes(w.affiliateId) && w.status === 'pending'
    );

    // ── Affiliate Balances ────────────────────────────────────────────────────
    const totalAffiliateBalances = affiliates.reduce((s, a) => s + (a.balance || 0), 0);

    // ── Low Stock ─────────────────────────────────────────────────────────────
    const lowStockItems = [
      ...products.filter(p => p.stock !== undefined && p.stock <= 5).map(p => ({ name: p.name, stock: p.stock, type: 'Produit' })),
      ...cards.filter(c => c.stock !== undefined && c.stock <= 5).map(c => ({ name: c.name, stock: c.stock, type: 'Carte' })),
    ];

    setStats({
      totalRevenue, totalProfit, adminBudget,
      totalParcels: parcels.length,
      totalWithdrawals: withdrawals.length,
      totalAffiliates: affiliates.length,
      totalAffiliateBalances,
      dailyRevenue, monthlyRevenue, topProducts, peakHours,
      stuckParcels, suspiciousWithdrawals, lowStockItems,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    // Limit heavy collections to avoid reading the entire database
    const salesQ       = query(collection(db, 'sales'),              orderBy('createdAt', 'desc'), limit(500));
    const parcelsQ     = query(collection(db, 'parcels'),            orderBy('updatedAt', 'desc'), limit(500));
    const withdrawalsQ = query(collection(db, 'withdrawals'),        orderBy('createdAt', 'desc'), limit(200));
    const affiliatesQ  = query(collection(db, 'affiliates'));
    const productsQ    = query(collection(db, 'products'));
    const cardsQ       = query(collection(db, 'card_topups'));

    // All 6 listeners are FLAT — no nesting, all properly tracked for cleanup
    const unsubs = [
      onSnapshot(salesQ, snap => {
        data.current.sales = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        loaded.current.sales = true;
        recompute();
      }),
      onSnapshot(parcelsQ, snap => {
        data.current.parcels = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Parcel[];
        loaded.current.parcels = true;
        recompute();
      }),
      onSnapshot(withdrawalsQ, snap => {
        data.current.withdrawals = snap.docs.map(d => ({ id: d.id, ...d.data() })) as WithdrawalRequest[];
        loaded.current.withdrawals = true;
        recompute();
      }),
      onSnapshot(affiliatesQ, snap => {
        data.current.affiliates = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Affiliate[];
        loaded.current.affiliates = true;
        recompute();
      }),
      onSnapshot(productsQ, snap => {
        data.current.products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        loaded.current.products = true;
        recompute();
      }),
      onSnapshot(cardsQ, snap => {
        data.current.cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        loaded.current.cards = true;
        recompute();
      }),
    ];

    // All 6 listeners cleaned up properly on unmount
    return () => unsubs.forEach(u => u());
  }, [recompute]);

  return { stats, loading };
};
