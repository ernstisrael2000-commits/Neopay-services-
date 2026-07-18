import React from 'react';
import {
  Home, ShoppingBag, Globe, GraduationCap,
  Wallet, Lock,
} from 'lucide-react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { Client } from '../types';
import { useSettings } from '../services/parcelService';

/* ─── Types ──────────────────────────────────────────────────── */
export interface BottomNavProps {
  currentView: string;
  onViewChange: (view: string) => void;
  loggedClient: Client | null;
  onOpenWallet: () => void;
  onRequestAuth: () => void;
  /** kept for API compat – unused (formations nav is internal to FormationsView) */
  formationsTab?: 'all' | 'my';
  onFormationsTabChange?: (tab: 'all' | 'my') => void;
}

/* ─── Nav item config ────────────────────────────────────────── */
const LEFT_ITEMS = [
  { key: 'home',     icon: Home,        label: 'Accueil'  },
  { key: 'products', icon: ShoppingBag, label: 'Produits' },
] as const;

const RIGHT_ITEMS = [
  { key: 'services',   icon: Globe,         label: 'Services'   },
  { key: 'formations', icon: GraduationCap, label: 'Formations' },
] as const;

/* ─── Spring presets ─────────────────────────────────────────── */
const SPRING_ICON  = { type: 'spring', stiffness: 400, damping: 22, mass: 0.75 } as const;
const SPRING_PILL  = { type: 'spring', stiffness: 450, damping: 30, mass: 0.65 } as const;
const SPRING_BTN   = { type: 'spring', stiffness: 360, damping: 18, mass: 0.85 } as const;

/* ─── SVG bar path (1000 × 64 viewBox, notch at x=500) ──────── */
// The quadratic bézier curves create a smooth rounded notch
// at the centre. The notch dips 34 units deep (≈ 34 px) to
// accommodate the 56 px circular button (radius 28 px).
const NOTCH_PATH =
  'M 0 0 L 416 0 Q 442 0 454 18 Q 467 34 500 34 Q 533 34 546 18 Q 558 0 584 0 L 1000 0 L 1000 64 L 0 64 Z';

const NOTCH_BORDER =
  'M 0 0.5 L 416 0.5 Q 442 0.5 454 18.5 Q 467 34.5 500 34.5 Q 533 34.5 546 18.5 Q 558 0.5 584 0.5 L 1000 0.5';

/* ─── Single tab item ────────────────────────────────────────── */
interface NavTabProps {
  tabKey: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}

function NavTab({ tabKey, icon: Icon, label, active, onClick }: NavTabProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="relative flex-1 flex flex-col items-center justify-end pb-2.5 pt-5 min-h-[64px] group focus:outline-none select-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Icon + label — spring-lifts when active */}
      <motion.div
        className="flex flex-col items-center gap-[3px]"
        animate={{ y: active ? -9 : 0 }}
        transition={SPRING_ICON}
      >
        {/* Icon wrapper with scale + opacity */}
        <motion.div
          animate={{
            scale:   active ? 1.2  : 1,
            opacity: active ? 1    : 0.42,
          }}
          transition={SPRING_ICON}
          className="relative"
        >
          <Icon
            className={`h-[22px] w-[22px] transition-colors duration-100 ${
              active ? 'text-primary' : 'text-gray-500'
            }`}
            strokeWidth={active ? 2.5 : 1.75}
          />
          {/* Subtle glow behind icon when active */}
          <AnimatePresence>
            {active && (
              <motion.span
                key="glow"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.18 }}
                className="absolute -inset-2 rounded-full bg-primary/10 -z-10"
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* Label */}
        <motion.span
          animate={{ opacity: active ? 1 : 0.45 }}
          transition={{ duration: 0.14 }}
          className={`text-[9.5px] font-bold leading-none tracking-tight transition-colors duration-100 ${
            active ? 'text-primary' : 'text-gray-400'
          }`}
        >
          {label}
        </motion.span>
      </motion.div>

      {/* Sliding active-pill indicator */}
      {active && (
        <motion.span
          layoutId="bnav-pill"
          key={tabKey}
          className="absolute bottom-1 h-[3px] w-5 rounded-full bg-primary"
          transition={SPRING_PILL}
        />
      )}
    </button>
  );
}

/* ─── Main export ────────────────────────────────────────────── */
export default function BottomNav({
  currentView,
  onViewChange,
  loggedClient,
  onOpenWallet,
  onRequestAuth,
}: BottomNavProps) {
  const { settings } = useSettings();
  const rate       = settings?.exchangeRate ?? 146;
  const balanceHTG = loggedClient ? Math.round((loggedClient.balance ?? 0) * rate) : 0;
  const balanceLabel =
    balanceHTG > 9999 ? `${(balanceHTG / 1000).toFixed(1)}k`
    : balanceHTG > 999 ? `${(balanceHTG / 1000).toFixed(0)}k`
    : String(balanceHTG);

  const isLoggedIn = Boolean(loggedClient);

  return (
    <MotionConfig reducedMotion="user">
      <nav
        className="fixed bottom-0 left-0 right-0 z-[300]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        role="navigation"
        aria-label="Navigation principale"
      >
        {/* ── Container: max-w-2xl + height 64 ── */}
        <div className="relative max-w-2xl mx-auto" style={{ height: 64 }}>

          {/* ── SVG bar background with curved notch ── */}
          <svg
            viewBox="0 0 1000 64"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              filter: 'drop-shadow(0 -5px 22px rgba(0,0,0,0.07)) drop-shadow(0 -1px 4px rgba(0,0,0,0.04))',
            }}
          >
            {/* White fill matching notch shape */}
            <path d={NOTCH_PATH} fill="white" />
            {/* Hairline top border that follows the notch curve */}
            <path
              d={NOTCH_BORDER}
              fill="none"
              stroke="rgba(0,0,0,0.055)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* ── Tabs row ── */}
          <div className="relative flex items-stretch h-full">

            {/* Left tabs */}
            {LEFT_ITEMS.map(item => (
              <NavTab
                key={item.key}
                tabKey={item.key}
                icon={item.icon}
                label={item.label}
                active={currentView === item.key}
                onClick={() => onViewChange(item.key)}
              />
            ))}

            {/* Centre slot (spacer) – the button floats above */}
            <div className="relative flex-1 flex items-center justify-center" style={{ minWidth: '18%' }}>
              {/* Floating circle button */}
              <motion.button
                onClick={isLoggedIn ? onOpenWallet : onRequestAuth}
                aria-label={isLoggedIn ? 'Ouvrir le wallet' : 'Se connecter'}
                className={`absolute flex items-center justify-center rounded-full focus:outline-none ${
                  isLoggedIn
                    ? 'bg-gradient-to-br from-primary via-primary to-indigo-600'
                    : 'bg-gradient-to-br from-gray-400 to-gray-500'
                }`}
                style={{
                  width: 56,
                  height: 56,
                  top: -26,
                  WebkitTapHighlightColor: 'transparent',
                }}
                initial={{ scale: 0.65, y: 10, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                whileTap={{ scale: 0.87 }}
                transition={SPRING_BTN}
              >
                {/* Layered shadow glow – composited on GPU via box-shadow */}
                <span
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    boxShadow: isLoggedIn
                      ? '0 6px 28px rgba(79,70,229,0.48), 0 2px 8px rgba(79,70,229,0.28), 0 0 0 3px rgba(255,255,255,0.9)'
                      : '0 4px 18px rgba(0,0,0,0.18), 0 0 0 3px rgba(255,255,255,0.9)',
                  }}
                />

                {/* Icon */}
                <span className="relative z-10">
                  {isLoggedIn
                    ? <Wallet className="h-[22px] w-[22px] text-white" strokeWidth={2.5} />
                    : <Lock className="h-[20px] w-[20px] text-white" strokeWidth={2.5} />
                  }
                </span>

                {/* Balance badge */}
                <AnimatePresence>
                  {isLoggedIn && balanceHTG > 0 && (
                    <motion.span
                      key="badge"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 480, damping: 22, delay: 0.15 }}
                      className="absolute -top-1 -right-1 min-w-[18px] h-[16px] px-1 bg-emerald-500 text-white text-[7.5px] font-black rounded-full flex items-center justify-center leading-none pointer-events-none"
                      style={{ border: '2px solid white' }}
                    >
                      {balanceLabel}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Label below center button */}
              <span
                className={`absolute bottom-2.5 text-[9.5px] font-bold leading-none tracking-tight transition-colors ${
                  isLoggedIn ? 'text-primary' : 'text-gray-400'
                }`}
              >
                {isLoggedIn ? 'Wallet' : 'Connexion'}
              </span>
            </div>

            {/* Right tabs */}
            {RIGHT_ITEMS.map(item => (
              <NavTab
                key={item.key}
                tabKey={item.key}
                icon={item.icon}
                label={item.label}
                active={currentView === item.key}
                onClick={() => onViewChange(item.key)}
              />
            ))}
          </div>
        </div>
      </nav>
    </MotionConfig>
  );
}
