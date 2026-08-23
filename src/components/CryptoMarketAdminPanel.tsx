import React, { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Coins, Loader2, Pencil, Plus, Save, Send, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import {
  deleteCryptoMarketOffer,
  getAdminCryptoMarketOffers,
  getAdminCryptoMarketRequests,
  saveCryptoMarketOffer,
  updateCryptoMarketRequest,
} from '../services/cryptoMarketService';
import { CryptoMarketOffer, CryptoMarketRequest, CryptoMarketRequestStatus } from '../types';

type OfferForm = {
  assetName: string; symbol: string; networkName: string; networkCode: string;
  icon: string; color: string; feePercent: string; minAmountUSD: string;
  maxAmountUSD: string; unitPriceUSD: string; enabled: boolean; quoteSource: 'manual' | 'partner';
};

const blankForm = (): OfferForm => ({
  assetName: '', symbol: '', networkName: '', networkCode: '', icon: '₿', color: '#2563EB',
  feePercent: '2', minAmountUSD: '20', maxAmountUSD: '1000', unitPriceUSD: '',
  enabled: true, quoteSource: 'manual',
});

const statusStyle: Record<CryptoMarketRequestStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  processing: 'border-blue-200 bg-blue-50 text-blue-700',
  sent: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
};

const statusLabel: Record<CryptoMarketRequestStatus, string> = {
  pending: 'En attente', processing: 'En cours', sent: 'Envoyée', rejected: 'Refusée',
};

function formatDate(value: any): string {
  const date = value?._seconds ? new Date(value._seconds * 1000) : value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export default function CryptoMarketAdminPanel() {
  const [offers, setOffers] = useState<CryptoMarketOffer[]>([]);
  const [requests, setRequests] = useState<CryptoMarketRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOffer, setSavingOffer] = useState(false);
  const [form, setForm] = useState<OfferForm>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CryptoMarketRequestStatus | 'all'>('all');
  const [actionTarget, setActionTarget] = useState<CryptoMarketRequest | null>(null);
  const [actionStatus, setActionStatus] = useState<CryptoMarketRequestStatus>('processing');
  const [actionNote, setActionNote] = useState('');
  const [actionHash, setActionHash] = useState('');
  const [savingAction, setSavingAction] = useState(false);

  const load = async (requestStatus = filter) => {
    setLoading(true);
    try {
      const [nextOffers, nextRequests] = await Promise.all([
        getAdminCryptoMarketOffers(),
        getAdminCryptoMarketRequests(requestStatus),
      ]);
      setOffers(nextOffers);
      setRequests(nextRequests);
    } catch (error: any) {
      toast.error(error.message || 'Impossible de charger le marché crypto.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load('all'); }, []);

  const setField = <K extends keyof OfferForm>(key: K, value: OfferForm[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setForm(blankForm());
    setEditingId(null);
  };

  const editOffer = (offer: CryptoMarketOffer) => {
    setEditingId(offer.id || null);
    setForm({
      assetName: offer.assetName, symbol: offer.symbol, networkName: offer.networkName, networkCode: offer.networkCode,
      icon: offer.icon || '', color: offer.color || '#2563EB', feePercent: String(offer.feePercent),
      minAmountUSD: String(offer.minAmountUSD), maxAmountUSD: String(offer.maxAmountUSD),
      unitPriceUSD: String(offer.unitPriceUSD), enabled: offer.enabled, quoteSource: offer.quoteSource || 'manual',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingOffer(true);
    try {
      await saveCryptoMarketOffer({
        assetName: form.assetName,
        symbol: form.symbol,
        networkName: form.networkName,
        networkCode: form.networkCode,
        icon: form.icon,
        color: form.color,
        feePercent: Number(form.feePercent),
        minAmountUSD: Number(form.minAmountUSD),
        maxAmountUSD: Number(form.maxAmountUSD),
        unitPriceUSD: Number(form.unitPriceUSD),
        enabled: form.enabled,
        quoteSource: form.quoteSource,
      }, editingId || undefined);
      toast.success(editingId ? 'Offre crypto mise à jour.' : 'Offre crypto ajoutée.');
      resetForm();
      await load(filter);
    } catch (error: any) {
      toast.error(error.message || 'Impossible de sauvegarder cette offre.');
    } finally {
      setSavingOffer(false);
    }
  };

  const removeOffer = async (offer: CryptoMarketOffer) => {
    if (!offer.id || !window.confirm(`Supprimer l’offre ${offer.symbol} / ${offer.networkName} ? Les demandes existantes conserveront leur récapitulatif.`)) return;
    try {
      await deleteCryptoMarketOffer(offer.id);
      toast.success('Offre supprimée.');
      await load(filter);
    } catch (error: any) {
      toast.error(error.message || 'Suppression impossible.');
    }
  };

  const openAction = (request: CryptoMarketRequest, status: CryptoMarketRequestStatus) => {
    setActionTarget(request);
    setActionStatus(status);
    setActionNote(request.adminNote || '');
    setActionHash(request.transactionHash || '');
  };

  const submitAction = async () => {
    if (!actionTarget?.id) return;
    setSavingAction(true);
    try {
      await updateCryptoMarketRequest(actionTarget.id, {
        status: actionStatus,
        adminNote: actionNote,
        transactionHash: actionHash,
      });
      toast.success(actionStatus === 'sent' ? 'Envoi finalisé et client notifié.' : 'Demande mise à jour et client notifié.');
      setActionTarget(null);
      await load(filter);
    } catch (error: any) {
      toast.error(error.message || 'Mise à jour impossible.');
    } finally {
      setSavingAction(false);
    }
  };

  const changeFilter = async (value: CryptoMarketRequestStatus | 'all') => {
    setFilter(value);
    await load(value);
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-xl shadow-blue-950/15">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20"><Coins className="h-5 w-5 text-cyan-200" /></div>
            <h2 className="text-2xl font-black">Marché Crypto manuel</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-blue-100/75">Catalogue, cotations indicatives et traitement humain. Aucun dépôt, clé privée ou mouvement wallet n’est traité ici.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">SLA affiché au client</p>
            <p className="mt-1 text-lg font-black">15–30 min</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-900">{editingId ? 'Modifier l’offre' : 'Nouvelle offre'}</h3>
                <p className="mt-0.5 text-xs text-slate-500">Chaque ligne correspond à un actif sur un réseau précis.</p>
              </div>
              {editingId && <Button type="button" variant="ghost" onClick={resetForm} className="h-9 rounded-xl text-slate-500">Annuler</Button>}
            </div>
            <form onSubmit={saveOffer} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Actif"><Input required value={form.assetName} onChange={e => setField('assetName', e.target.value)} placeholder="Tether USD" /></Field>
                <Field label="Symbole"><Input required value={form.symbol} onChange={e => setField('symbol', e.target.value.toUpperCase())} placeholder="USDT" /></Field>
                <Field label="Réseau"><Input required value={form.networkName} onChange={e => setField('networkName', e.target.value)} placeholder="TRON / TRC-20" /></Field>
                <Field label="Code réseau"><Input required value={form.networkCode} onChange={e => setField('networkCode', e.target.value.toUpperCase())} placeholder="TRC20" /></Field>
                <Field label="Icône"><Input value={form.icon} onChange={e => setField('icon', e.target.value)} placeholder="₮" /></Field>
                <Field label="Couleur"><Input required value={form.color} onChange={e => setField('color', e.target.value)} placeholder="#26A17B" /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Frais (%)"><Input required type="number" min="0" max="30" step="0.01" value={form.feePercent} onChange={e => setField('feePercent', e.target.value)} /></Field>
                <Field label="Minimum $"><Input required type="number" min="1" step="0.01" value={form.minAmountUSD} onChange={e => setField('minAmountUSD', e.target.value)} /></Field>
                <Field label="Maximum $"><Input required type="number" min="1" step="0.01" value={form.maxAmountUSD} onChange={e => setField('maxAmountUSD', e.target.value)} /></Field>
              </div>
              <Field label="Prix indicatif (USD par unité crypto)">
                <Input required type="number" min="0.00000001" step="any" value={form.unitPriceUSD} onChange={e => setField('unitPriceUSD', e.target.value)} placeholder="1.0000" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Source de cotation">
                  <Select value={form.quoteSource} onValueChange={value => setField('quoteSource', value as 'manual' | 'partner')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="manual">Saisie manuelle</SelectItem><SelectItem value="partner">Partenaire (prévu)</SelectItem></SelectContent>
                  </Select>
                </Field>
                <label className="flex cursor-pointer items-center gap-2 self-end rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={form.enabled} onChange={e => setField('enabled', e.target.checked)} className="h-4 w-4 accent-primary" /> Disponible
                </label>
              </div>
              <Button type="submit" disabled={savingOffer} className="h-11 w-full rounded-xl bg-primary font-black text-white">
                {savingOffer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {editingId ? 'Mettre à jour l’offre' : 'Ajouter au catalogue'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between"><div><h3 className="font-black text-slate-900">Catalogue actif</h3><p className="mt-0.5 text-xs text-slate-500">Les prix sont figés au moment de chaque demande.</p></div><Badge className="border-0 bg-primary/10 text-primary">{offers.length}</Badge></div>
            {loading ? <Loading /> : offers.length === 0 ? <Empty text="Aucune offre n’est encore configurée." /> : <div className="space-y-2.5">
              {offers.map(offer => (
                <div key={offer.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black" style={{ backgroundColor: `${offer.color || '#2563eb'}18`, color: offer.color || '#2563eb' }}>{offer.icon || offer.symbol[0]}</div>
                  <div className="min-w-0 flex-1"><p className="font-black text-slate-900">{offer.symbol} <span className="text-slate-400">· {offer.networkName}</span></p><p className="text-[10px] font-semibold text-slate-400">${offer.unitPriceUSD} · {offer.feePercent}% · ${offer.minAmountUSD}–${offer.maxAmountUSD}</p></div>
                  <span className={`hidden rounded-full px-2 py-1 text-[10px] font-black sm:inline ${offer.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{offer.enabled ? 'Disponible' : 'Indisponible'}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => editOffer(offer)} className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10"><Pencil className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeOffer(offer)} className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="flex items-center gap-2 font-black text-slate-900"><ClipboardList className="h-5 w-5 text-primary" />Demandes clients</h3><p className="mt-0.5 text-xs text-slate-500">Chaque changement est journalisé et notifie le client.</p></div>
            <Select value={filter} onValueChange={value => void changeFilter(value as CryptoMarketRequestStatus | 'all')}><SelectTrigger className="w-full rounded-xl sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toutes</SelectItem><SelectItem value="pending">En attente</SelectItem><SelectItem value="processing">En cours</SelectItem><SelectItem value="sent">Envoyées</SelectItem><SelectItem value="rejected">Refusées</SelectItem></SelectContent></Select>
          </div>
          {loading ? <Loading /> : requests.length === 0 ? <Empty text="Aucune demande ne correspond à ce filtre." /> : <div className="space-y-3">
            {requests.map(request => <RequestCard key={request.id} request={request} onAction={openAction} />)}
          </div>}
        </CardContent>
      </Card>

      {actionTarget && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-6">
          <div className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-900">{actionStatus === 'processing' ? 'Prendre en charge' : actionStatus === 'sent' ? 'Finaliser l’envoi' : 'Refuser la demande'}</h3><p className="mt-0.5 text-xs text-slate-500">{actionTarget.offerSnapshot.symbol} · {actionTarget.offerSnapshot.networkName} · ${actionTarget.amountUSD.toFixed(2)}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setActionTarget(null)} className="rounded-xl"><XCircle className="h-5 w-5" /></Button></div>
            <div className="space-y-4">
              <Field label={actionStatus === 'rejected' ? 'Motif de refus (recommandé)' : 'Note visible au client (optionnel)'}><Textarea value={actionNote} onChange={e => setActionNote(e.target.value)} maxLength={1000} placeholder={actionStatus === 'rejected' ? 'Expliquez la raison et la marche à suivre.' : 'Ex. Transaction en cours de préparation.'} className="min-h-24 rounded-xl" /></Field>
              {actionStatus === 'sent' && <Field label="Hash de transaction"><Input required value={actionHash} onChange={e => setActionHash(e.target.value)} placeholder="Hash blockchain de l’envoi" className="font-mono" /><p className="mt-1 text-[10px] font-semibold text-slate-400">Obligatoire : il sera communiqué au client avec le statut.</p></Field>}
              <Button type="button" onClick={submitAction} disabled={savingAction || (actionStatus === 'sent' && actionHash.trim().length < 8)} className={`h-11 w-full rounded-xl font-black text-white ${actionStatus === 'rejected' ? 'bg-red-600 hover:bg-red-700' : actionStatus === 'sent' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary hover:bg-primary/90'}`}>{savingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : actionStatus === 'sent' ? <Send className="mr-2 h-4 w-4" /> : actionStatus === 'rejected' ? <XCircle className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{actionStatus === 'processing' ? 'Mettre en cours' : actionStatus === 'sent' ? 'Confirmer l’envoi' : 'Refuser et notifier'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</Label>{children}</div>;
}

function Loading() { return <div className="flex items-center justify-center py-14 text-slate-400"><Loader2 className="h-7 w-7 animate-spin" /></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm font-semibold text-slate-400">{text}</div>; }

function RequestCard({ request, onAction }: { request: CryptoMarketRequest; onAction: (request: CryptoMarketRequest, status: CryptoMarketRequestStatus) => void }) {
  const offer = request.offerSnapshot;
  return <div className="rounded-2xl border border-slate-100 bg-white p-4">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black" style={{ backgroundColor: `${offer.color || '#2563eb'}18`, color: offer.color || '#2563eb' }}>{offer.icon || offer.symbol[0]}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{request.clientName} <span className="text-slate-400">·</span> {offer.symbol}/{offer.networkName}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${statusStyle[request.status]}`}>{statusLabel[request.status]}</span></div><p className="mt-1 text-[11px] font-semibold text-slate-500">${request.amountUSD.toFixed(2)} + ${request.feeAmountUSD.toFixed(2)} frais · ≈ {request.estimatedCryptoAmount.toFixed(6)} {offer.symbol}</p><p className="mt-1 break-all font-mono text-[10px] text-slate-400">{request.destinationAddress}</p><p className="mt-1 text-[10px] text-slate-400">{formatDate(request.createdAt)}{request.transactionHash ? ` · Hash: ${request.transactionHash}` : ''}</p>{request.adminNote && <p className="mt-1 text-[11px] font-medium text-slate-600">Note : {request.adminNote}</p>}</div></div>
      {request.status === 'pending' && <div className="flex gap-2"><Button type="button" size="sm" onClick={() => onAction(request, 'processing')} className="rounded-xl bg-primary text-xs font-black text-white">Traiter</Button><Button type="button" size="sm" variant="outline" onClick={() => onAction(request, 'rejected')} className="rounded-xl border-red-200 text-xs font-black text-red-600 hover:bg-red-50">Refuser</Button></div>}
      {request.status === 'processing' && <div className="flex gap-2"><Button type="button" size="sm" onClick={() => onAction(request, 'sent')} className="rounded-xl bg-emerald-600 text-xs font-black text-white hover:bg-emerald-700">Finaliser</Button><Button type="button" size="sm" variant="outline" onClick={() => onAction(request, 'rejected')} className="rounded-xl border-red-200 text-xs font-black text-red-600 hover:bg-red-50">Refuser</Button></div>}
    </div>
  </div>;
}