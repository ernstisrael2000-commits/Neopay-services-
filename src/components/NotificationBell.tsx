import React, { useRef, useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { type RoleNotification } from '../hooks/useRealtimeNotifs';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from './ui/skeleton';

interface NotificationBellProps {
  notifications: RoleNotification[];
  unreadCount: number;
  loading?: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}

function formatTs(ts: RoleNotification['createdAt']): string {
  if (!ts) return '';
  try {
    return format(new Date(ts._seconds * 1000), 'dd MMM, HH:mm', { locale: fr });
  } catch { return ''; }
}

const typeIcon: Record<string, string> = {
  withdrawal_approved: '✅',
  withdrawal_rejected: '❌',
  sale_credit: '💰',
  commission: '🎯',
  deposit_approved: '✅',
  deposit_rejected: '❌',
  system: '🔔',
  info: 'ℹ️',
};

export default function NotificationBell({
  notifications,
  unreadCount,
  loading = false,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-gray-600 dark:text-gray-300" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-blue-600" />
                <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={() => { onMarkAllRead(); }}
                    className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 transition-colors"
                    title="Tout marquer comme lu"
                  >
                    <CheckCheck size={15} />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={() => { onClearAll(); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                    title="Tout supprimer"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
              {loading ? (
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {[1, 2, 3].map(i => <div key={i} className="flex items-center gap-3 p-3"><Skeleton className="h-9 w-9 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-3/5 rounded-full" /><Skeleton className="h-2.5 w-4/5 rounded-full" /></div></div>)}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Bell size={28} className="text-gray-200 dark:text-gray-700" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">Aucune notification</p>
                </div>
              ) : (
                notifications.slice(0, 30).map((n) => (
                  <motion.button
                    key={n.id}
                    layout
                    onClick={() => { if (!n.read) onMarkRead(n.id); }}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60 flex gap-3 items-start ${
                      !n.read ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <span className="text-xl mt-0.5 shrink-0" role="img">
                      {typeIcon[n.type] || '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-sm font-medium leading-tight truncate ${
                          !n.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      {n.createdAt && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">
                          {formatTs(n.createdAt)}
                        </p>
                      )}
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
