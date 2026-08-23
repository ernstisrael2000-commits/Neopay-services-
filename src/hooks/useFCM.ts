import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getFCMToken, onForegroundMessage } from '../lib/firebase-messaging';

export function useFCM(clientId: string | null) {
  const registeredRef = useRef<string | null>(null);

  // Register FCM token when client logs in / changes
  useEffect(() => {
    if (!clientId) return;
    if (registeredRef.current === clientId) return;
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
          body: JSON.stringify({ clientId, token }),
        });
        if (res.ok) {
          registeredRef.current = clientId;
        }
      } catch (e) {
        console.warn('[FCM] Enregistrement token échoué:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [clientId]);

  // Unregister when client logs out
  useEffect(() => {
    if (clientId || !registeredRef.current) return;
    const prevClientId = registeredRef.current;
    fetch(`/api/fcm/unregister/${prevClientId}`, { method: 'DELETE' }).catch(() => {});
    registeredRef.current = null;
  }, [clientId]);

  // Handle foreground messages as toasts
  useEffect(() => {
    const unsub = onForegroundMessage((payload) => {
      const title = payload?.notification?.title || 'Solutionpam';
      const body  = payload?.notification?.body  || '';
      if (body) {
        toast(title, { description: body, duration: 7000 });
      } else {
        toast(title, { duration: 5000 });
      }
    });
    return unsub;
  }, []);
}
