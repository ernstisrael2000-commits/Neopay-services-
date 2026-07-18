/**
 * SettingsContext — single Firestore listener for settings/global.
 *
 * Problem: useSettings() was called in 15+ components (App, Navbar, BottomNav,
 * FormationsNavbar, AdminDashboard, AgentDashboard, …). Each call created its own
 * onSnapshot listener on the same document = N redundant listeners.
 *
 * Solution: one provider at the root, every consumer reads from context = 1 listener total.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cacheGet, cacheSet } from '../lib/localCache';
import { AppSettings } from '../types';

interface SettingsCtxValue {
  settings: AppSettings | null;
  loading: boolean;
}

const SettingsContext = createContext<SettingsCtxValue>({
  settings: null,
  loading: true,
});

/** Wrap the app root with this once. */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const cached = cacheGet<AppSettings>('settings_global');
  const [settings, setSettings] = useState<AppSettings | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as AppSettings;
          setSettings(data);
          cacheSet('settings_global', data, 30 * 60 * 1000); // 30 min TTL
        }
        setLoading(false);
      },
      () => { setLoading(false); },
    );
    return () => unsubscribe();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

/** Use this instead of useSettings() in any component inside <SettingsProvider>. */
export function useSettingsCtx(): SettingsCtxValue {
  return useContext(SettingsContext);
}
