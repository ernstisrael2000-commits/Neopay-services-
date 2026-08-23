import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import Navbar from './layouts/Navbar';
import BottomNav from './layouts/BottomNav';
import FormationsNavbar from './layouts/FormationsNavbar';
import LoadingScreen from './components/LoadingScreen';
import { PageSkeleton } from './components/skeletons/PageSkeleton';
import { SettingsProvider, useSettingsCtx } from './contexts/SettingsContext';
import SeoHead from './components/SeoHead';
import SeoLandingPage from './pages/SeoLandingPage';
import { SEO_LANDING_PATHS, SeoLandingPath } from './lib/seo';

// Heavy pages — loaded only when the user navigates to them
const HomeView = lazy(() => import('./pages/HomeView'));
const TrackingView = lazy(() => import('./pages/TrackingView'));
const ShippingView = lazy(() => import('./pages/ShippingView'));
const FormationsView = lazy(() => import('./pages/FormationsView'));
const ProductsView = lazy(() => import('./pages/ProductsView'));
const ServicesView = lazy(() => import('./pages/ServicesView'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AffiliateDashboard = lazy(() => import('./pages/AffiliateDashboard'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));
const PaymentSuccessView = lazy(() => import('./pages/PaymentSuccessView'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
const AdminLogin = lazy(() => import('./components/AdminLogin'));
const AffiliateLogin = lazy(() => import('./components/AffiliateLogin'));
const AgentLogin = lazy(() => import('./components/AgentLogin'));
const AgentDashboard = lazy(() => import('./pages/AgentDashboard'));
const TeacherLogin = lazy(() => import('./components/TeacherLogin'));
const UserAuthModal = lazy(() => import('./components/UserAuthModal'));
const PWAInstallPrompt = lazy(() => import('./components/PWAInstallPrompt'));
import { Toaster } from './components/ui/sonner';
import AccessChoice from './components/AccessChoice';
import { useAuth } from './hooks/useAuth';
import { useFCM } from './hooks/useFCM';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Package, ChevronLeft, Bell, X, WifiOff } from 'lucide-react';
import { Button } from './components/ui/button';
import { Affiliate, AdminAccount, Client, Teacher, Agent } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { toast } from 'sonner';
import { logoutClient } from './services/clientService';

type AppView = 'home' | 'tracking' | 'admin' | 'affiliate' | 'teacher' | 'shipping' | 'formations' | 'products' | 'services' | 'wallet' | 'seo';
type CatalogTab = 'products' | 'games' | 'giftcards' | 'cards';

const PUBLIC_VIEW_PATHS: Partial<Record<AppView, string>> = {
  home: '/',
  products: '/produits',
  services: '/services',
  tracking: '/suivi-colis',
  shipping: '/expedition',
  formations: '/formations',
};

function routeFromPathname(pathname: string): { view: AppView; seoPath: SeoLandingPath | null } {
  const path = pathname.replace(/\/+$/, '') || '/';
  if ((SEO_LANDING_PATHS as readonly string[]).includes(path)) return { view: 'seo', seoPath: path as SeoLandingPath };
  const view = (Object.entries(PUBLIC_VIEW_PATHS).find(([, value]) => value === path)?.[0] || 'home') as AppView;
  return { view, seoPath: null };
}

function AppInner() {
  const [initialRoute] = useState(() => routeFromPathname(window.location.pathname));
  const [view, setView] = useState<AppView>(initialRoute.view);
  const [seoPath, setSeoPath] = useState<SeoLandingPath | null>(initialRoute.seoPath);
  const [history, setHistory] = useState<AppView[]>([initialRoute.view]);
  // Direction for page slide: 1 = left (new page comes from right), -1 = right (back)
  const navDirection = useRef<1 | -1>(1);
  const [formationsTab, setFormationsTab] = useState<'all' | 'my'>('all');
  const [accessChoice, setAccessChoice] = useState<'selection' | 'affiliate' | 'agent' | 'admin' | null>(null);
  const { loading } = useAuth();
  const [splashVisible, setSplashVisible] = useState(true);
  const { settings } = useSettingsCtx();
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  // Wallet is now a view — no separate modal state needed
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [formationsSearch, setFormationsSearch] = useState('');
  const [formationsInPlayer, setFormationsInPlayer] = useState(false);
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('products');
  const [moncashReturnRef, setMoncashReturnRef] = useState<string | null>(null);
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(() =>
    window.location.pathname === '/payment-success'
  );

  useEffect(() => {
    const handleBrowserNavigation = () => {
      const route = routeFromPathname(window.location.pathname);
      navDirection.current = -1;
      setHistory([route.view]);
      setSeoPath(route.seoPath);
      setView(route.view);
      setAccessChoice(null);
    };
    window.addEventListener('popstate', handleBrowserNavigation);
    return () => window.removeEventListener('popstate', handleBrowserNavigation);
  }, []);

  useEffect(() => {
    if (loading) {
      setSplashVisible(true);
      return;
    }

    const timer = window.setTimeout(() => setSplashVisible(false), 250);
    return () => window.clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (loading || splashVisible) return;
    const bootLoader = document.getElementById('solution-pam-boot-loader');
    if (!bootLoader) return;

    bootLoader.classList.add('boot-loader--ready');
    const cleanup = window.setTimeout(() => bootLoader.remove(), 380);
    return () => window.clearTimeout(cleanup);
  }, [loading, splashVisible]);
  
  const [loggedAdmin, setLoggedAdmin] = useState<AdminAccount | null>(() => {
    const saved = localStorage.getItem('rena_admin');
    return saved ? JSON.parse(saved) : null;
  });

  const handleAdminLogin = (admin: AdminAccount) => {
    setLoggedAdmin(admin);
    localStorage.setItem('rena_admin', JSON.stringify(admin));
  };

  const handleAdminLogout = () => {
    fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    signOut(auth).catch(() => {});
    setLoggedAdmin(null);
    localStorage.removeItem('rena_admin');
    setView('home');
  };

  // Connection Test — passive listener (no network request on startup)
  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
        toast.error("Connexion perdue. Solutionpam fonctionne en mode hors-ligne.", {
        description: "Certaines fonctionnalités peuvent être limitées.",
        duration: Infinity,
        icon: <WifiOff className="h-4 w-4" />,
        id: 'offline-toast'
      });
    };
    const handleOnline = () => {
      setIsOffline(false);
      toast.dismiss('offline-toast');
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Detect MonCash return redirect (?moncash_ref=xxx after payment) — legacy support
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('moncash_ref');
    if (ref) {
      setMoncashReturnRef(ref);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    // Detect MonCashConnect v2 return: /payment-success path
    if (window.location.pathname === '/payment-success') {
      setShowPaymentSuccess(true);
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  // Preload heavy dashboards during idle time so there's no white-page flash on login
  useEffect(() => {
    if (loading || splashVisible) return;

    const preload = () => {
      import('./pages/AdminDashboard').catch(() => {});
      import('./pages/AgentDashboard').catch(() => {});
    };
    if (typeof (window as any).requestIdleCallback === 'function') {
      (window as any).requestIdleCallback(preload, { timeout: 8000 });
    } else {
      const t = setTimeout(preload, 5000);
      return () => clearTimeout(t);
    }
  }, [loading, splashVisible]);

  // Ordered nav slots — used to compute slide direction
  const NAV_ORDER = ['home', 'products', 'services', 'formations', 'tracking', 'shipping'];

  const handleViewChange = (newView: AppView) => {
    if (newView === view) return;
    if (newView === 'products') setCatalogTab('products');
    const fromIdx = NAV_ORDER.indexOf(view);
    const toIdx   = NAV_ORDER.indexOf(newView);
    navDirection.current = (fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx) ? -1 : 1;
    setHistory(prev => [...prev, newView]);
    setView(newView);
    setSeoPath(null);
    setAccessChoice(null);
    const path = PUBLIC_VIEW_PATHS[newView];
    if (path && window.location.pathname !== path) window.history.pushState({ view: newView }, '', path);
  };

  const handleCatalogShortcut = (tab: CatalogTab) => {
    handleViewChange('products');
    setCatalogTab(tab);
  };

  const handleBack = () => {
    setAccessChoice(null);
    navDirection.current = -1;
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      const prevView = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      setView(prevView);
      setSeoPath(null);
      const path = PUBLIC_VIEW_PATHS[prevView];
      if (path) window.history.replaceState({ view: prevView }, '', path);
    } else {
      setView('home');
      setSeoPath(null);
      window.history.replaceState({ view: 'home' }, '', '/');
    }
  };

  const [loggedAffiliate, setLoggedAffiliate] = useState<Affiliate | null>(() => {
    const saved = localStorage.getItem('rena_affiliate');
    return saved ? JSON.parse(saved) : null;
  });

  const handleAffiliateLogin = (affiliate: Affiliate) => {
    setLoggedAffiliate(affiliate);
    localStorage.setItem('rena_affiliate', JSON.stringify(affiliate));
  };

  const handleAffiliateLogout = () => {
    setLoggedAffiliate(null);
    localStorage.removeItem('rena_affiliate');
  };

  const [loggedAgent, setLoggedAgent] = useState<Agent | null>(() => {
    const saved = localStorage.getItem('rena_agent');
    return saved ? JSON.parse(saved) : null;
  });

  const handleAgentLogin = (agent: Agent) => {
    setLoggedAgent(agent);
    localStorage.setItem('rena_agent', JSON.stringify(agent));
  };

  const handleAgentLogout = () => {
    setLoggedAgent(null);
    localStorage.removeItem('rena_agent');
  };

  const [loggedTeacher, setLoggedTeacher] = useState<Teacher | null>(() => {
    const saved = localStorage.getItem('rena_teacher');
    return saved ? JSON.parse(saved) : null;
  });

  const handleTeacherLogin = (teacher: Teacher) => {
    setLoggedTeacher(teacher);
    localStorage.setItem('rena_teacher', JSON.stringify(teacher));
  };

  const handleTeacherLogout = () => {
    setLoggedTeacher(null);
    localStorage.removeItem('rena_teacher');
    setView('home');
  };

  const [loggedClient, setLoggedClient] = useState<Client | null>(() => {
    const saved = localStorage.getItem('rena_client');
    return saved ? JSON.parse(saved) : null;
  });

  useFCM(loggedClient?.id || null);

  const handleClientLogin = (client: Client) => {
    setLoggedClient(client);
    localStorage.setItem('rena_client', JSON.stringify(client));
  };

  const handleClientLogout = () => {
    setLoggedClient(null);
    localStorage.removeItem('rena_client');
    void logoutClient();
    if (view === 'wallet') setView('home');
  };

  // Sync loggedClient with Firestore in real-time so balance stays up-to-date
  const clientUnsub = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (clientUnsub.current) { clientUnsub.current(); clientUnsub.current = null; }
    if (!loggedClient?.id) return;
    clientUnsub.current = onSnapshot(doc(db, 'clients', loggedClient.id), (snap) => {
      if (snap.exists()) {
        const updated = { id: snap.id, ...snap.data() } as Client;
        setLoggedClient(updated);
        localStorage.setItem('rena_client', JSON.stringify(updated));
      }
    });
    return () => { if (clientUnsub.current) clientUnsub.current(); };
  }, [loggedClient?.id]);

  if (loading || splashVisible) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background font-sans selection:bg-accent-light selection:text-dark flex flex-col">
        <SeoHead
          pathname={view === 'seo' && seoPath ? seoPath : PUBLIC_VIEW_PATHS[view] || window.location.pathname}
          indexable={view === 'seo' || Boolean(PUBLIC_VIEW_PATHS[view])}
        />
        {view !== 'formations' && (
          <Navbar 
            currentView={view}
            onViewChange={handleViewChange}
            loggedClient={loggedClient}
            onClientLogin={handleClientLogin}
            onClientLogout={handleClientLogout}
            onOpenWallet={() => handleViewChange('wallet')}
            onCatalogShortcut={handleCatalogShortcut}
            onAdminLogin={(admin) => {
              handleAdminLogin(admin);
              handleViewChange('admin');
            }}
            onTeacherAccess={() => handleViewChange('teacher')}
            formationsTab={formationsTab}
            onFormationsTabChange={setFormationsTab}
          />
        )}

        {view === 'formations' && !formationsInPlayer && (
          <FormationsNavbar
            onGoHome={() => { handleViewChange('home'); setFormationsSearch(''); }}
            loggedClient={loggedClient}
            onOpenWallet={() => handleViewChange('wallet')}
            onRequestAuth={() => setShowAuthModal(true)}
            activeTab={formationsTab}
            onTabChange={setFormationsTab}
            searchQuery={formationsSearch}
            onSearch={setFormationsSearch}
          />
        )}

        <AnimatePresence>
          {settings?.showGlobalAnnouncement && settings?.globalAnnouncement && showAnnouncement && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4 p-6 pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-lg bg-white/98 backdrop-blur-xl rounded-[2.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.35)] border border-primary/20 pointer-events-auto overflow-hidden ring-1 ring-black/10"
              >
                <div className="relative">
                  <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-primary/5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                        <Bell className="h-5 w-5 text-white animate-ring" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-dark tracking-tight leading-none">
                          Annonce Spéciale
                        </h3>
                        <p className="text-[10px] uppercase font-black text-primary/60 tracking-widest mt-1">
                          Solutionpam
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowAnnouncement(false)}
                      className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all active:scale-95 text-gray-400 hover:text-dark border border-gray-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-6 sm:p-8 max-h-[40vh] overflow-y-auto no-scrollbar scroll-smooth">
                    <div className="space-y-4">
                      <p className="text-gray-600 font-bold leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                        {settings.globalAnnouncement}
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-6 pt-0 flex justify-center">
                    <Button 
                      onClick={() => setShowAnnouncement(false)}
                      className="w-full h-12 rounded-2xl bg-primary hover:bg-[#1D4ED8] text-white font-black text-sm shadow-xl shadow-accent-light/60 border-0 transition-all hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 group"
                    >
                      J'AI COMPRIS
                      <motion.span 
                        animate={{ x: [0, 5, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="ml-2"
                      >
                        →
                      </motion.span>
                    </Button>
                  </div>
                </div>

                <div className="h-2 w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-30" />
              </motion.div>

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] -z-10"
                onClick={() => setShowAnnouncement(false)}
              />
            </div>
          )}
        </AnimatePresence>
        
        {!['admin', 'affiliate', 'formations'].includes(view) && !isProductDetailOpen && (
          <BottomNav
            currentView={view}
            onViewChange={handleViewChange}
            loggedClient={loggedClient}
            onOpenWallet={() => handleViewChange('wallet')}
            onRequestAuth={() => setShowAuthModal(true)}
            formationsTab={formationsTab}
            onFormationsTabChange={setFormationsTab}
          />
        )}

        <main
          className={`${
            view === 'formations' ? (formationsInPlayer ? 'pt-0' : 'pt-14') : 'pt-14'
          } flex-grow relative ${
            !['admin', 'affiliate', 'formations', 'wallet'].includes(view) ? 'pb-[64px]' : ''
          }`}
          style={{ overflowX: 'hidden' }}
        >
          <Suspense fallback={<PageSkeleton />}>
            {/* Wallet page — full-screen, rendered outside AnimatePresence for clean layout */}
            {view === 'wallet' && loggedClient && (
              <ClientDashboard
                clientId={loggedClient.id!}
                onLogout={handleClientLogout}
                asPage
                onBack={handleBack}
              />
            )}

            <AnimatePresence mode="popLayout" initial={false} custom={navDirection.current}>
              {view !== 'wallet' && (
                <motion.div
                  key={view}
                  custom={navDirection.current}
                  variants={{
                    initial:  (dir: number) => ({ opacity: 0, x: dir * 24, willChange: 'transform, opacity' }),
                    animate:  { opacity: 1, x: 0,      willChange: 'transform, opacity' },
                    exit:     (dir: number) => ({ opacity: 0, x: dir * -18, willChange: 'transform, opacity' }),
                  }}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 310, damping: 32, mass: 0.9 }}
                  className="min-h-full"
                >
                  {['tracking', 'shipping'].includes(view) && (
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBack}
                        className="group flex items-center gap-1.5 text-subtext hover:text-primary hover:bg-accent-light/50 rounded-lg transition-all pl-2 pr-3"
                      >
                        <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Retour</span>
                      </Button>
                    </div>
                  )}

                  {view === 'home' && (
                    <HomeView
                      onTrackingClick={() => handleViewChange('tracking')}
                      onViewChange={handleViewChange}
                      loggedClient={loggedClient}
                      onOpenWallet={() => handleViewChange('wallet')}
                      onRequestAuth={() => setShowAuthModal(true)}
                    />
                  )}

                  {view === 'products' && (
                    <ProductsView
                      loggedClient={loggedClient}
                      onOpenWallet={() => handleViewChange('wallet')}
                      onRequestAuth={() => setShowAuthModal(true)}
                      onViewChange={handleViewChange}
                      initialTab={catalogTab}
                      onProductDetailChange={setIsProductDetailOpen}
                    />
                  )}

                  {view === 'services' && (
                    <ServicesView
                      onTrackingClick={() => handleViewChange('tracking')}
                      onViewChange={handleViewChange}
                      loggedClient={loggedClient}
                      onRequestAuth={() => setShowAuthModal(true)}
                    />
                  )}

                  {view === 'tracking' && <TrackingView />}

                  {view === 'shipping' && <ShippingView />}

                  {view === 'formations' && (
                    <FormationsView
                      loggedClient={loggedClient}
                      onOpenWallet={() => handleViewChange('wallet')}
                      onClientLogin={handleClientLogin}
                      activeTab={formationsTab}
                      onTabChange={setFormationsTab}
                      searchQuery={formationsSearch}
                      onSearchChange={setFormationsSearch}
                      onPlayerChange={setFormationsInPlayer}
                    />
                  )}

                  {view === 'seo' && seoPath && <SeoLandingPage path={seoPath} />}

                  {view === 'admin' && (
                    loggedAdmin
                      ? <AdminDashboard onLogout={handleAdminLogout} admin={loggedAdmin} />
                      : <AdminLogin onLoginSuccess={handleAdminLogin} onBack={() => handleViewChange('home')} />
                  )}

                  {view === 'teacher' && (
                    loggedTeacher
                      ? <TeacherDashboard teacher={loggedTeacher} onLogout={handleTeacherLogout} />
                      : <TeacherLogin onLoginSuccess={handleTeacherLogin} onBack={() => handleViewChange('home')} />
                  )}

                  {view === 'affiliate' && (
                    loggedAffiliate ? (
                      <AffiliateDashboard affiliateId={loggedAffiliate.id!} onLogout={handleAffiliateLogout} />
                    ) : loggedAgent ? (
                      <AgentDashboard agentUid={loggedAgent.uid!} onLogout={handleAgentLogout} />
                    ) : loggedAdmin ? (
                      <AdminDashboard onLogout={handleAdminLogout} admin={loggedAdmin} />
                    ) : accessChoice === 'affiliate' ? (
                      <AffiliateLogin onLogin={handleAffiliateLogin} />
                    ) : accessChoice === 'agent' ? (
                      <AgentLogin onLogin={handleAgentLogin} />
                    ) : accessChoice === 'admin' ? (
                      <AdminLogin onLoginSuccess={handleAdminLogin} onBack={() => setAccessChoice(null)} />
                    ) : (
                      <AccessChoice onChoice={(choice) => setAccessChoice(choice)} />
                    )
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </Suspense>
        </main>

        {!['admin', 'affiliate', 'teacher', 'formations', 'wallet'].includes(view) && (
          <footer className="py-12 border-t mt-auto bg-white pb-24">
            <div className="max-w-7xl mx-auto px-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="bg-muted p-1.5 rounded-md">
                  <Package className="h-5 w-5 text-subtext" />
                </div>
                <span className="text-xl font-bold text-dark">Solutionpam</span>
              </div>
              <p className="text-subtext text-sm">
                © {new Date().getFullYear()} Solutionpam. Tous droits réservés.
              </p>
              <div className="flex justify-center gap-6 mt-6 text-sm text-subtext/60">
                <a href="/services" className="hover:text-subtext transition-colors">Services</a>
                <a href="/contact" className="hover:text-subtext transition-colors">Contact &amp; support</a>
                <a href="/a-propos" className="hover:text-subtext transition-colors">À propos</a>
              </div>
            </div>
          </footer>
        )}

        <Toaster position="top-right" />

        <Suspense fallback={null}>
          <AnimatePresence>
            {moncashReturnRef && (
              <PaymentSuccessView
                referenceId={moncashReturnRef}
                onClose={() => { setMoncashReturnRef(null); handleViewChange('wallet'); }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showPaymentSuccess && (
              <PaymentSuccessPage
                onClose={() => { setShowPaymentSuccess(false); handleViewChange('wallet'); }}
              />
            )}
          </AnimatePresence>
        </Suspense>

        {showAuthModal && (
          <Suspense fallback={null}>
            <UserAuthModal
              open={showAuthModal}
              onOpenChange={setShowAuthModal}
              onClientLogin={(client) => { handleClientLogin(client); setShowAuthModal(false); }}
              onAdminLogin={(admin) => { handleAdminLogin(admin); handleViewChange('admin'); setShowAuthModal(false); }}
              onAffiliateAccess={() => handleViewChange('affiliate')}
              onTeacherAccess={() => { handleViewChange('teacher'); setShowAuthModal(false); }}
            />
          </Suspense>
        )}

        <Suspense fallback={null}>
          <PWAInstallPrompt />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <AppInner />
      </SettingsProvider>
    </ErrorBoundary>
  );
}
