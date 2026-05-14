'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, isOverdue, isDeadlineSoon } from '@/lib/utils'
import { STATUS_CONFIG, DEPT_BADGE_CONFIG } from '@/types/database'
import { exportTasksToExcel } from '@/lib/export-excel'
import type { CoordinationTaskWithRelations, Department } from '@/types/database'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { CheckCircle2, Clock, XCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn as clsx } from '@/lib/utils'

interface DeptReport {
  dept: Department
  tasks: CoordinationTaskWithRelations[]
  total: number
  done: number
  inProgress: number
  overdue: number
  pending: number
  paused: number
  waiting: number
  rate: number
  avgProgress: number
}

const PIE_COLORS = ['#22c55e', '#f59e0b', '#e2e8f0', '#ef4444', '#94a3b8', '#3b82f6']

export default function TienDoPage() {
  const [tasks, setTasks] = useState<CoordinationTaskWithRelations[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDept, setSelectedDept] = useState<string>('all')
  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')

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
      .order('due_date', { ascending: true, nullsFirst: false })

    if (depts) setDepartments(depts as Department[])
    if (taskData) setTasks(taskData as unknown as CoordinationTaskWithRelations[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Per-dept reports ──────────────────────────────────────────────────────
  const deptReports = useMemo((): DeptReport[] => {
    return departments
      .filter((d) => d.code !== 'BDH')
      .map((dept) => {
        const deptTasks = tasks.filter((t) => t.execute_department_id === dept.id)
        const done      = deptTasks.filter((t) => t.status === 'da_hoan_thanh').length
        const inProgress= deptTasks.filter((t) => t.status === 'dang_trien_khai').length
        const overdue   = deptTasks.filter((t) => t.status === 'qua_han' || isOverdue(t.due_date)).length
        const pending   = deptTasks.filter((t) => t.status === 'chua_hoan_thanh').length
        const paused    = deptTasks.filter((t) => t.status === 'tam_dung').length
        const waiting   = deptTasks.filter((t) => t.status === 'cho_phoi_hop').length
        const rate      = deptTasks.length > 0 ? Math.round((done / deptTasks.length) * 100) : 0
        const avgProgress = deptTasks.length > 0
          ? Math.round(deptTasks.reduce((s, t) => s + (t.progress_percent ?? 0), 0) / deptTasks.length)
          : 0
        return { dept, tasks: deptTasks, total: deptTasks.length, done, inProgress, overdue, pending, paused, waiting, rate, avgProgress }
      })
      .filter((r) => r.total > 0)
  }, [tasks, departments])

  // ── Bar chart data ────────────────────────────────────────────────────────
  const barData = useMemo(() => deptReports.map((r) => ({
    name: r.dept.code,
    'Đã xong':   r.done,
    'Đang làm':  r.inProgress,
    'Chưa làm':  r.pending,
    'Quá hạn':   r.overdue,
    'Tạm dừng':  r.paused,
  })), [deptReports])

  // ── Pie chart data (overall) ──────────────────────────────────────────────
  const pieData = useMemo(() => {
    const total      = tasks.length
    const done       = tasks.filter((t) => t.status === 'da_hoan_thanh').length
    const inProgress = tasks.filter((t) => t.status === 'dang_trien_khai').length
    const pending    = tasks.filter((t) => t.status === 'chua_hoan_thanh').length
    const overdue    = tasks.filter((t) => t.status === 'qua_han' || isOverdue(t.due_date)).length
    const paused     = tasks.filter((t) => t.status === 'tam_dung').length
    const waiting    = tasks.filter((t) => t.status === 'cho_phoi_hop').length
    return [
      { name: 'Đã xong',   value: done       },
      { name: 'Đang làm',  value: inProgress  },
      { name: 'Chưa làm',  value: pending     },
      { name: 'Quá hạn',   value: overdue     },
      { name: 'Tạm dừng',  value: paused      },
      { name: 'Chờ PH',    value: waiting     },
    ].filter((d) => d.value > 0)
  }, [tasks])

  // ── Selected dept detail ──────────────────────────────────────────────────
  const activeDeptReport = selectedDept === 'all'
    ? null
    : deptReports.find((r) => r.dept.code === selectedDept) ?? null

  const displayTasks = useMemo(() => {
    const base = activeDeptReport ? activeDeptReport.tasks : tasks
    if (statusFilter === 'all') return base
    return base.filter((t) => t.status === statusFilter)
  }, [activeDeptReport, tasks, statusFilter])

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Báo cáo tiến độ phòng ban"
        onExport={() => exportTasksToExcel(displayTasks, 'bao-cao-tien-do')}
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Đang tải...</div>
        ) : (
          <>
            {/* ── Top: Charts ── */}
            <div className="grid grid-cols-3 gap-5">
              {/* Bar chart */}
              <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Phân bổ công việc theo phòng ban</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="Đã xong"  stackId="a" fill="#22c55e" />
                    <Bar dataKey="Đang làm" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Chưa làm" stackId="a" fill="#e2e8f0" />
                    <Bar dataKey="Quá hạn"  stackId="a" fill="#ef4444" radius={[4,4,0,0]} />
                    <Bar dataKey="Tạm dừng" stackId="a" fill="#94a3b8" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 justify-center flex-wrap">
                  {[
                    { color: '#22c55e', label: 'Đã xong' },
                    { color: '#f59e0b', label: 'Đang làm' },
                    { color: '#e2e8f0', label: 'Chưa làm' },
                    { color: '#ef4444', label: 'Quá hạn' },
                    { color: '#94a3b8', label: 'Tạm dừng' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
                      <span className="text-[11px] text-gray-500">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pie chart */}
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Tổng quan ({tasks.length} CV)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="45%" outerRadius={75} dataKey="value" label={false} labelLine={false} fontSize={10}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Filter bar ── */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-gray-500">Lọc theo phòng:</span>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedDept('all')}
                  className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    selectedDept === 'all' ? 'bg-[#16A34A] text-white border-[#16A34A]' : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                  )}
                >
                  Tất cả ({tasks.length})
                </button>
                {deptReports.map((r) => {
                  const badge = DEPT_BADGE_CONFIG[r.dept.code] ?? 'bg-gray-50 text-gray-700 border-gray-200'
                  return (
                    <button
                      key={r.dept.code}
                      onClick={() => setSelectedDept(r.dept.code)}
                      className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                        selectedDept === r.dept.code ? 'ring-2 ring-blue-400 ' + badge : badge + ' hover:opacity-80'
                      )}
                    >
                      {r.dept.code} ({r.total})
                      {r.overdue > 0 && <span className="ml-1 text-red-600">⚠{r.overdue}</span>}
                    </button>
                  )
                })}
              </div>
              <div className="ml-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tất cả trạng thái</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Dept accordion cards ── */}
            <div className="space-y-3">
              {(activeDeptReport ? [activeDeptReport] : deptReports).map((r) => {
                const badge = DEPT_BADGE_CONFIG[r.dept.code] ?? 'bg-gray-50 text-gray-700 border-gray-200'
                const isExpanded = expandedDept === r.dept.code
                const barColor = r.overdue > 0 ? 'bg-red-500' : r.rate === 100 ? 'bg-green-500' : r.rate >= 50 ? 'bg-amber-400' : 'bg-blue-400'
                const filteredDeptTasks = statusFilter === 'all' ? r.tasks : r.tasks.filter((t) => t.status === statusFilter)

                return (
                  <div key={r.dept.code} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    {/* Card header */}
                    <button
                      className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedDept(isExpanded ? null : r.dept.code)}
                    >
                      <span className={cn('inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold w-28 justify-center flex-shrink-0', badge)}>
                        {r.dept.name}
                      </span>

                      {/* Progress bar */}
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">{r.total} công việc · TB {r.avgProgress}%</span>
                          <span className={cn('font-bold', r.rate === 100 ? 'text-green-600' : r.overdue > 0 ? 'text-red-600' : 'text-gray-700')}>
                            {r.rate}% hoàn thành
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${r.rate}%` }} />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                        <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" />{r.done}</span>
                        <span className="flex items-center gap-1 text-amber-600"><Clock className="h-3.5 w-3.5" />{r.inProgress}</span>
                        <span className={cn('flex items-center gap-1', r.overdue > 0 ? 'text-red-600 font-bold' : 'text-gray-400')}>
                          <XCircle className="h-3.5 w-3.5" />{r.overdue}
                        </span>
                        {r.overdue > 0 && (
                          <span className="bg-red-100 text-red-700 text-[10px] font-bold rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" />Cần xử lý
                          </span>
                        )}
                      </div>

                      {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                    </button>

                    {/* Expanded task list */}
                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        {filteredDeptTasks.length === 0 ? (
                          <p className="text-center text-gray-400 text-sm py-6">Không có công việc phù hợp.</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-50 bg-gray-50/60">
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 w-8">#</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Tên công việc</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 w-[100px]">Deadline</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 w-[120px]">Tiến độ</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 w-[140px]">Trạng thái</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 w-[120px]">Người xử lý</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredDeptTasks.map((task, idx) => {
                                const statusCfg = STATUS_CONFIG[task.status]
                                const over = task.status === 'qua_han' || isOverdue(task.due_date)
                                const soon = isDeadlineSoon(task.due_date)
                                return (
                                  <tr key={task.id} className="border-b border-gray-50 hover:bg-blue-50/20">
                                    <td className="px-4 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                                    <td className="px-4 py-2.5">
                                      <div className="font-medium text-gray-900 text-xs line-clamp-1">{task.title}</div>
                                      {task.task_group && <div className="text-[10px] text-gray-400">{task.task_group}</div>}
                                    </td>
                                    <td className={cn('px-4 py-2.5 text-xs', over ? 'text-red-600 font-semibold' : soon ? 'text-orange-500 font-medium' : 'text-gray-600')}>
                                      {formatDate(task.due_date)}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <div className="flex items-center gap-1.5">
                                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                          <div
                                            className={cn('h-full rounded-full', task.progress_percent === 100 ? 'bg-green-500' : task.progress_percent >= 50 ? 'bg-amber-400' : 'bg-blue-400')}
                                            style={{ width: `${task.progress_percent}%` }}
                                          />
                                        </div>
                                        <span className="text-[10px] text-gray-500 w-7 text-right">{task.progress_percent}%</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium', statusCfg.color)}>
                                        <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.dot)} />
                                        {statusCfg.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-gray-600">
                                      {task.assignee?.full_name ?? <span className="text-gray-300">—</span>}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
