'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types/database'
import {
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle2,
  User,
  RefreshCw,
  X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

const TYPE_CONFIG: Record<string, {
  icon: React.ElementType
  iconColor: string
  bg: string
}> = {
  overdue:       { icon: AlertTriangle, iconColor: 'text-red-500',    bg: 'bg-red-50'    },
  deadline_soon: { icon: Clock,         iconColor: 'text-orange-500', bg: 'bg-orange-50' },
  assigned:      { icon: User,          iconColor: 'text-blue-500',   bg: 'bg-blue-50'   },
  confirmed:     { icon: CheckCircle2,  iconColor: 'text-green-500',  bg: 'bg-green-50'  },
  reminder:      { icon: Bell,          iconColor: 'text-gray-400',   bg: 'bg-gray-50'   },
}

const DEFAULT_TYPE = { icon: Bell, iconColor: 'text-gray-400', bg: 'bg-gray-50' }

interface NotificationPanelProps {
  onCountChange?: (count: number) => void
}

export function NotificationPanel({ onCountChange }: NotificationPanelProps) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const unreadCount = notifications.filter((n) => !n.is_read).length

  // Notify parent of count changes
  useEffect(() => {
    onCountChange?.(unreadCount)
  }, [unreadCount, onCountChange])

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) setNotifications(data as Notification[])
    setLoading(false)
  }, [])

  // Initial load + poll every 60s
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function markAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('notifications') as any).update({ is_read: true }).eq('id', id)
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('notifications') as any).update({ is_read: true }).in('id', unreadIds)
  }

  async function dismissNotification(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('notifications') as any).delete().eq('id', id)
  }

  function handleBellClick() {
    setOpen((o) => !o)
    // Mark all as read when opening
    if (!open && unreadCount > 0) {
      // Small delay so user sees the badge first
      setTimeout(() => markAllAsRead(), 1500)
    }
  }

  const unread = notifications.filter((n) => !n.is_read)
  const read   = notifications.filter((n) => n.is_read)

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={handleBellClick}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-md transition-colors',
          open
            ? 'bg-blue-50 text-blue-600'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
        )}
        aria-label="Thông báo"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[380px] rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Thông báo</h3>
              {unreadCount > 0 && (
                <span className="bg-red-100 text-red-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {unreadCount} mới
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Đánh dấu tất cả đã đọc
                </button>
              )}
              <button
                onClick={fetchNotifications}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Tải lại"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[440px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Không có thông báo</p>
              </div>
            ) : (
              <>
                {/* Unread */}
                {unread.length > 0 && (
                  <div>
                    <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Chưa đọc</p>
                    </div>
                    {unread.map((n) => (
                      <NotifItem
                        key={n.id}
                        notif={n}
                        onRead={() => markAsRead(n.id)}
                        onDismiss={(e) => dismissNotification(n.id, e)}
                      />
                    ))}
                  </div>
                )}

                {/* Read */}
                {read.length > 0 && (
                  <div>
                    {unread.length > 0 && (
                      <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Đã đọc</p>
                      </div>
                    )}
                    {read.slice(0, 15).map((n) => (
                      <NotifItem
                        key={n.id}
                        notif={n}
                        onRead={() => markAsRead(n.id)}
                        onDismiss={(e) => dismissNotification(n.id, e)}
                      />
                    ))}
                    {read.length > 15 && (
                      <p className="text-center text-xs text-gray-400 py-3">
                        Còn {read.length - 15} thông báo cũ hơn
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Single notification item ──────────────────────────────────────────────────
function NotifItem({
  notif,
  onRead,
  onDismiss,
}: {
  notif: Notification
  onRead: () => void
  onDismiss: (e: React.MouseEvent) => void
}) {
  const cfg = TYPE_CONFIG[notif.type] ?? DEFAULT_TYPE
  const Icon = cfg.icon

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: vi })
    } catch {
      return ''
    }
  })()

  return (
    <div
      onClick={onRead}
      className={cn(
        'flex gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer group transition-colors hover:bg-gray-50/80',
        !notif.is_read && 'bg-blue-50/40'
      )}
    >
      {/* Icon */}
      <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', cfg.bg)}>
        <Icon className={cn('h-4 w-4', cfg.iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-xs leading-snug', !notif.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700')}>
            {notif.title}
          </p>
          <button
            onClick={onDismiss}
            className="text-gray-300 hover:text-gray-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
            title="Xóa thông báo"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {notif.message && (
          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
            {notif.message}
          </p>
        )}
        <p className="text-[10px] text-gray-400 mt-1">{timeAgo}</p>
      </div>

      {/* Unread dot */}
      {!notif.is_read && (
        <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
      )}
    </div>
  )
}
