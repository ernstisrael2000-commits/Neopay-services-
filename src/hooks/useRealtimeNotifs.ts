import { useState, useEffect, useCallback, useRef } from 'react';

export type NotifRole = 'client' | 'affiliate' | 'agent' | 'teacher' | 'admin';

export interface RoleNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt?: { _seconds: number; _nanoseconds?: number } | null;
  [key: string]: any;
}

function toMs(ts: RoleNotification['createdAt']): number {
  if (!ts) return 0;
  return (ts._seconds || 0) * 1000;
}

export function useRealtimeNotifs(role: NotifRole, userId: string | null) {
  const [notifications, setNotifications] = useState<RoleNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const esRef = useRef<EventSource | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/${role}/notifications/${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const list: RoleNotification[] = (data.notifications || []);
      list.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
      setNotifications(list);
    } catch {
      // silent — offline / server not ready
    } finally {
      setLoading(false);
    }
  }, [role, userId]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!userId) return;

    const es = new EventSource(`/api/${role}/events/${encodeURIComponent(userId)}`);
    esRef.current = es;

    es.addEventListener('new_notification', (e: MessageEvent) => {
      try {
        const notif = JSON.parse(e.data) as RoleNotification;
        setNotifications(prev => {
          if (prev.some(n => n.id === notif.id)) return prev;
          return [notif, ...prev].slice(0, 50);
        });
      } catch {}
    });

    es.onerror = () => {};

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [role, userId]);

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await fetch(`/api/${role}/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {});
  }, [role]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await fetch(`/api/${role}/notifications/read-all/${encodeURIComponent(userId)}`, { method: 'PATCH' }).catch(() => {});
  }, [role, userId]);

  const clearAll = useCallback(async () => {
    if (!userId) return;
    setNotifications([]);
    await fetch(`/api/${role}/notifications/clear-all/${encodeURIComponent(userId)}`, { method: 'DELETE' }).catch(() => {});
  }, [role, userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, loading, markRead, markAllRead, clearAll, refresh: fetchNotifications };
}
