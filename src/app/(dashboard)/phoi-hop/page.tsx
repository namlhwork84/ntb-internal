'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { KpiCards } from '@/components/phoi-hop/KpiCards'
import { FilterBar } from '@/components/phoi-hop/FilterBar'
import { TaskTable } from '@/components/phoi-hop/TaskTable'
import { TaskDrawer } from '@/components/phoi-hop/TaskDrawer'
import { TaskForm } from '@/components/phoi-hop/TaskForm'
import { createClient } from '@/lib/supabase/client'
import { exportTasksToExcel } from '@/lib/export-excel'
import { cn } from '@/lib/utils'
import type {
  CoordinationTask,
  CoordinationTaskWithRelations,
  Department,
  Profile,
  TaskHistory,
} from '@/types/database'

type Perspective = 'all' | 'requesting' | 'executing'

const PERSPECTIVE_CONFIG: Record<Perspective, { label: string; desc: string }> = {
  all:        { label: 'Tất cả',           desc: 'Toàn bộ công việc phối hợp' },
  requesting: { label: 'Tôi đang yêu cầu', desc: 'Phòng tôi giao việc cho phòng khác' },
  executing:  { label: 'Tôi đang thực hiện', desc: 'Phòng khác giao việc cho phòng tôi' },
}

export default function PhoiHopPage() {
  const [tasks, setTasks] = useState<CoordinationTaskWithRelations[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Perspective
  const [perspective, setPerspective] = useState<Perspective>('all')
  // Admin-only: override dept to view as another dept
  const [viewAsDept, setViewAsDept] = useState<string>('') // dept id or ''

  // Filters
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [weekFilter, setWeekFilter] = useState('all')

  // Drawer
  const [selectedTask, setSelectedTask] = useState<CoordinationTaskWithRelations | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [taskHistory, setTaskHistory] = useState<TaskHistory[]>([])

  // Form
  const [formOpen, setFormOpen] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: depts } = await supabase.from('departments').select('*').order('code')
    const { data: profs } = await supabase.from('profiles').select('*').eq('is_active', true)

    if (depts) setDepartments(depts as Department[])
    if (profs) setProfiles(profs as Profile[])

    const { data: { user } } = await supabase.auth.getUser()
    if (user && profs) {
      const me = (profs as Profile[]).find((p) => p.id === user.id) ?? null
      setCurrentProfile(me)
    }

    const { data: taskData, error } = await supabase
      .from('coordination_tasks')
      .select(`
        *,
        execute_department:departments!execute_department_id(*),
        request_department:departments!request_department_id(*),
        assignee:profiles!assignee_id(*),
        request_user:profiles!request_user_id(*)
      `)
      .order('created_at', { ascending: false })

    if (!error && taskData) {
      setTasks(taskData as unknown as CoordinationTaskWithRelations[])
    }

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

  // Resolve which department ID to use for perspective filtering
  const activeDeptId = useMemo(() => {
    const isAdminOrBdi = currentProfile?.role === 'admin' || currentProfile?.role === 'bdi'
    if (isAdminOrBdi && viewAsDept) return viewAsDept
    return currentProfile?.department_id ?? null
  }, [currentProfile, viewAsDept])

  // Step 1: Apply perspective filter
  const perspectiveTasks = useMemo(() => {
    if (perspective === 'all' || !activeDeptId) return tasks
    if (perspective === 'requesting') {
      return tasks.filter((t) => t.request_department_id === activeDeptId)
    }
    return tasks.filter((t) => t.execute_department_id === activeDeptId)
  }, [tasks, perspective, activeDeptId])

  // Step 2: Apply search/filter on top
  const filteredTasks = useMemo(() => {
    return perspectiveTasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
      if (deptFilter !== 'all') {
        // When "requesting": filter by execute dept (who they asked)
        // When "executing": filter by request dept (who asked them)
        // When "all": filter by execute dept (existing behavior)
        const code = perspective === 'executing'
          ? t.request_department?.code
          : t.execute_department?.code
        if (code !== deptFilter) return false
      }
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (weekFilter !== 'all' && t.time_week !== weekFilter) return false
      return true
    })
  }, [perspectiveTasks, search, deptFilter, statusFilter, weekFilter, perspective])

  const isAdminOrBdi = currentProfile?.role === 'admin' || currentProfile?.role === 'bdi'
  const hasDeptId = !!currentProfile?.department_id

  // Active dept name for subtitle
  const activeDept = departments.find((d) => d.id === activeDeptId)
  const perspectiveDesc = perspective === 'all'
    ? 'Toàn bộ công việc phối hợp'
    : `${activeDept?.name ?? 'Phòng tôi'} — ${PERSPECTIVE_CONFIG[perspective].desc.split(' — ')[1] ?? PERSPECTIVE_CONFIG[perspective].desc}`

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Phối hợp liên phòng ban"
        subtitle={perspectiveDesc}
        onExport={() => exportTasksToExcel(filteredTasks)}
        onCreateTask={() => setFormOpen(true)}
      />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            Đang tải dữ liệu...
          </div>
        ) : (
          <>
            {/* KPI Cards — based on perspective tasks */}
            <KpiCards tasks={perspectiveTasks as unknown as CoordinationTask[]} />

            {/* Perspective Toggle + Admin dept switcher */}
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-4 flex-wrap">
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                {(Object.keys(PERSPECTIVE_CONFIG) as Perspective[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => { setPerspective(key); setDeptFilter('all') }}
                    className={cn(
                      'px-3 py-1.5 transition-colors border-r border-gray-200 last:border-r-0',
                      perspective === key
                        ? 'bg-[#16A34A] text-white font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {PERSPECTIVE_CONFIG[key].label}
                    {key !== 'all' && (
                      <span className={cn(
                        'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                        perspective === key ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600'
                      )}>
                        {key === 'requesting'
                          ? tasks.filter((t) => t.request_department_id === activeDeptId).length
                          : tasks.filter((t) => t.execute_department_id === activeDeptId).length
                        }
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Admin: view as another dept */}
              {isAdminOrBdi && perspective !== 'all' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Xem theo phòng:</span>
                  <select
                    value={viewAsDept || currentProfile?.department_id || ''}
                    onChange={(e) => setViewAsDept(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {!hasDeptId && perspective !== 'all' && (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  Tài khoản chưa được gán phòng ban — hiển thị toàn bộ
                </span>
              )}
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-4">
              <FilterBar
                search={search}
                onSearchChange={setSearch}
                deptFilter={deptFilter}
                onDeptChange={setDeptFilter}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                weekFilter={weekFilter}
                onWeekChange={setWeekFilter}
                departments={departments}
                deptFilterLabel={
                  perspective === 'executing' ? 'Phòng yêu cầu' : 'Phòng thực hiện'
                }
              />
              {(search || deptFilter !== 'all' || statusFilter !== 'all' || weekFilter !== 'all') && (
                <button
                  className="text-xs text-blue-600 hover:underline ml-auto whitespace-nowrap"
                  onClick={() => { setSearch(''); setDeptFilter('all'); setStatusFilter('all'); setWeekFilter('all') }}
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>

            {/* Task Table */}
            <TaskTable
              tasks={filteredTasks}
              departments={departments}
              onRowClick={handleRowClick}
              groupByField={perspective === 'executing' ? 'request' : 'execute'}
            />
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

      <TaskForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={loadData}
        departments={departments}
        profiles={profiles}
        currentProfile={currentProfile}
      />
    </div>
  )
}
