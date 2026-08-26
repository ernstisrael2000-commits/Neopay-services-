import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft, LibraryBig,
  Wallet, Menu, LayoutDashboard, Heart, Award, X
} from 'lucide-react';
import { Client } from '../types';
import { AnimatePresence, motion } from 'motion/react';

interface FormationsNavbarProps {
  onGoHome: () => void;
  loggedClient: Client | null;
  onOpenWallet: () => void;
  onRequestAuth: () => void;
  activeTab: 'all' | 'my' | 'profile';
  onTabChange: (tab: 'all' | 'my' | 'profile') => void;
  searchQuery: string;
  onSearch: (q: string) => void;
}

export default function FormationsNavbar({
  onGoHome, loggedClient, onOpenWallet, onRequestAuth,
  activeTab, onTabChange, searchQuery, onSearch,
}: FormationsNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const navItems = [
    {
      id: 'all' as const,
      label: 'Catalogue',
      icon: LayoutDashboard,
      desc: 'Explorez toutes les formations',
      action: () => { onTabChange('all'); setMenuOpen(false); },
    },
    {
      id: 'my' as const,
      label: 'Mes cours',
      icon: LibraryBig,
      desc: 'Vos formations achetées',
      action: () => {
        if (!loggedClient) { onRequestAuth(); setMenuOpen(false); return; }
        onTabChange('my'); setMenuOpen(false);
      },
    },
    {
      id: 'fav' as const,
      label: 'Favoris',
      icon: Heart,
      desc: 'Formations sauvegardées',
      action: () => {
        if (!loggedClient) { onRequestAuth(); setMenuOpen(false); return; }
        onTabChange('my'); setMenuOpen(false);
      },
    },
    {
      id: 'cert' as const,
      label: 'Certificats',
      icon: Award,
      desc: 'Vos diplômes obtenus',
      action: () => {
        if (!loggedClient) { onRequestAuth(); setMenuOpen(false); return; }
        onTabChange('my'); setMenuOpen(false);
      },
    },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/96 backdrop-blur-lg border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-5">
        <div className="flex items-center h-14 gap-2 sm:gap-3">

          {/* Back button */}
          <button
            onClick={onGoHome}
            className="flex items-center gap-1 shrink-0 group"
            aria-label="Retour à l'accueil"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 transition-all group-hover:border-violet-200 group-hover:bg-violet-50 group-hover:shadow-sm">
              <ChevronLeft className="h-[17px] w-[17px] text-slate-500 transition-colors group-hover:text-violet-600" strokeWidth={2.25} />
            </div>
          </button>

          {/* Wordmark */}
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="font-editorial text-[17px] font-semibold text-gray-900 leading-none">Solution PAM</span>
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider leading-none">Academy</span>
          </div>

          <div className="flex-1" />

          {/* Right: burger only */}
          <div className="flex items-center shrink-0">

            {/* Burger menu button */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition-all ${
                  menuOpen
                    ? 'border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                    : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600'
                }`}
                aria-label="Menu"
              >
                {menuOpen ? <X className="h-[18px] w-[18px]" strokeWidth={2.25} /> : <Menu className="h-[18px] w-[18px]" strokeWidth={2.25} />}
              </button>

              {/* Dropdown menu */}
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-gray-100 shadow-2xl shadow-gray-200/60 overflow-hidden z-50"
                  >
                    {/* User info */}
                    {loggedClient && (
                      <div className="px-4 py-3 bg-violet-50 border-b border-violet-100 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-black shrink-0">
                          {loggedClient.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-gray-900 text-sm truncate">{loggedClient.name}</p>
                          <p className="text-xs text-violet-600 font-semibold truncate">{loggedClient.email || 'Étudiant'}</p>
                        </div>
                      </div>
                    )}

                    {/* Nav items */}
                    <div className="py-1.5">
                      {navItems.map(item => {
                        const active = (item.id === 'all' || item.id === 'my') && activeTab === item.id;
                        const Icon = item.icon;
                        return (
                          <button
                          key={item.id}
                          onClick={item.action}
                          className={`group w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-2xl transition-all ${
                            active
                              ? 'bg-violet-50 text-violet-700 shadow-[inset_0_0_0_1px_rgba(124,58,237,0.10)]'
                              : 'text-gray-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
                            active
                              ? 'bg-violet-600 text-white shadow-md shadow-violet-600/20'
                              : 'bg-slate-50 text-slate-500 group-hover:bg-white group-hover:shadow-sm'
                          }`}>
                            <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.35 : 1.9} />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{item.label}</p>
                            <p className="text-[11px] text-gray-400">{item.desc}</p>
                          </div>
                          {active && (
                            <div className="ml-auto h-2 w-2 rounded-full bg-violet-600 shrink-0 shadow-[0_0_0_3px_rgba(124,58,237,0.12)]" />
                          )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Divider + wallet */}
                    <div className="border-t border-gray-100 p-3">
                      <button
                        onClick={() => { onOpenWallet(); setMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-violet-50 transition-colors text-gray-700 hover:text-violet-700"
                      >
                        <Wallet className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-semibold">
                          {loggedClient ? 'Mon Wallet' : 'Connexion / Wallet'}
                        </span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>
      </div>
    </nav>
  );
}
