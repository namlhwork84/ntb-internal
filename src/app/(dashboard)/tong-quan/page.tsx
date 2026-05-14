'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, isDeadlineSoon, isOverdue } from '@/lib/utils'
import { STATUS_CONFIG, DEPT_BADGE_CONFIG } from '@/types/database'
import type { CoordinationTaskWithRelations, Department, Profile } from '@/types/database'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  AlertTriangle, CheckCircle2, Clock, TrendingUp, ArrowRight,
  GitMerge, ListTodo, XCircle,
} from 'lucide-react'

interface DeptStats {
  dept: Department
  total: number
  done: number
  inProgress: number
  overdue: number
  pending: number
  rate: number
  soonTasks: CoordinationTaskWithRelations[]
  overdueTasks: CoordinationTaskWithRelations[]
}

export default function TongQuanPage() {
  const [tasks, setTasks] = useState<CoordinationTaskWithRelations[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: depts } = await supabase.from('departments').select('*').order('code')
    if (depts) setDepartments(depts as Department[])

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof) setCurrentProfile(prof as Profile)

    }

    const { data: taskData } = await supabase
      .from('coordination_tasks')
      .select(`
        *,
        execute_department:departments!execute_department_id(*),
        request_department:departments!request_department_id(*),
        assignee:profiles!assignee_id(*),
        request_user:profiles!request_user_id(*)
      `)
      .order('due_date', { ascending: true, nullsFirst: false })

    if (taskData) setTasks(taskData as unknown as CoordinationTaskWithRelations[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Global KPI ─────────────────────────────────────────────────────────────
  const globalKpi = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((t) => t.status === 'da_hoan_thanh').length
    const inProgress = tasks.filter((t) => t.status === 'dang_trien_khai').length
    const overdue = tasks.filter((t) => t.status === 'qua_han' || isOverdue(t.due_date)).length
    const soon = tasks.filter((t) => isDeadlineSoon(t.due_date) && t.status !== 'da_hoan_thanh').length
    const rate = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, done, inProgress, overdue, soon, rate }
  }, [tasks])

  // ── Per-department stats (as executing dept) ────────────────────────────────
  const deptStats = useMemo((): DeptStats[] => {
    return departments
      .filter((d) => d.code !== 'BDH') // BDH không thực hiện task
      .map((dept) => {
        const deptTasks = tasks.filter((t) => t.execute_department_id === dept.id)
        const done = deptTasks.filter((t) => t.status === 'da_hoan_thanh').length
        const inProgress = deptTasks.filter((t) => t.status === 'dang_trien_khai').length
        const overdue = deptTasks.filter((t) => t.status === 'qua_han' || isOverdue(t.due_date)).length
        const pending = deptTasks.filter((t) => t.status === 'chua_hoan_thanh').length
        const rate = deptTasks.length > 0 ? Math.round((done / deptTasks.length) * 100) : 0
        const overdueTasks = deptTasks.filter((t) => t.status === 'qua_han' || isOverdue(t.due_date))
        const soonTasks = deptTasks.filter((t) => isDeadlineSoon(t.due_date) && t.status !== 'da_hoan_thanh' && !isOverdue(t.due_date))
        return { dept, total: deptTasks.length, done, inProgress, overdue, pending, rate, overdueTasks, soonTasks }
      })
      .filter((s) => s.total > 0) // Ẩn dept không có task
      .sort((a, b) => b.overdue - a.overdue || b.total - a.total)
  }, [tasks, departments])

  // ── Alert list: overdue + due soon ─────────────────────────────────────────
  const alertTasks = useMemo(() => {
    return tasks.filter(
      (t) => (t.status === 'qua_han' || isOverdue(t.due_date) || isDeadlineSoon(t.due_date)) &&
             t.status !== 'da_hoan_thanh'
    ).slice(0, 20)
  }, [tasks])

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return deptStats.map((s) => ({
      name: s.dept.code,
      'Đã xong': s.done,
      'Đang làm': s.inProgress,
      'Chưa làm': s.pending,
      'Quá hạn': s.overdue,
    }))
  }, [deptStats])

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Tổng quan quản trị"
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            Đang tải dữ liệu...
          </div>
        ) : (
          <>
            {/* ── Global KPI row ── */}
            <div className="grid grid-cols-6 gap-4">
              <GlobalKpi icon={<ListTodo className="h-5 w-5" />}  label="Tổng công việc"    value={globalKpi.total}       color="blue"   />
              <GlobalKpi icon={<CheckCircle2 className="h-5 w-5" />} label="Đã hoàn thành" value={globalKpi.done}        color="green"  />
              <GlobalKpi icon={<Clock className="h-5 w-5" />}     label="Đang triển khai"   value={globalKpi.inProgress}  color="amber"  />
              <GlobalKpi icon={<XCircle className="h-5 w-5" />}   label="Quá hạn"          value={globalKpi.overdue}     color="red"    />
              <GlobalKpi icon={<AlertTriangle className="h-5 w-5" />} label="Sắp đến hạn"  value={globalKpi.soon}        color="orange" />
              <GlobalKpi icon={<TrendingUp className="h-5 w-5" />} label="Tỉ lệ hoàn thành" value={`${globalKpi.rate}%`} color="purple" />
            </div>

            {/* ── Main content: dept cards + alert list ── */}
            <div className="grid grid-cols-3 gap-6">

              {/* Department cards — 2/3 width */}
              <div className="col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700">Tiến độ theo phòng ban (đang thực hiện)</h2>
                  <Link href="/phoi-hop" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    Xem chi tiết <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {deptStats.map((s) => (
                    <DeptCard key={s.dept.id} stats={s} />
                  ))}
                </div>

                {/* Bar chart */}
                {chartData.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                      Phân bổ trạng thái theo phòng ban
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          cursor={{ fill: '#f1f5f9' }}
                        />
                        <Bar dataKey="Đã xong"   stackId="a" fill="#22c55e" radius={[0,0,0,0]} />
                        <Bar dataKey="Đang làm"  stackId="a" fill="#f59e0b" />
                        <Bar dataKey="Chưa làm"  stackId="a" fill="#e2e8f0" />
                        <Bar dataKey="Quá hạn"   stackId="a" fill="#ef4444" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex items-center gap-4 mt-2 justify-center">
                      {[
                        { color: '#22c55e', label: 'Đã xong' },
                        { color: '#f59e0b', label: 'Đang làm' },
                        { color: '#e2e8f0', label: 'Chưa làm' },
                        { color: '#ef4444', label: 'Quá hạn' },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
                          <span className="text-[11px] text-gray-500">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Alert panel — 1/3 width */}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Cảnh báo cần xử lý
                  {alertTasks.length > 0 && (
                    <span className="ml-auto bg-red-100 text-red-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">
                      {alertTasks.length}
                    </span>
                  )}
                </h2>

                {alertTasks.length === 0 ? (
                  <div className="rounded-xl border border-green-100 bg-green-50 p-6 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-sm text-green-700 font-medium">Không có cảnh báo</p>
                    <p className="text-xs text-green-500 mt-0.5">Tất cả công việc đúng tiến độ</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alertTasks.map((task) => {
                      const isOver = task.status === 'qua_han' || isOverdue(task.due_date)
                      const deptCode = task.execute_department?.code ?? ''
                      const badge = DEPT_BADGE_CONFIG[deptCode] ?? 'bg-gray-50 text-gray-700 border-gray-200'
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            'rounded-lg border p-3 text-xs',
                            isOver
                              ? 'border-red-200 bg-red-50'
                              : 'border-orange-200 bg-orange-50'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span className={cn(
                              'inline-flex items-center rounded border px-1.5 py-0.5 font-semibold flex-shrink-0',
                              badge
                            )}>
                              {deptCode || '?'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                'font-medium line-clamp-2 leading-snug',
                                isOver ? 'text-red-800' : 'text-orange-800'
                              )}>
                                {task.title}
                              </p>
                              <p className={cn(
                                'mt-0.5',
                                isOver ? 'text-red-600' : 'text-orange-600'
                              )}>
                                {isOver ? '⚠ Quá hạn' : '⏰ Sắp đến hạn'}
                                {task.due_date && ` — ${formatDate(task.due_date)}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <Link
                      href="/phoi-hop"
                      className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:underline pt-1"
                    >
                      Xem tất cả trong bảng <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}

                {/* Quick links */}
                <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Truy cập nhanh</p>
                  {[
                    { href: '/phoi-hop', label: 'Phối hợp liên phòng ban', icon: GitMerge, count: globalKpi.total },
                    { href: '/cong-viec', label: 'Công việc của tôi', icon: ListTodo, count: null },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      >
                        <Icon className="h-4 w-4 text-gray-400" />
                        <span className="flex-1">{item.label}</span>
                        {item.count !== null && (
                          <span className="text-xs text-gray-400">{item.count}</span>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const GLOBAL_COLORS = {
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-500',   val: 'text-blue-700'   },
  green:  { bg: 'bg-green-50',  icon: 'text-green-500',  val: 'text-green-700'  },
  amber:  { bg: 'bg-amber-50',  icon: 'text-amber-500',  val: 'text-amber-700'  },
  red:    { bg: 'bg-red-50',    icon: 'text-red-500',    val: 'text-red-700'    },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-500', val: 'text-orange-700' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-500', val: 'text-purple-700' },
}

function GlobalKpi({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: keyof typeof GLOBAL_COLORS
}) {
  const c = GLOBAL_COLORS[color]
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0', c.bg)}>
        <span className={c.icon}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-500 leading-tight">{label}</p>
        <p className={cn('text-xl font-bold mt-0.5 leading-tight', c.val)}>{value}</p>
      </div>
    </div>
  )
}

function DeptCard({ stats }: { stats: DeptStats }) {
  const { dept, total, done, inProgress, overdue, rate } = stats
  const badgeClass = DEPT_BADGE_CONFIG[dept.code] ?? 'bg-gray-50 text-gray-700 border-gray-200'

  const barColor = overdue > 0
    ? 'bg-red-500'
    : rate === 100
    ? 'bg-green-500'
    : rate >= 50
    ? 'bg-amber-400'
    : 'bg-blue-400'

  return (
    <Link
      href={`/phoi-hop`}
      className="block rounded-xl border border-gray-100 bg-white p-4 hover:border-blue-200 hover:shadow-sm transition-all group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className={cn(
          'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold',
          badgeClass
        )}>
          {dept.name}
        </span>
        <span className="text-xs text-gray-400 group-hover:text-blue-500 transition-colors">
          {total} CV
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-gray-500">Hoàn thành</span>
          <span className={cn(
            'font-bold',
            rate === 100 ? 'text-green-600' : rate >= 50 ? 'text-amber-600' : 'text-gray-700'
          )}>
            {rate}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${rate}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-gray-400">Xong</p>
          <p className="text-sm font-bold text-green-600">{done}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400">Đang làm</p>
          <p className="text-sm font-bold text-amber-600">{inProgress}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400">Quá hạn</p>
          <p className={cn('text-sm font-bold', overdue > 0 ? 'text-red-600' : 'text-gray-400')}>
            {overdue}
          </p>
        </div>
      </div>
    </Link>
  )
}
