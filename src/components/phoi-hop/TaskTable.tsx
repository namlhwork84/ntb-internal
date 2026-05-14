'use client'

import React from 'react'
import { cn, formatDate, isDeadlineSoon, isOverdue } from '@/lib/utils'
import { STATUS_CONFIG, DEPT_BADGE_CONFIG } from '@/types/database'
import type { CoordinationTaskWithRelations, Department } from '@/types/database'

interface TaskTableProps {
  tasks: CoordinationTaskWithRelations[]
  departments: Department[]
  onRowClick: (task: CoordinationTaskWithRelations) => void
  groupByField?: 'execute' | 'request'
}

// Hệ số ưu tiên màu sắc theo điểm
function priorityColor(score: number | null): string {
  if (!score) return 'text-gray-400 bg-gray-50'
  if (score >= 15) return 'text-red-700 bg-red-50 border-red-200'
  if (score >= 9)  return 'text-orange-700 bg-orange-50 border-orange-200'
  if (score >= 6)  return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-gray-600 bg-gray-50 border-gray-200'
}

export function TaskTable({ tasks, departments, onRowClick, groupByField = 'execute' }: TaskTableProps) {
  const deptById = Object.fromEntries(departments.map((d) => [d.id, d]))

  function resolveGroupDept(task: CoordinationTaskWithRelations): Department | null {
    if (groupByField === 'request') {
      return (task.request_department as Department) ?? deptById[task.request_department_id] ?? null
    }
    return (task.execute_department as Department) ?? deptById[task.execute_department_id] ?? null
  }

  function resolveTaskDept(task: CoordinationTaskWithRelations): Department | null {
    return (task.execute_department as Department) ?? deptById[task.execute_department_id] ?? null
  }

  // Group by dept
  const grouped: Record<string, CoordinationTaskWithRelations[]> = {}
  for (const task of tasks) {
    const dept = resolveGroupDept(task)
    const key = dept?.code ?? (groupByField === 'request' ? task.request_department_id : task.execute_department_id) ?? 'OTHER'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(task)
  }

  // Sort groups by dept order
  const deptOrder = departments.map((d) => d.code)
  const sortedEntries = Object.entries(grouped).sort(([a], [b]) => {
    const ia = deptOrder.indexOf(a), ib = deptOrder.indexOf(b)
    if (ia === -1 && ib === -1) return 0
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-12 text-center text-gray-400 text-sm">
        Không có công việc nào phù hợp với bộ lọc.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-8">#</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[110px]">
              {groupByField === 'request' ? 'PB yêu cầu' : 'PB thực hiện'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tên hành động</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[180px]">Tiêu chuẩn</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[100px]">Deadline</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 w-[60px]">Hệ số</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[120px]">Tiến độ</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[140px]">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {sortedEntries.map(([deptCode, deptTasks]) => {
            const dept = departments.find((d) => d.code === deptCode) ?? resolveGroupDept(deptTasks[0])
            const deptBadgeClass = DEPT_BADGE_CONFIG[deptCode] ?? 'bg-gray-50 text-gray-700 border-gray-200'

            // Sub-group by task_group within this dept
            const subGrouped: Record<string, CoordinationTaskWithRelations[]> = {}
            for (const t of deptTasks) {
              const g = t.task_group ?? '__none__'
              if (!subGrouped[g]) subGrouped[g] = []
              subGrouped[g].push(t)
            }
            const hasSubGroups = Object.keys(subGrouped).some((k) => k !== '__none__')

            // Dept-level stats
            const deptDone = deptTasks.filter((t) => t.status === 'da_hoan_thanh').length
            const deptAvg  = deptTasks.length > 0
              ? Math.round(deptTasks.reduce((s, t) => s + t.progress_percent, 0) / deptTasks.length)
              : 0

            let rowIdx = 0

            return (
              <React.Fragment key={deptCode}>
                {/* ── Dept group header ── */}
                <tr className="bg-gray-50 border-b border-t border-gray-100">
                  <td colSpan={8} className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold', deptBadgeClass)}>
                        {dept?.name ?? deptCode}
                      </span>
                      <span className="text-xs text-gray-400">{deptTasks.length} công việc</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-green-600 font-medium">{deptDone} hoàn thành</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">Tiến độ TB: <span className="font-semibold text-gray-700">{deptAvg}%</span></span>
                      {/* Mini progress bar */}
                      <div className="flex-1 max-w-[100px] h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', deptAvg >= 80 ? 'bg-green-500' : deptAvg >= 50 ? 'bg-amber-400' : 'bg-blue-400')}
                          style={{ width: `${deptAvg}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>

                {/* ── Sub-groups ── */}
                {Object.entries(subGrouped).map(([groupName, groupTasks]) => {
                  const isNoGroup = groupName === '__none__'
                  const groupDone = groupTasks.filter((t) => t.status === 'da_hoan_thanh').length
                  const groupAvg  = groupTasks.length > 0
                    ? Math.round(groupTasks.reduce((s, t) => s + t.progress_percent, 0) / groupTasks.length)
                    : 0

                  return (
                    <React.Fragment key={groupName}>
                      {/* Task group sub-header */}
                      {hasSubGroups && !isNoGroup && (
                        <tr className="bg-blue-50/40 border-b border-blue-100/60">
                          <td colSpan={8} className="px-6 py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-blue-700">{groupName}</span>
                              <span className="text-[10px] text-blue-400">{groupTasks.length} CV</span>
                              <span className="text-[10px] text-blue-400">·</span>
                              <span className="text-[10px] text-blue-500">{groupDone}/{groupTasks.length} xong</span>
                              <span className="text-[10px] text-blue-400">·</span>
                              <span className="text-[10px] text-blue-500">TB {groupAvg}%</span>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Task rows */}
                      {groupTasks.map((task) => {
                        rowIdx++
                        const statusCfg  = STATUS_CONFIG[task.status]
                        const soon       = isDeadlineSoon(task.due_date)
                        const over       = isOverdue(task.due_date)
                        const deadlineCls = over || task.status === 'qua_han'
                          ? 'text-red-600 font-semibold'
                          : soon
                          ? 'text-orange-600 font-medium'
                          : 'text-gray-700'
                        const score = task.total_score

                        return (
                          <tr
                            key={task.id}
                            className="border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors"
                            onClick={() => onRowClick(task)}
                          >
                            {/* # */}
                            <td className="px-4 py-3 text-gray-400 text-xs">{rowIdx}</td>

                            {/* PB thực hiện */}
                            <td className="px-4 py-3">
                              <span className={cn(
                                'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                                DEPT_BADGE_CONFIG[resolveTaskDept(task)?.code ?? ''] ?? 'bg-gray-50 text-gray-700 border-gray-200'
                              )}>
                                {resolveTaskDept(task)?.code ?? '—'}
                              </span>
                            </td>

                            {/* Tên hành động */}
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 line-clamp-1">{task.title}</div>
                              {task.time_week && (
                                <div className="text-[10px] text-gray-400 mt-0.5">{task.time_week}</div>
                              )}
                            </td>

                            {/* Tiêu chuẩn */}
                            <td className="px-4 py-3 text-gray-600 text-xs line-clamp-2">
                              {task.success_criteria ?? '—'}
                            </td>

                            {/* Deadline */}
                            <td className={cn('px-4 py-3 text-xs', deadlineCls)}>
                              {task.due_date
                                ? formatDate(task.due_date)
                                : task.time_week
                                ? <span className="text-gray-400">{task.time_week}</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>

                            {/* Hệ số ưu tiên */}
                            <td className="px-4 py-3 text-center">
                              {score != null && score > 0 ? (
                                <span className={cn(
                                  'inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[11px] font-bold min-w-[28px]',
                                  priorityColor(score)
                                )}>
                                  {score % 1 === 0 ? score : score.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-gray-300 text-xs">—</span>
                              )}
                            </td>

                            {/* Tiến độ */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      task.progress_percent === 100 ? 'bg-green-500'
                                      : task.progress_percent >= 50  ? 'bg-amber-400'
                                      : 'bg-blue-400'
                                    )}
                                    style={{ width: `${task.progress_percent}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 w-8 text-right tabular-nums">
                                  {task.progress_percent}%
                                </span>
                              </div>
                            </td>

                            {/* Trạng thái */}
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
                    </React.Fragment>
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
