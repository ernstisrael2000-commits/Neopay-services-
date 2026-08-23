import React, { useRef, useEffect } from 'react';
import {
  House, PackageOpen, Compass, GraduationCap, Wallet, Lock,
} from 'lucide-react';
import { motion, useMotionValue, useTransform, animate, MotionConfig } from 'motion/react';
import { Client } from '../types';
import { useSettingsCtx } from '../contexts/SettingsContext';

/* ─── Props ──────────────────────────────────────────────────── */
export interface BottomNavProps {
  currentView: string;
  onViewChange: (view: string) => void;
  loggedClient: Client | null;
  onOpenWallet: () => void;
  onRequestAuth: () => void;
  /** kept for API compat */
  formationsTab?: 'all' | 'my';
  onFormationsTabChange?: (tab: 'all' | 'my') => void;
}

/* ─── Constants ──────────────────────────────────────────────── */
const BAR_H   = 58;   // visible bar height in px (reduced)
const RISE    = 20;   // px the active circle rises above bar top
const RING_SZ = 46;   // diameter of active circle in px

/* ─── Main nav items (4) + wallet handled separately ─────────── */
const NAV_ITEMS = [
  { key: 'home',       icon: House,         label: 'Accueil'    },
  { key: 'products',   icon: PackageOpen,   label: 'Produits'   },
  { key: 'services',   icon: Compass,       label: 'Services'   },
  { key: 'formations', icon: GraduationCap, label: 'Formations' },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]['key'] | 'wallet';

const SPRING = { type: 'spring', stiffness: 320, damping: 28, mass: 0.6 } as const;

/* ─── Component ──────────────────────────────────────────────── */
export default function BottomNav({
  currentView,
  onViewChange,
  loggedClient,
  onOpenWallet,
  onRequestAuth,
}: BottomNavProps) {
  const { settings } = useSettingsCtx();
  const rate          = settings?.exchangeRate ?? 146;
  const balanceHTG    = loggedClient ? Math.round((loggedClient.balance ?? 0) * rate) : 0;
  const balanceLabel  =
    balanceHTG > 9999 ? `${(balanceHTG / 1000).toFixed(1)}k`
    : balanceHTG > 999 ? `${(balanceHTG / 1000).toFixed(0)}k`
    : String(balanceHTG);
  const isLoggedIn    = Boolean(loggedClient);

  /* ── activeKey: which slot owns the blue circle ── */
  const mainKeys: NavKey[] = ['home', 'products', 'services', 'formations'];
  const activeKey: NavKey = mainKeys.includes(currentView as NavKey)
    ? (currentView as NavKey)
    : 'home';

  /* ── Moving notch via CSS mask-image ── */
  const barRef   = useRef<HTMLDivElement>(null);
  const notchPct = useMotionValue(0); // 0–100, percentage of bar width

  // Compute which percentage corresponds to the active tab center
  const ALL_KEYS: NavKey[] = ['home', 'products', 'services', 'formations', 'wallet'];
  const totalSlots = ALL_KEYS.length;

  useEffect(() => {
    const idx = ALL_KEYS.indexOf(activeKey);
    const pct = ((idx + 0.5) / totalSlots) * 100;
    animate(notchPct, pct, SPRING);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  /* The mask punches a rounded arch out of the bar at the active slot */
  const maskImage = useTransform(notchPct, (pct) => {
    // Circle radius in the % coordinate space (bar width = 100%)
    // We want ~RING_SZ/2 px radius. We express it as % of element height
    // to keep it consistent; but %-of-width is simpler. Use px via calc:
    const x = `${pct}%`;
    const y = `${RISE / 2}px`; // notch center slightly inside bar top
    const r = RING_SZ / 2 + 6; // notch slightly larger than ring
    return [
      `radial-gradient(circle ${r}px at ${x} ${y}, transparent ${r - 1}px, black ${r}px)`,
    ].join(', ');
  });

  return (
    <MotionConfig reducedMotion="user">
      <nav
        aria-label="Navigation principale"
        className="fixed bottom-0 left-0 right-0 z-[300]"
        style={{
          /* solid white all the way to screen edge — covers safe area */
          background: 'rgba(255,255,255,0.96)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          backdropFilter: 'blur(18px)',
        }}
      >
        {/* ── Animated notched bar background ── */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height: BAR_H,
            background: 'rgba(255,255,255,0.96)',
            WebkitMaskImage: maskImage,
            maskImage,
            boxShadow: '0 -8px 26px rgba(15,23,42,0.08), 0 -1px 0 rgba(37,99,235,0.08)',
          }}
        />

        {/* ── Tabs row (sits inside the bar height, icon area overflows above) ── */}
        <div
          ref={barRef}
          className="relative flex items-end max-w-2xl mx-auto"
          style={{ height: BAR_H }}
        >
          {NAV_ITEMS.map((item) => {
            const active = activeKey === item.key;
            const Icon   = item.icon;
            return (
              <TabButton
                key={item.key}
                label={item.label}
                active={active}
                rise={RISE}
                ringSize={RING_SZ}
                onClick={() => onViewChange(item.key)}
              >
                <Icon
                  style={{ width: 22, height: 22 }}
                  className={`transition-colors duration-100 ${active ? 'text-white' : 'text-slate-600'}`}
                  strokeWidth={active ? 2.5 : 1.75}
                />
              </TabButton>
            );
          })}

          {/* Wallet / Connexion */}
          <TabButton
            label={isLoggedIn ? 'Wallet' : 'Connexion'}
            active={currentView === 'wallet'}
            rise={RISE}
            ringSize={RING_SZ}
            onClick={isLoggedIn ? () => onViewChange('wallet') : onRequestAuth}
          >
            {isLoggedIn
              ? <Wallet style={{ width: 20, height: 20 }} strokeWidth={currentView === 'wallet' ? 2.5 : 1.75} />
              : <Lock   style={{ width: 18, height: 18 }} strokeWidth={2} />
            }
            {/* Balance badge */}
            {isLoggedIn && balanceHTG > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[14px] px-0.5 bg-blue-600 text-white text-[6.5px] font-black rounded-full flex items-center justify-center leading-none pointer-events-none"
                style={{ border: '2px solid white' }}
              >
                {balanceLabel}
              </span>
            )}
          </TabButton>
        </div>
      </nav>
    </MotionConfig>
  );
}

/* ─── TabButton ──────────────────────────────────────────────── */
interface TabButtonProps {
  label: string;
  active: boolean;
  rise: number;
  ringSize: number;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ label, active, rise, ringSize, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="relative flex flex-1 select-none flex-col items-center pb-[7px] focus:outline-none focus-visible:z-20 focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-primary/40"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Icon container — rises above bar when active */}
      <motion.div
        className={`relative flex items-center justify-center rounded-xl transition-colors ${active ? '' : 'bg-slate-50/80'}`}
        style={{ width: ringSize, height: ringSize }}
        animate={{ y: active ? -rise : 0, scale: active ? 1.05 : 1 }}
        transition={SPRING}
      >
        {/* ── Shared blue ring for all active tabs ── */}
        {active && (
          <motion.div
            layoutId="nav-ring"
            className="absolute inset-0 rounded-full"
            style={{
               background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 56%, #38BDF8 100%)',
               boxShadow: '0 9px 24px rgba(37,99,235,0.38), 0 0 0 3.5px white, 0 0 0 4.5px rgba(37,99,235,0.10)',
            }}
            transition={SPRING}
          />
        )}

        {/* Icon (and optional badge slot) */}
        <motion.span
          className="relative z-10 flex items-center justify-center"
          animate={{
            opacity: active ? 1 : 0.72,
            color: active ? '#ffffff' : '#475569',
          }}
          transition={{ duration: 0.18 }}
        >
          {children}
        </motion.span>
      </motion.div>

      {/* Label */}
      <motion.span
        className="mt-0.5 text-[9.5px] font-black leading-none tracking-[0.01em]"
        animate={{
          color: active ? '#2563EB' : '#64748b',
          opacity: active ? 1 : 0.78,
        }}
        transition={{ duration: 0.18 }}
      >
        {label}
      </motion.span>
    </button>
  );
}
