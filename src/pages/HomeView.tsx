import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package, Truck, Users, ArrowRight,
  ShoppingBag, Globe, GraduationCap, Wallet,
  MessageCircle, ArrowUp, ChevronRight, Search, X, Zap, TrendingUp, Loader2,
  Star, BookOpen, Award, Clock,
  ArrowDownToLine, ArrowUpFromLine, Send, Eye, EyeOff, CheckCircle2, Copy,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { useState, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import {
  useSliderImages, useNavButtons,
  useProducts, useGames, useCardTopups,
} from '../services/parcelService';
import { useSettingsCtx } from '../contexts/SettingsContext';
import { useClientData, useClientTransactions, submitClientPurchase } from '../services/clientService';
import { toast } from 'sonner';
import { Client } from '../types';
import { GameDialog } from '../components/GamesTab';
import { GiftCardDialog } from '../components/GiftCardsTab';
import { useFazerTopups, useFazerPriceOverrides, useFazerGiftCards, FazerCategory, FazerGiftCategory } from '../hooks/useFazerTopups';
import { isGameAvailableInHaiti, isGiftCardAvailableInHaiti } from '../lib/haitiFilter';
import { ProductGridSkeleton } from '../components/skeletons/ProductGridSkeleton';
import { FormationMiniSkeleton } from '../components/skeletons/FormationGridSkeleton';

const SLIDER_IMAGES = [
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1614850523296-62c09279446a?q=80&w=2070&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop',
];

const HelpCircle = LucideIcons.Circle;
const LucideIcon = ({ name, className, color }: { name: string; className?: string; color?: string }) => {
  const Icon = (LucideIcons as any)[name] || HelpCircle;
  return <Icon className={className} style={{ color }} />;
};

interface HomeViewProps {
  onTrackingClick: () => void;
  onViewChange: (view: any) => void;
  loggedClient?: Client | null;
  onOpenWallet?: () => void;
  onRequestAuth?: () => void;
}

const SECTION_CARDS = [
  {
    key: 'products',
    title: 'Produits',
    subtitle: 'Cartes, jeux, services digitaux',
    icon: ShoppingBag,
    gradient: 'from-indigo-600 via-purple-600 to-pink-500',
    glow: 'shadow-purple-200',
  },
  {
    key: 'services',
    title: 'Services',
    subtitle: 'Suivi colis, expédition, en ligne',
    icon: Globe,
    gradient: 'from-teal-500 via-emerald-500 to-cyan-400',
    glow: 'shadow-emerald-200',
  },
  {
    key: 'formations',
    title: 'Formations',
    subtitle: 'Développez vos compétences',
    icon: GraduationCap,
    gradient: 'from-amber-500 via-orange-500 to-rose-400',
    glow: 'shadow-orange-200',
  },
];

export default function HomeView({ onTrackingClick, onViewChange, loggedClient, onOpenWallet, onRequestAuth }: HomeViewProps) {
  const { sliderImages } = useSliderImages();
  const { buttons, loading: buttonsLoading } = useNavButtons();
  const { settings } = useSettingsCtx();

  const { products, loading: productsLoading } = useProducts();
  const { games, loading: gamesLoading } = useGames();
  const { cards, loading: cardsLoading } = useCardTopups();
  const { categories: fazerCategories } = useFazerTopups();
  const priceOverrides = useFazerPriceOverrides();
  const { categories: giftCardCategories } = useFazerGiftCards();

  const { client: liveClient } = useClientData(loggedClient?.id || null);
  const { transactions: clientTx } = useClientTransactions(loggedClient?.id || null);
  const effectiveClient = liveClient || loggedClient;

  const exchangeRate = settings?.exchangeRate || 146;
  const balanceHTG = Math.round((effectiveClient?.balance ?? 0) * exchangeRate);
  const balanceUSD = (effectiveClient?.balance ?? 0).toFixed(2);
  const recentTx = clientTx.slice(0, 3);

  const [balanceHidden, setBalanceHidden] = useState(false);
  const [walletCopied, setWalletCopied] = useState(false);
  const copyWalletId = (e: React.MouseEvent) => {
    e.stopPropagation();
    const id = effectiveClient?.walletId;
    if (!id) return;
    navigator.clipboard.writeText(id);
    setWalletCopied(true);
    setTimeout(() => setWalletCopied(false), 2000);
  };

  React.useEffect(() => {
    if (settings?.whatsappAdminNumber) (window as any).__renaAdminPhone = settings.whatsappAdminNumber;
  }, [settings?.whatsappAdminNumber]);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Debounce filtering so heavy .filter() only runs 250ms after the user stops typing
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string; image: string; price?: string; type: string; description?: string } | null>(null);
  const [selectedGameCat, setSelectedGameCat] = useState<FazerCategory | null>(null);
  const [selectedGiftCat, setSelectedGiftCat] = useState<FazerGiftCategory | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const imagesToDisplay = sliderImages.length > 0
    ? sliderImages.map(img => ({ url: img.url, description: img.description || '' }))
    : SLIDER_IMAGES.map(url => ({ url, description: 'Rena Digital Services' }));

  useEffect(() => {
    if (imagesToDisplay.length <= 1) return;
    const timer = setInterval(() => setCurrentSlide(prev => (prev + 1) % imagesToDisplay.length), 6000);
    return () => clearInterval(timer);
  }, [imagesToDisplay.length]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const resolveRedirection = (btn: any) => {
    const target = btn.targetUrl?.trim();
    const instruction = btn.redirectionInstruction?.toLowerCase() || '';

    if (target) {
      if (['tracking', 'shipping', 'affiliate'].includes(target)) { onViewChange(target); return; }
      if (['products', 'services', 'formations'].includes(target)) { onViewChange(target); return; }
      if (target.startsWith('#')) { document.getElementById(target.substring(1))?.scrollIntoView({ behavior: 'smooth' }); return; }
      if (!target.includes('.') && !target.startsWith('/')) {
        const el = document.getElementById(target);
        if (el) { el.scrollIntoView({ behavior: 'smooth' }); return; }
      }
      window.location.href = target;
      return;
    }

    if (instruction.includes('jeu'))                                              { onViewChange('products'); return; }
    if (instruction.includes('carte') || instruction.includes('recharge'))        { onViewChange('products'); return; }
    if (instruction.includes('produit') || instruction.includes('service'))       { onViewChange('products'); return; }
    if (instruction.includes('suivi') || instruction.includes('colis'))           { onViewChange('tracking'); return; }
    if (instruction.includes('shipping') || instruction.includes('envoi'))        { onViewChange('shipping'); return; }
    if (instruction.includes('formation'))                                        { onViewChange('formations'); return; }
  };

  const openWhatsApp = () => {
    const num = settings?.whatsappAdminNumber || '+50944813185';
    window.open(`https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent('Bonjour Rena, je souhaite avoir plus de renseignements.')}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pt-6 pb-28 space-y-8">

      {/* ── Hero: Wallet card or Slider ── */}
      <AnimatePresence mode="wait">
        {loggedClient ? (
          <motion.section
            key="wallet-hero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            {/* ── Premium card ── */}
            <div
              onClick={onOpenWallet}
              className="relative w-full rounded-[28px] overflow-hidden cursor-pointer select-none"
              style={{
                background: 'linear-gradient(135deg, #050A1C 0%, #0D1B3E 35%, #0A2440 65%, #061428 100%)',
                aspectRatio: '1.9 / 1',
              }}
            >
              {/* Diagonal line texture */}
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: 'repeating-linear-gradient(120deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 28px)',
              }} />
              {/* Top-left gold glow */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at 10% 15%, rgba(251,191,36,0.10) 0%, transparent 50%)',
              }} />
              {/* Bottom-right cyan glow */}
              <div className="absolute bottom-0 right-0 w-56 h-36 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at 85% 95%, rgba(34,211,238,0.14) 0%, transparent 65%)',
              }} />
              {/* Decorative arc top-right */}
              <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full border border-white/[0.05] pointer-events-none" />
              <div className="absolute -right-6 -top-6 w-36 h-36 rounded-full border border-white/[0.06] pointer-events-none" />
              {/* Thin gold accent line at top */}
              <div className="absolute top-0 left-8 right-8 h-[1px] pointer-events-none" style={{
                background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)',
              }} />

              <div className="relative z-10 h-full flex flex-col justify-between p-5">
                {/* Top row: label + eye + chip */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.4em] mb-1" style={{ color: 'rgba(251,191,36,0.55)' }}>
                      Rena Wallet
                    </p>
                    <p className="text-white font-black text-[15px] leading-snug tracking-wide max-w-[200px] truncate">
                      {effectiveClient?.name || loggedClient.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={e => { e.stopPropagation(); setBalanceHidden(v => !v); }}
                      className="text-white/25 hover:text-white/55 transition-colors"
                    >
                      {balanceHidden ? <EyeOff className="h-[15px] w-[15px]" /> : <Eye className="h-[15px] w-[15px]" />}
                    </button>
                    {/* EMV chip */}
                    <div
                      className="h-[26px] w-[36px] rounded-md shadow-lg"
                      style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #B45309 50%, #F59E0B 100%)' }}
                    >
                      <div className="w-full h-full grid grid-cols-2 gap-[1.5px] p-[3.5px]">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="rounded-[2px]" style={{ background: 'rgba(80,35,0,0.35)' }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Balance */}
                <div>
                  <p className="text-white/30 text-[8px] font-black uppercase tracking-[0.3em] mb-1.5">Solde disponible</p>
                  {balanceHidden ? (
                    <p className="text-white font-black text-3xl tracking-[0.3em] leading-none select-none">••••••</p>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-white font-black leading-none tabular-nums" style={{ fontSize: '2.1rem' }}>
                          ${balanceUSD}
                        </span>
                        <span className="text-white/40 text-sm font-bold">USD</span>
                      </div>
                      <p className="text-white text-[10px] font-semibold mt-1 tabular-nums">
                        ≈ {balanceHTG.toLocaleString()} HTG
                      </p>
                    </>
                  )}
                </div>

                {/* Bottom row: wallet ID copiable */}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-white/25 text-[7px] font-black uppercase tracking-[0.3em] mb-0.5">ID Wallet</p>
                    <button
                      onClick={copyWalletId}
                      className="flex items-center gap-1.5 group"
                    >
                      <span className="text-white/80 text-[10px] font-mono tracking-[0.15em] group-hover:text-white transition-colors">
                        {effectiveClient?.walletId || '—'}
                      </span>
                      {walletCopied
                        ? <CheckCircle2 className="h-3 w-3 text-emerald-300 shrink-0" />
                        : <Copy className="h-3 w-3 text-white/20 group-hover:text-white/50 transition-colors shrink-0" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Recharger button ── */}
            <motion.button
              onClick={onOpenWallet}
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.98] transition-colors shadow-sm"
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-sm font-black text-gray-700 tracking-wide">Recharger</span>
            </motion.button>

          </motion.section>
        ) : (
          <motion.section
            key="slider"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full"
          >
            <div
              className="relative h-[220px] md:h-[340px] w-full rounded-[28px] overflow-hidden bg-gray-900 shadow-lg cursor-pointer"
              onClick={() => onViewChange('products')}
            >
              <div className="absolute inset-0 w-full h-full z-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0, scale: 1.08 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0"
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${imagesToDisplay[currentSlide]?.url || ''})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/30 to-transparent opacity-55" />
                  </motion.div>
                </AnimatePresence>
              </div>
              <div
                className="absolute bottom-6 right-6 z-30 flex gap-2.5 bg-black/20 backdrop-blur-md p-1.5 px-2.5 rounded-full border border-white/10"
                onClick={e => e.stopPropagation()}
              >
                {imagesToDisplay.map((_, i) => (
                  <button key={i} onClick={() => setCurrentSlide(i)} className="relative h-2 flex items-center justify-center transition-all duration-500">
                    <div className={`h-full rounded-full transition-all duration-500 ${currentSlide === i ? 'bg-primary w-8' : 'bg-white/30 w-2 hover:bg-white/50'}`} />
                  </button>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Barre de recherche produits ── */}
      <div className="search-border-wrap shadow-sm">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher un produit, jeu, carte..."
            className="w-full h-12 pl-11 pr-10 rounded-[14px] bg-white text-sm font-medium text-dark placeholder:text-gray-400 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-dark transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Nos Produits — real catalog preview ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-dark">
            {debouncedSearch.trim() ? `Résultats (${
              [...products, ...games, ...cards].filter(i => i.name.toLowerCase().includes(debouncedSearch.trim().toLowerCase())).length
            })` : 'Nos Produits'}
          </h2>
          {!debouncedSearch.trim() && (
            <button
              onClick={() => onViewChange('products')}
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              Voir tout <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
        {(productsLoading || gamesLoading || cardsLoading) ? (
          <ProductGridSkeleton count={6} />
        ) : (
          (() => {
            const q = debouncedSearch.trim().toLowerCase();

            // Word-based fuzzy matching: every word in the query must appear in the name
            const matchesQuery = (name: string) => {
              if (!q) return true;
              const words = q.split(/\s+/).filter(Boolean);
              const lower = name.toLowerCase();
              return words.every(w => lower.includes(w));
            };

            // ── Firebase catalog items — interleaved round-robin ────────────
            type CatalogItem = { id: string; name: string; image: string; price?: string; type: string; description?: string; source: 'catalog' | 'fazer-game' | 'fazer-gift' };
            const _products = products.map(p => ({ id: p.id!, name: p.name, image: p.image, price: p.price, type: 'product', description: p.description, source: 'catalog' as const }));
            const _games    = games.map(g => ({ id: g.id!, name: g.name, image: g.image, price: (g as any).priceRange || (g as any).price || '', type: 'game', description: (g as any).description || '', source: 'catalog' as const }));
            const _cards    = cards.map(c => ({ id: c.id!, name: c.name, image: c.image, price: c.price, type: 'card', description: c.description, source: 'catalog' as const }));

            // Round-robin interleave: 1 product, 1 game, 1 card, repeat
            const catalogItems: CatalogItem[] = [];
            const buckets = [_products, _games, _cards];
            const maxLen = Math.max(...buckets.map(b => b.length));
            for (let i = 0; i < maxLen; i++) {
              for (const bucket of buckets) {
                if (i < bucket.length) catalogItems.push(bucket[i]);
              }
            }

            // ── FazerCards live game categories (only when searching) ───────
            const fazerGameItems = q ? fazerCategories
              .filter(cat => isGameAvailableInHaiti(cat.name) && matchesQuery(cat.name))
              .map(cat => ({
                id: `fazer-game-${cat.category_id}`,
                name: cat.name,
                image: cat.imageurl || '',
                price: '',
                type: 'game',
                description: 'Top-up jeu',
                source: 'fazer-game' as const,
                _cat: cat,
              })) : [];

            // ── FazerCards gift card categories (only when searching) ────────
            const fazerGiftItems = q ? giftCardCategories
              .filter(cat => isGiftCardAvailableInHaiti(cat.name) && matchesQuery(cat.name))
              .map(cat => ({
                id: `fazer-gift-${cat.category_id}`,
                name: cat.name,
                image: cat.imageurl || '',
                price: '',
                type: 'giftcard',
                description: 'Carte-cadeau',
                source: 'fazer-gift' as const,
                _cat: cat,
              })) : [];

            // ── Merge: catalog first, then FazerCards (deduplicate by name) ─
            const seenNames = new Set<string>();
            const allItems = [...catalogItems, ...fazerGameItems, ...fazerGiftItems]
              .filter(item => {
                if (!matchesQuery(item.name)) return false;
                const key = item.name.toLowerCase().split(' (')[0].trim();
                if (seenNames.has(key)) return false;
                seenNames.add(key);
                return true;
              })
              .slice(0, q ? 40 : 10);

            if (allItems.length === 0) return (
              <div className="text-center py-8 text-gray-400 text-sm">
                {q ? `Aucun résultat pour "${searchQuery}"` : 'Aucun produit disponible.'}
              </div>
            );

            const handleItemClick = (item: typeof allItems[0]) => {
              if (!loggedClient) {
                onRequestAuth?.();
                return;
              }
              // Gift card from FazerCards
              if (item.source === 'fazer-gift') {
                setSelectedGiftCat((item as any)._cat);
                return;
              }
              // Game from FazerCards directly
              if (item.source === 'fazer-game') {
                setSelectedGameCat((item as any)._cat);
                return;
              }
              // Catalog game — try to match against FazerCards
              if (item.type === 'game') {
                const nameLower = item.name.toLowerCase();
                const matchingCat = fazerCategories.find(cat => {
                  const catBase = cat.name.toLowerCase().split(' (')[0].trim();
                  return cat.name.toLowerCase().includes(nameLower) || nameLower.includes(catBase);
                });
                if (matchingCat) {
                  setSelectedGameCat(matchingCat);
                  return;
                }
              }
              setSelectedItem(item);
            };

            const typeConfig: Record<string, { label: string; bg: string; dot: string }> = {
              game:     { label: 'Jeu',          bg: 'bg-purple-500/90',  dot: 'bg-purple-400' },
              card:     { label: 'Carte',         bg: 'bg-emerald-500/90', dot: 'bg-emerald-400' },
              product:  { label: 'Produit',       bg: 'bg-blue-500/90',   dot: 'bg-blue-400' },
              giftcard: { label: 'Carte-cadeau',  bg: 'bg-amber-500/90',  dot: 'bg-amber-400' },
            };

            return (
              <div className="grid grid-cols-2 gap-3">
                {allItems.map((item, i) => {
                  const tc = typeConfig[item.type] ?? typeConfig.product;
                  const isFeatured = i === 0 && !q;
                  return (
                    <motion.button
                      key={`${item.type}-${item.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, type: 'spring', stiffness: 260, damping: 22 }}
                      onClick={() => handleItemClick(item)}
                      className={`relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all group bg-white text-left active:scale-[0.98]${isFeatured ? ' col-span-2' : ''}`}
                    >
                      <div className={`relative bg-gray-100 overflow-hidden ${isFeatured ? 'aspect-[16/7]' : 'aspect-[4/3]'}`}>
                        <img
                          src={item.image}
                          alt={item.name}
                          loading={i < 4 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={e => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/rena/200/150'; }}
                        />
                        {/* gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

                        {/* lock overlay */}
                        {!loggedClient && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                            <div className="h-9 w-9 rounded-full bg-white/90 flex items-center justify-center shadow-md">
                              <LucideIcons.Lock className="h-4 w-4 text-gray-700" />
                            </div>
                          </div>
                        )}

                        {/* name at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 pt-6">
                          <p className={`text-white font-black leading-tight drop-shadow ${isFeatured ? 'text-sm' : 'text-[11px] line-clamp-2'}`}>{item.name}</p>
                          {isFeatured && item.description && (
                            <p className="text-white/70 text-[10px] mt-0.5 line-clamp-1">{item.description}</p>
                          )}
                        </div>
                      </div>

                    </motion.button>
                  );
                })}
              </div>
            );
          })()
        )}
      </section>

      {/* ── Formations en vedette ── */}
      <section>
        <FeaturedFormations onGoToFormations={() => onViewChange('formations')} />
      </section>

      {/* ── Why Rena ── */}
      <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
        <h2 className="text-base font-black text-dark mb-4">Pourquoi choisir Rena ?</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: LucideIcons.Zap, label: 'Rapide', desc: 'Traitement en quelques minutes', color: 'text-amber-500 bg-amber-50' },
            { icon: LucideIcons.ShieldCheck, label: 'Sécurisé', desc: 'Transactions protégées', color: 'text-emerald-500 bg-emerald-50' },
            { icon: LucideIcons.Clock, label: '24/7', desc: 'Support disponible en tout temps', color: 'text-blue-500 bg-blue-50' },
            { icon: LucideIcons.Star, label: 'Fiable', desc: 'Des milliers de clients satisfaits', color: 'text-purple-500 bg-purple-50' },
          ].map(item => (
            <div key={item.label} className="flex flex-col items-center text-center gap-2 p-3 rounded-2xl bg-gray-50">
              <div className={`h-9 w-9 rounded-xl ${item.color} flex items-center justify-center`}>
                <item.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-black text-dark text-sm leading-none">{item.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Scroll to top ── */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed bottom-24 right-4 z-50"
          >
            <Button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="h-11 w-11 rounded-full bg-primary hover:bg-blue-700 text-white shadow-xl flex items-center justify-center p-0"
            >
              <ArrowUp className="h-5 w-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating WhatsApp chat ── */}
      <div className="fixed bottom-24 right-4 z-40 pointer-events-none">
        <Button
          onClick={openWhatsApp}
          className="pointer-events-auto h-13 w-13 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-2xl shadow-emerald-500/30 flex items-center justify-center p-0 h-[52px] w-[52px]"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>

      {/* ── FazerCards GameDialog (search result click) ── */}
      {selectedGameCat && (
        <GameDialog
          category={selectedGameCat}
          priceOverrides={priceOverrides}
          loggedClient={effectiveClient || null}
          exchangeRate={exchangeRate}
          onClose={() => setSelectedGameCat(null)}
          onOpenWallet={onOpenWallet}
        />
      )}

      {/* ── GiftCardDialog (search result click) ── */}
      {selectedGiftCat && (
        <GiftCardDialog
          category={selectedGiftCat}
          exchangeRate={exchangeRate}
          loggedClient={effectiveClient || null}
          onClose={() => setSelectedGiftCat(null)}
          onOpenWallet={onOpenWallet}
        />
      )}

      {/* ── Product quick-view modal ── */}
      <Dialog open={!!selectedItem} onOpenChange={(v) => { if (!v) setSelectedItem(null); }}>
        <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden rounded-2xl">
          {selectedItem && (
            <>
              <div className="relative aspect-[4/3] bg-gray-100">
                <img
                  src={selectedItem.image}
                  alt={selectedItem.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = '/icon.svg'; }}
                />
                <div className="absolute top-3 left-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                    selectedItem.type === 'game' ? 'bg-purple-500 text-white' :
                    selectedItem.type === 'card' ? 'bg-emerald-500 text-white' :
                    'bg-primary text-white'
                  }`}>
                    {selectedItem.type === 'game' ? 'Jeu' : selectedItem.type === 'card' ? 'Carte' : 'Produit'}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <DialogHeader>
                  <DialogTitle className="text-lg font-black text-dark leading-snug">{selectedItem.name}</DialogTitle>
                </DialogHeader>
                {selectedItem.description && (
                  <p className="text-sm text-subtext mt-2 leading-relaxed line-clamp-3">{selectedItem.description}</p>
                )}
                {selectedItem.price && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-subtext font-bold uppercase tracking-wider">Prix</span>
                    <span className="text-sm font-black text-primary">{selectedItem.price}</span>
                  </div>
                )}
                <div className="mt-5 space-y-2">
                  {effectiveClient && selectedItem.price && (() => {
                    const numericPrice = parseFloat(String(selectedItem.price).replace(/[^\d.]/g, ''));
                    const balHTG = Math.round((effectiveClient.balance ?? 0) * exchangeRate);
                    const canPay = !isNaN(numericPrice) && numericPrice > 0 && balHTG >= numericPrice;
                    return (
                      <button
                        type="button"
                        disabled={purchaseLoading || !canPay}
                        onClick={async () => {
                          if (purchaseLoading || !effectiveClient || !selectedItem) return;
                          setPurchaseLoading(true);
                          const priceUSD = numericPrice / exchangeRate;
                          try {
                            await submitClientPurchase(effectiveClient, selectedItem.name, String(selectedItem.price), priceUSD);
                            toast.success(`✅ Achat effectué ! ${numericPrice.toLocaleString()} HTG débité.`);
                            setSelectedItem(null);
                            const adminNum = (window as any).__renaAdminPhone || '';
                            const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                            const msg = `🛍️ *ACHAT EFFECTUÉ — Rena*\n\n👤 Client: *${effectiveClient.name}*\n🔑 ID Wallet: *#${effectiveClient.walletId || '—'}*\n🛒 Service: *${selectedItem.name}*\n💰 Montant: *${numericPrice.toLocaleString()} HTG*\n💳 Méthode: *Solde Wallet*\n📅 Date: *${now}*\n\n✅ Paiement traité automatiquement. Veuillez activer le service.`;
                            if (adminNum) window.open(`https://wa.me/${adminNum.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                          } catch (err: any) {
                            toast.error(err.message || "Erreur lors de l'achat.");
                          } finally {
                            setPurchaseLoading(false);
                          }
                        }}
                        className={`w-full h-12 rounded-2xl border-2 font-black text-sm flex items-center justify-center gap-2 transition-all ${canPay ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 active:scale-95' : 'border-red-200 text-red-400 cursor-not-allowed opacity-60'}`}
                      >
                        {purchaseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                          <><Wallet className="h-4 w-4" />{canPay ? `Payer ${numericPrice.toLocaleString()} HTG` : `Solde insuffisant (${balHTG.toLocaleString()} HTG)`}</>
                        )}
                      </button>
                    );
                  })()}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-10 text-sm font-bold border-gray-200"
                      onClick={() => { setSelectedItem(null); onViewChange('products'); }}
                    >
                      Voir le catalogue
                    </Button>
                    <Button
                      className="flex-1 h-10 text-sm font-bold bg-emerald-500 hover:bg-emerald-600 border-0"
                      onClick={() => {
                        const phone = (window as any).__renaAdminPhone || '';
                        const msg = `Bonjour, je suis intéressé par : ${selectedItem.name}${selectedItem.price ? ` (${selectedItem.price})` : ''}`;
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                    >
                      <MessageCircle className="h-4 w-4 mr-1.5" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Featured Formations section (used on Home) ─────────────────────────────────

const levelGradients: Record<string, string> = {
  debutant: 'from-emerald-500 to-teal-600',
  intermediaire: 'from-violet-500 to-purple-700',
  avance: 'from-rose-500 to-pink-700',
};

function FeaturedFormations({ onGoToFormations }: { onGoToFormations: () => void }) {
  const [formations, setFormations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/formations')
      .then(r => r.json())
      .then(data => {
        const all = Array.isArray(data.formations) ? data.formations : [];
        const sorted = [...all].sort((a, b) => (b.studentsCount || 0) - (a.studentsCount || 0));
        setFormations(sorted.slice(0, 4));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalStudents = formations.reduce((s, f) => s + (f.studentsCount || 0), 0);
  const certCount = formations.filter(f => f.hasCertificate).length;

  if (!loading && formations.length === 0) return null;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="h-7 w-7 rounded-xl bg-violet-100 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-violet-600" />
            </div>
            <h2 className="text-base font-black text-gray-900">Formations</h2>
          </div>
          <p className="text-xs text-gray-400 pl-9">Développez vos compétences en ligne</p>
        </div>
        <button
          onClick={onGoToFormations}
          className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-0.5 transition-colors"
        >
          Voir tout <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Stats pills */}
      {!loading && formations.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { label: `${formations.length}+ cours`, icon: BookOpen, color: 'text-violet-700 bg-violet-50 border-violet-100' },
            ...(totalStudents > 0 ? [{ label: `${totalStudents.toLocaleString()} étudiants`, icon: Users, color: 'text-emerald-700 bg-emerald-50 border-emerald-100' }] : []),
            ...(certCount > 0 ? [{ label: 'Certificats', icon: Award, color: 'text-amber-700 bg-amber-50 border-amber-100' }] : []),
            { label: 'En ligne', icon: Star, color: 'text-blue-700 bg-blue-50 border-blue-100' },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold shrink-0 ${s.color}`}>
              <s.icon className="h-3 w-3" />
              {s.label}
            </div>
          ))}
        </div>
      )}

      {/* Course grid */}
      {loading ? (
        <FormationMiniSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {formations.map((f, i) => (
            <motion.button
              key={f.id || i}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              onClick={onGoToFormations}
              className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group text-left active:scale-[0.98]"
            >
              {/* Cover */}
              <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
                {f.coverImage ? (
                  <img
                    src={f.coverImage}
                    alt={f.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${levelGradients[f.level] || 'from-violet-500 to-purple-700'}`}>
                    <GraduationCap className="h-8 w-8 text-white/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                {/* Badge */}
                {f.price === 0 ? (
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-white leading-none">
                    Gratuit
                  </span>
                ) : (
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-violet-600 text-white leading-none">
                    {(f.price || 0).toLocaleString()} HTG
                  </span>
                )}

                {/* Title overlay */}
                <div className="absolute bottom-1.5 left-2 right-2">
                  <p className="text-white font-black text-[11px] leading-tight line-clamp-2 drop-shadow-sm">
                    {f.title}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-2.5 py-2 bg-white flex items-center justify-between gap-1">
                <p className="text-[9px] text-gray-400 truncate">
                  {f.instructor || 'Rena Academy'}
                </p>
                {f.studentsCount > 0 && (
                  <p className="text-[9px] text-gray-400 shrink-0 flex items-center gap-0.5">
                    <Users className="h-2.5 w-2.5" />
                    {f.studentsCount}
                  </p>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* CTA */}
      {!loading && formations.length > 0 && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onGoToFormations}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/20 hover:-translate-y-0.5 active:translate-y-0"
        >
          <GraduationCap className="h-4 w-4" />
          Explorer toutes les formations
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      )}
    </div>
  );
}
