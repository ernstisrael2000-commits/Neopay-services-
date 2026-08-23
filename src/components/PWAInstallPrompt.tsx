import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone, Wifi, Zap, Star } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISSED_KEY = 'rena_pwa_dismissed';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (dismissed || isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 4000);
    };

    const installedHandler = () => {
      setShow(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setShow(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  const features = [
    { icon: <Wifi className="h-4 w-4 text-violet-500" />, label: 'Hors-ligne', sub: 'Sans connexion' },
    { icon: <Zap className="h-4 w-4 text-amber-500" />, label: 'Rapide', sub: 'Chargement instant' },
    { icon: <Star className="h-4 w-4 text-emerald-500" />, label: 'Gratuit', sub: 'Aucun frais' },
  ];

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[290] bg-black/20 backdrop-blur-[2px]"
            onClick={handleDismiss}
          />

          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 120, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 120, scale: 0.95 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="fixed bottom-4 left-4 right-4 z-[300] max-w-sm mx-auto"
          >
            <div className="bg-white rounded-3xl shadow-2xl shadow-violet-200/50 border border-violet-100 overflow-hidden">

              <div className="relative bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-700 p-5 overflow-hidden">
                <div className="absolute inset-0 opacity-20"
                  style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 50%)' }} />
                <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full border border-white/10" />
                <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full border border-white/10" />

                <div className="relative flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-white shadow-lg flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 512 512" className="h-8 w-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="512" height="512" rx="115" fill="#7C3AED"/>
                        <text x="256" y="360" textAnchor="middle" fontFamily="Arial Black, Arial" fontWeight="900" fontSize="300" fill="white">N</text>
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-black text-base leading-tight">Installer Solutionpam</p>
                      <p className="text-violet-200 text-xs mt-0.5">Application gratuite & complète</p>
                    </div>
                  </div>
                  <button
                    onClick={handleDismiss}
                    className="h-7 w-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors shrink-0 mt-0.5"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {features.map(f => (
                    <div key={f.label} className="flex flex-col items-center text-center p-3 rounded-2xl bg-gray-50 border border-gray-100">
                      <div className="h-8 w-8 rounded-xl bg-white shadow-sm flex items-center justify-center mb-1.5 border border-gray-100">
                        {f.icon}
                      </div>
                      <p className="text-[11px] font-black text-gray-800">{f.label}</p>
                      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{f.sub}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleInstall}
                  className="w-full h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm shadow-lg shadow-violet-200"
                >
                  <Smartphone className="h-4 w-4" />
                  Ajouter à l'écran d'accueil
                </button>

                <button
                  onClick={handleDismiss}
                  className="w-full mt-2 py-2 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Non merci, continuer dans le navigateur
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
