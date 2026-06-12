import React from 'react';
import { Home, ShoppingBag, Globe, GraduationCap, Wallet, Lock, BookOpen, BookMarked, Search, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client } from '../types';
import { useSettings } from '../services/parcelService';

interface BottomNavProps {
  currentView: string;
  onViewChange: (view: string) => void;
  loggedClient: Client | null;
  onOpenWallet: () => void;
  onRequestAuth: () => void;
  formationsTab?: 'all' | 'my';
  onFormationsTabChange?: (tab: 'all' | 'my') => void;
}

const DEFAULT_NAV_ITEMS = [
  { key: 'home',       icon: Home,         label: 'Accueil'    },
  { key: 'products',   icon: ShoppingBag,  label: 'Produits'   },
  { key: 'services',   icon: Globe,        label: 'Services'   },
  { key: 'formations', icon: GraduationCap, label: 'Formations' },
];

export default function BottomNav({
  currentView, onViewChange, loggedClient, onOpenWallet, onRequestAuth,
  formationsTab, onFormationsTabChange,
}: BottomNavProps) {
  const { settings } = useSettings();
  const rate = settings?.exchangeRate || 146;
  const balanceHTG = loggedClient ? Math.round((loggedClient.balance ?? 0) * rate) : 0;
  const balanceLabel = balanceHTG > 9999
    ? `${(balanceHTG / 1000).toFixed(1)}k`
    : balanceHTG > 999
      ? `${(balanceHTG / 1000).toFixed(0)}k`
      : String(balanceHTG);

  const isFormations = currentView === 'formations';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[300] bg-white/97 backdrop-blur-2xl border-t border-gray-100"
      style={{
        boxShadow: '0 -8px 40px rgba(0,0,0,0.07)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isFormations ? (
          <motion.div
            key="formations-nav"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="flex items-stretch justify-around max-w-2xl mx-auto"
          >
            {/* Home — always available */}
            <button
              onClick={() => onViewChange('home')}
              className="relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[58px] group"
            >
              <Home className="relative z-10 h-[22px] w-[22px] text-gray-400 group-hover:text-gray-600 transition-colors" strokeWidth={1.75} />
              <span className="relative z-10 text-[9.5px] font-bold leading-none tracking-tight text-gray-400 group-hover:text-gray-600 transition-colors">
                Accueil
              </span>
            </button>

            {/* Tous les cours */}
            <button
              onClick={() => onFormationsTabChange?.('all')}
              className="relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[58px] group"
            >
              {formationsTab === 'all' && (
                <motion.span
                  layoutId="fbnav-bg"
                  className="absolute inset-x-2 top-1.5 bottom-1.5 bg-primary/8 rounded-2xl"
                  transition={{ type: 'spring', bounce: 0.22, duration: 0.38 }}
                />
              )}
              <BookOpen
                className={`relative z-10 h-[22px] w-[22px] transition-all duration-200 ${formationsTab === 'all' ? 'text-primary scale-110' : 'text-gray-400 group-hover:text-gray-600'}`}
                strokeWidth={formationsTab === 'all' ? 2.5 : 1.75}
              />
              <span className={`relative z-10 text-[9.5px] font-bold leading-none tracking-tight transition-colors ${formationsTab === 'all' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'}`}>
                Tous
              </span>
              {formationsTab === 'all' && (
                <motion.span
                  layoutId="fbnav-dot"
                  className="absolute bottom-0 w-5 h-0.5 bg-primary rounded-full"
                  transition={{ type: 'spring', bounce: 0.22, duration: 0.38 }}
                />
              )}
            </button>

            {/* Mes cours */}
            <button
              onClick={() => {
                if (!loggedClient) { onRequestAuth(); return; }
                onFormationsTabChange?.('my');
              }}
              className="relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[58px] group"
            >
              {formationsTab === 'my' && (
                <motion.span
                  layoutId="fbnav-bg"
                  className="absolute inset-x-2 top-1.5 bottom-1.5 bg-primary/8 rounded-2xl"
                  transition={{ type: 'spring', bounce: 0.22, duration: 0.38 }}
                />
              )}
              <BookMarked
                className={`relative z-10 h-[22px] w-[22px] transition-all duration-200 ${formationsTab === 'my' ? 'text-primary scale-110' : 'text-gray-400 group-hover:text-gray-600'}`}
                strokeWidth={formationsTab === 'my' ? 2.5 : 1.75}
              />
              <span className={`relative z-10 text-[9.5px] font-bold leading-none tracking-tight transition-colors ${formationsTab === 'my' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'}`}>
                Mes cours
              </span>
              {formationsTab === 'my' && (
                <motion.span
                  layoutId="fbnav-dot"
                  className="absolute bottom-0 w-5 h-0.5 bg-primary rounded-full"
                  transition={{ type: 'spring', bounce: 0.22, duration: 0.38 }}
                />
              )}
            </button>

            {/* Populaires */}
            <button
              onClick={() => onFormationsTabChange?.('all')}
              className="relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[58px] group"
            >
              <Star className="relative z-10 h-[22px] w-[22px] text-gray-400 group-hover:text-amber-500 transition-colors" strokeWidth={1.75} />
              <span className="relative z-10 text-[9.5px] font-bold leading-none tracking-tight text-gray-400 group-hover:text-amber-500 transition-colors">
                Populaires
              </span>
            </button>

            {/* Wallet / Connexion */}
            <button
              onClick={loggedClient ? onOpenWallet : onRequestAuth}
              className="relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[58px] group"
            >
              <div className={`relative h-9 w-9 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                loggedClient
                  ? 'bg-gradient-to-br from-primary to-indigo-600 shadow-md shadow-primary/30 group-hover:shadow-lg group-hover:-translate-y-0.5'
                  : 'bg-gray-100 group-hover:bg-gray-200'
              }`}>
                {loggedClient
                  ? <Wallet className="h-4 w-4 text-white" strokeWidth={2} />
                  : <Lock className="h-[15px] w-[15px] text-gray-400" strokeWidth={2} />
                }
              </div>
              {loggedClient && balanceHTG > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[14px] px-1 bg-emerald-500 text-white text-[7.5px] font-black rounded-full flex items-center justify-center leading-none">
                  {balanceLabel}
                </span>
              )}
              <span className={`text-[9.5px] font-bold leading-none tracking-tight transition-colors ${
                loggedClient ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'
              }`}>
                {loggedClient ? 'Wallet' : 'Connexion'}
              </span>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="default-nav"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="flex items-stretch justify-around max-w-2xl mx-auto"
          >
            {DEFAULT_NAV_ITEMS.map(({ key, icon: Icon, label }) => {
              const active = currentView === key;
              return (
                <button
                  key={key}
                  onClick={() => onViewChange(key)}
                  className="relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[58px] group"
                >
                  {active && (
                    <motion.span
                      layoutId="bnav-bg"
                      className="absolute inset-x-2 top-1.5 bottom-1.5 bg-primary/8 rounded-2xl"
                      transition={{ type: 'spring', bounce: 0.22, duration: 0.38 }}
                    />
                  )}
                  <Icon
                    className={`relative z-10 h-[22px] w-[22px] transition-all duration-200 ${
                      active ? 'text-primary scale-110' : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                    strokeWidth={active ? 2.5 : 1.75}
                  />
                  <span
                    className={`relative z-10 text-[9.5px] font-bold leading-none tracking-tight transition-colors ${
                      active ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                  >
                    {label}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="bnav-dot"
                      className="absolute bottom-0 w-5 h-0.5 bg-primary rounded-full"
                      transition={{ type: 'spring', bounce: 0.22, duration: 0.38 }}
                    />
                  )}
                </button>
              );
            })}

            {/* Wallet tab */}
            <button
              onClick={loggedClient ? onOpenWallet : onRequestAuth}
              className="relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[58px] group"
            >
              <div className={`relative h-9 w-9 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                loggedClient
                  ? 'bg-gradient-to-br from-primary to-indigo-600 shadow-md shadow-primary/30 group-hover:shadow-lg group-hover:-translate-y-0.5'
                  : 'bg-gray-100 group-hover:bg-gray-200'
              }`}>
                {loggedClient
                  ? <Wallet className="h-4 w-4 text-white" strokeWidth={2} />
                  : <Lock className="h-[15px] w-[15px] text-gray-400" strokeWidth={2} />
                }
              </div>
              {loggedClient && balanceHTG > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[14px] px-1 bg-emerald-500 text-white text-[7.5px] font-black rounded-full flex items-center justify-center leading-none">
                  {balanceLabel}
                </span>
              )}
              <span className={`text-[9.5px] font-bold leading-none tracking-tight transition-colors ${
                loggedClient ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'
              }`}>
                {loggedClient ? 'Wallet' : 'Connexion'}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
