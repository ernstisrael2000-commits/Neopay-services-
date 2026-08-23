import React, { useState } from 'react';
import { motion } from 'motion/react';
import * as LucideIcons from 'lucide-react';
import {
  Globe, Package, Truck, ArrowRight, ExternalLink, ArrowLeft,
  Zap, ShieldCheck, Clock, Phone, MessageCircle,
  Coins, ChevronRight,
} from 'lucide-react';
import { useOnlineServices } from '../services/parcelService';
import { useSettingsCtx } from '../contexts/SettingsContext';
import { Client } from '../types';
import CryptoMarketView from '../components/CryptoMarketView';
import cryptoServiceImage from '../../attached_assets/96ede975caf4ec2657e6906958f42af6_1787453007148.jpg';

interface ServicesViewProps {
  onTrackingClick: () => void;
  onViewChange: (view: any) => void;
  loggedClient?: Client | null;
  onRequestAuth?: () => void;
}

const DEFAULT_SERVICES = [
  {
    id: '_tracking',
    label: 'Suivi de Colis',
    description: 'Suivez vos colis en temps réel depuis n\'importe où dans le monde.',
    icon: 'Package',
    target: 'tracking' as const,
    active: true,
    order: 1,
    color: 'from-blue-500 to-blue-700',
    badge: 'En direct',
  },
  {
    id: '_shipping',
    label: 'Expédition',
    description: 'Envoi et réception de colis — international, rapide et sécurisé.',
    icon: 'Truck',
    target: 'shipping' as const,
    active: true,
    order: 2,
    color: 'from-emerald-500 to-teal-700',
    badge: 'International',
  },
];

const SERVICE_COLORS = [
  'from-blue-500 to-blue-700',
  'from-emerald-500 to-teal-600',
  'from-purple-500 to-indigo-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
];

export default function ServicesView({ onTrackingClick, onViewChange, loggedClient, onRequestAuth }: ServicesViewProps) {
  const { services: rawServices } = useOnlineServices();
  const { settings } = useSettingsCtx();
  const [showCryptoMarket, setShowCryptoMarket] = useState(false);

  const activeServices = rawServices.filter(s => s.active);
  const displayServices = activeServices.length > 0 ? activeServices : DEFAULT_SERVICES;

  const handleServiceClick = (svc: any) => {
    if (svc.target === 'tracking') { onTrackingClick(); }
    else if (svc.target === 'shipping') { onViewChange('shipping'); }
    else if (svc.target === 'url' && svc.url) { window.open(svc.url, '_blank'); }
  };

  const openWhatsApp = () => {
    const num = settings?.whatsappAdminNumber || '+50944813185';
    window.open(`https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent('Bonjour Solutionpam, je souhaite avoir plus de renseignements sur vos services.')}`, '_blank');
  };

  if (showCryptoMarket) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        <div className="relative overflow-hidden bg-slate-950 px-4 pb-8 pt-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(234,179,8,0.28),transparent_34%),radial-gradient(circle_at_0%_100%,rgba(14,165,233,0.22),transparent_42%)]" />
          <div className="relative mx-auto max-w-3xl">
            <button onClick={() => setShowCryptoMarket(false)} className="mb-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-white/20">
              <ArrowLeft className="h-4 w-4" /> Retour aux services
            </button>
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2 text-amber-300">
                  <Coins className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.18em]">Service Solutionpam</span>
                </div>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Marché Crypto</h1>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">Choisissez votre actif, renseignez votre adresse et notre équipe traite votre demande en toute sécurité.</p>
              </div>
              <img src={cryptoServiceImage} alt="Cryptomonnaies proposées par Solutionpam" className="h-28 w-28 shrink-0 rounded-3xl border border-white/15 object-cover shadow-2xl shadow-black/50 sm:h-36 sm:w-36" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 py-6">
          <CryptoMarketView client={loggedClient || null} onRequestAuth={onRequestAuth || (() => undefined)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-500 px-4 pt-6 pb-12">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white leading-none">Nos Services</h1>
              <p className="text-white/60 text-xs font-medium mt-0.5">Solutions rapides et sécurisées</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { label: 'Pays desservis', value: '15+', icon: Globe },
              { label: 'Disponibilité', value: '24/7', icon: Clock },
              { label: 'Livraisons', value: '99%', icon: ShieldCheck },
            ].map(stat => (
              <div key={stat.label} className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10">
                <stat.icon className="h-4 w-4 text-white/70 mx-auto mb-1" />
                <p className="text-lg font-black text-white leading-none">{stat.value}</p>
                <p className="text-[9px] text-white/60 font-bold uppercase tracking-wide mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Services cards — floated over header */}
      <div className="max-w-3xl mx-auto px-4 -mt-4 space-y-4">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          onClick={() => setShowCryptoMarket(true)}
          className="group relative min-h-48 w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-left shadow-xl shadow-slate-950/15 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
        >
          <div className="absolute inset-y-0 right-0 w-[48%] sm:w-[44%]">
            <img src={cryptoServiceImage} alt="" className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/50 to-transparent" />
          </div>
          <div className="relative flex min-h-48 max-w-[68%] flex-col justify-between p-5 sm:p-6">
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/15 text-amber-300">
                <Coins className="h-5 w-5" />
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-white sm:text-xl">Marché Crypto</h2>
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-950">Nouveau</span>
              </div>
              <p className="max-w-xs text-xs font-medium leading-relaxed text-slate-300 sm:text-sm">Achetez des cryptomonnaies via une demande traitée par notre équipe.</p>
            </div>
            <div className="mt-5 flex items-center gap-2 text-sm font-black text-amber-300">
              Découvrir le service <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </motion.button>

        {displayServices.map((svc: any, i: number) => {
          const IconComp = (LucideIcons as any)[svc.icon] || Package;
          const colorClass = svc.color || SERVICE_COLORS[i % SERVICE_COLORS.length];
          const isExternal = svc.target === 'url';

          return (
            <motion.div
              key={svc.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.35 }}
            >
              <button
                onClick={() => handleServiceClick(svc)}
                className="w-full text-left group bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
              >
                {/* Top gradient strip */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${colorClass}`} />

                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-lg shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                      <IconComp className="h-7 w-7 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-black text-dark text-base leading-tight">{svc.label}</h3>
                        {(svc.badge || i < DEFAULT_SERVICES.length) && (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r ${colorClass} text-white`}>
                            {svc.badge || (i === 0 ? 'En direct' : i === 1 ? 'International' : 'Nouveau')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
                        {svc.description || 'Accédez à ce service rapidement et en toute sécurité.'}
                      </p>
                    </div>
                  </div>

                  {/* Footer row */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-semibold">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        Sécurisé
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-semibold">
                        <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        Rapide
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 text-sm font-black bg-gradient-to-r ${colorClass} bg-clip-text text-transparent group-hover:translate-x-0.5 transition-transform`}>
                      Accéder
                      {isExternal
                        ? <ExternalLink className="h-4 w-4 text-gray-400" />
                        : <ArrowRight className="h-4 w-4 text-gray-400" />
                      }
                    </div>
                  </div>
                </div>
              </button>
            </motion.div>
          );
        })}

        {/* Contact card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: displayServices.length * 0.08 + 0.1 }}
          className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-5 border border-gray-700"
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <Phone className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-white text-base">Besoin d'aide ?</h3>
              <p className="text-gray-400 text-xs mt-0.5">Notre équipe est disponible 24h/24 pour vous assister.</p>
            </div>
          </div>
          <button
            onClick={openWhatsApp}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 transition-colors text-white font-black text-sm"
          >
            <MessageCircle className="h-4 w-4" />
            Contacter via WhatsApp
          </button>
        </motion.div>
      </div>
    </div>
  );
}
