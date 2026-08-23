import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Coins, Loader2, ShieldCheck, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import {
  getClientCryptoMarketRequests,
  getCryptoMarketOffers,
  submitCryptoMarketRequest,
} from '../services/cryptoMarketService';
import { Client, CryptoMarketOffer, CryptoMarketRequest, CryptoMarketRequestStatus } from '../types';

interface CryptoMarketViewProps {
  client: Client | null;
  onRequestAuth: () => void;
}

const statusMeta: Record<CryptoMarketRequestStatus, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  processing: { label: 'En cours', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  sent: { label: 'Envoyée', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  rejected: { label: 'Refusée', className: 'bg-red-100 text-red-700 border-red-200' },
};

function formatDate(value: any): string {
  const date = value?._seconds ? new Date(value._seconds * 1000) : value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function CryptoMarketView({ client, onRequestAuth }: CryptoMarketViewProps) {
  const [offers, setOffers] = useState<CryptoMarketOffer[]>([]);
  const [requests, setRequests] = useState<CryptoMarketRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestLoading, setRequestLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<'buy' | 'history'>('buy');
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [consent, setConsent] = useState(false);
  const idempotencyKeyRef = useRef(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `crypto_${Math.random().toString(36).slice(2)}_${Date.now()}`);

  const load = async () => {
    setLoading(true);
    try {
      const marketOffers = await getCryptoMarketOffers();
      setOffers(marketOffers);
      setSelectedId(current => current || marketOffers[0]?.id || '');
      if (client) {
        try {
          setRequests(await getClientCryptoMarketRequests());
        } catch {
          // A signed session is created on the next login. The purchase action
          // below will give the client a clear recovery message if it is absent.
          setRequests([]);
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Impossible de charger le marché crypto.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [client?.id]);

  const selected = useMemo(
    () => offers.find(offer => offer.id === selectedId) || null,
    [offers, selectedId],
  );
  const amountUSD = Number(amount);
  const feeAmount = selected && amountUSD > 0 ? Number((amountUSD * selected.feePercent / 100).toFixed(2)) : 0;
  const totalUSD = selected && amountUSD > 0 ? Number((amountUSD + feeAmount).toFixed(2)) : 0;
  const estimatedCrypto = selected && amountUSD > 0 && selected.unitPriceUSD > 0
    ? amountUSD / selected.unitPriceUSD
    : 0;

  const submit = async () => {
    if (!client) { onRequestAuth(); return; }
    if (!selected) { toast.error('Choisissez un actif disponible.'); return; }
    if (!Number.isFinite(amountUSD) || amountUSD < selected.minAmountUSD || amountUSD > selected.maxAmountUSD) {
      toast.error(`Le montant doit être compris entre ${selected.minAmountUSD} et ${selected.maxAmountUSD} USD.`);
      return;
    }
    if (!destinationAddress.trim()) { toast.error('L’adresse de réception est requise.'); return; }
    if (!consent) { toast.error('Confirmez que l’adresse et le réseau sont exacts.'); return; }

    setRequestLoading(true);
    try {
      const created = await submitCryptoMarketRequest({
        offerId: selected.id!,
        amountUSD,
        destinationAddress: destinationAddress.trim(),
        consent,
        idempotencyKey: idempotencyKeyRef.current,
      });
      setRequests(current => [created, ...current]);
      setAmount('');
      setDestinationAddress('');
      setConsent(false);
      idempotencyKeyRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `crypto_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      setActivePanel('history');
      toast.success('Demande crypto envoyée. Traitement estimé : 15 à 30 minutes.');
    } catch (error: any) {
      const message = error.message || 'Impossible d’envoyer la demande.';
      toast.error(message.includes('Session client') ? 'Reconnectez-vous avant de soumettre cette demande.' : message);
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-5 text-white shadow-xl shadow-blue-950/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <Coins className="h-5 w-5 text-cyan-200" />
            </div>
            <h2 className="text-xl font-black tracking-tight">Marché Crypto Rena</h2>
            <p className="mt-1 max-w-md text-xs font-medium leading-relaxed text-blue-100/80">
              Demande manuelle sécurisée. Notre équipe vérifie chaque opération et vous répond sous 15 à 30 minutes.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200">
            Assistance humaine
          </span>
        </div>
      </div>

      <div className="flex rounded-2xl bg-slate-100 p-1">
        {[
          { key: 'buy', label: 'Nouvelle demande' },
          { key: 'history', label: `Suivi${requests.length ? ` (${requests.length})` : ''}` },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActivePanel(tab.key as 'buy' | 'history')}
            className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-black transition-all ${
              activePanel === tab.key ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14 text-slate-400"><Loader2 className="h-7 w-7 animate-spin" /></div>
      ) : activePanel === 'history' ? (
        <div className="space-y-3">
          {!client ? (
            <EmptyState icon={<WalletCards />} title="Connectez-vous pour suivre vos demandes" action={onRequestAuth} actionLabel="Se connecter" />
          ) : requests.length === 0 ? (
            <EmptyState icon={<Clock3 />} title="Aucune demande crypto pour le moment" />
          ) : requests.map(request => {
            const meta = statusMeta[request.status];
            return (
              <div key={request.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black" style={{ backgroundColor: `${request.offerSnapshot.color || '#2563eb'}18`, color: request.offerSnapshot.color || '#2563eb' }}>
                      {request.offerSnapshot.icon || request.offerSnapshot.symbol.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-slate-900">{request.offerSnapshot.assetName} <span className="text-slate-400">·</span> {request.offerSnapshot.networkName}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{formatDate(request.createdAt)} · ${request.amountUSD.toFixed(2)} USD</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${meta.className}`}>{meta.label}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-[11px]">
                  <span className="font-medium text-slate-500">Estimation</span>
                  <span className="text-right font-black text-slate-800">{request.estimatedCryptoAmount.toFixed(6)} {request.offerSnapshot.symbol}</span>
                  {request.transactionHash && <><span className="font-medium text-slate-500">Hash</span><span className="truncate text-right font-mono font-bold text-emerald-700">{request.transactionHash}</span></>}
                  {request.adminNote && <><span className="font-medium text-slate-500">Note équipe</span><span className="text-right font-semibold text-slate-700">{request.adminNote}</span></>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-5">
          {!client && (
            <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-3.5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-black text-blue-900">Connexion requise</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-blue-700">Votre identité est nécessaire pour protéger vos demandes et leur suivi.</p>
                <button type="button" onClick={onRequestAuth} className="mt-2 text-xs font-black text-primary underline underline-offset-2">Se connecter</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actif et réseau</Label>
            {offers.length === 0 ? (
              <EmptyState icon={<Coins />} title="Le marché est en cours de configuration" />
            ) : (
              <div className="space-y-2">
                {offers.map(offer => (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => setSelectedId(offer.id!)}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all ${
                      selectedId === offer.id ? 'border-primary bg-primary/[0.05] shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl text-xl font-black" style={{ backgroundColor: `${offer.color || '#2563eb'}18`, color: offer.color || '#2563eb' }}>
                      {offer.icon || offer.symbol.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900">{offer.assetName} <span className="text-slate-400">({offer.symbol})</span></p>
                      <p className="text-[11px] font-semibold text-slate-400">Réseau {offer.networkName} · Frais {offer.feePercent}%</p>
                    </div>
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${selectedId === offer.id ? 'border-primary bg-primary' : 'border-slate-300'}`}>
                      {selectedId === offer.id && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="crypto-amount" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Montant souhaité (USD)</Label>
                <Input id="crypto-amount" type="number" min={selected.minAmountUSD} max={selected.maxAmountUSD} value={amount} onChange={event => setAmount(event.target.value)} placeholder={`${selected.minAmountUSD} – ${selected.maxAmountUSD}`} className="h-12 rounded-xl text-base font-black" />
                <p className="text-[10px] font-semibold text-slate-400">Limites : ${selected.minAmountUSD} à ${selected.maxAmountUSD} USD</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="crypto-address" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adresse de réception {selected.networkName}</Label>
                <Input id="crypto-address" value={destinationAddress} onChange={event => setDestinationAddress(event.target.value)} placeholder={`Votre adresse ${selected.networkName}`} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="h-12 rounded-xl font-mono text-sm" />
                <p className="text-[10px] font-semibold text-amber-700">Vérifiez attentivement le réseau et l’adresse : une transaction blockchain est irréversible.</p>
              </div>
              {amountUSD > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <div className="bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Récapitulatif indicatif</div>
                  <div className="space-y-2 p-4 text-sm">
                    <SummaryRow label="Montant crypto estimé" value={`${estimatedCrypto.toFixed(6)} ${selected.symbol}`} accent />
                    <SummaryRow label={`Frais de service (${selected.feePercent}%)`} value={`$${feeAmount.toFixed(2)} USD`} />
                    <SummaryRow label="Total à régler" value={`$${totalUSD.toFixed(2)} USD`} strong />
                    <p className="pt-1 text-[10px] leading-relaxed text-slate-400">L’estimation et les frais seront figés dans votre demande. Le règlement et l’envoi sont confirmés manuellement par Rena.</p>
                  </div>
                </div>
              )}
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                <Checkbox checked={consent} onCheckedChange={value => setConsent(value === true)} className="mt-0.5" />
                <span className="text-[11px] font-medium leading-relaxed text-slate-600">Je confirme que cette adresse m’appartient, qu’elle correspond exactement au réseau sélectionné et que Rena ne peut pas récupérer un envoi vers une adresse erronée.</span>
              </label>
              <Button type="button" onClick={submit} disabled={!client || !selected || requestLoading || !consent} className="h-12 w-full rounded-xl bg-primary font-black text-white shadow-lg shadow-primary/20 hover:bg-primary/90">
                {requestLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                Envoyer ma demande
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, accent, strong }: { label: string; value: string; accent?: boolean; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-3 ${strong ? 'border-t border-slate-100 pt-2.5' : ''}`}><span className={strong ? 'font-black text-slate-800' : 'font-medium text-slate-500'}>{label}</span><span className={`${accent ? 'text-primary' : 'text-slate-800'} ${strong ? 'text-base font-black' : 'font-bold'}`}>{value}</span></div>;
}

function EmptyState({ icon, title, action, actionLabel }: { icon: React.ReactNode; title: string; action?: () => void; actionLabel?: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">{icon}</div><p className="text-sm font-bold text-slate-500">{title}</p>{action && <Button type="button" variant="outline" onClick={action} className="mt-3 rounded-xl font-bold">{actionLabel}</Button>}</div>;
}