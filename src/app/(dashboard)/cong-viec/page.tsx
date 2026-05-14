'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { TaskDrawer } from '@/components/phoi-hop/TaskDrawer'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, isDeadlineSoon, isOverdue } from '@/lib/utils'
import { STATUS_CONFIG, DEPT_BADGE_CONFIG } from '@/types/database'
import { exportTasksToExcel } from '@/lib/export-excel'
import type { CoordinationTaskWithRelations, Department, Profile, TaskHistory } from '@/types/database'
import { CheckCircle2, Clock, AlertTriangle, ListTodo, TrendingUp } from 'lucide-react'

type ViewTab = 'mine' | 'dept'

export default function CongViecPage() {
  const [allTasks, setAllTasks] = useState<CoordinationTaskWithRelations[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<ViewTab>('mine')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [selectedTask, setSelectedTask] = useState<CoordinationTaskWithRelations | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [taskHistory, setTaskHistory] = useState<TaskHistory[]>([])

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: depts } = await supabase.from('departments').select('*').order('code')
    if (depts) setDepartments(depts as Department[])

    let me: Profile | null = null
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof) { me = prof as Profile; setCurrentProfile(me) }
    }

    if (!me) { setLoading(false); return }

    // Load tasks where user is assignee OR in execute/request department
    const { data: taskData } = await supabase
      .from('coordination_tasks')
      .select(`
        *,
        execute_department:departments!execute_department_id(*),
        request_department:departments!request_department_id(*),
        assignee:profiles!assignee_id(*),
        request_user:profiles!request_user_id(*)
      `)
      .or(
        `assignee_id.eq.${me.id},execute_department_id.eq.${me.department_id},request_department_id.eq.${me.department_id}`
      )
      .order('due_date', { ascending: true, nullsFirst: false })

    if (taskData) setAllTasks(taskData as unknown as CoordinationTaskWithRelations[])

    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleRowClick(task: CoordinationTaskWithRelations) {
    setSelectedTask(task)
    setDrawerOpen(true)
    const { data } = await supabase
      .from('task_history')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: false })
    setTaskHistory(data ?? [])
  }

  // Split: tasks assigned to me vs tasks in my dept
  const myTasks = useMemo(
    () => allTasks.filter((t) => t.assignee_id === currentProfile?.id),
    [allTasks, currentProfile]
  )
  const deptTasks = useMemo(
    () => allTasks.filter((t) => t.execute_department_id === currentProfile?.department_id),
    [allTasks, currentProfile]
  )

  const baseTasks = activeTab === 'mine' ? myTasks : deptTasks

  const filteredTasks = useMemo(() => {
    return baseTasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      return true
    })
  }, [baseTasks, search, statusFilter])

  // KPI stats
  const kpi = useMemo(() => {
    const total = baseTasks.length
    const done = baseTasks.filter((t) => t.status === 'da_hoan_thanh').length
    const inProgress = baseTasks.filter((t) => t.status === 'dang_trien_khai').length
    const overdue = baseTasks.filter((t) => t.status === 'qua_han' || isOverdue(t.due_date)).length
    const rate = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, done, inProgress, overdue, rate }
  }, [baseTasks])

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Công việc của tôi"
        onExport={() => exportTasksToExcel(filteredTasks, 'cong-viec-ca-nhan')}
      />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            Đang tải dữ liệu...
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-5 gap-4">
              <KpiCard icon={<ListTodo className="h-5 w-5" />} label="Tổng công việc" value={kpi.total} color="blue" />
              <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} label="Đã hoàn thành" value={kpi.done} color="green" />
              <KpiCard icon={<Clock className="h-5 w-5" />} label="Đang triển khai" value={kpi.inProgress} color="amber" />
              <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label="Quá hạn" value={kpi.overdue} color="red" />
              <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Tỉ lệ hoàn thành" value={`${kpi.rate}%`} color="purple" />
            </div>

            {/* View tabs + filters */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 flex-wrap">
              {/* Tab switcher */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                <button
                  className={cn(
                    'px-4 py-1.5 transition-colors',
                    activeTab === 'mine'
                      ? 'bg-[#16A34A] text-white font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                  onClick={() => setActiveTab('mine')}
                >
                  Được giao cho tôi
                  <span className={cn(
                    'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    activeTab === 'mine' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600'
                  )}>
                    {myTasks.length}
                  </span>
                </button>
                <button
                  className={cn(
                    'px-4 py-1.5 border-l border-gray-200 transition-colors',
                    activeTab === 'dept'
                      ? 'bg-[#16A34A] text-white font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                  onClick={() => setActiveTab('dept')}
                >
                  Của phòng ban
                  <span className={cn(
                    'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    activeTab === 'dept' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600'
                  )}>
                    {deptTasks.length}
                  </span>
                </button>
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder="Tìm công việc..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
              />

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tất cả trạng thái</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              {(search || statusFilter !== 'all') && (
                <button
                  className="text-xs text-blue-600 hover:underline ml-auto"
                  onClick={() => { setSearch(''); setStatusFilter('all') }}
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>

            {/* Task list */}
            {filteredTasks.length === 0 ? (
              <div className="rounded-xl border border-gray-100 bg-white p-12 text-center text-gray-400 text-sm">
                {baseTasks.length === 0
                  ? activeTab === 'mine'
                    ? 'Bạn chưa được giao công việc nào.'
                    : 'Phòng ban chưa có công việc nào.'
                  : 'Không có công việc phù hợp với bộ lọc.'}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-8">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[110px]">PB thực hiện</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tên công việc</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[160px]">Tiêu chuẩn</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[110px]">Deadline</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[130px]">Tiến độ</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[140px]">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task, idx) => {
                      const statusCfg = STATUS_CONFIG[task.status]
                      const deptCode = task.execute_department?.code ?? ''
                      const deptBadge = DEPT_BADGE_CONFIG[deptCode] ?? 'bg-gray-50 text-gray-700 border-gray-200'
                      const soon = isDeadlineSoon(task.due_date)
                      const over = isOverdue(task.due_date)
                      const deadlineClass = over || task.status === 'qua_han'
                        ? 'text-red-600 font-semibold'
                        : soon
                        ? 'text-orange-600 font-medium'
                        : 'text-gray-700'

                      return (
                        <tr
                          key={task.id}
                          className="border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors"
                          onClick={() => handleRowClick(task)}
                        >
                          <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                              deptBadge
                            )}>
                              {deptCode || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 line-clamp-1">{task.title}</div>
                            {task.task_group && (
                              <div className="text-xs text-gray-400 mt-0.5">{task.task_group}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs line-clamp-2">
                            {task.success_criteria ?? '—'}
                          </td>
                          <td className={cn('px-4 py-3 text-xs', deadlineClass)}>
                            {task.time_week && !task.due_date
                              ? <span className="text-gray-500">{task.time_week}</span>
                              : formatDate(task.due_date)
                            }
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    task.progress_percent === 100
                                      ? 'bg-green-500'
                                      : task.progress_percent >= 50
                                      ? 'bg-amber-400'
                                      : 'bg-blue-400'
                                  )}
                                  style={{ width: `${task.progress_percent}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">
                                {task.progress_percent}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
                              statusCfg.color
                            )}>
                              <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', statusCfg.dot)} />
                              {statusCfg.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <TaskDrawer
        task={selectedTask}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        history={taskHistory}
        currentProfile={currentProfile}
        onRefresh={async () => {
          await loadData()
          if (selectedTask) {
            const { data } = await supabase
              .from('task_history')
              .select('*')
              .eq('task_id', selectedTask.id)
              .order('created_at', { ascending: false })
            setTaskHistory(data ?? [])
          }
        }}
      />
    </div>
  )
}

// ── KPI Card component (local) ────────────────────────────────────────────────
const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-500',   val: 'text-blue-700'   },
  green:  { bg: 'bg-green-50',  icon: 'text-green-500',  val: 'text-green-700'  },
  amber:  { bg: 'bg-amber-50',  icon: 'text-amber-500',  val: 'text-amber-700'  },
  red:    { bg: 'bg-red-50',    icon: 'text-red-500',    val: 'text-red-700'    },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-500', val: 'text-purple-700' },
}

function KpiCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: keyof typeof COLOR_MAP
}) {
  const c = COLOR_MAP[color]
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0', c.bg)}>
        <span className={c.icon}>{icon}</span>
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={cn('text-2xl font-bold mt-0.5', c.val)}>{value}</p>
      </div>
    </div>
  )
}
