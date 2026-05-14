import { CheckCircle2, Clock, XCircle, TrendingUp, BarChart2, Flame } from 'lucide-react'
import type { CoordinationTask } from '@/types/database'
import { cn } from '@/lib/utils'

interface KpiCardsProps {
  tasks: CoordinationTask[]
}

export function KpiCards({ tasks }: KpiCardsProps) {
  const total       = tasks.length
  const done        = tasks.filter((t) => t.status === 'da_hoan_thanh').length
  const inProgress  = tasks.filter((t) => t.status === 'dang_trien_khai').length
  const overdue     = tasks.filter((t) => t.status === 'qua_han').length
  const rateByCount = total > 0 ? Math.round((done / total) * 100) : 0

  // % tiến độ TB = average progress_percent across all tasks
  const avgProgress = total > 0
    ? Math.round(tasks.reduce((sum, t) => sum + t.progress_percent, 0) / total)
    : 0

  return (
    <div className="grid grid-cols-3 gap-4 lg:grid-cols-6">
      {/* Tổng công việc */}
      <Card
        label="Tổng công việc"
        value={total}
        icon={<TrendingUp className="h-4 w-4" />}
        bg="bg-blue-50" iconColor="text-blue-600" valueColor="text-blue-700"
      />

      {/* Đã hoàn thành */}
      <Card
        label="Đã hoàn thành"
        value={done}
        icon={<CheckCircle2 className="h-4 w-4" />}
        bg="bg-green-50" iconColor="text-green-600" valueColor="text-green-700"
      />

      {/* Đang triển khai */}
      <Card
        label="Đang triển khai"
        value={inProgress}
        icon={<Clock className="h-4 w-4" />}
        bg="bg-amber-50" iconColor="text-amber-600" valueColor="text-amber-700"
      />

      {/* Quá hạn */}
      <Card
        label="Quá hạn"
        value={overdue}
        icon={<XCircle className="h-4 w-4" />}
        bg="bg-red-50" iconColor="text-red-600" valueColor="text-red-700"
        highlight={overdue > 0}
      />

      {/* Tỉ lệ hoàn thành — done / total */}
      <CardProgress
        label="Tỉ lệ hoàn thành"
        sublabel={`${done}/${total} task`}
        percent={rateByCount}
        icon={<Flame className="h-4 w-4" />}
        bg="bg-purple-50" iconColor="text-purple-600"
        barColor={rateByCount >= 80 ? 'bg-green-500' : rateByCount >= 50 ? 'bg-amber-500' : 'bg-red-400'}
        valueColor="text-purple-700"
      />

      {/* % Tiến độ TB — weighted average progress_percent */}
      <CardProgress
        label="% Tiến độ TB"
        sublabel="trung bình tất cả CV"
        percent={avgProgress}
        icon={<BarChart2 className="h-4 w-4" />}
        bg="bg-indigo-50" iconColor="text-indigo-600"
        barColor={avgProgress >= 80 ? 'bg-green-500' : avgProgress >= 50 ? 'bg-indigo-400' : 'bg-gray-300'}
        valueColor="text-indigo-700"
      />
    </div>
  )
}

// ── Simple count card ─────────────────────────────────────────────────────────
function Card({
  label, value, icon, bg, iconColor, valueColor, highlight,
}: {
  label: string; value: number; icon: React.ReactNode
  bg: string; iconColor: string; valueColor: string; highlight?: boolean
}) {
  return (
    <div className={cn(
      'rounded-xl border bg-white p-4 shadow-sm',
      highlight ? 'border-red-200' : 'border-gray-100'
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 leading-tight">{label}</p>
          <p className={cn('mt-1.5 text-2xl font-bold', valueColor)}>{value}</p>
        </div>
        <div className={cn('rounded-lg p-2 flex-shrink-0', bg)}>
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
    </div>
  )
}

// ── Progress-bar card ─────────────────────────────────────────────────────────
function CardProgress({
  label, sublabel, percent, icon, bg, iconColor, barColor, valueColor,
}: {
  label: string; sublabel: string; percent: number; icon: React.ReactNode
  bg: string; iconColor: string; barColor: string; valueColor: string
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 leading-tight">{label}</p>
          <p className={cn('mt-1 text-2xl font-bold', valueColor)}>{percent}%</p>
        </div>
        <div className={cn('rounded-lg p-2 flex-shrink-0', bg)}>
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-400 mt-1">{sublabel}</p>
    </div>
  )
}
