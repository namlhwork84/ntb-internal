'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { TASK_GROUPS_BY_DEPT } from '@/types/database'
import type { Department, Profile } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface TaskFormProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  departments: Department[]
  profiles: Profile[]
  currentProfile: Profile | null
}

interface FormState {
  request_department_id: string
  execute_department_id: string
  assignee_id: string
  task_group: string
  title: string
  success_criteria: string
  description: string
  attachment_url: string
  time_quarter: string
  time_month: string
  time_week: string
  due_date: string
  recurrence: string
  priority_urgency: number
  priority_importance: number
  priority_workload: number
}

const INITIAL_FORM: FormState = {
  request_department_id: '',
  execute_department_id: '',
  assignee_id: '',
  task_group: '',
  title: '',
  success_criteria: '',
  description: '',
  attachment_url: '',
  time_quarter: '',
  time_month: '',
  time_week: '',
  due_date: '',
  recurrence: 'none',
  priority_urgency: 2,
  priority_importance: 3,
  priority_workload: 2,
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-5 first:mt-0">
      {children}
    </div>
  )
}

export function TaskForm({ open, onClose, onCreated, departments, profiles, currentProfile }: TaskFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && currentProfile) {
      setForm((f) => ({ ...f, request_department_id: currentProfile.department_id ?? '' }))
    }
  }, [open, currentProfile])

  const totalScore =
    form.priority_urgency * form.priority_importance * (form.priority_workload / 2)

  const executeDeptCode = departments.find((d) => d.id === form.execute_department_id)?.code ?? ''
  const taskGroups = TASK_GROUPS_BY_DEPT[executeDeptCode] ?? []

  const assignableProfiles = profiles.filter(
    (p) => !form.execute_department_id || p.department_id === form.execute_department_id
  )

  const set = (key: keyof FormState) => (val: string | number) =>
    setForm((f) => ({ ...f, [key]: val }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.request_department_id || !form.execute_department_id) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc (*).')
      return
    }

    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); setError('Chưa đăng nhập.'); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase.from('coordination_tasks') as any).insert({
      request_department_id: form.request_department_id,
      execute_department_id: form.execute_department_id,
      request_user_id: user.id,
      assignee_id: form.assignee_id || null,
      task_group: form.task_group || null,
      title: form.title.trim(),
      success_criteria: form.success_criteria.trim() || null,
      description: form.description.trim() || null,
      attachment_url: form.attachment_url.trim() || null,
      time_quarter: form.time_quarter ? parseInt(form.time_quarter) : null,
      time_month: form.time_month ? parseInt(form.time_month) : null,
      time_week: form.time_week || null,
      due_date: form.due_date || null,
      recurrence: form.recurrence as 'none' | 'weekly' | 'monthly' | 'meeting_schedule',
      priority_urgency: form.priority_urgency,
      priority_importance: form.priority_importance,
      priority_workload: form.priority_workload,
      created_by: user.id,
    })

    setLoading(false)
    if (insertError) {
      setError(insertError.message)
    } else {
      setForm(INITIAL_FORM)
      onCreated()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo yêu cầu phối hợp mới</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-0">
          {/* Section 1: Phân công */}
          <SectionTitle>1. Phân công</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Phòng ban yêu cầu *</Label>
              <Select value={form.request_department_id} onValueChange={set('request_department_id')}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Chọn phòng ban" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phòng ban thực hiện *</Label>
              <Select
                value={form.execute_department_id}
                onValueChange={(v) => setForm((f) => ({ ...f, execute_department_id: v, task_group: '', assignee_id: '' }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Chọn phòng ban" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Người xử lý</Label>
              <Select value={form.assignee_id} onValueChange={set('assignee_id')}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Chọn người xử lý" />
                </SelectTrigger>
                <SelectContent>
                  {assignableProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nhóm nhiệm vụ</Label>
              <Select
                value={form.task_group}
                onValueChange={set('task_group')}
                disabled={taskGroups.length === 0}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={taskGroups.length === 0 ? 'Chọn PB thực hiện trước' : 'Chọn nhóm'} />
                </SelectTrigger>
                <SelectContent>
                  {taskGroups.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Section 2: Nội dung */}
          <SectionTitle>2. Nội dung công việc</SectionTitle>
          <div className="space-y-3">
            <div>
              <Label>Tên hành động phối hợp *</Label>
              <Input
                className="mt-1"
                placeholder="VD: Thiết kế banner hội thảo..."
                value={form.title}
                onChange={(e) => set('title')(e.target.value)}
              />
            </div>
            <div>
              <Label>Tiêu chuẩn cần đạt *</Label>
              <Input
                className="mt-1"
                placeholder="VD: Thiết kế được phê duyệt"
                value={form.success_criteria}
                onChange={(e) => set('success_criteria')(e.target.value)}
              />
            </div>
            <div>
              <Label>Mô tả chi tiết</Label>
              <Textarea
                className="mt-1"
                placeholder="Mô tả yêu cầu cụ thể..."
                rows={3}
                value={form.description}
                onChange={(e) => set('description')(e.target.value)}
              />
            </div>
            <div>
              <Label>Link file đính kèm / brief</Label>
              <Input
                className="mt-1"
                placeholder="https://drive.google.com/..."
                value={form.attachment_url}
                onChange={(e) => set('attachment_url')(e.target.value)}
              />
            </div>
          </div>

          <Separator className="my-4" />

          {/* Section 3: Thời gian */}
          <SectionTitle>3. Thời gian & Deadline</SectionTitle>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label>Quý</Label>
              <Select value={form.time_quarter} onValueChange={set('time_quarter')}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Q" />
                </SelectTrigger>
                <SelectContent>
                  {[1,2,3,4].map((q) => (
                    <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tháng</Label>
              <Select value={form.time_month} onValueChange={set('time_month')}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="T" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({length: 12}, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tuần</Label>
              <Select value={form.time_week} onValueChange={set('time_week')}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Tuần" />
                </SelectTrigger>
                <SelectContent>
                  {['Tuần 1','Tuần 2','Tuần 3','Tuần 4','Hàng tuần'].map((w) => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deadline</Label>
              <Input
                type="date"
                className="mt-1"
                value={form.due_date}
                onChange={(e) => set('due_date')(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3">
            <Label>Tần suất lặp lại</Label>
            <Select value={form.recurrence} onValueChange={set('recurrence')}>
              <SelectTrigger className="mt-1 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không lặp</SelectItem>
                <SelectItem value="weekly">Hàng tuần</SelectItem>
                <SelectItem value="monthly">Hàng tháng</SelectItem>
                <SelectItem value="meeting_schedule">Theo lịch họp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="my-4" />

          {/* Section 4: Ưu tiên */}
          <SectionTitle>4. Mức độ ưu tiên</SectionTitle>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Độ gấp</Label>
              <Select
                value={String(form.priority_urgency)}
                onValueChange={(v) => set('priority_urgency')(Number(v))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 — Rất gấp</SelectItem>
                  <SelectItem value="2">2 — Gấp</SelectItem>
                  <SelectItem value="1">1 — Bình thường</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Độ quan trọng</Label>
              <Select
                value={String(form.priority_importance)}
                onValueChange={(v) => set('priority_importance')(Number(v))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 — Tối quan trọng</SelectItem>
                  <SelectItem value="3">3 — Quan trọng</SelectItem>
                  <SelectItem value="1">1 — Bình thường</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Khối lượng</Label>
              <Select
                value={String(form.priority_workload)}
                onValueChange={(v) => set('priority_workload')(Number(v))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">3 — Rất lớn</SelectItem>
                  <SelectItem value="4">2 — Lớn</SelectItem>
                  <SelectItem value="2">1 — Trung bình</SelectItem>
                  <SelectItem value="1">0.5 — Nhỏ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-4 py-2.5">
            <span className="text-sm text-blue-700">Tổng hệ số ưu tiên:</span>
            <span className="text-xl font-bold text-blue-800">{totalScore.toFixed(1)}</span>
            <span className="text-xs text-blue-500 ml-auto">
              = {form.priority_urgency} × {form.priority_importance} × {(form.priority_workload/2).toFixed(1)}
            </span>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mt-4">
              {error}
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Đang tạo...' : 'Tạo yêu cầu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
