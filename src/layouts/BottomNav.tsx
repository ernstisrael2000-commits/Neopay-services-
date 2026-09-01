import React from 'react';
import {
  House, PackageOpen, Compass, GraduationCap, Wallet, UserRound,
} from 'lucide-react';
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
const BAR_H = 82;

/* ─── Main nav items + wallet handled separately ──────────────── */
const NAV_ITEMS = [
  { key: 'home',       icon: House,         label: 'Accueil'    },
  { key: 'products',   icon: PackageOpen,   label: 'Produits'   },
  { key: 'services',   icon: Compass,       label: 'Services'   },
  { key: 'formations', icon: GraduationCap, label: 'Formations' },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]['key'] | 'wallet';

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

  /* ── activeKey: which slot is highlighted ── */
  const mainKeys: NavKey[] = ['home', 'products', 'services', 'formations'];
  const activeKey: NavKey = mainKeys.includes(currentView as NavKey)
    ? (currentView as NavKey)
    : 'home';

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-2 left-3 right-3 z-[300] rounded-[26px] border border-[#edf0f7]"
      style={{
        background: 'rgba(255,255,255,0.96)',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 14px 35px rgba(39,44,73,0.14)',
      }}
    >
      <div className="mx-auto flex max-w-[540px] items-stretch px-2 pt-2" style={{ height: BAR_H }}>
        {NAV_ITEMS.map((item) => {
          const active = activeKey === item.key;
          const Icon = item.icon;
          return (
            <TabButton
              key={item.key}
              label={item.label}
              active={active}
              onClick={() => onViewChange(item.key)}
            >
              <Icon style={{ width: 21, height: 21 }} strokeWidth={active ? 2.2 : 1.8} />
            </TabButton>
          );
        })}

        {/* Wallet / Connexion */}
        <TabButton
          label={isLoggedIn ? 'Wallet' : 'Connexion'}
          active={currentView === 'wallet'}
          onClick={isLoggedIn ? () => onViewChange('wallet') : onRequestAuth}
        >
          {isLoggedIn
            ? <Wallet style={{ width: 20, height: 20 }} strokeWidth={currentView === 'wallet' ? 2.2 : 1.8} />
            : <UserRound style={{ width: 20, height: 20 }} strokeWidth={1.9} />
          }
          {isLoggedIn && balanceHTG > 0 && (
            <span
              className="absolute right-1/2 top-0 min-w-[16px] -translate-y-1/4 translate-x-[1.4rem] rounded-full bg-blue-600 px-1 text-[6.5px] font-black leading-[14px] text-white"
              style={{ border: '2px solid white' }}
            >
              {balanceLabel}
            </span>
          )}
        </TabButton>
      </div>
    </nav>
  );
}

/* ─── TabButton ──────────────────────────────────────────────── */
interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ label, active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="relative flex flex-1 select-none flex-col items-center justify-center gap-1 px-1 focus:outline-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-primary/40"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl transition-colors duration-200 ${active ? 'bg-[#f0eaff] text-[#7042d3]' : 'text-[#566174] hover:bg-[#f7f8fc]'}`}>
        {children}
      </span>
      <span className={`text-[9.5px] font-black leading-none tracking-[0.01em] transition-colors duration-200 ${active ? 'text-[#7042d3]' : 'text-[#566174]'}`}>
        {label}
      </span>
    </button>
  );
}
