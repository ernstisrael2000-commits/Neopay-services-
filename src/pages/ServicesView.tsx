import React from 'react';
import { motion } from 'motion/react';
import * as LucideIcons from 'lucide-react';
import {
  ArrowRight,
  Check,
  Globe2,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Plane,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import { useOnlineServices } from '../services/parcelService';
import { useSettingsCtx } from '../contexts/SettingsContext';
import { Client } from '../types';
import { toast } from 'sonner';
import { ServicesSkeleton } from '../components/skeletons/ServicesSkeleton';

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
    description: 'Suivez vos colis en temps réel où que vous soyez.',
    icon: 'Package',
    target: 'tracking' as const,
    active: true,
    order: 1,
    color: 'from-blue-500 to-blue-700',
    badge: 'En direct',
  },
  {
    id: '_shipping',
    label: 'Expédition Internationale',
    description: 'Envoyez et recevez vos colis partout dans le monde.',
    icon: 'Truck',
    target: 'shipping' as const,
    active: true,
    order: 2,
    color: 'from-emerald-500 to-teal-700',
    badge: '',
  },
  {
    id: '_cards',
    label: 'Cartes',
    description: 'Créez et gérez vos cartes de débit virtuelles facilement.',
    icon: 'CreditCard',
    target: 'cards' as const,
    active: true,
    order: 3,
    color: 'from-violet-500 to-indigo-600',
    badge: 'Nouveau',
  },
];

function ServiceIllustration({ target, icon, compact = false }: { target?: string; icon?: string; compact?: boolean }) {
  const size = compact ? 'h-20 w-20 rounded-[1.2rem]' : 'h-24 w-32 rounded-[1.6rem]';
  if (target === 'tracking') {
    return (
      <div className={`relative shrink-0 overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 ${size}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-16 w-16">
            <div className="absolute left-0 top-1 h-14 w-14 rounded-full border-2 border-dashed border-blue-200" />
            <div className="absolute bottom-0 left-3 flex h-10 w-10 rotate-[-8deg] items-center justify-center rounded-lg bg-gradient-to-br from-amber-300 to-orange-400 shadow-lg shadow-orange-200/60">
              <Package className="h-6 w-6 text-white" strokeWidth={1.7} />
            </div>
            <div className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-300/50">
              <MapPin className="h-4 w-4" fill="currentColor" strokeWidth={1.5} />
            </div>
          </div>
        </div>
        <div className="absolute bottom-2 left-1/2 h-1.5 w-8 -translate-x-1/2 rounded-full bg-blue-200/70" />
      </div>
    );
  }

  if (target === 'shipping') {
    return (
      <div className={`relative shrink-0 overflow-hidden bg-gradient-to-br from-emerald-50 to-cyan-50 ${size}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-16 w-16">
            <div className="absolute left-0 top-1 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-teal-500 shadow-lg shadow-emerald-200/60">
              <Globe2 className="h-12 w-12 text-white/90" strokeWidth={1.1} />
            </div>
            <Plane className="absolute right-0 top-0 h-7 w-7 rotate-[-18deg] text-white drop-shadow-md" fill="currentColor" strokeWidth={1.5} />
          </div>
        </div>
        <div className="absolute bottom-2 left-1/2 h-1.5 w-9 -translate-x-1/2 rounded-full bg-emerald-200/80" />
      </div>
    );
  }

  if (target === 'cards') {
    return (
      <div className={`relative shrink-0 overflow-hidden bg-gradient-to-br from-violet-50 to-indigo-50 ${size}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-11 w-16 rotate-[7deg] rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 p-2 shadow-xl shadow-violet-300/50">
            <div className="h-3 w-5 rounded bg-amber-200/90" />
            <div className="mt-4 flex items-center gap-0.5">
              <span className="h-1 w-1 rounded-full bg-white" />
              <span className="h-1 w-1 rounded-full bg-white" />
              <span className="h-1 w-1 rounded-full bg-white" />
              <span className="ml-auto h-1 w-5 rounded-full bg-white/80" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const IconComp = (LucideIcons as any)[icon] || Sparkles;
  return (
    <div className={`flex shrink-0 items-center justify-center bg-slate-50 ${size}`}>
      <IconComp className="h-14 w-14 text-blue-500" strokeWidth={1.35} />
    </div>
  );
}

function ServiceIcon({ svc }: { svc: any }) {
  const IconComp = (LucideIcons as any)[svc.icon] || Package;
  const iconTone = svc.target === 'shipping'
    ? 'bg-emerald-50 text-emerald-500'
    : svc.target === 'cards'
      ? 'bg-violet-50 text-violet-600'
      : 'bg-blue-50 text-blue-600';
  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
      <IconComp className="h-6 w-6" strokeWidth={1.8} />
    </div>
  );
}

function serviceCta(target?: string, isExternal?: boolean) {
  if (target === 'tracking') return 'Suivre un colis';
  if (target === 'shipping') return 'Expédier maintenant';
  if (target === 'cards') return 'Gérer mes cartes';
  return isExternal ? 'Découvrir le service' : 'Accéder au service';
}

export default function ServicesView({ onTrackingClick, onViewChange, loggedClient, onRequestAuth }: ServicesViewProps) {
  const { services: rawServices, loading } = useOnlineServices();
  const { settings } = useSettingsCtx();
  const activeServices = rawServices.filter(s => s.active);
  const displayServices = [
    ...activeServices,
    ...DEFAULT_SERVICES.filter(def => !activeServices.some(svc => svc.target === def.target)),
  ].sort((a, b) => {
    const order: Record<string, number> = { cards: 1, tracking: 2, shipping: 3 };
    return (order[a.target] || 4) - (order[b.target] || 4) || (a.order || 0) - (b.order || 0);
  });

  if (loading && rawServices.length === 0) {
    return <ServicesSkeleton count={3} />;
  }

  const handleServiceClick = (svc: any) => {
    if (svc.target === 'tracking') onTrackingClick();
    else if (svc.target === 'shipping') onViewChange('shipping');
    else if (svc.target === 'cards') {
      if (!loggedClient) {
        toast.info('Connectez-vous pour accéder à vos cartes.');
        onRequestAuth?.();
        return;
      }
      onViewChange('cards');
    } else if (svc.target === 'url' && svc.url) {
      window.open(svc.url, '_blank');
    }
  };

  const openWhatsApp = () => {
    const num = settings?.whatsappAdminNumber || '+50944813185';
    window.open(`https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent('Bonjour Solutionpam, je souhaite avoir plus de renseignements sur vos services.')}`, '_blank');
  };

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-[#f8fafc] pb-8">
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-white to-[#f8fafc] px-5 pb-8 pt-7 sm:px-8 sm:pt-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-5">
          <div>
            <h1 data-testid="heading-services" className="text-[2.25rem] font-black leading-[1.02] tracking-[-.055em] text-[#101b35] sm:text-5xl">Nos Services</h1>
            <p className="mt-3 max-w-[260px] text-base leading-6 text-slate-500 sm:text-lg">Des solutions rapides, fiables et conçues pour vous.</p>
          </div>
          <div className="relative hidden h-32 w-48 shrink-0 sm:block">
            <div className="absolute left-2 top-3 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 via-blue-400 to-indigo-600 shadow-xl shadow-blue-200/60">
              <Globe2 className="h-20 w-20 text-white/85" strokeWidth={1.1} />
            </div>
            <Plane className="absolute right-1 top-2 h-12 w-12 rotate-[-20deg] text-slate-200" fill="currentColor" strokeWidth={1.2} />
            <div className="absolute bottom-1 right-2 h-16 w-20 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-xl shadow-blue-200/80"><div className="absolute right-2 top-2 h-8 w-8 rounded-lg border-2 border-white/60" /></div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <section data-testid="service-help-card" className="rounded-[1.45rem] bg-[#101d34] p-4 text-white shadow-[0_14px_28px_rgba(15,29,52,.16)] sm:p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#08bf77] shadow-lg shadow-emerald-900/30"><MessageCircle className="h-5 w-5" fill="white" strokeWidth={1.6} /></div>
              <div className="min-w-0 flex-1"><h2 className="text-base font-black text-white">Besoin d’aide ?</h2><p className="mt-0.5 text-[11px] text-white/60">Notre équipe est là pour vous accompagner.</p></div>
              <ChevronRightIcon />
            </div>
            <button type="button" data-testid="button-contact-whatsapp" onClick={openWhatsApp} className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#08bf77] text-xs font-black text-white shadow-lg shadow-emerald-950/20 transition hover:bg-[#08aa6b] active:scale-[.99]"><MessageCircle className="h-4 w-4" fill="white" strokeWidth={1.6} /> Nous contacter</button>
          </section>
        </motion.div>

        {displayServices.map((svc: any, i: number) => {
          const isExternal = svc.target === 'url';
          const isCards = svc.target === 'cards';
          return (
            <motion.div key={svc.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i + 1) * 0.06, duration: 0.3 }}>
              <button
                type="button"
                data-testid={isCards ? 'service-card-heyqo' : `service-card-${svc.target || svc.id}`}
                onClick={() => handleServiceClick(svc)}
                className="group flex min-h-[112px] w-full items-center gap-3 rounded-[1.45rem] border border-slate-100 bg-white p-3 text-left shadow-[0_5px_16px_rgba(15,23,42,.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,.1)] sm:min-h-[120px] sm:gap-4 sm:p-4"
              >
                <ServiceIcon svc={svc} />
                <div className="min-w-0 flex-1 self-stretch py-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[.95rem] font-black leading-tight text-[#101b35]">{svc.label}</h2>
                    {svc.badge && <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${isCards ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>{svc.badge}</span>}
                  </div>
                  <p className="mt-1.5 max-w-[255px] text-xs leading-4.5 text-slate-500">{svc.description || 'Accédez à ce service rapidement et en toute sécurité.'}</p>
                  <span className={`mt-2 inline-flex items-center gap-1 text-xs font-black ${isCards ? 'text-violet-700' : svc.target === 'shipping' ? 'text-emerald-600' : 'text-blue-700'}`}>{serviceCta(svc.target, isExternal)} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
                </div>
                <ServiceIllustration target={svc.target} icon={svc.icon} compact />
              </button>
            </motion.div>
          );
        })}

        <div className="mt-1 flex items-center justify-center gap-5 pb-4 text-[11px] font-semibold text-slate-400">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Sécurisé</span>
          <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-blue-500" /> Disponible 24/7</span>
          <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-violet-500" /> Assistance</span>
        </div>
      </div>
    </div>
  );
}

function ChevronRightIcon() {
  return <ArrowRight className="h-5 w-5 shrink-0 text-white/90" />;
}