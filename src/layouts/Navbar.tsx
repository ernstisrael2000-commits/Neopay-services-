import { Package, ShieldCheck, LogIn, LogOut, Search, Home, Users, Truck, ExternalLink, Menu, X, Wallet, ChevronRight, GraduationCap, Settings, BookOpen, LayoutGrid, Bell, CheckCheck, Info, TrendingUp, TrendingDown, Trash2, Key, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';
import RenaLogo from '../components/RenaLogo';
import { Button } from '../components/ui/button';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { useSettingsCtx } from '../contexts/SettingsContext';
import { usePendingCounts } from '../services/affiliateService';
import { usePendingClientCount, useClientNotifications, markClientNotificationRead, markAllClientNotificationsRead, clearAllClientNotifications } from '../services/clientService';
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Client, AdminAccount } from '../types';
import UserAuthModal from '../components/UserAuthModal';

interface NavbarProps {
  currentView: string;
  onViewChange: (view: any) => void;
  loggedClient: Client | null;
  onClientLogin: (client: Client) => void;
  onClientLogout: () => void;
  onOpenWallet: () => void;
  onAdminLogin: (admin: AdminAccount) => void;
  onTeacherAccess?: () => void;
  formationsTab?: 'all' | 'my';
  onFormationsTabChange?: (tab: 'all' | 'my') => void;
}

// ── Client notification item (with copy-to-clipboard for credentials) ────────
interface ClientNotifItemProps {
  notif: ReturnType<typeof useClientNotifications>[0] extends (infer T)[] ? T : never;
  onRead: () => void;
}
const ClientNotifItem: React.FC<{ notif: any; onRead: () => void }> = ({ notif, onRead }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const isCredentials = notif.type === 'purchase_credentials';
  const isApproved = notif.type === 'deposit_approved' || notif.type === 'withdrawal_approved';
  const isRejected = notif.type?.includes('rejected');
  const meta = notif.metadata;

  const iconBg = isCredentials ? 'bg-violet-100' :
    notif.type === 'deposit_approved' ? 'bg-emerald-100' :
    notif.type === 'withdrawal_approved' ? 'bg-blue-100' :
    isRejected ? 'bg-red-100' : 'bg-gray-100';
  const titleColor = isCredentials ? 'text-violet-700' :
    isApproved ? 'text-emerald-700' : isRejected ? 'text-red-700' : 'text-gray-900';

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  return (
    <div
      className={`flex flex-col gap-2 px-5 py-3.5 border-b last:border-0 transition-colors cursor-pointer ${notif.read ? 'hover:bg-gray-50' : isCredentials ? 'bg-violet-50/50 hover:bg-violet-50' : 'bg-blue-50/40 hover:bg-blue-50'}`}
      onClick={onRead}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 h-9 w-9 rounded-2xl flex items-center justify-center ${iconBg}`}>
          {isCredentials ? <Key className="h-4 w-4 text-violet-600" /> :
           notif.type === 'deposit_approved' ? <TrendingUp className="h-4 w-4 text-emerald-600" /> :
           notif.type === 'withdrawal_approved' ? <TrendingDown className="h-4 w-4 text-blue-600" /> :
           isRejected ? <X className="h-4 w-4 text-red-600" /> :
           <Info className="h-4 w-4 text-gray-500" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-black leading-snug ${notif.read ? 'text-gray-500' : titleColor}`}>{notif.title}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{notif.message}</p>
          {notif.createdAt && (
            <p className="text-[9px] text-gray-300 mt-1 font-semibold">
              {new Date(notif.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        {!notif.read && <div className="shrink-0 mt-2 h-2 w-2 rounded-full bg-primary animate-pulse" />}
      </div>

      {/* Credentials card */}
      {isCredentials && meta?.credentialEmail && (
        <div className="ml-12 rounded-2xl overflow-hidden border border-violet-200 bg-white shadow-sm" onClick={e => e.stopPropagation()}>
          <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-3 py-1.5 flex items-center gap-1.5">
            <Key className="h-3 w-3 text-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Identifiants</span>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100">
              <div className="min-w-0">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Email</p>
                <p className="text-xs font-black text-gray-900 font-mono truncate">{meta.credentialEmail}</p>
              </div>
              <button
                onClick={() => copyToClipboard(meta.credentialEmail, 'email')}
                className="shrink-0 h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center hover:bg-violet-200 transition-colors"
              >
                {copiedField === 'email' ? <Check className="h-3.5 w-3.5 text-violet-700" /> : <Copy className="h-3.5 w-3.5 text-violet-600" />}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100">
              <div className="min-w-0">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mot de passe</p>
                <p className="text-xs font-black text-gray-900 font-mono truncate">{meta.credentialPassword}</p>
              </div>
              <button
                onClick={() => copyToClipboard(meta.credentialPassword, 'password')}
                className="shrink-0 h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center hover:bg-violet-200 transition-colors"
              >
                {copiedField === 'password' ? <Check className="h-3.5 w-3.5 text-violet-700" /> : <Copy className="h-3.5 w-3.5 text-violet-600" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NAV_ITEMS = [
  { key: 'home', icon: Home, label: 'Accueil' },
  { key: 'tracking', icon: Search, label: 'Suivi' },
  { key: 'shipping', icon: Truck, label: 'Shipping' },
  { key: 'formations', icon: GraduationCap, label: 'Formations' },
  { key: 'affiliate', icon: Users, label: 'Affiliés' },
];

export default function Navbar({ currentView, onViewChange, loggedClient, onClientLogin, onClientLogout, onOpenWallet, onAdminLogin, onTeacherAccess, formationsTab, onFormationsTabChange }: NavbarProps) {
  const { user, isAdmin } = useAuth();
  const { settings } = useSettingsCtx();
  const { total: pendingAffiliateCount } = usePendingCounts(isAdmin);
  const pendingClientCount = usePendingClientCount();
  const pendingCount = isAdmin ? pendingAffiliateCount + pendingClientCount : 0;
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLoginErrorDialog, setShowLoginErrorDialog] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [formationsDropdownOpen, setFormationsDropdownOpen] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [confirmClearNotifs, setConfirmClearNotifs] = useState(false);
  const [clearingNotifs, setClearingNotifs] = useState(false);
  const formationsDropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { notifications: clientNotifs, unreadCount: clientUnreadCount } = useClientNotifications(loggedClient?.id || null);

  const isLoggedIn = !!(user || loggedClient);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      onViewChange('home');
      setMenuOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleNav = (view: string) => {
    onViewChange(view);
    setMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (formationsDropdownRef.current && !formationsDropdownRef.current.contains(e.target as Node)) {
        setFormationsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen, formationsDropdownOpen]);

  useEffect(() => {
    if (menuOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const NavButton = ({ item }: { item: typeof NAV_ITEMS[0] }) => {
    const active = currentView === item.key;
    return (
      <button
        onClick={() => handleNav(item.key)}
        className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors duration-200 group ${active ? 'bg-primary/10' : 'hover:bg-gray-100'}`}
      >
        <motion.div
          key={active ? 'active' : 'inactive'}
          initial={active ? { scale: 0.8, y: 2 } : false}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          whileHover={{ scale: 1.18, y: -1.5 }}
          whileTap={{ scale: 0.88 }}
        >
          <item.icon className={`h-[18px] w-[18px] transition-colors ${active ? 'text-primary' : 'text-gray-900 group-hover:text-primary'}`} />
        </motion.div>
        <span className={`text-[9px] font-bold uppercase tracking-wide transition-colors ${active ? 'text-primary' : 'text-gray-900/80 group-hover:text-primary/80'}`}>{item.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav className="border-b bg-white fixed top-0 left-0 right-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center gap-2">

            {/* Logo */}
            <div
              className="flex items-center gap-2 cursor-pointer shrink-0"
              onClick={() => handleNav('home')}
            >
              {/* Fixed width prevents CLS when logo URL loads asynchronously */}
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Rena Logo" width={28} height={28}
                  className="h-7 w-7 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <RenaLogo size={28} />
              )}
              <span className="text-lg font-black tracking-tight text-gray-800 hidden sm:block">Rena</span>
            </div>

            {/* Desktop nav — always visible on md+ */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map(item => <NavButton key={item.key} item={item} />)}
              {isAdmin && (
                <button
                  onClick={() => handleNav('admin')}
                  className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl relative transition-all duration-200 group ${currentView === 'admin' ? 'bg-amber-50' : 'hover:bg-amber-50/60'}`}
                >
                  <ShieldCheck className={`h-[18px] w-[18px] ${currentView === 'admin' ? 'text-amber-500' : 'text-gray-400 group-hover:text-amber-500'}`} />
                  <span className={`text-[9px] font-bold uppercase tracking-wide ${currentView === 'admin' ? 'text-amber-500' : 'text-gray-400/70 group-hover:text-amber-500'}`}>Admin</span>
                  {pendingCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </button>
              )}
              {onTeacherAccess && (
                <button
                  onClick={() => { onTeacherAccess(); handleNav('teacher'); }}
                  className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 group ${currentView === 'teacher' ? 'bg-violet-50' : 'hover:bg-violet-50/60'}`}
                >
                  <GraduationCap className={`h-[18px] w-[18px] ${currentView === 'teacher' ? 'text-violet-600' : 'text-gray-400 group-hover:text-violet-600'}`} />
                  <span className={`text-[9px] font-bold uppercase tracking-wide ${currentView === 'teacher' ? 'text-violet-600' : 'text-gray-400/70 group-hover:text-violet-600'}`}>Professeur</span>
                </button>
              )}
            </div>

            {/* Formations sub-menu (desktop) */}
            {currentView === 'formations' && onFormationsTabChange && (
              <div className="relative hidden md:block" ref={formationsDropdownRef}>
                <button
                  onClick={() => setFormationsDropdownOpen(v => !v)}
                  className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 group ${formationsDropdownOpen ? 'bg-primary/10' : 'hover:bg-gray-100'}`}
                >
                  <Settings className={`h-[18px] w-[18px] transition-colors ${formationsDropdownOpen ? 'text-primary' : 'text-gray-400 group-hover:text-primary'}`} />
                  <span className={`text-[9px] font-bold uppercase tracking-wide transition-colors ${formationsDropdownOpen ? 'text-primary' : 'text-gray-400/70 group-hover:text-primary/80'}`}>Options</span>
                </button>
                {formationsDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50">
                    <button
                      onClick={() => { onFormationsTabChange('all'); setFormationsDropdownOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${formationsTab === 'all' ? 'text-primary bg-primary/5 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <LayoutGrid className="h-4 w-4 shrink-0" />
                      Tous les cours
                      {formationsTab === 'all' && <ChevronRight className="h-3.5 w-3.5 ml-auto text-primary" />}
                    </button>
                    <button
                      onClick={() => { onFormationsTabChange('my'); setFormationsDropdownOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${formationsTab === 'my' ? 'text-primary bg-primary/5 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <BookOpen className="h-4 w-4 shrink-0" />
                      Mes cours
                      {formationsTab === 'my' && <ChevronRight className="h-3.5 w-3.5 ml-auto text-primary" />}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Right side */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Client notification bell */}
              {loggedClient && (
                <>
                  <button
                    onClick={() => setShowNotifPanel(true)}
                    className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
                    aria-label="Notifications"
                  >
                    <Bell className={`h-5 w-5 ${clientUnreadCount > 0 ? 'text-primary' : 'text-gray-400'}`} />
                    {clientUnreadCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                        {clientUnreadCount > 9 ? '9+' : clientUnreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification modal — centered popup */}
                  <Dialog open={showNotifPanel} onOpenChange={v => { setShowNotifPanel(v); if (!v) setConfirmClearNotifs(false); }}>
                    <DialogContent className="max-w-sm w-full rounded-3xl border-0 p-0 overflow-hidden shadow-2xl">
                      {/* Header */}
                      <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Bell className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900">Notifications</p>
                            {clientUnreadCount > 0 && (
                              <p className="text-[10px] text-primary font-bold">{clientUnreadCount} non lue{clientUnreadCount > 1 ? 's' : ''}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {clientUnreadCount > 0 && (
                            <button
                              onClick={async () => { await markAllClientNotificationsRead(loggedClient.id!); }}
                              className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                            >
                              <CheckCheck className="h-3 w-3" /> Tout lire
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Notification list */}
                      <div className="max-h-[60vh] overflow-y-auto">
                        {clientNotifs.length === 0 ? (
                          <div className="py-12 text-center text-gray-400">
                            <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
                              <Bell className="h-8 w-8 opacity-30" />
                            </div>
                            <p className="text-sm font-semibold">Aucune notification</p>
                            <p className="text-xs mt-1 text-gray-300">Tout est calme pour l'instant</p>
                          </div>
                        ) : (
                          clientNotifs.slice(0, 20).map(notif => {
                            const isCredentials = notif.type === 'purchase_credentials';
                            const isApproved = notif.type === 'deposit_approved' || notif.type === 'withdrawal_approved';
                            const isRejected = notif.type?.includes('rejected');
                            const iconBg = isCredentials ? 'bg-violet-100' :
                              notif.type === 'deposit_approved' ? 'bg-emerald-100' :
                              notif.type === 'withdrawal_approved' ? 'bg-blue-100' :
                              isRejected ? 'bg-red-100' : 'bg-gray-100';
                            const titleColor = isCredentials ? 'text-violet-700' :
                              isApproved ? 'text-emerald-700' : isRejected ? 'text-red-700' : 'text-gray-900';
                            const meta = (notif as any).metadata;
                            const [copiedField, setCopiedField] = React.useState<string | null>(null);
                            const copyToClipboard = (text: string, field: string) => {
                              navigator.clipboard.writeText(text).then(() => {
                                setCopiedField(field);
                                setTimeout(() => setCopiedField(null), 2000);
                              });
                            };
                            return (
                              <div
                                key={notif.id}
                                className={`flex flex-col gap-2 px-5 py-3.5 border-b last:border-0 transition-colors cursor-pointer ${notif.read ? 'hover:bg-gray-50' : isCredentials ? 'bg-violet-50/50 hover:bg-violet-50' : 'bg-blue-50/40 hover:bg-blue-50'}`}
                                onClick={() => markClientNotificationRead(notif.id!)}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`shrink-0 mt-0.5 h-9 w-9 rounded-2xl flex items-center justify-center ${iconBg}`}>
                                    {isCredentials ? <Key className="h-4 w-4 text-violet-600" /> :
                                     notif.type === 'deposit_approved' ? <TrendingUp className="h-4 w-4 text-emerald-600" /> :
                                     notif.type === 'withdrawal_approved' ? <TrendingDown className="h-4 w-4 text-blue-600" /> :
                                     isRejected ? <X className="h-4 w-4 text-red-600" /> :
                                     <Info className="h-4 w-4 text-gray-500" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-xs font-black leading-snug ${notif.read ? 'text-gray-500' : titleColor}`}>{notif.title}</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{notif.message}</p>
                                    {notif.createdAt && (
                                      <p className="text-[9px] text-gray-300 mt-1 font-semibold">
                                        {new Date(notif.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    )}
                                  </div>
                                  {!notif.read && <div className="shrink-0 mt-2 h-2 w-2 rounded-full bg-primary animate-pulse" />}
                                </div>

                                {/* Credentials card */}
                                {isCredentials && meta?.credentialEmail && (
                                  <div className="ml-12 rounded-2xl overflow-hidden border border-violet-200 bg-white shadow-sm" onClick={e => e.stopPropagation()}>
                                    <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-3 py-1.5 flex items-center gap-1.5">
                                      <Key className="h-3 w-3 text-white" />
                                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Identifiants</span>
                                    </div>
                                    <div className="p-3 space-y-2">
                                      <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100">
                                        <div className="min-w-0">
                                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Email</p>
                                          <p className="text-xs font-black text-gray-900 font-mono truncate">{meta.credentialEmail}</p>
                                        </div>
                                        <button
                                          onClick={() => copyToClipboard(meta.credentialEmail, 'email')}
                                          className="shrink-0 h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center hover:bg-violet-200 transition-colors"
                                        >
                                          {copiedField === 'email' ? <Check className="h-3.5 w-3.5 text-violet-700" /> : <Copy className="h-3.5 w-3.5 text-violet-600" />}
                                        </button>
                                      </div>
                                      <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100">
                                        <div className="min-w-0">
                                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mot de passe</p>
                                          <p className="text-xs font-black text-gray-900 font-mono truncate">{meta.credentialPassword}</p>
                                        </div>
                                        <button
                                          onClick={() => copyToClipboard(meta.credentialPassword, 'password')}
                                          className="shrink-0 h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center hover:bg-violet-200 transition-colors"
                                        >
                                          {copiedField === 'password' ? <Check className="h-3.5 w-3.5 text-violet-700" /> : <Copy className="h-3.5 w-3.5 text-violet-600" />}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Footer — delete history */}
                      {clientNotifs.length > 0 && (
                        <div className="border-t px-5 py-3 flex items-center justify-end bg-gray-50/50">
                          {confirmClearNotifs ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-red-500 font-bold">Supprimer tout ?</span>
                              <button
                                disabled={clearingNotifs}
                                onClick={async () => {
                                  setClearingNotifs(true);
                                  try { await clearAllClientNotifications(loggedClient.id!); } catch {}
                                  setClearingNotifs(false);
                                  setConfirmClearNotifs(false);
                                }}
                                className="text-[11px] font-black text-red-600 hover:text-red-800 px-2.5 py-1 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {clearingNotifs ? '...' : 'Confirmer'}
                              </button>
                              <button
                                onClick={() => setConfirmClearNotifs(false)}
                                className="text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmClearNotifs(true)}
                              className="text-[11px] font-bold text-gray-400 hover:text-red-500 flex items-center gap-1.5 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" /> Supprimer l'historique
                            </button>
                          )}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </>
              )}

              {/* Client wallet */}
              {loggedClient ? (
                <button onClick={onOpenWallet}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 transition-all">
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-white font-black text-[10px]">
                    {loggedClient.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold text-primary hidden sm:block truncate max-w-[80px]">{loggedClient.name.split(' ')[0]}</span>
                  <Wallet className="h-3.5 w-3.5 text-primary" />
                </button>
              ) : user ? (
                <div className="hidden md:flex items-center gap-2">
                  <img src={user.photoURL || ''} alt={user.displayName || ''}
                    className="h-7 w-7 rounded-full border-2 border-primary/20"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}`; }} />
                  <span className="text-xs font-bold text-gray-700 max-w-[90px] truncate">{user.displayName?.split(' ')[0]}</span>
                  <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary to-blue-600 text-white text-sm font-bold shadow-md shadow-primary/25 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200">
                  <LogIn className="h-4 w-4 shrink-0" />
                  <span>Se connecter</span>
                </button>
              )}

              {/* Burger — always on mobile, also on desktop when logged in for compactness */}
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors relative"
                aria-label="Menu"
              >
                {menuOpen ? <X className="h-5 w-5 text-gray-600" /> : <Menu className="h-5 w-5 text-gray-600" />}
                {pendingCount > 0 && !menuOpen && (
                  <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div ref={menuRef} className="absolute top-14 right-0 w-72 max-h-[calc(100vh-56px)] overflow-y-auto bg-white shadow-2xl rounded-bl-2xl flex flex-col">

            {/* User info block */}
            {(user || loggedClient) && (
              <div className="p-4 border-b bg-gray-50">
                {user && (
                  <div className="flex items-center gap-3">
                    <img src={user.photoURL || ''} alt={user.displayName || ''}
                      className="h-10 w-10 rounded-full border-2 border-primary/20"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}`; }} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{user.displayName}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                  </div>
                )}
                {loggedClient && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-black text-base">
                      {loggedClient.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{loggedClient.name}</p>
                      <p className="text-xs text-primary font-semibold">Wallet client</p>
                    </div>
                    <button onClick={() => { onOpenWallet(); setMenuOpen(false); }}
                      className="ml-auto p-2 bg-primary/10 rounded-xl text-primary hover:bg-primary/20 transition-colors">
                      <Wallet className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Nav links */}
            <div className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map(item => {
                const active = currentView === item.key;
                return (
                  <button key={item.key} onClick={() => handleNav(item.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${active ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <item.icon className={`h-5 w-5 shrink-0 ${active ? 'text-primary' : 'text-gray-400'}`} />
                    <span>{item.label}</span>
                    {active && <ChevronRight className="h-4 w-4 ml-auto text-primary" />}
                  </button>
                );
              })}

              {isAdmin && (
                <button onClick={() => handleNav('admin')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all relative ${currentView === 'admin' ? 'bg-amber-50 text-amber-600' : 'text-gray-600 hover:bg-amber-50/60'}`}>
                  <ShieldCheck className={`h-5 w-5 shrink-0 ${currentView === 'admin' ? 'text-amber-500' : 'text-gray-400'}`} />
                  <span>Administration</span>
                  {pendingCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </button>
              )}
              {onTeacherAccess && (
                <button onClick={() => { onTeacherAccess(); handleNav('teacher'); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${currentView === 'teacher' ? 'bg-violet-50 text-violet-600' : 'text-gray-600 hover:bg-violet-50/60'}`}>
                  <GraduationCap className={`h-5 w-5 shrink-0 ${currentView === 'teacher' ? 'text-violet-600' : 'text-gray-400'}`} />
                  <span>Espace Professeur</span>
                  {currentView === 'teacher' && <ChevronRight className="h-4 w-4 ml-auto text-violet-500" />}
                </button>
              )}
            </div>

            {/* Bottom actions */}
            <div className="p-3 border-t space-y-1">
              {(user || loggedClient) ? (
                <button onClick={user ? handleLogout : () => { onClientLogout(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-all">
                  <LogOut className="h-5 w-5 shrink-0" />
                  <span>Se déconnecter</span>
                </button>
              ) : (
                <button onClick={() => { setShowAuthModal(true); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-[#1D4ED8] transition-all">
                  <LogIn className="h-5 w-5 shrink-0" />
                  <span>Connexion</span>
                </button>
              )}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs text-gray-400 hover:bg-gray-50 transition-all"
                onClick={() => { window.open(window.location.href, '_blank'); setMenuOpen(false); }}
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span>Ouvrir dans un nouvel onglet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <UserAuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onClientLogin={(client) => { onClientLogin(client); setShowAuthModal(false); }}
        onAdminLogin={(admin) => { onAdminLogin(admin); onViewChange('admin'); setShowAuthModal(false); }}
        onAffiliateAccess={() => onViewChange('affiliate')}
        onAdminPasswordLogin={() => { onViewChange('admin'); setShowAuthModal(false); }}
        onTeacherAccess={onTeacherAccess ? () => { onTeacherAccess(); onViewChange('teacher'); setShowAuthModal(false); } : undefined}
      />

      <Dialog open={showLoginErrorDialog} onOpenChange={setShowLoginErrorDialog}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mb-6 border border-red-100 mx-auto">
              <ShieldCheck className="h-8 w-8 text-red-500" />
            </div>
            <DialogTitle className="text-2xl font-black text-center text-dark">Problème de Connexion</DialogTitle>
            <DialogDescription className="pt-4 space-y-4 text-center">
              <p className="text-subtext text-sm leading-relaxed">Une erreur est survenue lors de la connexion. Veuillez réessayer.</p>
              {lastError && (
                <p className="text-[10px] text-subtext/60 font-mono bg-muted p-2 rounded border truncate">Détail: {lastError}</p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button className="w-full h-12 rounded-xl bg-primary hover:bg-[#1D4ED8] text-white font-bold flex items-center justify-center gap-2"
              onClick={() => { window.open(window.location.href, '_blank'); setShowLoginErrorDialog(false); }}>
              <ExternalLink className="h-5 w-5" />
              Ouvrir dans un nouvel onglet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
