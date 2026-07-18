import React, { useRef, useEffect } from 'react';
import {
  Home, ShoppingBag, Globe, GraduationCap, Wallet, Lock,
} from 'lucide-react';
import { motion, useMotionValue, useTransform, animate, MotionConfig } from 'motion/react';
import { Client } from '../types';
import { useSettings } from '../services/parcelService';

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
  { key: 'home',       icon: Home,          label: 'Accueil'    },
  { key: 'products',   icon: ShoppingBag,   label: 'Produits'   },
  { key: 'services',   icon: Globe,         label: 'Services'   },
  { key: 'formations', icon: GraduationCap, label: 'Formations' },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]['key'] | 'wallet';

const SPRING = { type: 'spring', stiffness: 380, damping: 26, mass: 0.8 } as const;

/* ─── Component ──────────────────────────────────────────────── */
export default function BottomNav({
  currentView,
  onViewChange,
  loggedClient,
  onOpenWallet,
  onRequestAuth,
}: BottomNavProps) {
  const { settings }  = useSettings();
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
          background: 'white',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* ── Animated notched bar background ── */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height: BAR_H,
            background: 'white',
            WebkitMaskImage: maskImage,
            maskImage,
            boxShadow: '0 -5px 22px rgba(0,0,0,0.07), 0 -1px 0 rgba(0,0,0,0.055)',
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
                  className={`transition-colors duration-100 ${active ? 'text-white' : 'text-gray-500'}`}
                  strokeWidth={active ? 2.5 : 1.75}
                />
              </TabButton>
            );
          })}

          {/* Wallet / Connexion */}
          <TabButton
            label={isLoggedIn ? 'Wallet' : 'Connexion'}
            active={false}
            rise={RISE}
            ringSize={RING_SZ}
            onClick={isLoggedIn ? onOpenWallet : onRequestAuth}
            walletStyle={isLoggedIn ? 'logged' : 'guest'}
          >
            {isLoggedIn
              ? <Wallet style={{ width: 20, height: 20 }} className="text-white" strokeWidth={2.5} />
              : <Lock   style={{ width: 18, height: 18 }} className="text-gray-400" strokeWidth={2} />
            }
            {/* Balance badge */}
            {isLoggedIn && balanceHTG > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[14px] px-0.5 bg-emerald-500 text-white text-[6.5px] font-black rounded-full flex items-center justify-center leading-none pointer-events-none"
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
  walletStyle?: 'logged' | 'guest';
  children: React.ReactNode;
}

function TabButton({ label, active, rise, ringSize, onClick, walletStyle, children }: TabButtonProps) {
  const isWallet = Boolean(walletStyle);

  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="relative flex-1 flex flex-col items-center pb-[7px] focus:outline-none select-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Icon container — rises above bar when active */}
      <motion.div
        className="relative flex items-center justify-center"
        style={{ width: ringSize, height: ringSize }}
        animate={{ y: active ? -(rise) : 0, scale: active ? 1 : 0.95 }}
        transition={SPRING}
      >
        {/* ── Moving blue ring (only for nav items, not wallet) ── */}
        {active && !isWallet && (
          <motion.div
            layoutId="nav-ring"
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(135deg, #2563EB 0%, #4f46e5 100%)',
              boxShadow: '0 8px 22px rgba(79,70,229,0.44), 0 0 0 3.5px white, 0 0 0 4.5px rgba(0,0,0,0.05)',
            }}
            transition={SPRING}
          />
        )}

        {/* ── Wallet-specific ring (static, different colour) ── */}
        {isWallet && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: walletStyle === 'logged'
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : '#f3f4f6',
              boxShadow: walletStyle === 'logged'
                ? '0 4px 14px rgba(16,185,129,0.35), 0 0 0 3px white, 0 0 0 4px rgba(0,0,0,0.05)'
                : '0 0 0 3px white, 0 0 0 4px rgba(0,0,0,0.05)',
            }}
          />
        )}

        {/* Icon (and optional badge slot) */}
        <motion.span
          className="relative z-10 flex items-center justify-center"
          animate={{ opacity: (active || isWallet) ? 1 : 0.42 }}
          transition={{ duration: 0.15 }}
        >
          {children}
        </motion.span>
      </motion.div>

      {/* Label */}
      <motion.span
        className="text-[9.5px] font-bold leading-none tracking-tight mt-0.5"
        animate={{
          color: active ? '#2563EB' : isWallet && walletStyle === 'logged' ? '#059669' : '#9ca3af',
          opacity: active ? 1 : 0.65,
        }}
        transition={{ duration: 0.14 }}
      >
        {label}
      </motion.span>
    </button>
  );
}
