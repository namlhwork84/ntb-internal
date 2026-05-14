'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { NotificationPanel } from './NotificationPanel'

interface HeaderProps {
  title: string
  subtitle?: string
  onExport?: () => void
  onCreateTask?: () => void
}

export function Header({ title, subtitle, onExport, onCreateTask }: HeaderProps) {
  const now = new Date()
  const displaySubtitle = subtitle ?? `Tháng ${format(now, 'MM/yyyy')}`

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Trái: Title */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500">{displaySubtitle}</p>
      </div>

      {/* Phải: Actions */}
      <div className="flex items-center gap-3">
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4" />
            Xuất Excel
          </Button>
        )}
        {onCreateTask && (
          <Button size="sm" onClick={onCreateTask}>
            + Tạo yêu cầu
          </Button>
        )}

        <NotificationPanel />
      </div>
    </header>
  )
}
