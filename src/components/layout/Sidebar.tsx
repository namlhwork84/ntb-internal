'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  GitMerge,
  ClipboardList,
  CalendarDays,
  BarChart3,
  AlertTriangle,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/database'

const NAV_ITEMS = [
  {
    section: 'TỔNG QUAN',
    items: [{ href: '/tong-quan', label: 'Tổng quan', icon: LayoutDashboard }],
  },
  {
    section: 'CÔNG VIỆC',
    items: [
      { href: '/phoi-hop', label: 'Phối hợp liên PB', icon: GitMerge },
      { href: '/cong-viec', label: 'Công việc của tôi', icon: ClipboardList },
      { href: '/ke-hoach', label: 'Kế hoạch tháng', icon: CalendarDays },
    ],
  },
  {
    section: 'BÁO CÁO',
    items: [
      { href: '/bao-cao/tien-do', label: 'Tiến độ phòng ban', icon: BarChart3 },
      { href: '/bao-cao/canh-bao', label: 'Cảnh báo deadline', icon: AlertTriangle },
    ],
  },
  {
    section: 'HỆ THỐNG',
    items: [{ href: '/admin', label: 'Quản lý người dùng', icon: Settings }],
  },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị viên',
  bdi: 'Ban Điều hành',
  truong_phong: 'Trưởng phòng',
  staff: 'Nhân viên',
  viewer: 'Xem',
}

interface SidebarProps {
  profile: Profile | null
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col"
      style={{ backgroundColor: 'var(--sidebar-bg)' }}
    >
      {/* ── Logo ── */}
      <div
        className="flex h-16 items-center gap-3 px-4"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        {/* NTB icon — vòng tròn xanh lá như logo */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0d5a1a 0%, #16A34A 50%, #60b8e0 100%)' }}
        >
          <div className="h-4 w-4 rounded-full bg-white/90" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight tracking-wide">NTB Pharma</p>
          <p className="text-[10px] leading-tight" style={{ color: 'var(--sidebar-text-dim)' }}>
            Quản trị nội bộ
          </p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map((group) => (
          <div key={group.section} className="mb-3">
            <p
              className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--sidebar-text-dim)' }}
            >
              {group.section}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'text-white shadow-sm'
                      : 'hover:text-white'
                  )}
                  style={
                    isActive
                      ? { backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }
                      : { color: 'var(--sidebar-text)' }
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                  }}
                >
                  <Icon
                    className="h-4 w-4 flex-shrink-0"
                    style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.5)' }}
                  />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── User info ── */}
      <div
        className="p-4"
        style={{ borderTop: '1px solid var(--sidebar-border)' }}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-white text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: 'var(--brand-green)' }}
          >
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {profile?.full_name ?? 'Người dùng'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--sidebar-text-dim)' }}>
              {ROLE_LABELS[profile?.role ?? 'staff']}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
