import React from 'react';
import { motion } from 'motion/react';
import * as LucideIcons from 'lucide-react';
import {
  Globe, Package, Truck, ArrowRight, ExternalLink, ArrowLeft,
  Zap, ShieldCheck, Clock, Phone, MessageCircle,
  Coins, CreditCard,
} from 'lucide-react';
import { useOnlineServices } from '../services/parcelService';
import { useSettingsCtx } from '../contexts/SettingsContext';
import { Client } from '../types';
import cryptoServiceImage from '../../attached_assets/96ede975caf4ec2657e6906958f42af6_1787453007148.jpg';
import { toast } from 'sonner';

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
  {
    id: '_cards',
    label: 'Cartes',
    description: 'Créez et gérez vos cartes de débit virtuelles en toute sécurité.',
    icon: 'CreditCard',
    target: 'cards' as const,
    active: true,
    order: 3,
    color: 'from-indigo-500 to-blue-700',
    badge: 'Nouveau',
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
  const activeServices = rawServices.filter(s => s.active);
  // Keep the platform services visible even when custom services are configured.
  // Keep the platform services visible even when custom services are configured.
  const displayServices = [
    ...activeServices,
    ...DEFAULT_SERVICES.filter(def => !activeServices.some(svc => svc.target === def.target)),
  ].sort((a, b) => Number(b.target === 'cards') - Number(a.target === 'cards'));
  const cardServices = displayServices.filter((svc: any) => svc.target === 'cards');
  const otherServices = displayServices.filter((svc: any) => svc.target !== 'cards');

  const handleServiceClick = (svc: any) => {
    if (svc.target === 'tracking') { onTrackingClick(); }
    else if (svc.target === 'shipping') { onViewChange('shipping'); }
    else if (svc.target === 'cards') {
      if (!loggedClient) {
        toast.info('Connectez-vous pour accéder à vos cartes.');
        onRequestAuth?.();
        return;
      }
      onViewChange('cards');
    }
    else if (svc.target === 'url' && svc.url) { window.open(svc.url, '_blank'); }
  };

  const openWhatsApp = () => {
    const num = settings?.whatsappAdminNumber || '+50944813185';
    window.open(`https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent('Bonjour Solutionpam, je souhaite avoir plus de renseignements sur vos services.')}`, '_blank');
  };

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
        {cardServices.map((svc: any, i: number) => {
          const IconComp = (LucideIcons as any)[svc.icon] || CreditCard;
          const colorClass = svc.color || 'from-blue-600 to-indigo-700';
          return (
            <motion.div
              key={svc.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
            >
              <button
                data-testid="service-card-heyqo"
                onClick={() => handleServiceClick(svc)}
                className="group flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-blue-100 bg-white p-4 text-left shadow-md shadow-blue-900/[.06] transition-all hover:-translate-y-0.5 hover:shadow-xl sm:p-5"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorClass} shadow-lg shadow-blue-900/15 transition-transform group-hover:scale-105`}>
                  <IconComp className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-black text-slate-900">Cartes</h2>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-blue-700">Nouveau</span>
                  </div>
                  <p className="mt-1 truncate text-xs font-medium text-slate-500 sm:text-sm">{svc.description}</p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-blue-600 transition-transform group-hover:translate-x-1" />
              </button>
            </motion.div>
          );
        })}

        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative min-h-32 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-left shadow-lg shadow-slate-950/15 sm:min-h-36"
        >
          <div className="absolute inset-y-0 right-0 w-[37%] sm:w-[32%]">
            <img src={cryptoServiceImage} alt="" className="h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/50 to-transparent" />
          </div>
          <div className="relative flex min-h-32 max-w-[78%] flex-col justify-center p-4 sm:min-h-36 sm:max-w-[72%] sm:p-5">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-400/15 text-amber-300">
                  <Coins className="h-4 w-4" />
                </div>
                <h2 className="text-base font-black text-white sm:text-lg">Marché Crypto</h2>
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-slate-950">Bientôt</span>
              </div>
              <p className="max-w-md text-[11px] font-medium leading-relaxed text-slate-300 sm:text-xs">Le service est en préparation. Les nouvelles commandes crypto sont temporairement fermées.</p>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] font-black text-amber-300">
              Revenez bientôt <span aria-hidden="true">↗</span>
            </div>
          </div>
        </motion.article>

        {otherServices.map((svc: any, i: number) => {
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
              className="group w-full overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              >
                {/* Top gradient strip */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${colorClass}`} />

                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                      <IconComp className="h-5 w-5 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-black text-dark text-sm leading-tight">{svc.label}</h3>
                        {(svc.badge || i < DEFAULT_SERVICES.length) && (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r ${colorClass} text-white`}>
                            {svc.badge || (i === 0 ? 'En direct' : i === 1 ? 'International' : 'Nouveau')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                        {svc.description || 'Accédez à ce service rapidement et en toute sécurité.'}
                      </p>
                    </div>
                  </div>

                  {/* Footer row */}
                  <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
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
