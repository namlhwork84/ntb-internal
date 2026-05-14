'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { STATUS_CONFIG, DEPT_BADGE_CONFIG } from '@/types/database'
import type { Plan, Department, Profile, CoordinationTaskWithRelations } from '@/types/database'
import {
  CalendarDays, ChevronDown, ChevronUp, Plus, X,
  CheckCircle2, Clock, AlertTriangle, ListTodo,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const CURRENT_YEAR = new Date().getFullYear()
const QUARTERS = [1, 2, 3, 4]
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

const PLAN_TYPE_LABELS: Record<string, string> = {
  year: 'Cả năm',
  quarter: 'Quý',
  month: 'Tháng',
  week: 'Tuần',
}

interface PlanWithStats extends Plan {
  dept: Department | null
  owner: Profile | null
  taskCount: number
  doneCount: number
  overdueCount: number
  avgProgress: number
  tasks: CoordinationTaskWithRelations[]
}

// ── Form state ────────────────────────────────────────────────────────────────
interface PlanForm {
  title: string
  type: 'year' | 'quarter' | 'month' | 'week'
  year: number
  quarter: number | null
  month: number | null
  department_id: string
}

const DEFAULT_FORM: PlanForm = {
  title: '',
  type: 'month',
  year: CURRENT_YEAR,
  quarter: null,
  month: new Date().getMonth() + 1,
  department_id: '',
}

export default function KeHoachPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [tasks, setTasks] = useState<CoordinationTaskWithRelations[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState(CURRENT_YEAR)
  const [deptFilter, setDeptFilter] = useState('all')
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null)

  // Form
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<PlanForm>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: depts }, { data: profs }, { data: planData }, { data: taskData }] =
      await Promise.all([
        supabase.from('departments').select('*').order('code'),
        supabase.from('profiles').select('*').eq('is_active', true),
        supabase.from('plans').select('*').eq('year', yearFilter).order('type').order('quarter').order('month'),
        supabase.from('coordination_tasks').select(`
          *,
          execute_department:departments!execute_department_id(*),
          request_department:departments!request_department_id(*),
          assignee:profiles!assignee_id(*),
          request_user:profiles!request_user_id(*)
        `),
      ])

    if (depts) setDepartments(depts as Department[])
    if (profs) setProfiles(profs as Profile[])
    if (planData) setPlans(planData as Plan[])
    if (taskData) setTasks(taskData as unknown as CoordinationTaskWithRelations[])

    const { data: { user } } = await supabase.auth.getUser()
    if (user && profs) {
      const me = (profs as Profile[]).find((p) => p.id === user.id) ?? null
      setCurrentProfile(me)
    }

    setLoading(false)
  }, [yearFilter])

  useEffect(() => { loadData() }, [loadData])

  // Attach stats to plans
  const plansWithStats = useMemo<PlanWithStats[]>(() => {
    return plans.map((plan) => {
      const dept = departments.find((d) => d.id === plan.department_id) ?? null
      const owner = profiles.find((p) => p.id === plan.owner_id) ?? null
      const linked = tasks.filter((t) => t.plan_id === plan.id)
      const done = linked.filter((t) => t.status === 'da_hoan_thanh').length
      const overdue = linked.filter((t) => t.status === 'qua_han').length
      const avgProgress = linked.length > 0
        ? Math.round(linked.reduce((s, t) => s + t.progress_percent, 0) / linked.length)
        : 0
      return { ...plan, dept, owner, taskCount: linked.length, doneCount: done, overdueCount: overdue, avgProgress, tasks: linked }
    })
  }, [plans, departments, profiles, tasks])

  // Filtered + grouped by quarter
  const filtered = useMemo(() => {
    return plansWithStats.filter((p) =>
      deptFilter === 'all' || p.department_id === deptFilter || !p.department_id
    )
  }, [plansWithStats, deptFilter])

  const grouped = useMemo(() => {
    const map: Record<string, PlanWithStats[]> = { 'Cả năm': [], 'Quý 1': [], 'Quý 2': [], 'Quý 3': [], 'Quý 4': [] }
    for (const p of filtered) {
      if (p.type === 'year') { map['Cả năm'].push(p); continue }
      if (p.quarter) { map[`Quý ${p.quarter}`]?.push(p); continue }
      if (p.month) {
        const q = Math.ceil(p.month / 3)
        map[`Quý ${q}`]?.push(p)
      }
    }
    return map
  }, [filtered])

  // Unlinked tasks — for showing in right panel
  const unlinkedTasks = useMemo(() => {
    return tasks.filter((t) => !t.plan_id && t.status !== 'da_hoan_thanh').length
  }, [tasks])

  async function handleCreatePlan() {
    setFormError('')
    if (!form.title.trim()) { setFormError('Nhập tên kế hoạch'); return }
    if (form.type === 'quarter' && !form.quarter) { setFormError('Chọn quý'); return }
    if (form.type === 'month' && !form.month) { setFormError('Chọn tháng'); return }

    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('plans') as any).insert({
      title: form.title.trim(),
      type: form.type,
      year: form.year,
      quarter: form.type === 'quarter' ? form.quarter : form.type === 'month' ? Math.ceil((form.month ?? 1) / 3) : null,
      month: form.type === 'month' ? form.month : null,
      department_id: form.department_id || null,
      owner_id: currentProfile?.id ?? null,
      status: 'active',
    })

    if (error) { setFormError(error.message); setSaving(false); return }
    setForm(DEFAULT_FORM)
    setFormOpen(false)
    loadData()
    setSaving(false)
  }

  async function handleDeletePlan(id: string) {
    if (!confirm('Xóa kế hoạch này? Các công việc liên kết sẽ không bị xóa.')) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('plans') as any).delete().eq('id', id)
    loadData()
  }

  const yearOptions = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Kế hoạch"
        subtitle={`Năm ${yearFilter} — Quản lý kế hoạch theo quý/tháng`}
        onCreateTask={() => setFormOpen(true)}
      />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-4">
          <SummaryCard icon={<ListTodo className="h-4 w-4 text-blue-500" />}   label="Tổng kế hoạch"    value={plans.length}                                           color="blue"  />
          <SummaryCard icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} label="Đã hoàn thành" value={plansWithStats.filter((p) => p.doneCount === p.taskCount && p.taskCount > 0).length} color="green" />
          <SummaryCard icon={<Clock className="h-4 w-4 text-amber-500" />}     label="Đang triển khai"  value={plansWithStats.filter((p) => p.taskCount > 0 && p.doneCount < p.taskCount).length} color="amber" />
          <SummaryCard icon={<AlertTriangle className="h-4 w-4 text-orange-500" />} label="CV chưa gán KH" value={unlinkedTasks} color="orange" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {yearOptions.map((y) => (
              <button
                key={y}
                onClick={() => setYearFilter(y)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  yearFilter === y ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {y}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Phòng ban:</span>
            <button
              onClick={() => setDeptFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs border font-medium transition-colors',
                deptFilter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              )}
            >
              Tất cả
            </button>
            {departments.map((d) => (
              <button
                key={d.id}
                onClick={() => setDeptFilter(d.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs border font-medium transition-colors',
                  deptFilter === d.id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : cn('bg-white border-gray-200 hover:border-gray-400', DEPT_BADGE_CONFIG[d.code])
                )}
              >
                {d.code}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Đang tải...</div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-sm gap-3">
            <CalendarDays className="h-10 w-10 opacity-30" />
            <p>Chưa có kế hoạch nào cho năm {yearFilter}</p>
            <Button size="sm" onClick={() => setFormOpen(true)}>+ Tạo kế hoạch đầu tiên</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {(['Cả năm', 'Quý 1', 'Quý 2', 'Quý 3', 'Quý 4'] as const).map((group) => {
              const list = grouped[group] ?? []
              if (list.length === 0) return null
              return (
                <QuarterGroup
                  key={group}
                  title={group}
                  plans={list}
                  expandedPlan={expandedPlan}
                  onToggleExpand={(id) => setExpandedPlan((cur) => cur === id ? null : id)}
                  onDelete={handleDeletePlan}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Create Plan Dialog */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Tạo kế hoạch mới</h2>
              <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tên kế hoạch *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="VD: Kế hoạch MKT Tháng 5/2026"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Loại kế hoạch</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['year', 'quarter', 'month', 'week'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      className={cn(
                        'py-1.5 rounded-lg text-xs font-medium border transition-colors',
                        form.type === t ? 'bg-[#16A34A] text-white border-[#16A34A]' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
                      )}
                    >
                      {PLAN_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quarter selector */}
              {form.type === 'quarter' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quý *</label>
                  <div className="grid grid-cols-4 gap-2">
                    {QUARTERS.map((q) => (
                      <button
                        key={q}
                        onClick={() => setForm((f) => ({ ...f, quarter: q }))}
                        className={cn(
                          'py-1.5 rounded-lg text-xs font-medium border transition-colors',
                          form.quarter === q ? 'bg-[#16A34A] text-white border-[#16A34A]' : 'bg-white text-gray-600 border-gray-200'
                        )}
                      >
                        Q{q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Month selector */}
              {form.type === 'month' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tháng *</label>
                  <div className="grid grid-cols-6 gap-2">
                    {MONTHS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setForm((f) => ({ ...f, month: m }))}
                        className={cn(
                          'py-1.5 rounded-lg text-xs font-medium border transition-colors',
                          form.month === m ? 'bg-[#16A34A] text-white border-[#16A34A]' : 'bg-white text-gray-600 border-gray-200'
                        )}
                      >
                        T{m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Department */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phòng ban (tùy chọn)</label>
                <select
                  value={form.department_id}
                  onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Toàn công ty —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                  ))}
                </select>
              </div>

              {formError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>Hủy</Button>
              <Button size="sm" onClick={handleCreatePlan} disabled={saving}>
                {saving ? 'Đang tạo...' : 'Tạo kế hoạch'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({
  icon, label, value, color,
}: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
    green:  'bg-green-50 border-green-100 text-green-700',
    amber:  'bg-amber-50 border-amber-100 text-amber-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700',
  }
  return (
    <div className={cn('rounded-xl border p-4 flex items-center gap-3', colors[color])}>
      <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center shadow-sm">{icon}</div>
      <div>
        <p className="text-[11px] text-gray-500">{label}</p>
        <p className={cn('text-xl font-bold')}>{value}</p>
      </div>
    </div>
  )
}

// ── Quarter group ─────────────────────────────────────────────────────────────
function QuarterGroup({
  title, plans, expandedPlan, onToggleExpand, onDelete,
}: {
  title: string
  plans: PlanWithStats[]
  expandedPlan: string | null
  onToggleExpand: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            expanded={expandedPlan === plan.id}
            onToggle={() => onToggleExpand(plan.id)}
            onDelete={() => onDelete(plan.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({
  plan, expanded, onToggle, onDelete,
}: {
  plan: PlanWithStats
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const rate = plan.taskCount > 0 ? Math.round((plan.doneCount / plan.taskCount) * 100) : 0
  const periodLabel = plan.type === 'year'
    ? `Năm ${plan.year}`
    : plan.type === 'quarter'
    ? `Quý ${plan.quarter} / ${plan.year}`
    : plan.type === 'month'
    ? `Tháng ${plan.month} / ${plan.year}`
    : `Tuần ${plan.week} / ${plan.year}`

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Card header */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        {/* Icon */}
        <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <CalendarDays className="h-4 w-4 text-blue-600" />
        </div>

        {/* Title & meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{plan.title}</p>
            {plan.dept && (
              <span className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold flex-shrink-0',
                DEPT_BADGE_CONFIG[plan.dept.code] ?? 'bg-gray-50 text-gray-600 border-gray-200'
              )}>
                {plan.dept.code}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{periodLabel}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-5 text-xs text-gray-500 flex-shrink-0">
          <div className="text-center">
            <p className="font-semibold text-gray-800">{plan.taskCount}</p>
            <p>Công việc</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-green-700">{plan.doneCount}</p>
            <p>Hoàn thành</p>
          </div>
          {plan.overdueCount > 0 && (
            <div className="text-center">
              <p className="font-semibold text-red-700">{plan.overdueCount}</p>
              <p>Quá hạn</p>
            </div>
          )}
        </div>

        {/* Progress — tỉ lệ HT + % TB */}
        <div className="flex flex-col gap-2 w-36 flex-shrink-0">
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
              <span>Tỉ lệ HT</span>
              <span className="font-semibold text-gray-700">{rate}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={cn('h-full rounded-full', rate >= 100 ? 'bg-green-500' : rate >= 50 ? 'bg-blue-500' : 'bg-amber-500')}
                style={{ width: `${rate}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
              <span>Tiến độ TB</span>
              <span className="font-semibold text-indigo-700">{plan.avgProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={cn('h-full rounded-full', plan.avgProgress >= 80 ? 'bg-green-500' : plan.avgProgress >= 50 ? 'bg-indigo-400' : 'bg-gray-300')}
                style={{ width: `${plan.avgProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="text-gray-300 hover:text-red-400 transition-colors"
            title="Xóa kế hoạch"
          >
            <X className="h-4 w-4" />
          </button>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-gray-400" />
            : <ChevronDown className="h-4 w-4 text-gray-400" />
          }
        </div>
      </div>

      {/* Expanded task list — grouped by task_group */}
      {expanded && (
        <div className="border-t border-gray-100">
          {plan.tasks.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              Chưa có công việc nào liên kết với kế hoạch này
            </div>
          ) : (
            <ExpandedTaskList tasks={plan.tasks} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const URGENCY_CFG: Record<number, { label: string; cls: string }> = {
  3: { label: 'Rất gấp',  cls: 'bg-red-100 text-red-700 border-red-300' },
  2: { label: 'Gấp',      cls: 'bg-orange-100 text-orange-700 border-orange-300' },
  1: { label: 'Bình thường', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}
const IMPORTANCE_CFG: Record<number, { label: string; cls: string }> = {
  5: { label: 'Tối QT',  cls: 'bg-purple-100 text-purple-700 border-purple-300' },
  3: { label: 'Quan trọng', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  1: { label: 'Bình thường', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

function getAssigneeName(task: CoordinationTaskWithRelations): string {
  if (task.assignee?.full_name) return task.assignee.full_name
  if (task.description?.startsWith('Người thực hiện: '))
    return task.description.replace('Người thực hiện: ', '')
  return ''
}

function getTimeLabel(task: CoordinationTaskWithRelations): string {
  if (task.due_date) {
    const [y, m, d] = task.due_date.split('-')
    return `${d}/${m}/${y}`
  }
  return task.time_week ?? ''
}

// ── Expanded task list with sub-grouping by task_group ────────────────────────
function ExpandedTaskList({ tasks }: { tasks: CoordinationTaskWithRelations[] }) {
  const subGrouped: Record<string, CoordinationTaskWithRelations[]> = {}
  for (const t of tasks) {
    const g = t.task_group ?? '__none__'
    if (!subGrouped[g]) subGrouped[g] = []
    subGrouped[g].push(t)
  }
  const hasGroups = Object.keys(subGrouped).some((k) => k !== '__none__')

  let rowIdx = 0

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[900px]">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
            <th className="px-4 py-2.5 text-left font-semibold w-8">#</th>
            <th className="px-4 py-2.5 text-left font-semibold">Tên công việc</th>
            <th className="px-4 py-2.5 text-left font-semibold w-[160px]">Tiêu chí cần đạt</th>
            <th className="px-4 py-2.5 text-left font-semibold w-[120px]">Người thực hiện</th>
            <th className="px-4 py-2.5 text-left font-semibold w-[95px]">Thời gian</th>
            <th className="px-4 py-2.5 text-center font-semibold w-[72px]">Độ gấp</th>
            <th className="px-4 py-2.5 text-center font-semibold w-[80px]">Ưu tiên</th>
            <th className="px-4 py-2.5 text-center font-semibold w-[52px]">Hệ số</th>
            <th className="px-4 py-2.5 text-left font-semibold w-[110px]">Tiến độ</th>
            <th className="px-4 py-2.5 text-left font-semibold w-[120px]">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(subGrouped).map(([groupName, groupTasks]) => {
            const isNoGroup = groupName === '__none__'
            const groupDone = groupTasks.filter((t) => t.status === 'da_hoan_thanh').length
            const groupAvg  = groupTasks.length > 0
              ? Math.round(groupTasks.reduce((s, t) => s + t.progress_percent, 0) / groupTasks.length)
              : 0

            return (
              <React.Fragment key={groupName}>
                {/* ── Sub-group header — prominent ── */}
                {hasGroups && !isNoGroup && (
                  <tr>
                    <td colSpan={10} className="p-0">
                      <div className="flex items-center gap-4 px-4 py-3 border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-white border-y border-blue-100">
                        <span className="text-sm font-bold text-blue-800 tracking-tight">{groupName}</span>
                        <span className="text-xs text-blue-500 font-medium">{groupTasks.length} công việc</span>
                        <span className="text-blue-300">·</span>
                        <span className="text-xs text-blue-600 font-medium">
                          {groupDone}/{groupTasks.length} hoàn thành
                        </span>
                        <span className="text-blue-300">·</span>
                        <span className="text-xs text-blue-600">
                          Tiến độ TB: <span className="font-bold">{groupAvg}%</span>
                        </span>
                        <div className="w-20 h-2 rounded-full bg-blue-100 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all',
                              groupAvg >= 80 ? 'bg-green-500'
                              : groupAvg >= 50 ? 'bg-blue-500'
                              : 'bg-amber-400'
                            )}
                            style={{ width: `${groupAvg}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* ── Task rows ── */}
                {groupTasks.map((task) => {
                  rowIdx++
                  const statusCfg   = (STATUS_CONFIG as Record<string, { label: string; color: string; dot: string }>)[task.status]
                  const score       = task.total_score
                  const urgency     = URGENCY_CFG[task.priority_urgency]     ?? URGENCY_CFG[1]
                  const importance  = IMPORTANCE_CFG[task.priority_importance] ?? IMPORTANCE_CFG[1]
                  const assignee    = getAssigneeName(task)
                  const timeLabel   = getTimeLabel(task)

                  const scoreCls = !score || score === 0
                    ? 'text-gray-300'
                    : score >= 15 ? 'font-bold text-red-700 bg-red-50 border border-red-200 rounded px-1.5'
                    : score >= 9  ? 'font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5'
                    : score >= 6  ? 'font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5'
                    : 'font-bold text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5'

                  return (
                    <tr key={task.id} className="border-b border-gray-100 hover:bg-blue-50/20 transition-colors">
                      {/* # */}
                      <td className="px-4 py-3 text-gray-400 font-medium">{rowIdx}</td>

                      {/* Tên công việc */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800 line-clamp-2 leading-snug">{task.title}</p>
                      </td>

                      {/* Tiêu chí */}
                      <td className="px-4 py-3 text-gray-600 line-clamp-2 leading-snug">
                        {task.success_criteria || <span className="text-gray-300">—</span>}
                      </td>

                      {/* Người thực hiện */}
                      <td className="px-4 py-3">
                        {assignee
                          ? <span className="text-gray-700 font-medium">{assignee}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>

                      {/* Thời gian */}
                      <td className="px-4 py-3">
                        {timeLabel
                          ? <span className={cn('font-medium', task.due_date ? 'text-gray-800' : 'text-gray-500')}>{timeLabel}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>

                      {/* Độ gấp */}
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap', urgency.cls)}>
                          {urgency.label}
                        </span>
                      </td>

                      {/* Ưu tiên */}
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap', importance.cls)}>
                          {importance.label}
                        </span>
                      </td>

                      {/* Hệ số */}
                      <td className="px-4 py-3 text-center">
                        {score != null && score > 0
                          ? <span className={cn('text-[11px] tabular-nums', scoreCls)}>{score % 1 === 0 ? score : score.toFixed(1)}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>

                      {/* Tiến độ */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={cn('h-full rounded-full',
                                task.progress_percent >= 100 ? 'bg-green-500'
                                : task.progress_percent >= 60  ? 'bg-blue-500'
                                : 'bg-amber-400'
                              )}
                              style={{ width: `${task.progress_percent}%` }}
                            />
                          </div>
                          <span className="text-gray-600 tabular-nums w-7 text-right font-medium">{task.progress_percent}%</span>
                        </div>
                      </td>

                      {/* Trạng thái */}
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
                          statusCfg?.color ?? 'bg-gray-50 text-gray-500 border-gray-200'
                        )}>
                          <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', statusCfg?.dot ?? 'bg-gray-400')} />
                          {statusCfg?.label ?? task.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
