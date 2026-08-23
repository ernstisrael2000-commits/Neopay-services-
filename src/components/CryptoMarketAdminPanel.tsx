import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Coins, Loader2, Pencil, Plus, RefreshCw, Save, Send, WalletCards, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { getAdminCryptoOrderCatalog, getAdminCryptoOrders, migrateLegacyCryptoMarket, saveCryptoAsset, saveCryptoNetwork, syncCoinGeckoCryptos, updateCryptoOrder } from '../services/cryptoMarketService';
import { CryptoAsset, CryptoNetwork, CryptoOrder, CryptoOrderStatus } from '../types';

type AssetForm = { name: string; symbol: string; logo: string; coingeckoId: string; enabled: boolean };
type NetworkForm = { cryptoId: string; networkName: string; networkCode: string; walletAddress: string; enabled: boolean };
const blankAsset = (): AssetForm => ({ name: '', symbol: '', logo: '', coingeckoId: '', enabled: true });
const blankNetwork = (): NetworkForm => ({ cryptoId: '', networkName: '', networkCode: 'TRC20', walletAddress: '', enabled: true });
const statuses: CryptoOrderStatus[] = ['pending', 'payment_pending', 'payment_confirmed', 'processing', 'completed', 'cancelled', 'rejected'];
const statusLabel: Record<CryptoOrderStatus, string> = { pending: 'En attente', payment_pending: 'Paiement à confirmer', payment_confirmed: 'Paiement confirmé', processing: 'En cours', completed: 'Finalisée', cancelled: 'Annulée', rejected: 'Refusée' };

export default function CryptoMarketAdminPanel() {
  const [cryptos, setCryptos] = useState<CryptoAsset[]>([]);
  const [networks, setNetworks] = useState<CryptoNetwork[]>([]);
  const [orders, setOrders] = useState<CryptoOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState<AssetForm>(blankAsset);
  const [network, setNetwork] = useState<NetworkForm>(blankNetwork);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [saving, setSaving] = useState<'asset' | 'network' | 'order' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<CryptoOrderStatus | 'all'>('all');
  const [actionOrder, setActionOrder] = useState<CryptoOrder | null>(null);
  const [actionStatus, setActionStatus] = useState<CryptoOrderStatus>('processing');
  const [actionNote, setActionNote] = useState('');
  const [actionHash, setActionHash] = useState('');

  const load = async (status = filter) => {
    setLoading(true);
    try {
      const [catalog, nextOrders] = await Promise.all([getAdminCryptoOrderCatalog(), getAdminCryptoOrders(status)]);
      setCryptos(catalog.cryptos); setNetworks(catalog.networks); setOrders(nextOrders);
      setNetwork(current => current.cryptoId || !catalog.cryptos[0]?.id ? current : { ...current, cryptoId: String(catalog.cryptos[0].id) });
    } catch (error: any) { toast.error(error.message || 'Impossible de charger les commandes crypto.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load('all'); }, []);

  const saveAsset = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving('asset');
    try { await saveCryptoAsset(asset, assetId || undefined); toast.success(assetId ? 'Crypto mise à jour.' : 'Crypto ajoutée.'); setAsset(blankAsset()); setAssetId(null); await load(); }
    catch (error: any) { toast.error(error.message || 'Crypto invalide.'); } finally { setSaving(null); }
  };
  const saveNetwork = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving('network');
    try { await saveCryptoNetwork(network, networkId || undefined); toast.success(networkId ? 'Réseau mis à jour.' : 'Réseau ajouté.'); setNetwork(blankNetwork()); setNetworkId(null); await load(); }
    catch (error: any) { toast.error(error.message || 'Réseau invalide.'); } finally { setSaving(null); }
  };
  const sync = async () => {
    setSyncing(true);
    try { const result = await syncCoinGeckoCryptos(); toast.success(`${result.synced} prix synchronisé${result.synced > 1 ? 's' : ''} depuis CoinGecko.`); await load(); }
    catch (error: any) { toast.error(error.message || 'Synchronisation CoinGecko impossible.'); } finally { setSyncing(false); }
  };
  const migrate = async () => {
    if (!window.confirm('Importer les anciennes demandes crypto dans le nouvel historique ? Les données originales ne seront pas modifiées.')) return;
    setSyncing(true);
    try { const result = await migrateLegacyCryptoMarket(); toast.success(`Historique importé : ${result.orders} commande(s), ${result.cryptos} crypto(s).`); await load(); }
    catch (error: any) { toast.error(error.message || 'Migration historique impossible.'); } finally { setSyncing(false); }
  };
  const openOrder = (order: CryptoOrder, status?: CryptoOrderStatus) => { setActionOrder(order); setActionStatus(status || order.status); setActionNote(order.adminNote || ''); setActionHash(order.transactionHash || ''); };
  const submitOrder = async () => {
    if (!actionOrder?.id) return;
    setSaving('order');
    try { await updateCryptoOrder(actionOrder.id, { status: actionStatus, adminNote: actionNote, transactionHash: actionHash }); toast.success('Commande mise à jour et client notifié.'); setActionOrder(null); await load(); }
    catch (error: any) { toast.error(error.message || 'Mise à jour impossible.'); } finally { setSaving(null); }
  };
  const networkRows = useMemo(() => networks.map(item => ({ ...item, crypto: cryptos.find(assetItem => assetItem.id === item.cryptoId) })), [networks, cryptos]);

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-xl shadow-blue-950/15"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20"><Coins className="h-5 w-5 text-cyan-200" /></div><h2 className="text-2xl font-black">Commandes Crypto manuelles</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-blue-100/75">Catalogue séparé, prix indicatifs CoinGecko et traitement humain. Aucun transfert ni échange automatique.</p></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={migrate} disabled={syncing} variant="outline" className="rounded-xl border-white/20 bg-transparent font-black text-white hover:bg-white/10 hover:text-white">Importer l’historique</Button><Button type="button" onClick={sync} disabled={syncing} className="rounded-xl bg-white/10 font-black text-white hover:bg-white/20">{syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Synchroniser CoinGecko</Button></div></div></section>

    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="border-slate-100 shadow-sm"><CardContent className="p-5"><div className="mb-5"><h3 className="font-black text-slate-900">{assetId ? 'Modifier la crypto' : 'Ajouter une crypto'}</h3><p className="mt-0.5 text-xs text-slate-500">La clé CoinGecko alimente uniquement le prix indicatif.</p></div><form onSubmit={saveAsset} className="space-y-3"><div className="grid grid-cols-2 gap-3"><Field label="Nom"><Input required value={asset.name} onChange={e => setAsset({ ...asset, name: e.target.value })} placeholder="Tether USD" /></Field><Field label="Symbole"><Input required value={asset.symbol} onChange={e => setAsset({ ...asset, symbol: e.target.value.toUpperCase() })} placeholder="USDT" /></Field></div><Field label="ID CoinGecko"><Input required value={asset.coingeckoId} onChange={e => setAsset({ ...asset, coingeckoId: e.target.value })} placeholder="tether" /></Field><Field label="URL logo HTTPS (optionnel)"><Input value={asset.logo} onChange={e => setAsset({ ...asset, logo: e.target.value })} placeholder="https://…" /></Field><Toggle label="Disponible pour les clients" checked={asset.enabled} onChange={checked => setAsset({ ...asset, enabled: checked })} /><div className="flex gap-2"><Button type="submit" disabled={saving === 'asset'} className="h-11 flex-1 rounded-xl bg-primary font-black text-white">{saving === 'asset' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : assetId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{assetId ? 'Mettre à jour' : 'Ajouter'}</Button>{assetId && <Button type="button" variant="outline" onClick={() => { setAsset(blankAsset()); setAssetId(null); }} className="h-11 rounded-xl">Annuler</Button>}</div></form></CardContent></Card>
      <Card className="border-slate-100 shadow-sm"><CardContent className="p-5"><div className="mb-5"><h3 className="font-black text-slate-900">{networkId ? 'Modifier le réseau' : 'Ajouter un réseau'}</h3><p className="mt-0.5 text-xs text-slate-500">L’adresse wallet d’exploitation reste privée et n’est jamais envoyée au client.</p></div><form onSubmit={saveNetwork} className="space-y-3"><Field label="Crypto"><Select value={network.cryptoId} onValueChange={value => setNetwork({ ...network, cryptoId: value })}><SelectTrigger><SelectValue placeholder="Choisir une crypto" /></SelectTrigger><SelectContent>{cryptos.map(item => <SelectItem key={item.id} value={item.id!}>{item.name} ({item.symbol})</SelectItem>)}</SelectContent></Select></Field><div className="grid grid-cols-2 gap-3"><Field label="Nom du réseau"><Input required value={network.networkName} onChange={e => setNetwork({ ...network, networkName: e.target.value })} placeholder="TRON" /></Field><Field label="Code"><Select value={network.networkCode} onValueChange={value => setNetwork({ ...network, networkCode: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TRC20">TRC20 / TRON</SelectItem><SelectItem value="ERC20">ERC20 / Ethereum</SelectItem><SelectItem value="BEP20">BEP20 / BSC</SelectItem><SelectItem value="BTC">BTC / Bitcoin</SelectItem><SelectItem value="SOL">SOL / Solana</SelectItem></SelectContent></Select></Field></div><Field label="Adresse wallet administrateur"><Input required value={network.walletAddress} onChange={e => setNetwork({ ...network, walletAddress: e.target.value })} autoCapitalize="none" className="font-mono" placeholder="Adresse correspondant au réseau" /></Field><Toggle label="Disponible pour les clients" checked={network.enabled} onChange={checked => setNetwork({ ...network, enabled: checked })} /><div className="flex gap-2"><Button type="submit" disabled={saving === 'network' || !cryptos.length} className="h-11 flex-1 rounded-xl bg-primary font-black text-white">{saving === 'network' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : networkId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{networkId ? 'Mettre à jour' : 'Ajouter'}</Button>{networkId && <Button type="button" variant="outline" onClick={() => { setNetwork(blankNetwork()); setNetworkId(null); }} className="h-11 rounded-xl">Annuler</Button>}</div></form></CardContent></Card>
    </div>

    <div className="grid gap-6 xl:grid-cols-2">
      <CatalogCard title="Cryptos configurées" count={cryptos.length} empty="Aucune crypto configurée." loading={loading}>{cryptos.map(item => <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{item.logo ? <img src={item.logo} alt="" className="h-7 w-7 rounded-full" /> : <Coins className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><p className="font-black text-slate-900">{item.name} <span className="text-slate-400">({item.symbol})</span></p><p className="text-[10px] font-semibold text-slate-400">{item.coingeckoId} · {item.priceUSD ? `$${item.priceUSD}` : 'Prix non synchronisé'}</p></div><State enabled={item.enabled} /><Button type="button" variant="ghost" size="icon" onClick={() => { setAssetId(item.id || null); setAsset({ name: item.name, symbol: item.symbol, logo: item.logo || '', coingeckoId: item.coingeckoId, enabled: item.enabled }); }} className="rounded-xl text-primary"><Pencil className="h-4 w-4" /></Button></div>)}</CatalogCard>
      <CatalogCard title="Réseaux configurés" count={networks.length} empty="Aucun réseau configuré." loading={loading}>{networkRows.map(item => <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><WalletCards className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-black text-slate-900">{item.crypto?.symbol || item.cryptoSymbol} <span className="text-slate-400">· {item.networkName}</span></p><p className="truncate font-mono text-[10px] font-semibold text-slate-400">{item.networkCode} · {item.walletAddress}</p></div><State enabled={item.enabled} /><Button type="button" variant="ghost" size="icon" onClick={() => { setNetworkId(item.id || null); setNetwork({ cryptoId: item.cryptoId, networkName: item.networkName, networkCode: item.networkCode, walletAddress: item.walletAddress, enabled: item.enabled }); }} className="rounded-xl text-primary"><Pencil className="h-4 w-4" /></Button></div>)}</CatalogCard>
    </div>

    <Card className="border-slate-100 shadow-sm"><CardContent className="p-5"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="flex items-center gap-2 font-black text-slate-900"><ClipboardList className="h-5 w-5 text-primary" />Commandes clients</h3><p className="mt-0.5 text-xs text-slate-500">Chaque changement est journalisé et notifie le client.</p></div><Select value={filter} onValueChange={value => { const status = value as CryptoOrderStatus | 'all'; setFilter(status); void load(status); }}><SelectTrigger className="w-full rounded-xl sm:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toutes les commandes</SelectItem>{statuses.map(status => <SelectItem key={status} value={status}>{statusLabel[status]}</SelectItem>)}</SelectContent></Select></div>{loading ? <Loading /> : !orders.length ? <Empty text="Aucune commande ne correspond à ce filtre." /> : <div className="space-y-3">{orders.map(order => <OrderCard key={order.id} order={order} onAction={openOrder} />)}</div>}</CardContent></Card>

    {actionOrder && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-6"><div className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"><div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-900">Mettre à jour la commande</h3><p className="mt-0.5 text-xs text-slate-500">{actionOrder.orderNumber} · {actionOrder.amount} {actionOrder.cryptoSymbol} · {actionOrder.networkName}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setActionOrder(null)} className="rounded-xl"><XCircle className="h-5 w-5" /></Button></div><div className="space-y-4"><Field label="Statut"><Select value={actionStatus} onValueChange={value => setActionStatus(value as CryptoOrderStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.filter(status => allowedNext(actionOrder.status).includes(status)).map(status => <SelectItem key={status} value={status}>{statusLabel[status]}</SelectItem>)}</SelectContent></Select></Field><Field label="Note visible au client"><Textarea value={actionNote} onChange={e => setActionNote(e.target.value)} maxLength={1000} placeholder="Ex. Paiement reçu, envoi en préparation." className="min-h-24 rounded-xl" /></Field>{actionStatus === 'completed' && <Field label="Hash de transaction"><Input required value={actionHash} onChange={e => setActionHash(e.target.value)} placeholder="Hash blockchain de l’envoi" className="font-mono" /><p className="mt-1 text-[10px] font-semibold text-slate-400">Obligatoire pour finaliser une commande.</p></Field>}<Button type="button" onClick={submitOrder} disabled={saving === 'order' || (actionStatus === 'completed' && actionHash.trim().length < 20)} className="h-11 w-full rounded-xl bg-primary font-black text-white">{saving === 'order' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Enregistrer et notifier</Button></div></div></div>}
  </div>;
}

function allowedNext(status: CryptoOrderStatus) { const map: Record<CryptoOrderStatus, CryptoOrderStatus[]> = { pending: ['payment_pending', 'payment_confirmed', 'processing', 'cancelled', 'rejected'], payment_pending: ['payment_confirmed', 'cancelled', 'rejected'], payment_confirmed: ['processing', 'cancelled', 'rejected'], processing: ['completed', 'cancelled', 'rejected'], completed: [], cancelled: [], rejected: [] }; return map[status]; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</Label>{children}</div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 accent-primary" />{label}</label>; }
function State({ enabled }: { enabled: boolean }) { return <span className={`hidden rounded-full px-2 py-1 text-[10px] font-black sm:inline ${enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{enabled ? 'Actif' : 'Masqué'}</span>; }
function CatalogCard({ title, count, empty, loading, children }: { title: string; count: number; empty: string; loading: boolean; children: React.ReactNode }) { return <Card className="border-slate-100 shadow-sm"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-black text-slate-900">{title}</h3><Badge className="border-0 bg-primary/10 text-primary">{count}</Badge></div>{loading ? <Loading /> : count ? <div className="space-y-2.5">{children}</div> : <Empty text={empty} />}</CardContent></Card>; }
function OrderCard({ order, onAction }: { order: CryptoOrder; onAction: (order: CryptoOrder, status?: CryptoOrderStatus) => void }) { const terminal = ['completed', 'cancelled', 'rejected'].includes(order.status); return <article className="rounded-2xl border border-slate-100 bg-white p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{order.clientName} <span className="text-slate-400">·</span> {order.amount} {order.cryptoSymbol}/{order.networkName}</p><span className="rounded-full border border-primary/15 bg-primary/5 px-2 py-0.5 text-[10px] font-black text-primary">{statusLabel[order.status]}</span></div><p className="mt-1 text-[11px] font-semibold text-slate-500">{order.orderNumber} · {formatDate(order.createdAt)} · {order.phone || order.email || 'Contact non renseigné'}</p><p className="mt-1 break-all font-mono text-[10px] text-slate-400">{order.walletAddress}</p>{order.adminNote && <p className="mt-1 text-[11px] font-medium text-slate-600">Note : {order.adminNote}</p>}</div>{!terminal && <Button type="button" size="sm" onClick={() => onAction(order)} className="rounded-xl bg-primary text-xs font-black text-white">Traiter</Button>}</div></article>; }
function Loading() { return <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm font-semibold text-slate-400">{text}</div>; }
function formatDate(value: any) { const date = value?._seconds ? new Date(value._seconds * 1000) : value?.toDate ? value.toDate() : value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }