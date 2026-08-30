import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap, Users, Star, Clock, Play, Award,
  CheckCircle2, X, Wallet, Loader2, BookOpen, Lock,
  ChevronRight, ChevronLeft, TrendingUp, Zap, Globe, Tag, User,
  FileText, Layers, BadgeCheck, Percent, MessageSquare,
  ChevronDown, ChevronUp, Video, Download, ExternalLink,
  Smartphone, CreditCard, Send, AlertCircle, Search,
  Heart, Trophy, BarChart3, Sparkles, Filter, Grid,
  BookMarked, ArrowRight, Shield, LogIn,
  Cpu, ShoppingBag, Palette, Briefcase,
  Banknote, XCircle, Share2
} from 'lucide-react';
import { Dialog, DialogContent } from '../components/ui/dialog';
import CoursePlayer from './CoursePlayer';
import { Button } from '../components/ui/button';
import PlopPlopMethodPicker from '../components/PlopPlopMethodPicker';
import { Formation, FormationModule, FormationChapter } from '../types';
import { Client } from '../types';
import { toast } from 'sonner';
import { useSettingsCtx } from '../contexts/SettingsContext';
import { loginClientWithGoogle } from '../services/clientService';
import { openCertificate } from '../lib/certificateGenerator';
import { FormationGridSkeleton } from '../components/skeletons/FormationGridSkeleton';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface FormationsViewProps {
  loggedClient: Client | null;
  onRequestAuth?: () => void;
  onOpenWallet: () => void;
  onClientLogin?: (client: Client) => void;
  activeTab: 'all' | 'my' | 'profile';
  onTabChange: (tab: 'all' | 'my' | 'profile') => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onPlayerChange?: (active: boolean) => void;
  onDetailChange?: (active: boolean) => void;
  resetSignal?: number;
  /** Course id to open automatically once loaded — used for shared course links (?course=<id>) */
  initialCourseId?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const levelLabels: Record<string, string> = {
  debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé',
};
const levelColors: Record<string, string> = {
  debutant: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  intermediaire: 'bg-violet-100 text-violet-700 border-violet-200',
  avance: 'bg-rose-100 text-rose-700 border-rose-200',
};
const levelGradients: Record<string, string> = {
  debutant: 'from-emerald-500 to-teal-600',
  intermediaire: 'from-violet-500 to-purple-700',
  avance: 'from-rose-500 to-pink-700',
};

// ── Fixed editorial categories ───────────────────────────────────────────────
// The catalog groups every formation's free-text `category` into one of these
// four fixed buckets (matching the Academy design), instead of surfacing raw
// admin-entered category strings. Anything unrecognized falls back to "Business".
const FIXED_CATEGORIES = ['Développement', 'Business', 'Marketing', 'Design'] as const;
type FixedCategory = typeof FIXED_CATEGORIES[number];

const CATEGORY_BUCKET_KEYWORDS: Record<FixedCategory, string[]> = {
  'Développement': ['dev', 'code', 'program', 'web', 'app', 'ia', 'intelligence', 'ai', 'tech', 'software', 'informatique', 'data', 'cyber', 'no-code', 'nocode'],
  'Marketing': ['marketing', 'publicit', 'ads', 'seo', 'réseaux sociaux', 'social media', 'contenu', 'growth', 'copywriting', 'communication', 'branding'],
  'Design': ['design', 'ui', 'ux', 'graphi', 'photoshop', 'illustrat', 'créa', 'video', 'vidéo', 'photo', 'montage', 'animation'],
  'Business': ['business', 'entrepr', 'gestion', 'finance', 'trading', 'bourse', 'crypto', 'comptab', 'leadership', 'e-commerce', 'ecommerce', 'dropship', 'vente', 'management', 'immobilier'],
};

function bucketCategory(category?: string): FixedCategory {
  if (category) {
    const key = category.toLowerCase();
    for (const bucket of FIXED_CATEGORIES) {
      if (CATEGORY_BUCKET_KEYWORDS[bucket].some(kw => key.includes(kw))) return bucket;
    }
  }
  return 'Business'; // fallback bucket for anything unrecognized
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'xs' }) {
  const s = size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`${s} ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
      <span className="text-xs text-gray-500 ml-1 font-semibold">{rating > 0 ? rating.toFixed(1) : '—'}</span>
    </div>
  );
}

function ProgressBar({ pct, color = 'bg-violet-600' }: { pct: number; color?: string }) {
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <motion.div
        className={`h-full ${color} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}

function getFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem('rena_favorites') || '[]'); } catch { return []; }
}
function setFavorites(ids: string[]) {
  try { localStorage.setItem('rena_favorites', JSON.stringify(ids)); } catch {}
}

type PaymentStep = 'detail' | 'external-method' | 'form' | 'done';

// ── Main Component ─────────────────────────────────────────────────────────────

export default function FormationsView({ loggedClient, onOpenWallet, onClientLogin, onRequestAuth, activeTab, onTabChange, searchQuery: externalSearch, onSearchChange, onPlayerChange, onDetailChange, resetSignal, initialCourseId }: FormationsViewProps) {
  const { settings } = useSettingsCtx();

  // Data
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation
  const [selected, setSelected] = useState<Formation | null>(null);
  const [playerFormation, setPlayerFormation] = useState<Formation | null>(null);

  // Filters
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Sync external search from FormationsNavbar
  useEffect(() => {
    if (externalSearch !== undefined) setSearchQuery(externalSearch);
  }, [externalSearch]);

  // Reset catalog filters when the parent signals a "go home" action
  const isFirstResetSignal = React.useRef(true);
  useEffect(() => {
    if (isFirstResetSignal.current) { isFirstResetSignal.current = false; return; }
    if (resetSignal === undefined) return;
    setFilterCategory('all');
    setFilterLevel('all');
    setShowFilters(false);
  }, [resetSignal]);

  // Notify parent when the course detail page is open (hides catalog-only chrome)
  useEffect(() => {
    onDetailChange?.(!!selected);
  }, [selected, onDetailChange]);

  // Ownership & progress
  const [purchasedIds, setPurchasedIds] = useState<string[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  // Favorites
  const [favorites, setFavoritesState] = useState<string[]>(getFavorites);

  // Purchase flow
  const [purchasing, setPurchasing] = useState(false);
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('detail');
  const [selectedPayMethod, setSelectedPayMethod] = useState<'moncash' | 'natcash' | null>(null);
  const [payFormData, setPayFormData] = useState({ name: '', email: '', transactionCode: '' });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // ── Load formations ─────────────────────────────────────────────────────────
  // Protected content (video/PDF URLs, quiz answers) is stripped server-side for
  // formations the logged-in client hasn't purchased — see redactFormationForViewer
  // in the API. Re-run this after a purchase completes so the unlocked content
  // (e.g. video URLs) shows up without requiring a full page reload.
  const loadFormations = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch('/api/formations');
      if (!res.ok) throw new Error('api_fail');
      const data = await res.json();
      if (!Array.isArray(data.formations)) throw new Error('api_fail');
      setFormations(data.formations);
    } catch {
      try {
        const q = query(collection(db, 'formations'), where('published', '==', true), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setFormations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Formation)));
      } catch { toast.error('Impossible de charger les formations.'); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadFormations(true); }, [loadFormations]);

  // ── Load purchases ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loggedClient?.id) return;
    fetch(`/api/formations/purchases/user/${loggedClient.id}`)
      .then(r => r.json())
      .then(data => {
        const active = (data.purchases || []).filter((p: any) => p.status === 'active').map((p: any) => p.formationId);
        setPurchasedIds(active);
      }).catch(() => {});
  }, [loggedClient?.id]);

  // ── Load progress for owned courses ────────────────────────────────────────
  useEffect(() => {
    if (!loggedClient?.id || purchasedIds.length === 0) return;
    fetch(`/api/formations/progress/${loggedClient.id}`)
      .then(r => r.json())
      .then(data => {
        const map: Record<string, number> = {};
        (data.progress || []).forEach((p: any) => { if (p.formationId) map[p.formationId] = p.percentage || 0; });
        setProgressMap(map);
      }).catch(() => {});
  }, [loggedClient?.id, purchasedIds.length]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const isOwned = (f: Formation) => !!f.id && purchasedIds.includes(f.id);
  const isFav = (f: Formation) => !!f.id && favorites.includes(f.id);
  const discount = (f: Formation) => f.originalPrice && f.originalPrice > f.price ? Math.round((1 - f.price / f.originalPrice) * 100) : 0;

  const categories = ['all', ...FIXED_CATEGORIES];
  const filtered = formations.filter(f => {
    const matchLevel = filterLevel === 'all' || f.level === filterLevel;
    const matchCat = filterCategory === 'all' || bucketCategory(f.category) === filterCategory;
    const matchSearch = !searchQuery || f.title.toLowerCase().includes(searchQuery.toLowerCase()) || (f.instructor || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchLevel && matchCat && matchSearch;
  });
  const myCourses = formations.filter(f => f.id && purchasedIds.includes(f.id));
  const freeCourses = formations.filter(f => f.price === 0);
  const popularCourses = [...formations].sort((a, b) => (b.studentsCount || 0) - (a.studentsCount || 0)).slice(0, 6);
  const newCourses = formations.slice(0, 6);
  const moncashNumber = settings?.moncashNumber || '—';
  const natcashNumber = settings?.natcashNumber || '—';

  // ── Favorites toggle ────────────────────────────────────────────────────────
  const toggleFavorite = (f: Formation, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = f.id!;
    const newFavs = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id];
    setFavoritesState(newFavs);
    setFavorites(newFavs);
  };

  // ── Login prompt ─────────────────────────────────────────────────────────────
  const [pendingFormation, setPendingFormation] = useState<Formation | null>(null);
  const [pendingViaSharedLink, setPendingViaSharedLink] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setShowLoginPrompt(false);
    await new Promise(r => setTimeout(r, 120));
    setGoogleLoading(true);
    try {
      const result = await loginClientWithGoogle();
      if ((result as any).noAccount) {
        toast.error('Aucun compte trouvé. Créez un compte via le Wallet.');
        onOpenWallet();
        return;
      }
      if ((result as any).client) {
        onClientLogin?.((result as any).client);
        toast.success('Connexion réussie !');
        setTimeout(() => {
          if (pendingFormation) { openDetail(pendingFormation, { viaSharedLink: pendingViaSharedLink }); setPendingFormation(null); setPendingViaSharedLink(false); }
        }, 200);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur de connexion Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Open detail ─────────────────────────────────────────────────────────────
  // `viaSharedLink` marks entries coming from a shared course link (?course=<id>):
  // instead of the plain description page, jump straight to the payment-method
  // screen so the visitor immediately sees the course, its price and how to pay.
  const openDetail = (f: Formation, opts?: { viaSharedLink?: boolean }) => {
    if (!loggedClient && !opts?.viaSharedLink) {
      setPendingFormation(f);
      setPendingViaSharedLink(!!opts?.viaSharedLink);
      setShowLoginPrompt(true);
      return;
    }
    setSelected(f);
    const skipToPayment = !!opts?.viaSharedLink && (f.price ?? 0) > 0 && !isOwned(f);
    setPaymentStep(skipToPayment ? 'external-method' : 'detail');
    setSelectedPayMethod(null);
    setPayFormData({ name: loggedClient?.name || '', email: loggedClient?.email || '', transactionCode: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const closeDetail = () => { setSelected(null); setPaymentStep('detail'); setSelectedPayMethod(null); };

  // ── Open shared course link (?course=<id>) once formations are loaded ────────
  const openedInitialCourse = React.useRef(false);
  useEffect(() => {
    if (openedInitialCourse.current || !initialCourseId || formations.length === 0) return;
    const target = formations.find(f => f.id === initialCourseId);
    if (target) {
      openedInitialCourse.current = true;
      openDetail(target, { viaSharedLink: true });
    }
  }, [initialCourseId, formations]);

  // ── Purchase ─────────────────────────────────────────────────────────────────
  const handleWalletPurchase = async (formation: Formation) => {
    if (!loggedClient) { onOpenWallet(); return; }
    const rate = settings?.exchangeRate || 146;
    const balanceHTG = Math.round((loggedClient.balance ?? 0) * rate);
    if (balanceHTG < (formation.price ?? 0)) {
      toast.error(`Solde insuffisant. Vous avez ${balanceHTG.toLocaleString()} HTG.`); return;
    }
    setPurchasing(true);
    const priceUSD = (formation.price ?? 0) / rate;
    try {
      const res = await fetch('/api/formations/purchases/wallet', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: loggedClient.id, clientName: loggedClient.name, formationId: formation.id, formationTitle: formation.title, amount: priceUSD }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur lors de l\'achat.');
      setPurchasedIds(prev => [...prev, formation.id!]);
      toast.success(`✅ Accès à "${formation.title}" activé !`);
      setSelected(null);
      void loadFormations(); // refresh so unlocked video/PDF content is now included
    } catch (err: any) { toast.error(err.message); } finally { setPurchasing(false); }
  };

  // Called once a Paym Plop Plop payment is confirmed (whether the confirmation
  // arrived while this popup was still open, or was reconciled later on load).
  const handlePlopPlopSuccess = (formation: Formation) => {
    setPurchasedIds(prev => prev.includes(formation.id!) ? prev : [...prev, formation.id!]);
    toast.success(`✅ Accès à "${formation.title}" activé !`);
    setSelected(null);
    void loadFormations();
  };

  const shareFormation = async (formation: Formation) => {
    if (!formation.id) return;
    const link = `${window.location.origin}/formations?course=${encodeURIComponent(formation.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: formation.title,
          text: `Découvrez cette formation sur Solutionpam : ${formation.title}`,
          url: link,
        });
      } else {
        await navigator.clipboard.writeText(link);
        toast.success('Lien de la formation copié !');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error(`Impossible de partager. Copiez ce lien : ${link}`);
      }
    }
  };

  const handleExternalPaymentSubmit = async () => {
    if (!loggedClient || !selected || !selectedPayMethod) return;
    if (!payFormData.transactionCode.trim()) { toast.error('Veuillez saisir le code de transaction.'); return; }
    if (!payFormData.name.trim() || !payFormData.email.trim()) { toast.error('Veuillez renseigner votre nom et email.'); return; }
    setSubmittingPayment(true);
    try {
      const res = await fetch('/api/formations/payment-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: loggedClient.id, userEmail: payFormData.email, userName: payFormData.name,
          formationId: selected.id, formationTitle: selected.title, amount: selected.price,
          method: selectedPayMethod === 'moncash' ? 'MonCash' : 'NatCash',
          transactionCode: payFormData.transactionCode,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur lors de la soumission.');
      if (json.alreadyOwned) { setPurchasedIds(prev => [...prev, selected.id!]); toast.success('Vous avez déjà accès à cette formation !'); closeDetail(); void loadFormations(); return; }
      setPaymentStep('done');
      const whatsappNum = settings?.whatsappAdminNumber?.replace(/\D/g, '') || '50944813185';
      const methodLabel = selectedPayMethod === 'moncash' ? 'MonCash' : 'NatCash';
      const msg = encodeURIComponent(
        `Bonjour Solutionpam 👋\n\nJe viens d'effectuer un paiement pour une formation :\n\n` +
        `👤 Nom: *${payFormData.name}*\n📧 Email: *${payFormData.email}*\n` +
        `🎓 Cours: *${selected.title}*\n💳 Méthode: *${methodLabel}*\n` +
        `💰 Montant: *${(selected.price || 0).toLocaleString()} HTG*\n` +
        `🔖 Code transaction: *${payFormData.transactionCode}*\n\nMerci de valider mon accès.`
      );
      setTimeout(() => { window.open(`https://wa.me/${whatsappNum}?text=${msg}`, '_blank'); }, 800);
    } catch (err: any) { toast.error(err.message); } finally { setSubmittingPayment(false); }
  };

  // ── Player helpers ──────────────────────────────────────────────────────────
  const enterPlayer = (f: Formation) => {
    setPlayerFormation(f);
    onPlayerChange?.(true);
  };
  const exitPlayer = () => {
    setPlayerFormation(null);
    onPlayerChange?.(false);
  };

  // ── Render: Player ──────────────────────────────────────────────────────────
  if (playerFormation && loggedClient) {
    return <CoursePlayer formation={playerFormation} loggedClient={loggedClient} onBack={exitPlayer} />;
  }

  // ── Render: Detail Page ─────────────────────────────────────────────────────
  if (selected) {
    return (
      <FormationDetailPage
        formation={selected}
        isOwned={isOwned(selected)}
        isFav={isFav(selected)}
        loggedClient={loggedClient}
        onRequestAuth={onRequestAuth}
        onBack={closeDetail}
        onPlay={() => { closeDetail(); enterPlayer(selected); }}
        onFavorite={(e) => toggleFavorite(selected, e)}
        onShare={() => shareFormation(selected)}
        onOpenWallet={onOpenWallet}
        paymentStep={paymentStep}
        setPaymentStep={setPaymentStep}
        selectedPayMethod={selectedPayMethod}
        setSelectedPayMethod={setSelectedPayMethod}
        payFormData={payFormData}
        setPayFormData={setPayFormData}
        purchasing={purchasing}
        submittingPayment={submittingPayment}
        onWalletPurchase={() => handleWalletPurchase(selected)}
        onExternalSubmit={handleExternalPaymentSubmit}
        onPlopPlopSuccess={() => handlePlopPlopSuccess(selected)}
        moncashNumber={moncashNumber}
        natcashNumber={natcashNumber}
        discount={discount(selected)}
        settings={settings}
        progressPct={progressMap[selected.id!] ?? 0}
      />
    );
  }

  // ── Render: Loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f6] px-4 pt-6 pb-24">
        <FormationGridSkeleton count={6} />
      </div>
    );
  }

  // ── Render: Catalog ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#faf9f6]">

      {/* ── Login prompt dialog ─────────────────────────────────────────────── */}
      <Dialog open={showLoginPrompt} onOpenChange={open => { setShowLoginPrompt(open); if (!open) setPendingFormation(null); }}>
        <DialogContent className="max-w-sm rounded-[2rem] border-0 shadow-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-violet-600 to-purple-700 p-6 text-white text-center">
            <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
              <GraduationCap className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-lg font-black text-white">Connexion requise</h2>
            <p className="text-white/70 text-xs mt-1">Connectez-vous pour accéder aux formations</p>
          </div>
          <div className="p-6 space-y-4 bg-white">
            {pendingFormation && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border border-violet-100">
                <div className={`h-10 w-10 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br ${levelGradients[pendingFormation.level] || 'from-violet-500 to-purple-700'} flex items-center justify-center`}>
                  {pendingFormation.coverImage
                    ? <img src={pendingFormation.coverImage} alt="" className="w-full h-full object-cover" />
                    : <GraduationCap className="h-5 w-5 text-white/40" />}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-gray-900 text-sm truncate">{pendingFormation.title}</p>
                  <p className="text-xs text-violet-600 font-semibold">
                    {pendingFormation.price === 0 ? 'Gratuit' : `${(pendingFormation.price || 0).toLocaleString()} HTG`}
                  </p>
                </div>
              </div>
            )}
            <button
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-black text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-violet-500/20"
            >
              {googleLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              }
              {googleLoading ? 'Connexion…' : 'Se connecter avec Google'}
            </button>
            <button
              onClick={() => setShowLoginPrompt(false)}
              className="w-full h-10 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── EDITORIAL MASTHEAD ───────────────────────────────────────────────── */}
      {activeTab === 'all' && (
        <div className="border-b border-stone-200/70 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-orange-600 mb-2">Solution PAM Academy</p>
            <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight">
              Apprenez à votre rythme
            </h1>
            <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
              Des formations pensées pour progresser, une compétence à la fois.
            </p>
            <div className="relative mt-5 max-w-lg mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher un cours, instructeur…"
                value={searchQuery}
                onChange={e => onSearchChange?.(e.target.value)}
                className="w-full h-12 pl-11 pr-10 rounded-full bg-stone-50 border border-stone-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange?.('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── "Mes cours" sub-header (only on my tab) ─────────────────────────── */}
      {activeTab === 'my' && loggedClient && (
        <div className="bg-white border-b border-gray-100 px-4 sticky top-14 z-30">
          <div className="max-w-7xl mx-auto flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-violet-600" />
              <span className="font-black text-gray-900 text-sm">Mes Cours</span>
              {myCourses.length > 0 && (
                <span className="bg-violet-100 text-violet-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {myCourses.length} actif{myCourses.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              onClick={() => onTabChange('all')}
              className="text-xs text-violet-600 font-bold flex items-center gap-1 hover:gap-1.5 transition-all"
            >
              Catalogue <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── CONTENT ─────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <AnimatePresence mode="wait">

          {/* ── ALL COURSES TAB ──────────────────────────────────────────── */}
          {activeTab === 'all' && (
            <motion.div key="all" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-7">

              {searchQuery ? (
                /* ── Search results */
                <div>
                  <p className="text-sm text-gray-500 font-semibold mb-5">
                    {filtered.length} résultat{filtered.length !== 1 ? 's' : ''} pour "<span className="text-violet-600">{searchQuery}</span>"
                  </p>
                  {filtered.length === 0 ? (
                    <EmptyState icon={<Search className="h-10 w-10" />} title="Aucun résultat" sub="Essayez un autre mot-clé ou modifiez vos filtres." />
                  ) : (
                    <div className={EDITORIAL_CARD_GRID}>
                      {filtered.map((f, i) => <EditorialCourseCard key={f.id} formation={f} i={i} owned={isOwned(f)} fav={isFav(f)} disc={discount(f)} onOpen={() => openDetail(f)} onFav={(e) => toggleFavorite(f, e)} />)}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* ── 1. Categories — editorial underline tabs */}
                  <div>
                    <div className="flex items-center justify-between mb-3 border-b border-stone-200">
                      <div className="flex gap-5 overflow-x-auto no-scrollbar">
                        {['all', ...FIXED_CATEGORIES].map(cat => {
                          const active = filterCategory === cat;
                          return (
                            <button
                              key={cat}
                              onClick={() => setFilterCategory(cat)}
                              className={`relative shrink-0 pb-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                                active ? 'text-violet-700' : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              {cat === 'all' ? 'Tous' : cat}
                              {active && (
                                <motion.span layoutId="cat-underline" className="absolute left-0 right-0 -bottom-px h-[2px] bg-orange-500 rounded-full" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setShowFilters(v => !v)}
                        className={`text-xs font-semibold flex items-center gap-1 shrink-0 pl-3 transition-colors ${showFilters ? 'text-violet-700' : 'text-gray-400 hover:text-violet-600'}`}
                      >
                        <Filter className="h-3 w-3" /> {showFilters ? 'Fermer' : 'Filtres'}
                      </button>
                    </div>

                    {/* Filters panel */}
                    <AnimatePresence>
                      {showFilters && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4 mt-3">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Niveau</p>
                            <div className="flex flex-wrap gap-1.5">
                              {['all', 'debutant', 'intermediaire', 'avance'].map(lvl => (
                                <button key={lvl} onClick={() => setFilterLevel(lvl)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filterLevel === lvl ? 'bg-violet-600 text-white shadow-sm shadow-violet-400/30' : 'bg-white text-gray-500 hover:bg-gray-100 border border-stone-200'}`}>
                                  {lvl === 'all' ? 'Tous' : levelLabels[lvl]}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── 2. Continue learning (if in-progress courses) */}
                  {loggedClient && myCourses.filter(f => (progressMap[f.id!] ?? 0) > 0 && (progressMap[f.id!] ?? 0) < 100).length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[15px] font-black text-gray-900">Continuer l'apprentissage</h3>
                        <button onClick={() => onTabChange('my')} className="text-xs text-violet-600 font-bold flex items-center gap-1 hover:gap-1.5 transition-all">
                          Voir tout <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        {myCourses.filter(f => (progressMap[f.id!] ?? 0) > 0 && (progressMap[f.id!] ?? 0) < 100).slice(0, 2).map(f => (
                          <ContinueLearningMiniCard
                            key={f.id}
                            formation={f}
                            pct={progressMap[f.id!] ?? 0}
                            onResume={() => enterPlayer(f)}
                            onDetails={() => openDetail(f)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 3. Popular */}
                  {popularCourses.length > 0 && (
                    <div>
                      <h3 className="font-editorial text-lg font-semibold text-gray-900 mb-3">Formations populaires</h3>
                      <div className={EDITORIAL_CARD_GRID}>
                        {popularCourses.map((f, i) => (
                          <EditorialCourseCard
                            key={f.id}
                            formation={f}
                            i={i}
                            owned={isOwned(f)}
                            fav={isFav(f)}
                            disc={discount(f)}
                            onOpen={() => openDetail(f)}
                            onFav={e => toggleFavorite(f, e)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 4. Free courses */}
                  {freeCourses.filter(f => !popularCourses.find(p => p.id === f.id)).length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="h-4 w-4 text-orange-500 shrink-0" />
                        <h3 className="font-editorial text-lg font-semibold text-gray-900">Cours gratuits</h3>
                      </div>
                      <div className={EDITORIAL_CARD_GRID}>
                        {freeCourses.filter(f => !popularCourses.find(p => p.id === f.id)).slice(0, 8).map((f, i) => (
                          <EditorialCourseCard
                            key={f.id}
                            formation={f}
                            i={i}
                            owned={isOwned(f)}
                            fav={isFav(f)}
                            disc={discount(f)}
                            onOpen={() => openDetail(f)}
                            onFav={e => toggleFavorite(f, e)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 5. New courses */}
                  {(() => {
                    const shownIds = new Set([...popularCourses.map(f => f.id), ...freeCourses.map(f => f.id)]);
                    const novelties = newCourses.filter(f => !shownIds.has(f.id));
                    return novelties.length > 0 ? (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="h-4 w-4 text-orange-500 shrink-0" />
                          <h3 className="font-editorial text-lg font-semibold text-gray-900">Nouveautés</h3>
                        </div>
                        <div className={EDITORIAL_CARD_GRID}>
                          {novelties.map((f, i) => (
                            <EditorialCourseCard
                              key={f.id}
                              formation={f}
                              i={i}
                              owned={isOwned(f)}
                              fav={isFav(f)}
                              disc={discount(f)}
                              onOpen={() => openDetail(f)}
                              onFav={e => toggleFavorite(f, e)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* ── 6. Certificate banner */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-3xl bg-gradient-to-br from-violet-700 via-violet-800 to-orange-600 p-6 text-white shadow-lg shadow-violet-900/20"
                  >
                    <div>
                      <Award className="h-10 w-10 mb-3 text-orange-200" />
                      <h4 className="font-editorial text-xl font-semibold mb-1.5">Certificats Solution PAM Academy</h4>
                      <p className="text-white/70 text-sm mb-5 max-w-xs leading-relaxed">
                        Obtenez un certificat reconnu après chaque formation complétée.
                      </p>
                      <button
                        onClick={() => loggedClient ? onTabChange('my') : onOpenWallet()}
                        className="bg-white text-violet-800 font-bold text-sm px-5 py-2.5 rounded-full hover:bg-orange-50 active:scale-95 transition-all inline-flex items-center gap-2 shadow-md"
                      >
                        {loggedClient ? 'Voir mes certificats' : 'Se connecter'}
                      </button>
                    </div>
                  </motion.div>

                  {/* ── 7. User stats */}
                  {loggedClient && myCourses.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 pb-4">
                      {[
                        { value: myCourses.length, label: 'Formations' },
                        { value: myCourses.filter(f => (progressMap[f.id!] ?? 0) > 0 && (progressMap[f.id!] ?? 0) < 100).length, label: 'En cours' },
                        { value: myCourses.filter(f => (progressMap[f.id!] ?? 0) >= 100).length, label: 'Terminés' },
                      ].map(s => (
                        <motion.div
                          key={s.label}
                          whileTap={{ scale: 0.96 }}
                          className="bg-white p-4 rounded-2xl border border-stone-200/80 text-center hover:shadow-sm transition-all cursor-default"
                        >
                          <span className="block font-editorial text-2xl font-semibold text-violet-700">{s.value}</span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{s.label}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ── MY COURSES TAB ───────────────────────────────────────────── */}
          {activeTab === 'my' && (
            <motion.div key="my" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {!loggedClient ? (
                <div className="text-center py-14">
                  <div className="bg-violet-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-violet-100">
                    <Lock className="h-7 w-7 text-violet-400" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 mb-1.5">Connectez-vous pour accéder à vos cours</h3>
                  <p className="text-gray-500 text-sm mb-5 max-w-sm mx-auto">Votre espace personnel vous permet de retrouver tous vos cours achetés et votre progression.</p>
                  <Button onClick={onOpenWallet} className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-6">
                    Se connecter
                  </Button>
                </div>
              ) : myCourses.length === 0 ? (
                <div className="text-center py-14">
                  <div className="bg-violet-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-violet-100">
                    <BookOpen className="h-7 w-7 text-violet-400" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 mb-1.5">Vous n'avez pas encore de cours</h3>
                  <p className="text-gray-500 text-sm mb-5 max-w-sm mx-auto">Explorez notre catalogue et démarrez votre apprentissage dès aujourd'hui.</p>
                  <Button onClick={() => onTabChange('all')} className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-6 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" /> Explorer le catalogue
                  </Button>
                </div>
              ) : (
                <StudentDashboard
                  loggedClient={loggedClient}
                  myCourses={myCourses}
                  progressMap={progressMap}
                  favorites={favorites.map(id => formations.find(f => f.id === id)).filter(Boolean) as Formation[]}
                  onPlay={(f) => { enterPlayer(f); }}
                  onDetails={openDetail}
                  onOpenWallet={onOpenWallet}
                  onTabChange={onTabChange}
                  allFormations={formations}
                />
              )}
            </motion.div>
          )}

          {/* ── PROFILE TAB ──────────────────────────────────────────────── */}
          {activeTab === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {!loggedClient ? (
                <div className="text-center py-14">
                  <div className="bg-violet-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-violet-100">
                    <Lock className="h-7 w-7 text-violet-400" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 mb-1.5">Connectez-vous pour voir votre profil</h3>
                  <p className="text-gray-500 text-sm mb-5 max-w-sm mx-auto">Retrouvez vos statistiques d'apprentissage et vos certificats.</p>
                  <Button onClick={onOpenWallet} className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-6">
                    Se connecter
                  </Button>
                </div>
              ) : (
                <AcademyProfilePage
                  loggedClient={loggedClient}
                  myCourses={myCourses}
                  progressMap={progressMap}
                  onTabChange={onTabChange}
                  onOpenWallet={onOpenWallet}
                />
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-gray-100 rounded-lg p-1.5">{icon}</div>
        <h2 className="text-base font-black text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <div className="mb-3 mx-auto opacity-30">{icon}</div>
      <p className="font-bold text-gray-700 mb-1">{title}</p>
      <p className="text-sm">{sub}</p>
    </div>
  );
}

// ── Editorial course card ────────────────────────────────────────────────────
// One consistent card used across every catalog row (search, populaires,
// gratuits, nouveautés) so grids line up edge-to-edge regardless of section.
const EDITORIAL_CARD_GRID = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5';

function EditorialCourseCard({ formation, i = 0, owned, fav, disc, onOpen, onFav }: {
  formation: Formation; i?: number; owned: boolean; fav: boolean; disc: number;
  onOpen: () => void; onFav: (e: React.MouseEvent) => void;
}) {
  const isComingSoon = !!formation.comingSoon;
  const bucket = bucketCategory(formation.category);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 8) * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onClick={isComingSoon ? undefined : onOpen}
      className={`bg-white rounded-2xl border border-stone-200/80 transition-all duration-300 overflow-hidden group flex flex-col h-full ${isComingSoon ? 'cursor-default opacity-90' : 'hover:shadow-lg hover:shadow-stone-300/40 hover:-translate-y-1 cursor-pointer'}`}
    >
      {/* Cover */}
      <div className="relative aspect-[16/10] overflow-hidden shrink-0 bg-stone-100">
        {formation.coverImage ? (
          <img src={formation.coverImage} alt={formation.title} className={`w-full h-full object-cover transition-transform duration-700 ${isComingSoon ? 'grayscale-[30%]' : 'group-hover:scale-105'}`} />
        ) : (
          <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${isComingSoon ? 'from-gray-400 to-gray-600' : levelGradients[formation.level] || 'from-violet-500 to-purple-700'}`}>
            <GraduationCap className="h-10 w-10 text-white/25" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          {isComingSoon ? (
            <span className="px-2 py-1 rounded-full text-[9.5px] font-bold bg-orange-500 text-white shadow-sm flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> À venir
            </span>
          ) : (
            <>
              {formation.price === 0 && (
                <span className="px-2 py-1 rounded-full text-[9.5px] font-bold bg-white/95 text-violet-700 shadow-sm">Gratuit</span>
              )}
              {disc > 0 && (
                <span className="px-2 py-1 rounded-full text-[9.5px] font-bold bg-orange-500 text-white shadow-sm">-{disc}%</span>
              )}
            </>
          )}
        </div>

        {/* Favorite */}
        {!isComingSoon && (
          <button onClick={onFav}
            className={`absolute top-2.5 right-2.5 h-7 w-7 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-sm ${fav ? 'bg-orange-500 text-white scale-110' : 'bg-black/25 text-white/85 hover:bg-black/40 hover:scale-110'}`}>
            <Heart className={`h-3.5 w-3.5 ${fav ? 'fill-white' : ''}`} />
          </button>
        )}

        {/* Owned badge */}
        {owned && !isComingSoon && (
          <div className="absolute bottom-2.5 left-2.5 bg-violet-700 text-white px-2.5 py-1 rounded-full text-[9.5px] font-bold flex items-center gap-1 shadow-sm">
            <CheckCircle2 className="h-2.5 w-2.5 fill-white" /> Acquis
          </div>
        )}

        {/* Coming Soon overlay */}
        {isComingSoon && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/15">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Bientôt</span>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-2.5 sm:p-3 flex flex-col flex-1">
        <span className="text-[9px] font-bold uppercase tracking-widest mb-1 text-orange-600">{bucket}</span>
        <h3 className="font-editorial font-semibold text-gray-900 text-[13.5px] sm:text-[14.5px] mb-1 line-clamp-1 leading-snug">{formation.title}</h3>
        {!isComingSoon && (formation.instructor || formation.rating > 0) && (
          <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
            {formation.instructor && (
              <span className="text-[11px] text-gray-400 truncate">{formation.instructor}</span>
            )}
            {formation.instructor && formation.rating > 0 && <span className="text-gray-200 text-[10px]">·</span>}
            {formation.rating > 0 && <StarRating rating={formation.rating || 0} size="xs" />}
          </div>
        )}
        {isComingSoon && formation.shortDescription && (
          <p className="text-xs text-gray-400 mb-1.5 line-clamp-1">{formation.shortDescription}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-1.5 border-t border-stone-100">
          <div>
            {isComingSoon ? (
              <span className="text-[12.5px] font-bold text-orange-500">
                {formation.price > 0 ? `${(formation.price || 0).toLocaleString()} HTG` : 'Prix à venir'}
              </span>
            ) : (
              <>
                <span className="text-[13.5px] font-bold text-violet-700">
                  {formation.price === 0 ? 'Gratuit' : `${(formation.price || 0).toLocaleString()} HTG`}
                </span>
                {formation.originalPrice && formation.originalPrice > formation.price && (
                  <span className="text-[10px] text-gray-400 line-through ml-1.5">{formation.originalPrice.toLocaleString()}</span>
                )}
              </>
            )}
          </div>
          {!isComingSoon && (
            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

function InProgressCard({ formation, pct, onContinue, onDetails, i }: {
  formation: Formation; pct: number; onContinue: () => void; onDetails: () => void; i: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.08 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
    >
      <div className="relative h-36 overflow-hidden shrink-0">
        {formation.coverImage ? (
          <img src={formation.coverImage} alt={formation.title} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${levelGradients[formation.level] || 'from-violet-500 to-purple-700'} flex items-center justify-center`}>
            <GraduationCap className="h-12 w-12 text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {formation.category && (
          <span className="absolute top-3 left-3 text-[10px] font-black text-white/90 uppercase tracking-wider bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">{formation.category}</span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h4 className="font-black text-gray-900 text-sm mb-1 line-clamp-2">{formation.title}</h4>
        <p className="text-xs text-gray-400 mb-3">{(formation.modules || []).length} modules</p>
        <div className="mb-1.5">
          <ProgressBar pct={pct} />
        </div>
        <div className="flex items-center justify-between text-xs mb-3">
          <span className="text-gray-500">{pct}% complété</span>
          <span className="text-violet-600 font-bold">Continuer</span>
        </div>
        <button onClick={onContinue}
          className="w-full h-9 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5">
          <Play className="h-3.5 w-3.5 fill-white" /> Continuer
        </button>
      </div>
    </motion.div>
  );
}

// Category color pills for the "Mes cours" cards
const categoryColors: Record<string, { bg: string; text: string }> = {
  default: { bg: 'bg-indigo-900', text: 'text-indigo-200' },
  développement: { bg: 'bg-slate-800', text: 'text-slate-200' },
  development: { bg: 'bg-slate-800', text: 'text-slate-200' },
  marketing: { bg: 'bg-rose-800', text: 'text-rose-200' },
  design: { bg: 'bg-blue-800', text: 'text-blue-200' },
  business: { bg: 'bg-amber-700', text: 'text-amber-100' },
  trading: { bg: 'bg-emerald-800', text: 'text-emerald-200' },
  finance: { bg: 'bg-emerald-800', text: 'text-emerald-200' },
  ia: { bg: 'bg-violet-800', text: 'text-violet-200' },
};

function getCategoryColors(cat?: string) {
  if (!cat) return categoryColors.default;
  const key = cat.toLowerCase();
  for (const k of Object.keys(categoryColors)) {
    if (key.includes(k)) return categoryColors[k];
  }
  return categoryColors.default;
}

interface AcademyCertificate {
  id?: string;
  formationId: string;
  formationTitle: string;
  userName?: string;
  certificateCode?: string;
  issuedBy?: string;
  issuedAt?: any;
  pdfUrl?: string;
}

function AcademyProfilePage({ loggedClient, myCourses, progressMap, onTabChange, onOpenWallet }: {
  loggedClient: Client; myCourses: Formation[]; progressMap: Record<string, number>;
  onTabChange: (t: 'all' | 'my' | 'profile') => void; onOpenWallet: () => void;
}) {
  const [certificates, setCertificates] = useState<AcademyCertificate[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(true);

  const inProgress = myCourses.filter(f => (progressMap[f.id!] ?? 0) > 0 && (progressMap[f.id!] ?? 0) < 100);
  const completed = myCourses.filter(f => (progressMap[f.id!] ?? 0) >= 100);

  useEffect(() => {
    if (!loggedClient?.id || completed.length === 0) { setLoadingCerts(false); return; }
    let cancelled = false;
    setLoadingCerts(true);
    Promise.all(
      completed.filter(f => f.hasCertificate).map(f =>
        fetch(`/api/formations/certificate/${loggedClient.id}/${f.id}`)
          .then(r => r.json())
          .then(data => (data.certificate ? { ...data.certificate, formationId: f.id, formationTitle: f.title } as AcademyCertificate : null))
          .catch(() => null)
      )
    ).then(results => {
      if (!cancelled) setCertificates(results.filter(Boolean) as AcademyCertificate[]);
    }).finally(() => { if (!cancelled) setLoadingCerts(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedClient?.id, completed.map(f => f.id).join(',')]);

  const initials = (loggedClient.name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="bg-white rounded-3xl border border-stone-200/80 p-6 flex items-center gap-4">
        {loggedClient.photoUrl ? (
          <img src={loggedClient.photoUrl} alt={loggedClient.name} className="h-16 w-16 rounded-full object-cover shrink-0 border border-stone-200" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-violet-600 to-orange-500 flex items-center justify-center text-white text-2xl font-editorial font-semibold shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-editorial text-xl font-semibold text-gray-900 truncate">{loggedClient.name}</h2>
          {loggedClient.email && <p className="text-sm text-gray-400 truncate">{loggedClient.email}</p>}
          <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-widest text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Étudiant</span>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: myCourses.length, label: 'Formations' },
          { value: inProgress.length, label: 'En cours' },
          { value: completed.length, label: 'Terminées' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-stone-200/80 p-4 text-center">
            <p className="font-editorial text-2xl font-semibold text-violet-700">{s.value}</p>
            <p className="text-[11px] text-gray-400 font-semibold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Certificates ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Award className="h-4 w-4 text-orange-500" />
          <h3 className="font-editorial text-base font-semibold text-gray-900">Mes certificats</h3>
        </div>
        {loadingCerts ? (
          <div className="bg-white rounded-2xl border border-stone-200/80 p-8 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-violet-400 animate-spin" />
          </div>
        ) : certificates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200/80 p-8 text-center">
            <Trophy className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-semibold">Aucun certificat pour l'instant</p>
            <p className="text-xs text-gray-400 mt-1">Terminez une formation pour obtenir votre premier certificat.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {certificates.map(cert => (
              <div key={cert.formationId} className="bg-white rounded-2xl border border-stone-200/80 p-4 flex items-center gap-3">
                <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                  <Award className="h-5 w-5 text-orange-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{cert.formationTitle}</p>
                  <p className="text-[11px] text-gray-400">
                    {cert.issuedAt?.seconds ? new Date(cert.issuedAt.seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                    {cert.certificateCode && ` · ${cert.certificateCode}`}
                  </p>
                </div>
                <button
                  onClick={() => openCertificate({
                    userName: cert.userName || loggedClient.name || 'Étudiant',
                    formationTitle: cert.formationTitle,
                    certificateCode: cert.certificateCode,
                    issuedBy: cert.issuedBy,
                    issuedAt: cert.issuedAt,
                    pdfUrl: cert.pdfUrl,
                  })}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Télécharger</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Account actions ── */}
      <div className="bg-white rounded-2xl border border-stone-200/80 divide-y divide-stone-100 overflow-hidden">
        <button onClick={() => onTabChange('my')} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-stone-50 transition-colors">
          <BookMarked className="h-4 w-4 text-violet-600 shrink-0" />
          <span className="text-sm font-semibold text-gray-800 flex-1">Mes cours</span>
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </button>
        <button onClick={onOpenWallet} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-stone-50 transition-colors">
          <Wallet className="h-4 w-4 text-violet-600 shrink-0" />
          <span className="text-sm font-semibold text-gray-800 flex-1">Mon wallet & solde</span>
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </button>
      </div>
    </div>
  );
}

function StudentDashboard({ loggedClient, myCourses, progressMap, favorites, onPlay, onDetails, onOpenWallet, onTabChange, allFormations }: {
  loggedClient: Client; myCourses: Formation[]; progressMap: Record<string, number>;
  favorites: Formation[]; onPlay: (f: Formation) => void; onDetails: (f: Formation) => void;
  onOpenWallet: () => void; onTabChange: (t: 'all' | 'my') => void; allFormations: Formation[];
}) {
  const [subTab, setSubTab] = useState<'all' | 'inprogress' | 'done'>('all');
  const [localSearch, setLocalSearch] = useState('');

  const inProgress = myCourses.filter(f => (progressMap[f.id!] ?? 0) > 0 && (progressMap[f.id!] ?? 0) < 100);
  const completed = myCourses.filter(f => (progressMap[f.id!] ?? 0) >= 100);
  const notStarted = myCourses.filter(f => (progressMap[f.id!] ?? 0) === 0);

  const visibleCourses = (() => {
    let base = subTab === 'inprogress' ? inProgress : subTab === 'done' ? completed : myCourses;
    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      base = base.filter(f => f.title.toLowerCase().includes(q) || (f.instructor || '').toLowerCase().includes(q));
    }
    return base;
  })();

  const recommended = allFormations
    .filter(f => !myCourses.find(m => m.id === f.id))
    .sort((a, b) => (b.studentsCount || 0) - (a.studentsCount || 0))
    .slice(0, 6);

  return (
    <div className="space-y-6">

      {/* ── Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Rechercher dans mes cours..."
          value={localSearch}
          onChange={e => setLocalSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300 transition-all shadow-sm"
        />
        {localSearch && (
          <button onClick={() => setLocalSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Sub-tabs */}
      <div className="flex items-center gap-2">
        {([
          { id: 'all', label: 'Tous', count: myCourses.length },
          { id: 'inprogress', label: 'En cours', count: inProgress.length },
          { id: 'done', label: 'Terminés', count: completed.length },
        ] as { id: 'all' | 'inprogress' | 'done'; label: string; count: number }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              subTab === t.id
                ? 'bg-violet-600 text-white shadow-sm shadow-violet-400/30'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                subTab === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Course cards (reference style: full-width, large) */}
      {visibleCourses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-gray-100">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <BookOpen className="h-7 w-7 text-gray-400" />
          </div>
          <p className="font-black text-gray-700 mb-1">
            {subTab === 'inprogress' ? 'Aucun cours en cours' : subTab === 'done' ? 'Aucun cours terminé' : 'Aucun résultat'}
          </p>
          <p className="text-sm text-gray-400">
            {subTab === 'all' && localSearch ? 'Essayez un autre mot-clé.' : 'Explorez le catalogue pour commencer.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {subTab === 'all' && inProgress.length > 0 && !localSearch && (
            <h3 className="text-sm font-black text-gray-500 uppercase tracking-wider pt-1">Continuer l'apprentissage</h3>
          )}
          {visibleCourses.map((f, i) => {
            const pct = progressMap[f.id!] ?? 0;
            const catColors = getCategoryColors(f.category);
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
              >
                {/* Category pill */}
                {f.category && (
                  <div className="px-5 pt-4 pb-0">
                    <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${catColors.bg} ${catColors.text}`}>
                      {f.category}
                    </span>
                  </div>
                )}

                {/* Cover image */}
                <div className="relative h-44 mx-4 mt-3 rounded-2xl overflow-hidden">
                  {f.coverImage ? (
                    <img src={f.coverImage} alt={f.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${levelGradients[f.level] || 'from-violet-500 to-purple-700'} flex items-center justify-center`}>
                      <GraduationCap className="h-14 w-14 text-white/20" />
                    </div>
                  )}
                  {pct === 100 && (
                    <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg">
                      <Trophy className="h-2.5 w-2.5" /> Terminé
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="px-5 pt-4 pb-5">
                  <h4 className="font-black text-gray-900 text-base leading-snug mb-1 line-clamp-2">{f.title}</h4>
                  {f.instructor && (
                    <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                      <User className="h-3 w-3" /> {f.instructor}
                    </p>
                  )}

                  {/* Progress */}
                  <div className="mb-1.5">
                    <ProgressBar pct={pct} />
                  </div>
                  <div className="flex items-center justify-between text-xs mb-4">
                    <span className="text-gray-500 font-semibold">{pct}% terminé</span>
                    <span className="text-gray-400">{(f.modules || []).length} modules</span>
                  </div>

                  {/* CTA button */}
                  <button
                    onClick={() => onPlay(f)}
                    className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white font-black text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {pct === 0 ? 'Commencer le cours' : pct === 100 ? 'Revoir le cours' : 'Continuer le cours'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Not started (only on "Tous" tab) */}
      {subTab === 'all' && !localSearch && notStarted.length > 0 && (
        <div>
          <h3 className="text-sm font-black text-gray-500 uppercase tracking-wider mb-3">Pas encore commencé</h3>
          <div className="space-y-3">
            {notStarted.map(f => (
              <div
                key={f.id}
                onClick={() => onPlay(f)}
                className="bg-white rounded-2xl border border-gray-100 flex items-center gap-3 p-3 cursor-pointer hover:shadow-sm transition-all"
              >
                <div className={`h-14 w-14 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br ${levelGradients[f.level] || 'from-violet-500 to-purple-700'} flex items-center justify-center`}>
                  {f.coverImage
                    ? <img src={f.coverImage} alt={f.title} className="w-full h-full object-cover" />
                    : <GraduationCap className="h-7 w-7 text-white/30" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 text-sm truncate">{f.title}</p>
                  <p className="text-xs text-gray-400">{(f.modules || []).length} modules · {f.totalDuration || '—'}</p>
                </div>
                <div className="h-9 w-9 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
                  <Play className="h-4 w-4 text-violet-600 fill-violet-600 ml-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recommended for you */}
      {recommended.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-black text-gray-900">Recommandé pour vous</h3>
            <button onClick={() => onTabChange('all')} className="text-xs text-violet-600 font-bold flex items-center gap-1">
              Voir tout <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {recommended.slice(0, 4).map((f, i) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                onClick={() => onDetails(f)}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-all"
              >
                <div className="relative h-28 overflow-hidden">
                  {f.coverImage ? (
                    <img src={f.coverImage} alt={f.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${levelGradients[f.level] || 'from-violet-500 to-purple-700'} flex items-center justify-center`}>
                      <GraduationCap className="h-8 w-8 text-white/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
                <div className="p-3">
                  <p className="font-black text-gray-900 text-xs line-clamp-2 leading-snug mb-1">{f.title}</p>
                  <p className="text-[10px] text-gray-400">{f.totalDuration || `${(f.modules || []).length} modules`}</p>
                  {f.instructor && <p className="text-[10px] text-gray-400 truncate">Par {f.instructor}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Certificate banner */}
      <div className="rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-700 to-purple-900 p-6 text-white shadow-lg">
        <Award className="h-9 w-9 mb-3 text-amber-300" />
        <h4 className="text-base font-black mb-1">Certificats Solutionpam Academy</h4>
        <p className="text-white/70 text-sm mb-4 leading-relaxed">
          Complétez une formation pour obtenir votre certificat reconnu.
        </p>
        <button
          onClick={onOpenWallet}
          className="bg-white text-violet-700 font-black text-sm px-5 py-2.5 rounded-full hover:bg-violet-50 active:scale-95 transition-all inline-flex items-center gap-2 shadow-md"
        >
          👉 Voir mes certificats
        </button>
      </div>

    </div>
  );
}

// ── Formation Detail Page ──────────────────────────────────────────────────────

interface DetailPageProps {
  formation: Formation;
  isOwned: boolean;
  isFav: boolean;
  loggedClient: Client | null;
  onRequestAuth?: () => void;
  onBack: () => void;
  onPlay: () => void;
  onFavorite: (e: React.MouseEvent) => void;
  onShare: () => void;
  onOpenWallet: () => void;
  paymentStep: PaymentStep;
  setPaymentStep: (s: PaymentStep) => void;
  selectedPayMethod: 'moncash' | 'natcash' | null;
  setSelectedPayMethod: (m: 'moncash' | 'natcash' | null) => void;
  payFormData: { name: string; email: string; transactionCode: string };
  setPayFormData: (d: any) => void;
  purchasing: boolean;
  submittingPayment: boolean;
  onWalletPurchase: () => void;
  onExternalSubmit: () => void;
  onPlopPlopSuccess: () => void;
  moncashNumber: string;
  natcashNumber: string;
  discount: number;
  settings: any;
  progressPct: number;
}

function FormationDetailPage({
  formation, isOwned, isFav, loggedClient, onBack, onPlay, onFavorite, onOpenWallet,
  onRequestAuth, onShare,
  paymentStep, setPaymentStep, selectedPayMethod, setSelectedPayMethod,
  payFormData, setPayFormData, purchasing, submittingPayment,
  onWalletPurchase, onExternalSubmit, onPlopPlopSuccess, moncashNumber, natcashNumber, discount, progressPct, settings
}: DetailPageProps) {

  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [showAllModules, setShowAllModules] = useState(false);

  useEffect(() => {
    const map: Record<string, boolean> = {};
    (formation.chapters || []).forEach((c, i) => { map[c.id] = i < 2; });
    if (!(formation.chapters || []).length) map['__all'] = true;
    setExpandedChapters(map);
  }, [formation.id]);

  const modules = [...(formation.modules || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const visibleModules = showAllModules ? modules : modules.slice(0, 6);

  // Group modules by chapter
  const chapterModules: Record<string, FormationModule[]> = {};
  const noChapter: FormationModule[] = [];
  modules.forEach(m => {
    if (m.chapterId) { chapterModules[m.chapterId] = [...(chapterModules[m.chapterId] || []), m]; }
    else { noChapter.push(m); }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="relative h-64 sm:h-80 bg-gray-900 overflow-hidden">
        {formation.coverImage ? (
          <img src={formation.coverImage} alt={formation.title} className="w-full h-full object-cover opacity-60" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${levelGradients[formation.level] || 'from-violet-600 to-purple-800'}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />

        {/* Back button */}
        <div className="absolute top-4 left-4">
          <button onClick={onBack}
            className="flex items-center gap-2 text-white/80 hover:text-white bg-black/30 backdrop-blur-sm rounded-xl px-3 py-2 text-sm font-semibold transition-colors">
            <ChevronLeft className="h-4 w-4" /> Retour
          </button>
        </div>

        {/* Favorite */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button onClick={onShare} aria-label="Partager cette formation"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/30 text-white/70 backdrop-blur-sm transition-all hover:bg-black/50 hover:text-white">
            <Share2 className="h-4 w-4" />
          </button>
          <button onClick={onFavorite} aria-label="Ajouter aux favoris"
            className={`flex h-9 w-9 items-center justify-center rounded-xl backdrop-blur-sm transition-all ${isFav ? 'bg-rose-500 text-white' : 'bg-black/30 text-white/70 hover:bg-black/50'}`}>
            <Heart className={`h-4 w-4 ${isFav ? 'fill-white' : ''}`} />
          </button>
        </div>

        {/* Title */}
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300 mb-3">
            {bucketCategory(formation.category)}
          </span>
          <h1 className="font-editorial text-2xl sm:text-4xl font-semibold text-white leading-tight max-w-2xl">{formation.title}</h1>
          <p className="text-gray-300 text-sm mt-2 line-clamp-2 max-w-xl">{formation.shortDescription || formation.description}</p>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-8">

            {/* Meta stats */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: <Clock className="h-4 w-4 text-violet-500" />, label: 'Durée', value: formation.totalDuration || `${modules.length * 15} min` },
                  { icon: <BookOpen className="h-4 w-4 text-violet-500" />, label: 'Modules', value: modules.length },
                  { icon: <Users className="h-4 w-4 text-violet-500" />, label: 'Étudiants', value: (formation.studentsCount || 0).toLocaleString() },
                  { icon: <Star className="h-4 w-4 text-orange-500" />, label: 'Note', value: formation.rating > 0 ? formation.rating.toFixed(1) : '—' },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="text-center p-3 bg-stone-50 rounded-xl">
                    <div className="flex justify-center mb-1.5">{icon}</div>
                    <p className="font-bold text-gray-900 text-sm">{value}</p>
                    <p className="text-[11px] text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {formation.hasCertificate && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 text-xs font-bold rounded-full border border-orange-200">
                    <BadgeCheck className="h-3.5 w-3.5" /> Certification incluse
                  </span>
                )}
                {formation.level && (
                  <span className={`px-3 py-1.5 text-xs font-bold rounded-full border ${levelColors[formation.level] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {levelLabels[formation.level] || formation.level}
                  </span>
                )}
                {formation.language && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">
                    <Globe className="h-3 w-3" /> {formation.language}
                  </span>
                )}
              </div>
            </div>

            {/* Preview Video */}
            {formation.previewVideoUrl && (
              <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
                <div className="p-4 border-b border-stone-100 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-orange-50 flex items-center justify-center">
                    <Play className="h-3.5 w-3.5 text-orange-600 fill-orange-600" />
                  </div>
                  <div>
                    <h2 className="font-editorial font-semibold text-gray-900 text-[15px]">Aperçu gratuit du cours</h2>
                    <p className="text-[11px] text-gray-400">Regardez sans inscription</p>
                  </div>
                </div>
                {(() => {
                  const ytMatch = formation.previewVideoUrl?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
                  const vimeoMatch = formation.previewVideoUrl?.match(/vimeo\.com\/(\d+)/);
                  if (ytMatch) {
                    return (
                      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                        <iframe
                          src={`https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`}
                          className="absolute inset-0 w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen title="Aperçu du cours"
                        />
                      </div>
                    );
                  }
                  if (vimeoMatch) {
                    return (
                      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                        <iframe
                          src={`https://player.vimeo.com/video/${vimeoMatch[1]}?color=7C3AED`}
                          className="absolute inset-0 w-full h-full"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen title="Aperçu du cours"
                        />
                      </div>
                    );
                  }
                  return (
                    <video controls playsInline className="w-full aspect-video">
                      <source src={formation.previewVideoUrl} />
                    </video>
                  );
                })()}
              </div>
            )}

            {/* Description */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-6">
              <h2 className="font-editorial font-semibold text-gray-900 text-lg mb-3">À propos de cette formation</h2>
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{formation.description}</p>
            </div>

            {/* Instructor */}
            {formation.instructor && (
              <div className="bg-white rounded-2xl border border-stone-200/80 p-6">
                <h2 className="font-editorial font-semibold text-gray-900 text-lg mb-4">Votre instructeur</h2>
                <div className="flex items-start gap-4">
                  {formation.instructorAvatar ? (
                    <img src={formation.instructorAvatar} alt={formation.instructor}
                      className="h-16 w-16 rounded-full object-cover border-2 border-orange-200 shrink-0"
                      onError={e => (e.currentTarget.style.display = 'none')} />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-violet-100 flex items-center justify-center border-2 border-orange-200 shrink-0">
                      <User className="h-8 w-8 text-violet-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-gray-900 text-base">{formation.instructor}</p>
                    {formation.instructorBio && (
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed">{formation.instructorBio}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Curriculum */}
            {modules.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
                <div className="p-5 border-b border-stone-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-editorial font-semibold text-gray-900 text-lg">Curriculum du cours</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {modules.length} module{modules.length > 1 ? 's' : ''} · {(formation.chapters || []).length > 0 ? `${(formation.chapters || []).length} chapitres` : ''}
                    </p>
                  </div>
                  {isOwned && progressPct > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">{progressPct}% complété</p>
                      <div className="w-24">
                        <ProgressBar pct={progressPct} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Chapters */}
                {(formation.chapters || []).length > 0 ? (
                  <div className="divide-y divide-stone-100">
                    {(formation.chapters || []).map((chapter, ci) => {
                      const cms = chapterModules[chapter.id] || [];
                      const expanded = expandedChapters[chapter.id];
                      return (
                        <div key={chapter.id}>
                          <button
                            onClick={() => setExpandedChapters(prev => ({ ...prev, [chapter.id]: !prev[chapter.id] }))}
                            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-stone-50 transition-colors"
                          >
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-editorial font-semibold shrink-0 ${expanded ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                              {ci + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-sm">{chapter.title}</p>
                              <p className="text-[11px] text-gray-400">{cms.length} leçon{cms.length !== 1 ? 's' : ''}</p>
                            </div>
                            {!isOwned && <Lock className="h-4 w-4 text-gray-300 shrink-0" />}
                            {expanded ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                          </button>
                          {expanded && cms.map((mod, mi) => (
                            <ModuleRow key={mod.id} mod={mod} idx={mi} isOwned={isOwned} />
                          ))}
                        </div>
                      );
                    })}
                    {noChapter.map((mod, mi) => <ModuleRow key={mod.id} mod={mod} idx={mi} isOwned={isOwned} />)}
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {visibleModules.map((mod, mi) => <ModuleRow key={mod.id} mod={mod} idx={mi} isOwned={isOwned} />)}
                    {modules.length > 6 && (
                      <button onClick={() => setShowAllModules(v => !v)}
                        className="w-full py-3.5 text-xs font-bold text-violet-600 hover:bg-stone-50 transition-colors flex items-center justify-center gap-1.5">
                        {showAllModules ? <><ChevronUp className="h-3.5 w-3.5" /> Réduire</> : <><ChevronDown className="h-3.5 w-3.5" /> Voir {modules.length - 6} modules de plus</>}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PDF Resources */}
            {formation.pdfUrl && (
              <div className="bg-white rounded-2xl border border-stone-200/80 p-5">
                <h2 className="font-editorial font-semibold text-gray-900 text-[15px] mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-500" /> Ressources
                </h2>
                {isOwned ? (
                  <a href={formation.pdfUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-100 rounded-xl hover:bg-orange-100 transition-colors">
                    <div className="h-10 w-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-orange-800 text-sm">Support de cours PDF</p>
                      <p className="text-xs text-orange-500">Télécharger</p>
                    </div>
                    <Download className="h-4 w-4 text-orange-500 shrink-0" />
                  </a>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                    <Lock className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-400">Support PDF — disponible après achat</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (Purchase Card) ────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="sticky top-20">
              <PurchaseCard
                formation={formation}
                isOwned={isOwned}
                loggedClient={loggedClient}
                paymentStep={paymentStep}
                setPaymentStep={setPaymentStep}
                selectedPayMethod={selectedPayMethod}
                setSelectedPayMethod={setSelectedPayMethod}
                payFormData={payFormData}
                setPayFormData={setPayFormData}
                purchasing={purchasing}
                submittingPayment={submittingPayment}
                onPlay={onPlay}
                onWalletPurchase={onWalletPurchase}
                onExternalSubmit={onExternalSubmit}
                 onPlopPlopSuccess={onPlopPlopSuccess}
                 onRequestAuth={onRequestAuth}
                onOpenWallet={onOpenWallet}
                moncashNumber={moncashNumber}
                natcashNumber={natcashNumber}
                discount={discount}
                progressPct={progressPct}
                settings={settings}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleRow({ mod, idx, isOwned }: { mod: FormationModule; idx: number; isOwned: boolean }) {
  const hasVideo = !!mod.videoUrl;
  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isOwned ? 'bg-violet-100' : 'bg-gray-100'}`}>
        {isOwned ? (
          hasVideo ? <Play className="h-3.5 w-3.5 text-violet-600 fill-violet-600" /> : <FileText className="h-3.5 w-3.5 text-violet-600" />
        ) : (
          <Lock className="h-3.5 w-3.5 text-gray-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{mod.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {mod.duration && <span className="text-[11px] text-gray-400 flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{mod.duration}</span>}
          {mod.pdfUrl && <span className="text-[11px] text-violet-500 flex items-center gap-1"><FileText className="h-2.5 w-2.5" />PDF</span>}
        </div>
      </div>
      {!isOwned && <Lock className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
    </div>
  );
}

// ── Purchase Card ──────────────────────────────────────────────────────────────

function PurchaseCard({
  formation, isOwned, loggedClient, paymentStep, setPaymentStep,
  selectedPayMethod, setSelectedPayMethod, payFormData, setPayFormData,
  purchasing, submittingPayment, onPlay, onWalletPurchase, onExternalSubmit, onPlopPlopSuccess,
  onRequestAuth, onOpenWallet, moncashNumber, natcashNumber, discount, progressPct, settings
}: any) {

  const rate = settings?.exchangeRate || 146;
  const hasWalletFunds = loggedClient && Math.round((loggedClient.balance ?? 0) * rate) >= (formation.price ?? 0);

  if (paymentStep === 'done') {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-lg shadow-stone-200/50 p-6 text-center">
        <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h3 className="font-editorial font-semibold text-gray-900 text-lg mb-2">Paiement envoyé !</h3>
        <p className="text-sm text-gray-500 mb-5">Votre demande est en cours de validation. Vous recevrez un accès dès confirmation.</p>
        <div className="bg-emerald-50 rounded-xl p-4 text-left space-y-1 text-xs text-gray-600 mb-4">
          <p>✅ Transaction soumise avec succès</p>
          <p>⏳ Validation sous 24–48h ouvrables</p>
          <p>📲 WhatsApp ouvert pour notifier l'admin</p>
        </div>
        <button onClick={() => setPaymentStep('detail')}
          className="w-full h-11 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
          Retour
        </button>
      </div>
    );
  }

  if (paymentStep === 'form' && selectedPayMethod) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-lg shadow-stone-200/50 p-6">
        <button onClick={() => setPaymentStep('external-method')} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-xs font-semibold mb-4 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>
        <h3 className="font-editorial font-semibold text-gray-900 text-lg mb-1">Finaliser le paiement</h3>
        <p className="text-xs text-gray-500 mb-5">via {selectedPayMethod === 'moncash' ? 'MonCash' : 'NatCash'}</p>

        <div className="space-y-3 mb-5">
          <input type="text" placeholder="Votre nom complet" value={payFormData.name}
            onChange={e => setPayFormData((d: any) => ({ ...d, name: e.target.value }))}
            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition-all" />
          <input type="email" placeholder="Votre email" value={payFormData.email}
            onChange={e => setPayFormData((d: any) => ({ ...d, email: e.target.value }))}
            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition-all" />
          <input type="text" placeholder="Code de transaction" value={payFormData.transactionCode}
            onChange={e => setPayFormData((d: any) => ({ ...d, transactionCode: e.target.value }))}
            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition-all" />
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-5 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Formation</span><span className="font-bold text-gray-800 truncate max-w-[140px]">{formation.title}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Montant</span><span className="font-black text-violet-700">{(formation.price || 0).toLocaleString()} HTG</span></div>
        </div>

        <button onClick={onExternalSubmit} disabled={submittingPayment}
          className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
          {submittingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Confirmer le paiement
        </button>
      </div>
    );
  }

  if (paymentStep === 'external-method') {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-lg shadow-stone-200/50 p-6">
        <button onClick={() => setPaymentStep('detail')} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-xs font-semibold mb-4 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>
        <h3 className="font-editorial font-semibold text-gray-900 text-lg mb-1">Mode de paiement</h3>
        <p className="text-xs text-gray-400 mb-4">
          {formation.title} · <span className="font-black text-violet-700">{(formation.price || 0).toLocaleString()} HTG</span>
        </p>

        <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> Automatique — accès immédiat
        </p>
        <PlopPlopMethodPicker
          formation={formation}
          loggedClient={loggedClient}
          onRequestAuth={onRequestAuth}
          onSuccess={onPlopPlopSuccess}
        />

        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-6 mb-2 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Manuel — validation sous 24-48h
        </p>
        <div className="space-y-3 mb-5">
          {/* MonCash */}
          <div onClick={() => setSelectedPayMethod('moncash')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPayMethod === 'moncash' ? 'border-rose-400 bg-rose-50' : 'border-gray-200 bg-white hover:border-rose-200'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Smartphone className="h-4 w-4 text-rose-600" />
              </div>
              <div className="flex-1">
                <p className="font-black text-gray-900 text-sm">MonCash</p>
                <p className="text-[10px] text-gray-400">Paiement mobile sécurisé par Digicel</p>
              </div>
              {selectedPayMethod === 'moncash' && <CheckCircle2 className="h-5 w-5 text-rose-500 shrink-0" />}
            </div>
            <div className="bg-white rounded-lg p-2.5 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-gray-400">Numéro</span><span className="font-black text-gray-800">{moncashNumber}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-400">Montant exact</span><span className="font-black text-violet-700">{(formation.price || 0).toLocaleString()} HTG</span></div>
            </div>
          </div>

          {/* NatCash */}
          <div onClick={() => setSelectedPayMethod('natcash')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPayMethod === 'natcash' ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white hover:border-amber-200'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <CreditCard className="h-4 w-4 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-black text-gray-900 text-sm">NatCash</p>
                <p className="text-[10px] text-gray-400">Sécurisé et rapide</p>
              </div>
              {selectedPayMethod === 'natcash' && <CheckCircle2 className="h-5 w-5 text-amber-500 shrink-0" />}
            </div>
            <div className="bg-white rounded-lg p-2.5 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-gray-400">Numéro</span><span className="font-black text-gray-800">{natcashNumber}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-400">Montant exact</span><span className="font-black text-violet-700">{(formation.price || 0).toLocaleString()} HTG</span></div>
            </div>
          </div>
        </div>

        <button onClick={() => { if (selectedPayMethod) setPaymentStep('form'); else toast.error('Choisissez un mode de paiement.'); }}
          disabled={!selectedPayMethod}
          className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors">
          Continuer <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Default: detail card
  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-lg shadow-stone-200/50 overflow-hidden">
      {/* Price header */}
      <div className="p-5 border-b border-stone-100">
        <div className="flex items-center gap-3 mb-1">
          <span className="font-editorial text-3xl font-semibold text-violet-700">
            {formation.price === 0 ? 'Gratuit' : `${(formation.price || 0).toLocaleString()} HTG`}
          </span>
          {formation.originalPrice && formation.originalPrice > formation.price && (
            <span className="text-sm text-gray-400 line-through">{formation.originalPrice.toLocaleString()}</span>
          )}
          {discount > 0 && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs font-black rounded-full">-{discount}%</span>
          )}
        </div>
        {loggedClient && formation.price > 0 && (
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5" />
            Votre solde : <span className={`font-bold ml-0.5 ${hasWalletFunds ? 'text-emerald-600' : 'text-rose-500'}`}>
              {Math.round((loggedClient.balance ?? 0) * rate).toLocaleString()} HTG
            </span>
          </p>
        )}
      </div>

      <div className="p-5 space-y-3">
        {isOwned ? (
          <>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <p className="text-sm font-bold text-emerald-700">Accès activé — Prêt à commencer !</p>
            </div>
            {progressPct > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progression</span><span className="font-bold text-violet-600">{progressPct}%</span>
                </div>
                <ProgressBar pct={progressPct} />
              </div>
            )}
            <button onClick={onPlay}
              className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-violet-500/20">
              <Play className="h-4 w-4 fill-white" />
              {progressPct > 0 ? 'Continuer le cours' : 'Commencer le cours'}
            </button>
          </>
        ) : loggedClient ? (
          <>
            {formation.price === 0 ? (
              <button onClick={onWalletPurchase} disabled={purchasing}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Accéder gratuitement
              </button>
            ) : (
              <>
                {hasWalletFunds && (
                  <button onClick={onWalletPurchase} disabled={purchasing}
                    className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-violet-500/20">
                    {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                    Acheter avec mon Wallet
                  </button>
                )}
                {!hasWalletFunds && (
                  <button onClick={onOpenWallet} className="w-full text-xs text-violet-600 font-semibold hover:underline flex items-center justify-center gap-1 py-1">
                    <TrendingUp className="h-3 w-3" /> Recharger mon wallet
                  </button>
                )}
              </>
            )}
          </>
        ) : (
          <button onClick={onRequestAuth || onOpenWallet}
            className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors">
            <Lock className="h-4 w-4" /> Se connecter pour acheter
          </button>
        )}

        {/* Trust badges */}
        <div className="pt-3 border-t border-stone-100 space-y-2">
          {[
            { icon: <Shield className="h-3.5 w-3.5 text-emerald-500" />, text: 'Paiement 100% sécurisé' },
            { icon: <Award className="h-3.5 w-3.5 text-orange-500" />, text: 'Accès à vie aux mises à jour' },
            { icon: <BadgeCheck className="h-3.5 w-3.5 text-violet-500" />, text: formation.hasCertificate ? 'Certificat d\'achèvement inclus' : 'Support d\'instructeur inclus' },
          ].map(b => (
            <div key={b.text} className="flex items-center gap-2 text-xs text-gray-500">
              {b.icon} {b.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Premium catalog sub-components ─────────────────────────────────────────────

function ContinueLearningMiniCard({ formation, pct, onResume, onDetails }: {
  formation: Formation; pct: number; onResume: () => void; onDetails: () => void;
}) {
  return (
    <div className="bg-white border border-violet-50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex gap-3 mb-3">
        <div className="w-[60px] h-[60px] rounded-xl overflow-hidden shrink-0">
          {formation.coverImage ? (
            <img src={formation.coverImage} alt={formation.title} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${levelGradients[formation.level] || 'from-violet-500 to-purple-700'} flex items-center justify-center`}>
              <GraduationCap className="h-6 w-6 text-white/30" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h5
            className="font-black text-gray-900 text-sm leading-tight mb-0.5 line-clamp-2 cursor-pointer hover:text-violet-700 transition-colors"
            onClick={onDetails}
          >
            {formation.title}
          </h5>
          <p className="text-[11px] text-gray-400 font-semibold">{100 - pct}% restant</p>
          <div className="mt-2 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full"
            />
          </div>
          <p className="text-right text-[10px] font-black text-violet-600 mt-0.5">{pct}% complété</p>
        </div>
      </div>
      <button
        onClick={onResume}
        className="w-full bg-violet-50 text-violet-700 border border-violet-100 font-black text-xs py-2.5 rounded-xl hover:bg-violet-100 active:scale-95 transition-all flex items-center justify-center gap-1.5"
      >
        <Play className="h-3.5 w-3.5 fill-violet-700" /> Reprendre
      </button>
    </div>
  );
}
