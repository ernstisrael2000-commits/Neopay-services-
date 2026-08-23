import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getFCMToken, onForegroundMessage } from '../lib/firebase-messaging';

export type FcmRole = 'client' | 'affiliate' | 'agent' | 'teacher' | 'admin';

export function useUniversalFCM(role: FcmRole, userId: string | null) {
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !role) return;
    const key = role === 'client' ? userId : `${role}_${userId}`;
    if (registeredRef.current === key) return;
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    let cancelled = false;

    (async () => {
      try {
        const token = await getFCMToken();
        if (!token || cancelled) return;
        const res = await fetch('/api/fcm/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, userId, token }),
        });
        if (res.ok) registeredRef.current = key;
      } catch (e) {
        console.warn('[FCM] Enregistrement token échoué:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [role, userId]);

  useEffect(() => {
    if (userId || !registeredRef.current) return;
    const prevKey = registeredRef.current;
    fetch(`/api/fcm/unregister/${encodeURIComponent(prevKey)}`, { method: 'DELETE' }).catch(() => {});
    registeredRef.current = null;
  }, [userId]);

  useEffect(() => {
    const unsub = onForegroundMessage((payload) => {
      const title = payload?.notification?.title || 'Solutionpam';
      const body  = payload?.notification?.body  || '';
      if (body) toast(title, { description: body, duration: 7000 });
      else toast(title, { duration: 5000 });
    });
    return unsub;
  }, []);
}
