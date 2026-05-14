// Supabase Edge Function: deadline-alert
// Chạy hàng ngày lúc 7:00 sáng (UTC+7) qua pg_cron
//
// Logic phân phối thông báo theo role:
//   Assignee (người được giao):
//     - Task quá hạn → overdue alert
//     - Task đến hạn hôm nay → urgent alert
//     - Task còn 3 ngày → deadline_soon
//     - Chưa cập nhật tiến độ > 7 ngày → reminder
//
//   Trưởng phòng (truong_phong) của phòng THỰC HIỆN:
//     - Có task quá hạn trong phòng → dept overdue summary
//     - Có task đến hạn hôm nay → today alert
//
//   Admin / BĐH (admin, bdi):
//     - Task quá hạn toàn hệ thống → critical overdue (tổng hợp, không spam từng task)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Profile {
  id: string
  full_name: string
  department_id: string | null
  role: string
}

interface Task {
  id: string
  title: string
  due_date: string | null
  status: string
  progress_percent: number
  updated_at: string
  assignee_id: string | null
  execute_department_id: string
  request_department_id: string
}

interface NotificationInsert {
  user_id: string
  task_id: string
  type: string
  title: string
  message: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Múi giờ UTC+7
  const nowUtc = new Date()
  const nowVn = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000)
  const todayStr = nowVn.toISOString().split('T')[0]

  const threeDays = new Date(nowVn)
  threeDays.setDate(nowVn.getDate() + 3)
  const threeDaysStr = threeDays.toISOString().split('T')[0]

  const sevenDaysAgo = new Date(nowVn)
  sevenDaysAgo.setDate(nowVn.getDate() - 7)

  // ── Load data ────────────────────────────────────────────────────────────────
  const [tasksRes, profilesRes] = await Promise.all([
    supabase
      .from('coordination_tasks')
      .select('id, title, due_date, status, progress_percent, updated_at, assignee_id, execute_department_id, request_department_id')
      .not('status', 'in', '("da_hoan_thanh","tam_dung")'),
    supabase
      .from('profiles')
      .select('id, full_name, department_id, role')
      .eq('is_active', true),
  ])

  const tasks = (tasksRes.data ?? []) as Task[]
  const profiles = (profilesRes.data ?? []) as Profile[]

  // Build lookup maps
  const profilesByDeptAndRole: Record<string, Profile[]> = {}
  const adminBdiProfiles: Profile[] = []

  for (const p of profiles) {
    if (p.role === 'admin' || p.role === 'bdi') {
      adminBdiProfiles.push(p)
    }
    if (p.role === 'truong_phong' && p.department_id) {
      if (!profilesByDeptAndRole[p.department_id]) profilesByDeptAndRole[p.department_id] = []
      profilesByDeptAndRole[p.department_id].push(p)
    }
  }

  // ── Process tasks ─────────────────────────────────────────────────────────────
  const notifications: NotificationInsert[] = []
  const overdueIds: string[] = []

  // Track which dept had overdue + today tasks (for trưởng phòng summary)
  const deptOverdueCount: Record<string, number> = {}
  const deptTodayCount: Record<string, number> = {}

  for (const task of tasks) {
    const due = task.due_date
    const assignee = task.assignee_id
    const updatedAt = new Date(task.updated_at)
    const execDeptId = task.execute_department_id

    const isOver = due && due < todayStr
    const isToday = due === todayStr
    const isSoon = due === threeDaysStr
    const noUpdate = updatedAt < sevenDaysAgo && task.progress_percent < 100

    if (isOver && task.status !== 'qua_han') {
      overdueIds.push(task.id)
      deptOverdueCount[execDeptId] = (deptOverdueCount[execDeptId] ?? 0) + 1

      // Notify assignee
      if (assignee) {
        notifications.push({
          user_id: assignee,
          task_id: task.id,
          type: 'overdue',
          title: '⚠️ Công việc quá hạn',
          message: `"${task.title}" đã quá deadline (${due}). Cập nhật tiến độ ngay.`,
        })
      }
    } else if (isToday) {
      deptTodayCount[execDeptId] = (deptTodayCount[execDeptId] ?? 0) + 1

      if (assignee) {
        notifications.push({
          user_id: assignee,
          task_id: task.id,
          type: 'deadline_soon',
          title: '🔔 Deadline hôm nay',
          message: `"${task.title}" đến hạn hôm nay. Hoàn thành và cập nhật tiến độ.`,
        })
      }
    } else if (isSoon) {
      if (assignee) {
        notifications.push({
          user_id: assignee,
          task_id: task.id,
          type: 'deadline_soon',
          title: '📅 Sắp đến deadline',
          message: `"${task.title}" còn 3 ngày đến deadline (${due}).`,
        })
      }
    }

    if (noUpdate && !isOver) {
      if (assignee) {
        notifications.push({
          user_id: assignee,
          task_id: task.id,
          type: 'reminder',
          title: '📝 Nhắc cập nhật tiến độ',
          message: `"${task.title}" chưa được cập nhật tiến độ trong 7 ngày.`,
        })
      }
    }
  }

  // ── Trưởng phòng: dept-level alerts (1 thông báo tổng hợp / phòng) ──────────
  for (const [deptId, count] of Object.entries(deptOverdueCount)) {
    const managers = profilesByDeptAndRole[deptId] ?? []
    for (const mgr of managers) {
      // Dùng task_id của task đầu tiên quá hạn trong phòng để liên kết
      const firstOverdueTask = tasks.find(
        (t) => t.execute_department_id === deptId && (t.due_date && t.due_date < todayStr)
      )
      if (firstOverdueTask) {
        notifications.push({
          user_id: mgr.id,
          task_id: firstOverdueTask.id,
          type: 'overdue',
          title: `⚠️ Phòng có ${count} công việc quá hạn`,
          message: `Phòng bạn hiện có ${count} công việc quá hạn cần xử lý ngay.`,
        })
      }
    }
  }

  for (const [deptId, count] of Object.entries(deptTodayCount)) {
    const managers = profilesByDeptAndRole[deptId] ?? []
    for (const mgr of managers) {
      const firstTodayTask = tasks.find(
        (t) => t.execute_department_id === deptId && t.due_date === todayStr
      )
      if (firstTodayTask) {
        notifications.push({
          user_id: mgr.id,
          task_id: firstTodayTask.id,
          type: 'deadline_soon',
          title: `🔔 Phòng có ${count} công việc đến hạn hôm nay`,
          message: `${count} công việc trong phòng đến hạn hôm nay. Kiểm tra và theo dõi tiến độ.`,
        })
      }
    }
  }

  // ── Admin / BĐH: critical summary (chỉ khi có task quá hạn) ─────────────────
  if (overdueIds.length > 0) {
    const firstOverdue = tasks.find((t) => overdueIds.includes(t.id))
    for (const admin of adminBdiProfiles) {
      if (firstOverdue) {
        notifications.push({
          user_id: admin.id,
          task_id: firstOverdue.id,
          type: 'overdue',
          title: `🚨 Hệ thống: ${overdueIds.length} công việc quá hạn`,
          message: `Toàn hệ thống có ${overdueIds.length} công việc quá hạn cần chú ý. Vào Dashboard để xem chi tiết.`,
        })
      }
    }
  }

  // ── Batch updates ─────────────────────────────────────────────────────────────
  if (overdueIds.length > 0) {
    await supabase
      .from('coordination_tasks')
      .update({ status: 'qua_han' })
      .in('id', overdueIds)
  }

  // ── Deduplicate before inserting ──────────────────────────────────────────────
  if (notifications.length > 0) {
    const { data: existing } = await supabase
      .from('notifications')
      .select('user_id, task_id, type')
      .gte('created_at', `${todayStr}T00:00:00.000Z`)

    const existingSet = new Set(
      (existing ?? []).map((n: { user_id: string; task_id: string; type: string }) =>
        `${n.user_id}__${n.task_id}__${n.type}`
      )
    )

    const toInsert = notifications.filter(
      (n) => !existingSet.has(`${n.user_id}__${n.task_id}__${n.type}`)
    )

    if (toInsert.length > 0) {
      await supabase.from('notifications').insert(toInsert)
    }
  }

  const result = {
    ok: true,
    date: todayStr,
    tasksChecked: tasks.length,
    markedOverdue: overdueIds.length,
    notificationsQueued: notifications.length,
    deptOverdueAlerts: Object.keys(deptOverdueCount).length,
    adminAlerts: adminBdiProfiles.length > 0 && overdueIds.length > 0 ? adminBdiProfiles.length : 0,
  }

  console.log('deadline-alert result:', JSON.stringify(result))

  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
