'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, daysUntilDue } from '@/lib/utils'
import { STATUS_CONFIG, DEPT_BADGE_CONFIG } from '@/types/database'
import type { CoordinationTaskWithRelations, Department } from '@/types/database'
import { AlertTriangle, Clock, Hourglass, ChevronUp, ChevronDown, User, Building2 } from 'lucide-react'

type SortField = 'days' | 'dept' | 'progress'
type SortDir = 'asc' | 'desc'

export default function CanhBaoPage() {
  const [tasks, setTasks] = useState<CoordinationTaskWithRelations[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [deptFilter, setDeptFilter] = useState('all')
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'days', dir: 'asc' })

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: depts } = await supabase.from('departments').select('*').order('code')
    const { data: taskData } = await supabase
      .from('coordination_tasks')
      .select(`
        *,
        execute_department:departments!execute_department_id(*),
        request_department:departments!request_department_id(*),
        assignee:profiles!assignee_id(*),
        request_user:profiles!request_user_id(*)
      `)
      .neq('status', 'da_hoan_thanh')
      .order('due_date', { ascending: true })

    if (depts) setDepartments(depts as Department[])
    if (taskData) setTasks(taskData as unknown as CoordinationTaskWithRelations[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const overdueTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!t.due_date) return false
      const days = daysUntilDue(t.due_date)
      return days !== null && days < 0
    })
  }, [tasks])

  const soonTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!t.due_date) return false
      const days = daysUntilDue(t.due_date)
      return days !== null && days >= 0 && days <= 3
    })
  }, [tasks])

  const waitingTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'cho_phoi_hop')
  }, [tasks])

  function applyFiltersAndSort(list: CoordinationTaskWithRelations[]) {
    let result = list
    if (deptFilter !== 'all') {
      result = result.filter(
        (t) => t.execute_department_id === deptFilter || t.request_department_id === deptFilter
      )
    }
    result = [...result].sort((a, b) => {
      let va = 0, vb = 0
      if (sort.field === 'days') {
        va = daysUntilDue(a.due_date) ?? 999
        vb = daysUntilDue(b.due_date) ?? 999
      } else if (sort.field === 'progress') {
        va = a.progress_percent
        vb = b.progress_percent
      } else if (sort.field === 'dept') {
        va = (a.execute_department?.code ?? '').charCodeAt(0)
        vb = (b.execute_department?.code ?? '').charCodeAt(0)
      }
      return sort.dir === 'asc' ? va - vb : vb - va
    })
    return result
  }

  function toggleSort(field: SortField) {
    setSort((s) => s.field === field
      ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: 'asc' }
    )
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sort.field !== field) return <ChevronUp className="h-3 w-3 text-gray-300" />
    return sort.dir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-blue-500" />
      : <ChevronDown className="h-3 w-3 text-blue-500" />
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Cảnh báo Deadline" subtitle="Theo dõi công việc quá hạn và sắp đến hạn" />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-4">
          <AlertCard
            icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
            label="Quá hạn"
            value={overdueTasks.length}
            bg="bg-red-50"
            border="border-red-200"
            textColor="text-red-700"
          />
          <AlertCard
            icon={<Clock className="h-5 w-5 text-orange-500" />}
            label="Sắp đến hạn (≤ 3 ngày)"
            value={soonTasks.length}
            bg="bg-orange-50"
            border="border-orange-200"
            textColor="text-orange-700"
          />
          <AlertCard
            icon={<Hourglass className="h-5 w-5 text-blue-500" />}
            label="Chờ phối hợp"
            value={waitingTasks.length}
            bg="bg-blue-50"
            border="border-blue-200"
            textColor="text-blue-700"
          />
        </div>

        {/* Dept filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Lọc phòng:</span>
          <button
            onClick={() => setDeptFilter('all')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              deptFilter === 'all'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            )}
          >
            Tất cả
          </button>
          {departments.map((d) => (
            <button
              key={d.id}
              onClick={() => setDeptFilter(d.id)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                deptFilter === d.id
                  ? 'bg-gray-900 text-white border-gray-900'
                  : cn('bg-white border-gray-200 hover:border-gray-400', DEPT_BADGE_CONFIG[d.code])
              )}
            >
              {d.code}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Đang tải...
          </div>
        ) : (
          <>
            {/* Overdue section */}
            <Section
              title="Quá hạn"
              icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
              badge={applyFiltersAndSort(overdueTasks).length}
              badgeColor="bg-red-100 text-red-700"
              emptyText="Không có công việc quá hạn"
              tasks={applyFiltersAndSort(overdueTasks)}
              isOverdue
              onToggleSort={toggleSort}
              SortIconEl={SortIcon}
            />

            {/* Soon section */}
            <Section
              title="Sắp đến hạn (trong 3 ngày)"
              icon={<Clock className="h-4 w-4 text-orange-500" />}
              badge={applyFiltersAndSort(soonTasks).length}
              badgeColor="bg-orange-100 text-orange-700"
              emptyText="Không có công việc sắp đến hạn"
              tasks={applyFiltersAndSort(soonTasks)}
              isOverdue={false}
              onToggleSort={toggleSort}
              SortIconEl={SortIcon}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ── Alert KPI card ────────────────────────────────────────────────────────────
function AlertCard({
  icon, label, value, bg, border, textColor,
}: {
  icon: React.ReactNode
  label: string
  value: number
  bg: string
  border: string
  textColor: string
}) {
  return (
    <div className={cn('rounded-xl border p-4 flex items-center gap-4', bg, border)}>
      <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={cn('text-2xl font-bold', textColor)}>{value}</p>
      </div>
    </div>
  )
}

// ── Task section ──────────────────────────────────────────────────────────────
function Section({
  title, icon, badge, badgeColor, emptyText, tasks, isOverdue, onToggleSort, SortIconEl,
}: {
  title: string
  icon: React.ReactNode
  badge: number
  badgeColor: string
  emptyText: string
  tasks: CoordinationTaskWithRelations[]
  isOverdue: boolean
  onToggleSort: (f: SortField) => void
  SortIconEl: React.FC<{ field: SortField }>
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
        {icon}
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', badgeColor)}>
          {badge}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-gray-500">
                <th className="px-4 py-2 text-left font-medium w-24">Mã CV</th>
                <th className="px-4 py-2 text-left font-medium">Tên công việc</th>
                <th
                  className="px-4 py-2 text-left font-medium cursor-pointer hover:text-gray-700 select-none"
                  onClick={() => onToggleSort('dept')}
                >
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> PB thực hiện <SortIconEl field="dept" />
                  </span>
                </th>
                <th className="px-4 py-2 text-left font-medium">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> Người xử lý
                  </span>
                </th>
                <th
                  className="px-4 py-2 text-left font-medium cursor-pointer hover:text-gray-700 select-none"
                  onClick={() => onToggleSort('days')}
                >
                  <span className="flex items-center gap-1">
                    Deadline <SortIconEl field="days" />
                  </span>
                </th>
                <th
                  className="px-4 py-2 text-left font-medium w-32 cursor-pointer hover:text-gray-700 select-none"
                  onClick={() => onToggleSort('progress')}
                >
                  <span className="flex items-center gap-1">
                    Tiến độ <SortIconEl field="progress" />
                  </span>
                </th>
                <th className="px-4 py-2 text-left font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tasks.map((task) => {
                const days = daysUntilDue(task.due_date)
                const daysLabel = days === null
                  ? '—'
                  : days < 0
                  ? `${Math.abs(days)} ngày trước`
                  : days === 0
                  ? 'Hôm nay'
                  : `Còn ${days} ngày`

                const deptCode = task.execute_department?.code ?? ''
                const statusCfg = (STATUS_CONFIG as Record<string, { label: string; color: string; dot: string }>)[task.status]

                return (
                  <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-gray-400">{task.code ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800 line-clamp-1">{task.title}</p>
                      {task.success_criteria && (
                        <p className="text-gray-400 line-clamp-1 mt-0.5">{task.success_criteria}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        DEPT_BADGE_CONFIG[deptCode] ?? 'bg-gray-50 text-gray-600 border-gray-200'
                      )}>
                        {deptCode || task.execute_department?.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {task.assignee?.full_name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="space-y-0.5">
                        <p className={cn(
                          'font-medium',
                          isOverdue ? 'text-red-600' : 'text-orange-600'
                        )}>
                          {formatDate(task.due_date)}
                        </p>
                        <p className={cn(
                          'text-[10px]',
                          isOverdue ? 'text-red-400' : 'text-orange-400'
                        )}>
                          {daysLabel}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              task.progress_percent >= 100 ? 'bg-green-500'
                              : task.progress_percent >= 60  ? 'bg-amber-500'
                              : 'bg-red-400'
                            )}
                            style={{ width: `${task.progress_percent}%` }}
                          />
                        </div>
                        <span className="text-gray-500 tabular-nums w-7 text-right">
                          {task.progress_percent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                        statusCfg?.color ?? 'bg-gray-50 text-gray-500 border-gray-200'
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg?.dot ?? 'bg-gray-400')} />
                        {statusCfg?.label ?? task.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
