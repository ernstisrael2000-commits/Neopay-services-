import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Coins, Loader2, ShieldCheck, Wallet, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { getClientCryptoOrders, getCryptoOrderCatalog, submitCryptoOrder } from '../services/cryptoMarketService';
import { Client, CryptoAsset, CryptoNetwork, CryptoOrder, CryptoOrderStatus } from '../types';

interface CryptoMarketViewProps { client: Client | null; onRequestAuth: () => void; }

const statusMeta: Record<CryptoOrderStatus, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  payment_pending: { label: 'Paiement à confirmer', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  payment_confirmed: { label: 'Paiement confirmé', className: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  processing: { label: 'En cours', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  completed: { label: 'Finalisée', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'Annulée', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  rejected: { label: 'Refusée', className: 'bg-red-100 text-red-700 border-red-200' },
};

function formatDate(value: any): string {
  const date = value?._seconds ? new Date(value._seconds * 1000) : value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function CryptoMarketView({ client, onRequestAuth }: CryptoMarketViewProps) {
  const [cryptos, setCryptos] = useState<CryptoAsset[]>([]);
  const [networks, setNetworks] = useState<CryptoNetwork[]>([]);
  const [orders, setOrders] = useState<CryptoOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<'buy' | 'history'>('buy');
  const [cryptoId, setCryptoId] = useState('');
  const [networkId, setNetworkId] = useState('');
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [consent, setConsent] = useState(false);
  const [balance, setBalance] = useState(client?.balance ?? 0);
  const [confirming, setConfirming] = useState(false);
  const idempotencyKeyRef = useRef(newKey());

  const load = async () => {
    setLoading(true);
    try {
      const catalog = await getCryptoOrderCatalog();
      setCryptos(catalog.cryptos);
      setNetworks(catalog.networks);
      setCryptoId(current => current || catalog.cryptos[0]?.id || '');
      if (client) {
        try { setOrders(await getClientCryptoOrders()); } catch { setOrders([]); }
      } else setOrders([]);
    } catch (error: any) {
      toast.error(error.message || 'Impossible de charger le catalogue crypto.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [client?.id]);
  useEffect(() => { setBalance(client?.balance ?? 0); }, [client?.id, client?.balance]);
  const selectedCrypto = useMemo(() => cryptos.find(asset => asset.id === cryptoId) || null, [cryptos, cryptoId]);
  const availableNetworks = useMemo(() => networks.filter(network => network.cryptoId === cryptoId), [networks, cryptoId]);
  const selectedNetwork = useMemo(() => availableNetworks.find(network => network.id === networkId) || null, [availableNetworks, networkId]);
  const amountValue = Number(amount);
  const estimateUSD = selectedCrypto?.priceUSD && amountValue > 0 ? Number((amountValue * selectedCrypto.priceUSD).toFixed(2)) : null;
  const feePercent = selectedCrypto?.feePercent ?? 2;
  const feeAmountUSD = estimateUSD ? Number((estimateUSD * feePercent / 100).toFixed(2)) : 0;
  const totalUSD = estimateUSD ? Number((estimateUSD + feeAmountUSD).toFixed(2)) : 0;
  const hasFunds = totalUSD > 0 && totalUSD <= balance;

  useEffect(() => {
    if (!availableNetworks.some(network => network.id === networkId)) setNetworkId(availableNetworks[0]?.id || '');
  }, [availableNetworks, networkId]);

  const submit = async () => {
    if (!client) { onRequestAuth(); return; }
    if (!selectedCrypto || !selectedNetwork) { toast.error('Choisissez une crypto et un réseau disponibles.'); return; }
    if (!Number.isFinite(amountValue) || amountValue <= 0) { toast.error('Saisissez un montant crypto valide.'); return; }
    if (!walletAddress.trim()) { toast.error('L’adresse de réception est requise.'); return; }
    if (!consent) { toast.error('Confirmez le réseau et l’adresse de réception.'); return; }
    if (!hasFunds) { toast.error('Votre solde Rena est insuffisant pour cette commande.'); return; }
    setSubmitting(true);
    try {
      const result = await submitCryptoOrder({ cryptoId: selectedCrypto.id!, networkId: selectedNetwork.id!, amount: amountValue, walletAddress: walletAddress.trim(), consent, idempotencyKey: idempotencyKeyRef.current });
      const { order } = result;
      setOrders(current => [order, ...current.filter(item => item.id !== order.id)]);
      setBalance(result.balanceAfter);
      setAmount(''); setWalletAddress(''); setConsent(false); idempotencyKeyRef.current = newKey();
      setTab('history');
      toast.success('Commande crypto envoyée. Notre équipe la traite manuellement.');
    } catch (error: any) {
      toast.error(error.message?.includes('Session client') ? 'Reconnectez-vous avant de soumettre cette commande.' : error.message || 'Impossible d’envoyer la commande.');
    } finally { setSubmitting(false); setConfirming(false); }
  };

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-3xl bg-[#102a43] p-5 text-white shadow-xl shadow-[#102a43]/20">
      <div className="flex items-start justify-between gap-3">
        <div><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20"><Coins className="h-5 w-5 text-cyan-200" /></div>
          <h2 className="text-xl font-black tracking-tight">Marché Crypto Rena</h2>
           <p className="mt-1 max-w-md text-xs font-medium leading-relaxed text-[#d9f0ee]/80">Achetez avec votre solde Rena. Un opérateur vérifie chaque commande avant l’envoi.</p>
        </div>
         <span className="shrink-0 rounded-full border border-[#8ed1c7]/30 bg-[#8ed1c7]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#b9eee8]">Solde sécurisé</span>
      </div>
    </section>

    <div className="flex rounded-2xl bg-slate-100 p-1">
      <Tab active={tab === 'buy'} onClick={() => setTab('buy')}>Nouvelle commande</Tab>
      <Tab active={tab === 'history'} onClick={() => setTab('history')}>Suivi{orders.length ? ` (${orders.length})` : ''}</Tab>
    </div>

    {loading ? <Loading /> : tab === 'history' ? (
      <OrderHistory client={client} orders={orders} onRequestAuth={onRequestAuth} />
    ) : (
      <div className="space-y-5">
         {client && <div className="flex items-center justify-between rounded-2xl border border-[#b9eee8] bg-[#effaf8] p-3.5"><div className="flex items-center gap-3"><Wallet className="h-5 w-5 text-[#167d73]" /><div><p className="text-[10px] font-black uppercase tracking-widest text-[#167d73]">Solde Rena disponible</p><p data-testid="text-crypto-balance" className="mt-0.5 text-lg font-black text-[#102a43]">{formatUSD(balance)}</p></div></div><ShieldCheck className="h-5 w-5 text-[#167d73]" /></div>}
         {!client && <div className="flex items-start gap-3 rounded-2xl border border-[#b9eee8] bg-[#effaf8] p-3.5"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#167d73]" /><div><p className="text-sm font-black text-[#102a43]">Connexion requise</p><p className="mt-0.5 text-[11px] leading-relaxed text-[#167d73]">Votre solde Rena protège votre commande et son suivi.</p><button type="button" onClick={onRequestAuth} className="mt-2 text-xs font-black text-[#167d73] underline underline-offset-2">Se connecter</button></div></div>}
        {cryptos.length === 0 ? <Empty icon={<Coins />} title="Le catalogue crypto est en cours de configuration." /> : <>
          <SelectGroup label="1. Choisissez votre crypto">
            <div className="grid gap-2 sm:grid-cols-2">{cryptos.map(asset => <Choice key={asset.id} selected={asset.id === cryptoId} onClick={() => setCryptoId(asset.id || '')} icon={asset.logo ? <img src={asset.logo} alt="" className="h-7 w-7 rounded-full" /> : asset.symbol.slice(0, 1)} title={`${asset.name} (${asset.symbol})`} subtitle={asset.priceUSD ? `≈ ${formatUSD(asset.priceUSD)} / ${asset.symbol}` : 'Prix indicatif indisponible'} />)}</div>
          </SelectGroup>
          <SelectGroup label="2. Choisissez le réseau">
            {availableNetworks.length === 0 ? <Empty icon={<WalletCards />} title="Aucun réseau disponible pour cette crypto." /> : <div className="grid gap-2 sm:grid-cols-2">{availableNetworks.map(network => <Choice key={network.id} selected={network.id === networkId} onClick={() => setNetworkId(network.id || '')} icon={<WalletCards className="h-5 w-5" />} title={network.networkName} subtitle={network.networkCode} />)}</div>}
          </SelectGroup>
          {selectedCrypto && selectedNetwork && <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="crypto-amount" className="text-[10px] font-black uppercase tracking-widest text-slate-400">3. Montant souhaité ({selectedCrypto.symbol})</Label><Input id="crypto-amount" type="number" min="0" step="any" value={amount} onChange={event => setAmount(event.target.value)} placeholder={`Ex. 50 ${selectedCrypto.symbol}`} className="h-12 rounded-xl text-base font-black" /></div>
            <div className="space-y-1.5"><Label htmlFor="crypto-address" className="text-[10px] font-black uppercase tracking-widest text-slate-400">4. Votre wallet {selectedNetwork.networkName}</Label><Input id="crypto-address" value={walletAddress} onChange={event => setWalletAddress(event.target.value)} placeholder={`Votre adresse ${selectedNetwork.networkCode}`} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="h-12 rounded-xl font-mono text-sm" /><p className="text-[10px] font-semibold text-amber-700">Vérifiez le réseau et l’adresse : une transaction blockchain est irréversible.</p></div>
             <div className="overflow-hidden rounded-2xl border border-slate-100"><div className="bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">5. Contact et récapitulatif</div><div className="space-y-2 p-4 text-sm"><Row label="Commande" value={`${amountValue > 0 ? amountValue : '—'} ${selectedCrypto.symbol}`} accent /><Row label="Réseau" value={selectedNetwork.networkName} /><Row label="Contact" value={client ? `${client.name}${client.phone ? ` · ${client.phone}` : ''}` : 'Connexion requise'} /><Row label="Sous-total crypto" value={estimateUSD ? formatUSD(estimateUSD) : 'Indisponible'} /><Row label={`Frais Rena (${feePercent.toFixed(2)} %)`} value={estimateUSD ? formatUSD(feeAmountUSD) : '—'} /><Row label="Total débité du solde" value={totalUSD ? formatUSD(totalUSD) : 'Indisponible'} strong /><div className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2 text-xs font-black ${hasFunds ? 'bg-[#effaf8] text-[#167d73]' : 'bg-amber-50 text-amber-700'}`}><span>Après la commande</span><span>{totalUSD ? formatUSD(balance - totalUSD) : '—'}</span></div><p className="pt-1 text-[10px] leading-relaxed text-slate-400">Le prix est indicatif, mis à jour depuis CoinGecko. Le total affiché est débité de votre solde Rena; l’envoi reste manuel.</p></div></div>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5"><Checkbox checked={consent} onCheckedChange={value => setConsent(value === true)} className="mt-0.5" /><span className="text-[11px] font-medium leading-relaxed text-slate-600">Je confirme que cette adresse m’appartient et correspond exactement au réseau sélectionné.</span></label>
             {!hasFunds && totalUSD > 0 && <p className="flex items-center gap-2 text-xs font-bold text-amber-700"><AlertTriangle className="h-4 w-4" />Solde insuffisant : ajoutez des fonds avant de confirmer.</p>}
             <Button type="button" onClick={() => { if (!client) onRequestAuth(); else if (hasFunds) setConfirming(true); }} disabled={!client || !consent || submitting || !hasFunds} className="h-12 w-full rounded-xl bg-[#167d73] font-black text-white shadow-lg shadow-[#167d73]/20 hover:bg-[#12665e]">{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />} Vérifier et confirmer</Button>
          </div>}
        </>}
      </div>
     )}
     {confirming && selectedCrypto && selectedNetwork && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#102a43]/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="w-full max-w-md rounded-t-3xl bg-[#fffdf8] p-5 shadow-2xl sm:rounded-3xl"><div className="mb-4 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#effaf8] text-[#167d73]"><ShieldCheck className="h-5 w-5" /></div><div><h3 className="font-black text-[#102a43]">Confirmer l’achat avec Rena</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">Cette somme sera débitée immédiatement de votre solde Rena. L’envoi crypto sera traité manuellement.</p></div></div><div className="space-y-2 rounded-2xl bg-[#f4f1e9] p-4 text-sm"><Row label="Vous recevez" value={`${amountValue} ${selectedCrypto.symbol}`} accent /><Row label="Réseau" value={selectedNetwork.networkName} /><Row label="Total débité" value={formatUSD(totalUSD)} strong /></div><div className="mt-4 grid grid-cols-2 gap-2"><Button type="button" variant="outline" onClick={() => setConfirming(false)} className="h-11 rounded-xl font-bold">Retour</Button><Button type="button" onClick={submit} disabled={submitting} className="h-11 rounded-xl bg-[#167d73] font-black text-white">{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Confirmer</Button></div></div></div>}
  </div>;
}

function OrderHistory({ client, orders, onRequestAuth }: { client: Client | null; orders: CryptoOrder[]; onRequestAuth: () => void }) {
  if (!client) return <Empty icon={<WalletCards />} title="Connectez-vous pour suivre vos commandes" action={onRequestAuth} actionLabel="Se connecter" />;
  if (!orders.length) return <Empty icon={<Clock3 />} title="Aucune commande crypto pour le moment" />;
  return <div className="space-y-3">{orders.map(order => { const meta = statusMeta[order.status]; return <article key={order.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{order.cryptoSymbol} <span className="text-slate-400">·</span> {order.networkName}</p><p className="mt-0.5 text-[11px] font-semibold text-slate-400">{order.orderNumber} · {formatDate(order.createdAt)}</p></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${meta.className}`}>{meta.label}</span></div><div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-[11px]"><span className="font-medium text-slate-500">Montant commandé</span><span className="text-right font-black text-slate-800">{order.amount} {order.cryptoSymbol}</span><span className="font-medium text-slate-500">Sous-total</span><span className="text-right font-bold text-slate-700">{formatUSD(order.cryptoSubtotalUSD)}</span><span className="font-medium text-slate-500">Frais Rena</span><span className="text-right font-bold text-slate-700">{formatUSD(order.feeAmountUSD)} ({order.feePercent ?? 0}%)</span><span className="font-black text-slate-800">Débit du solde</span><span className="text-right font-black text-[#167d73]">{formatUSD(order.totalUSD)}</span>{order.paymentStatus && <><span className="font-medium text-slate-500">Paiement</span><span className={`text-right font-black ${order.paymentStatus === 'refunded' ? 'text-amber-700' : 'text-[#167d73]'}`}>{order.paymentStatus === 'refunded' ? 'Remboursé' : 'Confirmé'}</span></>}{order.transactionHash && <><span className="font-medium text-slate-500">Hash d’envoi</span><span className="truncate text-right font-mono font-bold text-emerald-700">{order.transactionHash}</span></>}{order.refundTransactionId && <><span className="font-medium text-slate-500">Remboursement</span><span className="truncate text-right font-mono font-bold text-amber-700">{order.refundTransactionId}</span></>}{order.adminNote && <><span className="font-medium text-slate-500">Note équipe</span><span className="text-right font-semibold text-slate-700">{order.adminNote}</span></>}</div></article>; })}</div>;
}
function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-black transition-all ${active ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{children}</button>; }
function SelectGroup({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</Label>{children}</div>; }
function Choice({ selected, onClick, icon, title, subtitle }: { selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string }) { return <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all ${selected ? 'border-primary bg-primary/[0.05] shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'}`}><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-black text-primary">{icon}</div><div className="min-w-0 flex-1"><p className="truncate font-black text-slate-900">{title}</p><p className="text-[11px] font-semibold text-slate-400">{subtitle}</p></div><div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? 'border-primary bg-primary' : 'border-slate-300'}`}>{selected && <CheckCircle2 className="h-3 w-3 text-white" />}</div></button>; }
function Row({ label, value, accent, strong }: { label: string; value: string; accent?: boolean; strong?: boolean }) { return <div className={`flex items-center justify-between gap-3 ${strong ? 'border-t border-slate-100 pt-2.5' : ''}`}><span className={strong ? 'font-black text-slate-800' : 'font-medium text-slate-500'}>{label}</span><span className={`${accent ? 'text-primary' : 'text-slate-800'} ${strong ? 'text-base font-black' : 'font-bold'} text-right`}>{value}</span></div>; }
function Empty({ icon, title, action, actionLabel }: { icon: React.ReactNode; title: string; action?: () => void; actionLabel?: string }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">{icon}</div><p className="text-sm font-bold text-slate-500">{title}</p>{action && <Button type="button" variant="outline" onClick={action} className="mt-3 rounded-xl font-bold">{actionLabel}</Button>}</div>; }
function Loading() { return <div className="flex items-center justify-center py-14 text-slate-400"><Loader2 className="h-7 w-7 animate-spin" /></div>; }
function formatUSD(value?: number | null) { return typeof value === 'number' ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 6 : 2 }).format(value) : '—'; }
function newKey() { return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `crypto_${Math.random().toString(36).slice(2)}_${Date.now()}`; }