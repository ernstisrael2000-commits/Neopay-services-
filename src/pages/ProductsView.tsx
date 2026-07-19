import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as LucideIcons from 'lucide-react';
import {
  ShoppingBag, CreditCard, Gamepad2, MessageCircle, ArrowRight,
  Info, Wallet, Smartphone, Landmark, Zap, ShieldCheck,
  DollarSign, Clock, Package, Star, QrCode, Loader2, X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from '../components/ui/dialog';
import { useProducts, useCardTopups } from '../services/parcelService';
import GamesTab from '../components/GamesTab';
import { useSettingsCtx } from '../contexts/SettingsContext';
import { submitClientPurchase, useClientData, useClientPendingPurchase } from '../services/clientService';
import { Client } from '../types';
import { toast } from 'sonner';

const WHATSAPP_NUMBER = '+50944813185';

// ── WalletPayButton ──────────────────────────────────────────────────────────
interface WalletPayButtonProps {
  client: Client;
  price: string | number | undefined;
  productName: string | undefined;
  hasPendingPurchase: boolean;
  purchaseLoading: boolean;
  setPurchaseLoading: (v: boolean) => void;
  onSuccess: () => void;
  exchangeRate: number;
}

const WalletPayButton = ({
  client, price, productName, hasPendingPurchase, purchaseLoading,
  setPurchaseLoading, onSuccess, exchangeRate,
}: WalletPayButtonProps) => {
  const numericPrice = parseFloat(String(price ?? '0').replace(/[^\d.]/g, ''));
  const balanceHTG = Math.round((client.balance ?? 0) * exchangeRate);
  const hasBalance = !isNaN(numericPrice) && numericPrice > 0 && balanceHTG >= numericPrice;

  const handlePay = async () => {
    if (purchaseLoading) return;
    if (!hasBalance) { toast.error(`Solde insuffisant. Vous avez ${balanceHTG.toLocaleString()} HTG`); return; }
    setPurchaseLoading(true);
    const priceUSD = numericPrice / exchangeRate;
    try {
      await submitClientPurchase(client, productName ?? '', String(price ?? ''), priceUSD);
      toast.success(`✅ Achat effectué ! ${numericPrice.toLocaleString()} HTG débité.`);
      onSuccess();
      const adminNum = (window as any).__renaAdminPhone || WHATSAPP_NUMBER;
      const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const msg = `🛍️ *ACHAT EFFECTUÉ — Rena*\n\n👤 Client: *${client.name}*\n🔑 ID Wallet: *#${client.walletId || '—'}*\n📱 Téléphone: *${client.phone || '—'}*\n🛒 Service: *${productName || '—'}*\n💰 Montant payé: *${numericPrice.toLocaleString()} HTG*\n💳 Méthode: *Solde Wallet*\n📅 Date: *${now}*\n\n✅ Paiement traité automatiquement. Veuillez activer le service.`;
      window.open(`https://wa.me/${adminNum.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'achat.");
    } finally {
      setPurchaseLoading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={purchaseLoading || !hasBalance}
      onClick={handlePay}
      className={`w-full h-14 rounded-2xl border-2 font-black text-base flex items-center justify-center gap-3 transition-all ${hasBalance ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 active:scale-95' : 'border-red-200 text-red-400 cursor-not-allowed opacity-60'}`}
    >
      {purchaseLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
        <><Wallet className="h-5 w-5" />{hasBalance ? `Payer avec mon solde (${balanceHTG.toLocaleString()} HTG)` : `Solde insuffisant (${balanceHTG.toLocaleString()} HTG)`}</>
      )}
    </button>
  );
};

interface ProductsViewProps {
  loggedClient?: Client | null;
  onOpenWallet?: () => void;
  onViewChange: (view: any) => void;
  onProductDetailChange?: (open: boolean) => void;
}

type TabKey = 'cards' | 'games' | 'products';

export default function ProductsView({ loggedClient, onOpenWallet, onViewChange, onProductDetailChange }: ProductsViewProps) {
  const { products, loading: productsLoading } = useProducts();
  const { cards, loading: cardsLoading } = useCardTopups();
  const { settings } = useSettingsCtx();
  const exchangeRate = settings?.exchangeRate || 146;

  const { client: liveClient } = useClientData(loggedClient?.id || null);
  const effectiveClient = liveClient || loggedClient;
  const hasPendingPurchase = useClientPendingPurchase(loggedClient?.id || null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  React.useEffect(() => {
    if (settings?.whatsappAdminNumber) (window as any).__renaAdminPhone = settings.whatsappAdminNumber;
  }, [settings?.whatsappAdminNumber]);

  const [activeTab, setActiveTab] = useState<TabKey>('products');

  // Card recharge
  const [selectedCardForRecharge, setSelectedCardForRecharge] = useState<any>(null);
  const [rechargeAmountUSD, setRechargeAmountUSD] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isRechargeDialogOpen, setIsRechargeDialogOpen] = useState(false);
  const [isPaymentMethodDialogOpen, setIsPaymentMethodDialogOpen] = useState(false);

  // Product detail
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);
  const [customAmountUSD, setCustomAmountUSD] = useState('');

  useEffect(() => {
    onProductDetailChange?.(isProductDetailOpen);
  }, [isProductDetailOpen]);

  // Payment modal (for games + products via WhatsApp)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<{ name: string; price: string; type: string } | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'moncash' | 'natcash' | 'admi' | null>('moncash');
  const [paymentTransactionInfo, setPaymentTransactionInfo] = useState('');

  const openWhatsApp = (message: string) => {
    const num = settings?.whatsappAdminNumber || WHATSAPP_NUMBER;
    window.open(`https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleBuyRequested = (item: { name: string; price: string; type: string }) => {
    setPaymentTarget(item);
    setIsPaymentModalOpen(true);
    setSelectedPaymentMethod('moncash');
  };

  const handleFinalPaymentSubmit = () => {
    if (!paymentTarget || !selectedPaymentMethod) return;
    const methodLabel = selectedPaymentMethod === 'moncash' ? 'Mon Cash' : selectedPaymentMethod === 'natcash' ? 'Natcash' : 'Admi';
    const message = `Bonjour Rena,\n\nJe souhaite commander :\n📦 *${paymentTarget.name}*\n💰 Prix : *${paymentTarget.price}*\n\n💳 Mode de paiement : *${methodLabel}*\n📝 Infos Transaction : *${paymentTransactionInfo || 'Non fournie'}*\n\nMerci de valider ma commande.`;
    openWhatsApp(message);
    setIsPaymentModalOpen(false);
    setPaymentTransactionInfo('');
  };

  const handleCardClick = (card: any) => {
    setSelectedCardForRecharge(card);
    setRechargeAmountUSD(card.presets?.[0]?.toString() || '');
    setIsRechargeDialogOpen(true);
  };

  const handleRechargeSubmit = () => {
    if (!selectedCardForRecharge || !rechargeAmountUSD) return;
    setIsRechargeDialogOpen(false);
    setIsPaymentMethodDialogOpen(true);
  };

  const handleFinalRechargePayment = (method: string) => {
    if (!selectedCardForRecharge || !rechargeAmountUSD) return;
    const usd = parseFloat(rechargeAmountUSD);
    const gourdes = usd * (settings?.exchangeRate || 146);
    const message = `Bonjour Rena,\n\nJe souhaite recharger ma carte :\n👤 Client : *${customerName || 'Non spécifié'}*\n💳 Carte : *${selectedCardForRecharge.name}*\n💵 Montant USD : *${usd}$*\n🇭🇹 Équivalent en Gourdes : *${gourdes.toLocaleString()} HTG*\n\n💳 Moyen de paiement : *${method}*\n\nMerci de valider ma recharge.`;
    openWhatsApp(message);
    setIsPaymentMethodDialogOpen(false);
    setRechargeAmountUSD('');
    setCustomerName('');
    setSelectedCardForRecharge(null);
  };

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setSelectedPlan(product.plans?.[0] || null);
    setCustomAmountUSD('');
    setIsProductDetailOpen(true);
  };

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'cards',    label: 'Cartes',   icon: <CreditCard className="h-4 w-4" /> },
    { key: 'games',    label: 'Jeux',     icon: <Gamepad2 className="h-4 w-4" /> },
    { key: 'products', label: 'Produits', icon: <ShoppingBag className="h-4 w-4" /> },
  ];

  // ── Vue Jeux : pleine page indépendante ──────────────────────────
  if (activeTab === 'games') {
    return (
      <motion.div
        key="games-page"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 30 }}
        transition={{ duration: 0.25 }}
        className="min-h-screen bg-gray-50 pb-28"
      >
        {/* Sticky top bar */}
        <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => setActiveTab('products')}
            className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all shrink-0"
          >
            <LucideIcons.ArrowLeft className="h-4 w-4 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Gamepad2 className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-black text-gray-900 text-base">Top-up Jeux</span>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <GamesTab loggedClient={loggedClient} onOpenWallet={onOpenWallet} />
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-4 pt-6 pb-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white leading-none">Nos Produits</h1>
              <p className="text-white/60 text-xs font-medium mt-0.5">Cartes, jeux, services digitaux</p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating tabs */}
      <div className="max-w-3xl mx-auto px-4 -mt-5 mb-6">
        <div className="bg-white rounded-2xl shadow-lg shadow-black/10 border border-gray-100 p-1.5 flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-black transition-all ${
                activeTab === tab.key
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 space-y-6">
        <AnimatePresence mode="wait">

          {/* ── CARTES TAB ── */}
          {activeTab === 'cards' && (
            <motion.div key="cards" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <h2 className="font-black text-dark text-base leading-none">Recharge Cartes</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Choisissez une carte à recharger</p>
                </div>
              </div>
              {cardsLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                </div>
              ) : cards.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                  <CreditCard className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Aucune carte disponible pour le moment.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {cards.map((card, i) => (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <button
                        onClick={() => handleCardClick(card)}
                        className="w-full bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                          <img
                            src={card.image}
                            alt={card.name}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={e => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/card/400/300'; }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                          <div className="absolute bottom-2 left-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white">{card.price}</span>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="font-black text-dark text-sm leading-tight line-clamp-1">{card.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Activation instantanée</p>
                          <div className="mt-2 flex items-center gap-1 text-emerald-600 text-[10px] font-black">
                            <Zap className="h-3 w-3 fill-current" />
                            Recharger
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── JEUX TAB ── */}
          {activeTab === 'games' && (
            <motion.div key="games" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>
              <GamesTab loggedClient={loggedClient} onOpenWallet={onOpenWallet} />
            </motion.div>
          )}

          {/* ── PRODUITS TAB ── */}
          {activeTab === 'products' && (
            <motion.div key="products" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Package className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-black text-dark text-base leading-none">Produits & Services</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Services digitaux premium</p>
                </div>
              </div>
              {productsLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                  <Package className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Aucun produit disponible pour le moment.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {products.map((product, i) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.06 }}
                      onClick={() => handleProductClick(product)}
                      className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group active:scale-[0.98]"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                        <img
                          src={product.image}
                          alt={product.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={e => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/rena/400/300'; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-primary text-white shadow-md">
                            {product.price}
                          </span>
                        </div>
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="text-white font-black text-[11px] leading-tight line-clamp-2 drop-shadow">{product.name}</p>
                        </div>
                      </div>
                      <div className="p-2.5">
                        <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">{product.description || 'Service digital Rena'}</p>
                        <div className="flex items-center gap-1 mt-2 text-[9px] text-primary font-black">
                          <Clock className="h-2.5 w-2.5" />
                          <span>24/7</span>
                          <span className="ml-auto flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                            Détails <ArrowRight className="h-2.5 w-2.5" />
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Card Recharge — Step 1 ── */}
      <Dialog open={isRechargeDialogOpen} onOpenChange={setIsRechargeDialogOpen}>
        <DialogContent className="sm:max-w-lg border-0 bg-white shadow-2xl relative flex flex-col overflow-hidden" showCloseButton={false}>
          <div className="bg-emerald-600 p-7 text-white relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <DialogHeader>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none">Recharge de Carte</DialogTitle>
                    <DialogDescription className="text-white/80 text-[10px] font-black uppercase tracking-widest mt-1">Étape 1: Configuration</DialogDescription>
                  </div>
                </div>
                <DialogClose className="rounded-full bg-white/20 p-2 hover:bg-white/30 transition-colors">
                  <X className="h-5 w-5 text-white" />
                </DialogClose>
              </div>
            </DialogHeader>
            {selectedCardForRecharge && (
              <div className="p-4 rounded-2xl bg-black/20 border border-white/10 flex items-center gap-3">
                <div className="h-14 w-14 rounded-xl overflow-hidden bg-white/10 shrink-0">
                  <img src={selectedCardForRecharge.image} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Carte sélectionnée</p>
                  <p className="text-base font-bold leading-tight">{selectedCardForRecharge.name}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Identifiant ou Nom complet</Label>
              <div className="relative">
                <LucideIcons.User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                <Input
                  placeholder="Votre nom ou ID Wallet"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="pl-10 h-12 rounded-2xl border-gray-100 font-bold bg-gray-50/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant (USD)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-emerald-600">$</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={rechargeAmountUSD}
                  onChange={e => setRechargeAmountUSD(e.target.value)}
                  className="pl-10 h-14 text-xl font-black rounded-2xl border-gray-100 bg-gray-50/50"
                />
              </div>
              {selectedCardForRecharge?.presets?.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedCardForRecharge.presets.map((val: number) => (
                    <button
                      key={val}
                      onClick={() => setRechargeAmountUSD(val.toString())}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${rechargeAmountUSD === val.toString() ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-100 text-dark hover:bg-gray-200'}`}
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(() => {
              const usd = parseFloat(rechargeAmountUSD) || 0;
              const rate = settings?.exchangeRate || 146;
              const feeRules = selectedCardForRecharge?.feeRules || [];
              const matchedRule = feeRules.find((r: any) => usd >= r.min && usd <= r.max);
              const fee = matchedRule ? matchedRule.fee : 0;
              const total = usd + fee;
              return (
                <div className="rounded-2xl border border-emerald-100 overflow-hidden">
                  <div className="bg-emerald-600 px-4 py-2.5 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-white fill-white" />
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Calculateur intelligent</p>
                  </div>
                  <div className="bg-emerald-50 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-emerald-700 font-semibold">Montant USD</span>
                      <span className="text-xl font-black text-emerald-900">${rechargeAmountUSD || '0'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-emerald-700 font-semibold">Taux de change</span>
                      <span className="text-sm font-black text-emerald-600">1$ = {rate} HTG</span>
                    </div>
                    {fee > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-amber-700 font-semibold">Frais de service</span>
                        <span className="text-sm font-black text-amber-600">+${fee}</span>
                      </div>
                    )}
                    <div className="h-px bg-emerald-200" />
                    {fee > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-emerald-800">Total USD</span>
                        <span className="text-lg font-black text-emerald-800">${total.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-emerald-900">Équivalent Gourdes</span>
                      <span className="text-2xl font-black text-emerald-700">
                        {usd > 0 ? (total * rate).toLocaleString() : '0'} HTG
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="p-6 pt-3 shrink-0 bg-white border-t border-gray-100">
            <Button
              onClick={handleRechargeSubmit}
              disabled={!rechargeAmountUSD || parseFloat(rechargeAmountUSD) <= 0 || !customerName.trim()}
              className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
            >
              Suivant <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Card Recharge — Step 2 ── */}
      <Dialog open={isPaymentMethodDialogOpen} onOpenChange={setIsPaymentMethodDialogOpen}>
        <DialogContent className="sm:max-w-lg border-0 bg-white shadow-2xl relative flex flex-col overflow-hidden" showCloseButton={false}>
          <div className="bg-emerald-800 p-7 text-white shrink-0">
            <DialogHeader>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center">
                    <ShieldCheck className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none">Moyen de Paiement</DialogTitle>
                    <DialogDescription className="text-white/80 text-[10px] font-black uppercase tracking-widest mt-1">Étape 2: Choisir votre mode</DialogDescription>
                  </div>
                </div>
                <DialogClose className="rounded-full bg-white/20 p-2 hover:bg-white/30 transition-colors">
                  <X className="h-5 w-5 text-white" />
                </DialogClose>
              </div>
            </DialogHeader>
            {(() => {
              const usd2 = parseFloat(rechargeAmountUSD || '0');
              const rate2 = settings?.exchangeRate || 146;
              const feeRules2 = selectedCardForRecharge?.feeRules || [];
              const matchedRule2 = feeRules2.find((r: any) => usd2 >= r.min && usd2 <= r.max);
              const fee2 = matchedRule2 ? matchedRule2.fee : 0;
              const total2 = usd2 + fee2;
              return (
                <div className="p-5 rounded-2xl bg-white/10 border border-white/5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Montant{fee2 > 0 ? ' + frais' : ''}</span>
                    <span className="text-3xl font-black text-white">${total2.toFixed(2)} USD</span>
                  </div>
                  {fee2 > 0 && (
                    <div className="flex justify-between items-center text-amber-200/80 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-tighter">Dont frais de service</span>
                      <span className="text-xs font-black">+${fee2}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-emerald-100/60">
                    <span className="text-[10px] font-black uppercase tracking-tighter">Estimation HTG</span>
                    <span className="text-sm font-black">≈ {(total2 * rate2).toLocaleString()} HTG</span>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {(() => {
              const usd = parseFloat(rechargeAmountUSD || '0');
              const feeRulesS = selectedCardForRecharge?.feeRules || [];
              const matchedRuleS = feeRulesS.find((r: any) => usd >= r.min && usd <= r.max);
              const feeS = matchedRuleS ? matchedRuleS.fee : 0;
              const totalS = usd + feeS;
              const bal = effectiveClient?.balance ?? 0;
              const canPay = effectiveClient && bal >= totalS && totalS > 0;
              const balHTG = Math.round(bal * exchangeRate);
              if (!effectiveClient) {
                return (
                  <div className="flex flex-col items-center gap-4 py-6 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                      <Wallet className="h-7 w-7 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-black text-gray-800 text-base">Connexion requise</p>
                      <p className="text-xs text-gray-400 mt-1">Connectez-vous pour payer avec votre solde Wallet.</p>
                    </div>
                    <button
                      onClick={() => { setIsPaymentMethodDialogOpen(false); onOpenWallet?.(); }}
                      className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Wallet className="h-5 w-5" /> Se connecter
                    </button>
                  </div>
                );
              }
              return (
                <>
                  <button
                    onClick={() => { if (!canPay) { toast.error(`Solde insuffisant. Vous avez ${balHTG.toLocaleString()} HTG.`); return; } handleFinalRechargePayment('Solde Wallet'); }}
                    className={`group w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all hover:scale-[1.01] active:scale-[0.99] ${canPay ? 'bg-emerald-50 border-emerald-100 hover:shadow-md' : 'bg-gray-50 border-gray-200 opacity-70 cursor-not-allowed'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center ${canPay ? 'text-emerald-600' : 'text-gray-400'}`}>
                        <Wallet className="h-6 w-6" />
                      </div>
                      <div className="text-left">
                        <span className="block text-lg font-black text-dark">Payer avec mon Solde</span>
                        <span className={`text-[10px] font-bold uppercase ${canPay ? 'text-emerald-600' : 'text-red-500'}`}>
                          Solde: {balHTG.toLocaleString()} HTG {canPay ? '· Suffisant ✓' : '· Insuffisant ✗'}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className={`h-5 w-5 ${canPay ? 'text-emerald-600' : 'text-gray-300'}`} />
                  </button>
                  {!canPay && (
                    <button
                      onClick={() => { setIsPaymentMethodDialogOpen(false); onOpenWallet?.(); }}
                      className="w-full text-xs text-emerald-600 font-semibold hover:underline flex items-center justify-center gap-1 py-1"
                    >
                      Recharger mon wallet →
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Product Detail — plein-écran slide-up ── */}
      <AnimatePresence>
        {isProductDetailOpen && selectedProduct && (
          <>
            {/* Backdrop */}
            <motion.div
              key="product-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsProductDetailOpen(false)}
            />
            {/* Panel */}
            <motion.div
              key="product-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[2rem] shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
            >
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="h-1 w-10 rounded-full bg-gray-200" />
              </div>

              {/* Hero image */}
              <div className="relative w-full aspect-[16/7] shrink-0">
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                {/* Close button */}
                <button
                  onClick={() => setIsProductDetailOpen(false)}
                  className="absolute top-4 right-4 z-10 h-9 w-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-black/60 transition-all"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
                {/* Badge catégorie */}
                <span className="absolute top-4 left-4 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-primary/90 backdrop-blur-sm text-white">
                  Service Premium
                </span>
                {/* Prix en bas à gauche */}
                <div className="absolute bottom-4 left-4">
                  <p className="text-3xl font-black text-white drop-shadow-lg">
                    {selectedPlan ? selectedPlan.price : selectedProduct.price}
                  </p>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="p-5 space-y-5 pb-8">

                  {/* Titre + sous-titre */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-black text-gray-900 leading-tight">{selectedProduct.name}</h2>
                      <p className="text-gray-400 text-sm mt-0.5">Rena Digital · Livraison instantanée</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
                      <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-xs font-black text-amber-700">4.9</span>
                    </div>
                  </div>

                  {/* Description */}
                  {selectedProduct.description && (
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {selectedProduct.description}
                      </p>
                    </div>
                  )}

                  {/* Badges garanties */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                      <Clock className="h-5 w-5 text-emerald-500" />
                      <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wide text-center">Livraison 24/7</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-blue-50 border border-blue-100">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      <span className="text-[9px] font-black text-primary uppercase tracking-wide text-center">100% Sécurisé</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-purple-50 border border-purple-100">
                      <Zap className="h-5 w-5 text-purple-500" />
                      <span className="text-[9px] font-black text-purple-700 uppercase tracking-wide text-center">Instantané</span>
                    </div>
                  </div>

                  {/* Plans */}
                  {selectedProduct.plans?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Choisissez votre plan</p>
                      {selectedProduct.plans.map((plan: any) => (
                        <button
                          key={plan.id}
                          onClick={() => setSelectedPlan(plan)}
                          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${
                            selectedPlan?.id === plan.id
                              ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                              : 'border-gray-100 bg-white hover:border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${selectedPlan?.id === plan.id ? 'border-primary' : 'border-gray-300'}`}>
                              {selectedPlan?.id === plan.id && <div className="h-2 w-2 rounded-full bg-primary" />}
                            </div>
                            <span className={`font-bold text-sm ${selectedPlan?.id === plan.id ? 'text-primary' : 'text-gray-800'}`}>{plan.name}</span>
                          </div>
                          <span className={`font-black text-base ${selectedPlan?.id === plan.id ? 'text-primary' : 'text-gray-500'}`}>{plan.price}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Montant personnalisé */}
                  {selectedProduct.allowCustomAmount && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Montant personnalisé</p>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-lg">$</span>
                        <Input
                          type="number"
                          value={customAmountUSD}
                          onChange={e => setCustomAmountUSD(e.target.value)}
                          placeholder="0.00"
                          className="h-13 rounded-2xl text-lg font-black pl-10 border-2 focus:border-primary"
                          min="0.01"
                          step="0.01"
                        />
                      </div>
                      {customAmountUSD && !isNaN(parseFloat(customAmountUSD)) && parseFloat(customAmountUSD) > 0 && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                          <DollarSign className="h-4 w-4 text-primary shrink-0" />
                          <p className="text-sm font-black text-primary">
                            = {Math.round(parseFloat(customAmountUSD) * (selectedProduct.customExchangeRate || exchangeRate)).toLocaleString()} HTG
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Boutons d'action */}
                  {(() => {
                    const rate2 = selectedProduct.customExchangeRate || exchangeRate;
                    const customHTG = selectedProduct.allowCustomAmount && customAmountUSD && !isNaN(parseFloat(customAmountUSD))
                      ? Math.round(parseFloat(customAmountUSD) * rate2) : null;
                    const displayPrice = customHTG !== null
                      ? `${customHTG} HTG`
                      : (selectedPlan ? selectedPlan.price : selectedProduct.price);
                    const displayName = selectedPlan
                      ? `${selectedProduct.name} (${selectedPlan.name})`
                      : selectedProduct.name;
                    const customLabel = customHTG !== null
                      ? `$${customAmountUSD} USD = ${customHTG.toLocaleString()} HTG`
                      : null;
                    return (
                      <div className="space-y-3 pt-1">
                        {loggedClient && (
                          <WalletPayButton
                            client={effectiveClient || loggedClient}
                            price={displayPrice}
                            productName={customLabel ? `${displayName} — ${customLabel}` : displayName}
                            hasPendingPurchase={hasPendingPurchase}
                            purchaseLoading={purchaseLoading}
                            setPurchaseLoading={setPurchaseLoading}
                            onSuccess={() => setIsProductDetailOpen(false)}
                            exchangeRate={exchangeRate}
                          />
                        )}
                        {!loggedClient && (
                          <Button
                            onClick={() => { setIsProductDetailOpen(false); onOpenWallet?.(); }}
                            variant="outline"
                            className="w-full h-12 rounded-2xl border-2 border-emerald-200 text-emerald-700 font-black flex items-center justify-center gap-2 hover:bg-emerald-50 active:scale-95 transition-all"
                          >
                            <Wallet className="h-4 w-4" />
                            Se connecter pour payer
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Payment Modal (WhatsApp) ── */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <div className="bg-primary p-6 text-white rounded-t-[2rem]">
            <DialogHeader>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-black uppercase text-white">Finaliser Paiement</DialogTitle>
                    <DialogDescription className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Paiement Sécurisé Rena</DialogDescription>
                  </div>
                </div>
                <DialogClose className="rounded-full bg-white/20 p-1.5 hover:bg-white/30 transition-colors">
                  <X className="h-4 w-4 text-white" />
                </DialogClose>
              </div>
            </DialogHeader>
            {paymentTarget && (
              <div className="p-4 rounded-2xl bg-black/20 border border-white/10">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Commande</p>
                <p className="text-base font-bold truncate">{paymentTarget.name}</p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                  <span className="text-xs font-bold text-white/60">Total</span>
                  <span className="text-xl font-black text-white">{paymentTarget.price}</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-5 space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mode de paiement</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'moncash', label: 'Mon Cash', icon: Smartphone, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
                  { id: 'natcash', label: 'Natcash',  icon: Smartphone, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
                  { id: 'admi',    label: 'Admi',     icon: Landmark,   color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100' },
                ].map(method => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPaymentMethod(method.id as any)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all ${selectedPaymentMethod === method.id ? `${method.border} ${method.bg} shadow-sm scale-105` : 'border-gray-100 bg-gray-50/50 grayscale hover:grayscale-0'}`}
                  >
                    <method.icon className={`h-5 w-5 ${method.color}`} />
                    <span className="text-[9px] font-black uppercase text-dark">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {selectedPaymentMethod && (
                <motion.div key={selectedPaymentMethod} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-center space-y-1.5">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Numéro de réception</p>
                  <p className="text-2xl font-black text-dark tracking-tight">
                    {selectedPaymentMethod === 'moncash' ? (settings?.moncashNumber || 'Précisé sur WhatsApp') :
                     selectedPaymentMethod === 'natcash' ? (settings?.natcashNumber || 'Précisé sur WhatsApp') :
                     ((settings as any)?.admiNumber || 'Précisé sur WhatsApp')}
                  </p>
                  {(settings as any)?.[`${selectedPaymentMethod}QR`] && (
                    <div className="flex justify-center">
                      <div className="p-2 bg-white rounded-2xl border border-gray-100 shadow-sm relative">
                        <img src={(settings as any)[`${selectedPaymentMethod}QR`]} alt="QR" className="h-20 w-20 object-contain" />
                        <div className="absolute -bottom-1.5 -right-1.5 bg-primary text-white p-1 rounded-lg">
                          <QrCode className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Détails de transaction</Label>
              <Input
                placeholder="ID Transaction, Nom ou Numéro de l'expéditeur"
                value={paymentTransactionInfo}
                onChange={e => setPaymentTransactionInfo(e.target.value)}
                className="h-12 rounded-2xl border-gray-100 font-bold bg-gray-50/50"
              />
            </div>
          </div>

          <DialogFooter className="p-5 pt-0">
            <Button
              onClick={handleFinalPaymentSubmit}
              disabled={!paymentTransactionInfo.trim()}
              className="w-full h-12 rounded-2xl bg-primary hover:bg-blue-700 text-white font-black shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              Envoyer et Payer <ArrowRight className="h-5 w-5" />
            </Button>
            <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-wider w-full mt-2">
              Vous serez redirigé vers WhatsApp
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
