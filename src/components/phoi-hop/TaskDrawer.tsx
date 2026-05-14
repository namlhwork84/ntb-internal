'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatDate } from '@/lib/utils'
import { STATUS_CONFIG, DEPT_BADGE_CONFIG } from '@/types/database'
import type { CoordinationTaskWithRelations, TaskHistory, Profile } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import {
  Building2,
  User,
  Calendar,
  Target,
  ClipboardCheck,
  History,
  CheckCircle2,
  ExternalLink,
  RepeatIcon,
  AlertTriangle,
  Save,
  Loader2,
} from 'lucide-react'

interface TaskDrawerProps {
  task: CoordinationTaskWithRelations | null
  open: boolean
  onClose: () => void
  history?: TaskHistory[]
  currentProfile?: Profile | null
  onRefresh?: () => void
}

const PRIORITY_URGENCY_LABELS: Record<number, string> = { 3: 'Rất gấp', 2: 'Gấp', 1: 'Bình thường' }
const PRIORITY_IMPORTANCE_LABELS: Record<number, string> = { 5: 'Tối quan trọng', 3: 'Quan trọng', 1: 'Bình thường' }
const PRIORITY_WORKLOAD_LABELS: Record<number, string> = { 6: 'Rất lớn', 4: 'Lớn', 2: 'Trung bình', 1: 'Nhỏ' }
const RECURRENCE_LABELS: Record<string, string> = {
  none: 'Không lặp',
  weekly: 'Hàng tuần',
  monthly: 'Hàng tháng',
  meeting_schedule: 'Theo lịch họp',
}
const RESULT_QUALITY_LABELS: Record<string, string> = {
  dat_chuan: 'Đạt chuẩn',
  vuot_chuan: 'Vượt chuẩn',
  khong_dat: 'Không đạt',
  dat_mot_phan: 'Đạt một phần',
}
const ACTION_LABELS: Record<string, string> = {
  created: 'Tạo công việc',
  status_changed: 'Đổi trạng thái',
  progress_updated: 'Cập nhật tiến độ',
  confirmed: 'Xác nhận hoàn thành',
  system_alert: 'Cảnh báo hệ thống',
}

interface InfoRowProps {
  label: string
  children: React.ReactNode
}
function InfoRow({ label, children }: InfoRowProps) {
  return (
    <div className="flex gap-3 py-2">
      <span className="w-36 flex-shrink-0 text-xs text-gray-500 pt-0.5">{label}</span>
      <span className="text-sm text-gray-900 flex-1">{children}</span>
    </div>
  )
}

interface SectionHeadingProps {
  icon: React.ReactNode
  title: string
}
function SectionHeading({ icon, title }: SectionHeadingProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-gray-400">{icon}</span>
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
    </div>
  )
}

export function TaskDrawer({ task, open, onClose, history = [], currentProfile, onRefresh }: TaskDrawerProps) {
  const [activeTab, setActiveTab] = useState('info')

  // Progress tab state
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')
  // Editable info fields
  const [editTitle, setEditTitle] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editSecondDueDate, setEditSecondDueDate] = useState('')
  const [editSecondDueReason, setEditSecondDueReason] = useState('')
  const [savingProgress, setSavingProgress] = useState(false)
  const [progressError, setProgressError] = useState<string | null>(null)
  const [progressSaved, setProgressSaved] = useState(false)

  // Result tab state
  const [resultSummary, setResultSummary] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [resultQuality, setResultQuality] = useState('')
  const [savingResult, setSavingResult] = useState(false)
  const [resultError, setResultError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Sync local state when task changes
  useEffect(() => {
    if (task) {
      setProgress(task.progress_percent ?? 0)
      setStatus(task.status)
      setNotes(task.notes ?? '')
      setEditTitle(task.title ?? '')
      setEditDueDate(task.due_date ?? '')
      setEditSecondDueDate(task.second_due_date ?? '')
      setEditSecondDueReason(task.second_due_reason ?? '')
      setResultSummary(task.result_summary ?? '')
      setResultUrl(task.result_url ?? '')
      setResultQuality(task.result_quality ?? '')
      setProgressSaved(false)
      setProgressError(null)
      setResultError(null)
    }
  }, [task])

  if (!task) return null

  const statusCfg = STATUS_CONFIG[task.status]
  const executeDeptCode = task.execute_department?.code ?? ''
  const requestDeptCode = task.request_department?.code ?? ''
  const deptBadgeClass = DEPT_BADGE_CONFIG[executeDeptCode] ?? 'bg-gray-50 text-gray-700 border-gray-200'

  const canConfirm =
    currentProfile?.department_id === task.request_department_id &&
    task.status !== 'da_hoan_thanh' &&
    !task.confirmed_at

  const totalScore =
    task.priority_urgency * task.priority_importance * (task.priority_workload / 2)

  async function handleSaveProgress() {
    if (!task) return
    setSavingProgress(true)
    setProgressError(null)
    setProgressSaved(false)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('coordination_tasks') as any)
      .update({
        title: editTitle.trim() || task.title,
        due_date: editDueDate || null,
        second_due_date: editSecondDueDate || null,
        second_due_reason: editSecondDueReason.trim() || null,
        progress_percent: progress,
        status,
        notes: notes || null,
      })
      .eq('id', task.id)
    setSavingProgress(false)
    if (error) {
      setProgressError(error.message)
    } else {
      setProgressSaved(true)
      onRefresh?.()
    }
  }

  async function handleSaveResult() {
    if (!task) return
    setSavingResult(true)
    setResultError(null)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('coordination_tasks') as any)
      .update({
        result_summary: resultSummary || null,
        result_url: resultUrl || null,
        result_quality: resultQuality || null,
      })
      .eq('id', task.id)
    setSavingResult(false)
    if (error) {
      setResultError(error.message)
    } else {
      onRefresh?.()
    }
  }

  async function handleConfirm() {
    if (!task) return
    setConfirming(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setConfirming(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('coordination_tasks') as any)
      .update({
        status: 'da_hoan_thanh',
        progress_percent: 100,
        confirmed_at: new Date().toISOString(),
        confirmed_by: user.id,
      })
      .eq('id', task.id)
    setConfirming(false)
    if (!error) {
      onRefresh?.()
      onClose()
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[440px] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b">
          <div className="flex items-start justify-between pr-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {task.code && (
                  <span className="text-xs font-mono text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                    {task.code}
                  </span>
                )}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
                    statusCfg.color
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.dot)} />
                  {statusCfg.label}
                </span>
              </div>
              <SheetTitle className="text-base leading-snug">{task.title}</SheetTitle>
              {task.task_group && (
                <SheetDescription className="mt-0.5">{task.task_group}</SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="px-5 pt-3 border-b">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1 text-xs">Thông tin</TabsTrigger>
              <TabsTrigger value="progress" className="flex-1 text-xs">Tiến độ</TabsTrigger>
              <TabsTrigger value="result" className="flex-1 text-xs">Kết quả</TabsTrigger>
              <TabsTrigger value="history" className="flex-1 text-xs">Lịch sử</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === 'info' && (
            <div className="space-y-5">
              {/* Section 1: Phân công */}
              <div>
                <SectionHeading icon={<Building2 className="h-4 w-4" />} title="Phân công" />
                <div className="divide-y divide-gray-50">
                  <InfoRow label="PB yêu cầu">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                        DEPT_BADGE_CONFIG[requestDeptCode] ?? 'bg-gray-50 text-gray-700 border-gray-200'
                      )}
                    >
                      {task.request_department?.name ?? '—'}
                    </span>
                  </InfoRow>
                  <InfoRow label="PB thực hiện">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                        deptBadgeClass
                      )}
                    >
                      {task.execute_department?.name ?? '—'}
                    </span>
                  </InfoRow>
                  <InfoRow label="Người yêu cầu">
                    <span className="flex items-center gap-1.5">
                      <User className="h-3 w-3 text-gray-400" />
                      {task.request_user?.full_name ?? '—'}
                    </span>
                  </InfoRow>
                  <InfoRow label="Người xử lý">
                    <span className="flex items-center gap-1.5">
                      <User className="h-3 w-3 text-gray-400" />
                      {task.assignee?.full_name ?? 'Chưa phân công'}
                    </span>
                  </InfoRow>
                </div>
              </div>

              <Separator />

              {/* Section 2: Nội dung */}
              <div>
                <SectionHeading icon={<ClipboardCheck className="h-4 w-4" />} title="Nội dung công việc" />
                <div className="divide-y divide-gray-50">
                  <InfoRow label="Tiêu chuẩn đạt">
                    {task.success_criteria ?? '—'}
                  </InfoRow>
                  {task.description && (
                    <InfoRow label="Mô tả chi tiết">
                      <span className="whitespace-pre-wrap">{task.description}</span>
                    </InfoRow>
                  )}
                  {task.attachment_url && (
                    <InfoRow label="File đính kèm">
                      <a
                        href={task.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        Xem file <ExternalLink className="h-3 w-3" />
                      </a>
                    </InfoRow>
                  )}
                </div>
              </div>

              <Separator />

              {/* Section 3: Thời gian */}
              <div>
                <SectionHeading icon={<Calendar className="h-4 w-4" />} title="Thời gian & Deadline" />
                <div className="divide-y divide-gray-50">
                  {task.time_quarter && <InfoRow label="Quý">Q{task.time_quarter}</InfoRow>}
                  {task.time_month && <InfoRow label="Tháng">Tháng {task.time_month}</InfoRow>}
                  {task.time_week && <InfoRow label="Tuần">{task.time_week}</InfoRow>}
                  <InfoRow label="Deadline">
                    {formatDate(task.due_date)}
                  </InfoRow>
                  {task.second_due_date && (
                    <>
                      <InfoRow label="Deadline lần 2">
                        <span className="text-orange-600">{formatDate(task.second_due_date)}</span>
                      </InfoRow>
                      {task.second_due_reason && (
                        <InfoRow label="Lý do gia hạn">
                          <span className="text-gray-600 text-xs">{task.second_due_reason}</span>
                        </InfoRow>
                      )}
                    </>
                  )}
                  {task.recurrence !== 'none' && (
                    <InfoRow label="Lặp lại">
                      <span className="flex items-center gap-1">
                        <RepeatIcon className="h-3 w-3 text-blue-500" />
                        {RECURRENCE_LABELS[task.recurrence] ?? task.recurrence}
                      </span>
                    </InfoRow>
                  )}
                </div>
              </div>

              <Separator />

              {/* Section 4: Mức độ ưu tiên */}
              <div>
                <SectionHeading icon={<AlertTriangle className="h-4 w-4" />} title="Mức độ ưu tiên" />
                <div className="divide-y divide-gray-50">
                  <InfoRow label="Độ gấp">
                    {PRIORITY_URGENCY_LABELS[task.priority_urgency] ?? task.priority_urgency}
                  </InfoRow>
                  <InfoRow label="Độ quan trọng">
                    {PRIORITY_IMPORTANCE_LABELS[task.priority_importance] ?? task.priority_importance}
                  </InfoRow>
                  <InfoRow label="Khối lượng">
                    {PRIORITY_WORKLOAD_LABELS[task.priority_workload] ?? task.priority_workload}
                  </InfoRow>
                  <InfoRow label="Tổng hệ số">
                    <span className="font-bold text-blue-700">{totalScore.toFixed(1)}</span>
                  </InfoRow>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-5">
              <SectionHeading icon={<Target className="h-4 w-4" />} title="Cập nhật tiến độ" />

              {/* Editable: Title */}
              <div>
                <Label className="text-sm mb-1 block">Tên hành động phối hợp *</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Tên công việc..."
                />
              </div>

              {/* Editable: Deadline */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm mb-1 block">Deadline lần 1</Label>
                  <Input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-sm mb-1 block">Deadline lần 2</Label>
                  <Input
                    type="date"
                    value={editSecondDueDate}
                    onChange={(e) => setEditSecondDueDate(e.target.value)}
                  />
                </div>
              </div>
              {editSecondDueDate && (
                <div>
                  <Label className="text-sm mb-1 block">Lý do gia hạn</Label>
                  <Input
                    value={editSecondDueReason}
                    onChange={(e) => setEditSecondDueReason(e.target.value)}
                    placeholder="Lý do gia hạn deadline..."
                  />
                </div>
              )}

              <Separator />

              {/* Progress slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-sm">Tiến độ hoàn thành</Label>
                  <span className="text-xl font-bold text-blue-700">{progress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="w-full h-2 rounded-full bg-gray-200 appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
                {/* Visual preview bar */}
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-3">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      progress === 100
                        ? 'bg-green-500'
                        : progress >= 50
                        ? 'bg-amber-400'
                        : 'bg-blue-500'
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Status selector */}
              <div>
                <Label className="text-sm mb-1 block">Trạng thái</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full inline-block', cfg.dot)} />
                          {cfg.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-sm mb-1 block">Ghi chú tiến độ</Label>
                <Textarea
                  placeholder="Mô tả tình trạng, vướng mắc, hoặc ghi chú cập nhật..."
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {progressError && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {progressError}
                </div>
              )}
              {progressSaved && (
                <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
                  Đã lưu thành công.
                </div>
              )}

              <Button className="w-full" onClick={handleSaveProgress} disabled={savingProgress}>
                {savingProgress ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Đang lưu...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1.5" />Lưu cập nhật</>
                )}
              </Button>
            </div>
          )}

          {activeTab === 'result' && (
            <div className="space-y-5">
              <SectionHeading icon={<CheckCircle2 className="h-4 w-4" />} title="Kết quả & Xác nhận" />

              {/* Result summary */}
              <div>
                <Label className="text-sm mb-1 block">Kết quả đạt được</Label>
                <Textarea
                  placeholder="Mô tả kết quả thực hiện, số liệu, thành phẩm..."
                  rows={3}
                  value={resultSummary}
                  onChange={(e) => setResultSummary(e.target.value)}
                />
              </div>

              {/* Result URL */}
              <div>
                <Label className="text-sm mb-1 block">Link kết quả / file nghiệm thu</Label>
                <Input
                  placeholder="https://drive.google.com/..."
                  value={resultUrl}
                  onChange={(e) => setResultUrl(e.target.value)}
                />
              </div>

              {/* Result quality */}
              <div>
                <Label className="text-sm mb-1 block">Đánh giá chất lượng kết quả</Label>
                <Select value={resultQuality} onValueChange={setResultQuality}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn đánh giá" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vuot_chuan">Vượt chuẩn</SelectItem>
                    <SelectItem value="dat_chuan">Đạt chuẩn</SelectItem>
                    <SelectItem value="dat_mot_phan">Đạt một phần</SelectItem>
                    <SelectItem value="khong_dat">Không đạt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {resultError && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {resultError}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={handleSaveResult}
                disabled={savingResult}
              >
                {savingResult ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Đang lưu...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1.5" />Lưu kết quả</>
                )}
              </Button>

              {task.confirmed_at ? (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-green-800">Đã xác nhận hoàn thành</p>
                    <p className="text-xs text-green-600">{formatDate(task.confirmed_at)}</p>
                  </div>
                </div>
              ) : canConfirm ? (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
                  <p className="text-xs text-blue-700">
                    Phòng yêu cầu xác nhận kết quả đã đạt tiêu chuẩn và đóng công việc này.
                  </p>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleConfirm}
                    disabled={confirming}
                  >
                    {confirming ? (
                      <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Đang xác nhận...</>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4 mr-1.5" />Xác nhận hoàn thành</>
                    )}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic text-center">
                  Chỉ phòng yêu cầu mới có thể xác nhận hoàn thành.
                </p>
              )}

              {/* Show existing result data if saved */}
              {(task.result_summary || task.result_quality) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Kết quả đã lưu</p>
                    {task.result_summary && (
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{task.result_summary}</p>
                    )}
                    {task.result_quality && (
                      <span className={cn(
                        'inline-flex rounded-md border px-2 py-0.5 text-xs font-medium',
                        task.result_quality === 'vuot_chuan'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : task.result_quality === 'dat_chuan'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : task.result_quality === 'dat_mot_phan'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      )}>
                        {RESULT_QUALITY_LABELS[task.result_quality]}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <SectionHeading icon={<History className="h-4 w-4" />} title="Lịch sử thay đổi" />
              {history.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-8">Chưa có lịch sử.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => {
                    const oldVal = entry.old_value as Record<string, unknown> | null
                    const newVal = entry.new_value as Record<string, unknown> | null
                    return (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="h-2 w-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 w-px bg-gray-100 mt-1" />
                        </div>
                        <div className="pb-3 flex-1">
                          <p className="text-xs font-medium text-gray-700">
                            {ACTION_LABELS[entry.action] ?? entry.action}
                          </p>
                          {entry.action === 'status_changed' && oldVal && newVal && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {(STATUS_CONFIG as Record<string, { label: string }>)[oldVal.status as string]?.label ?? String(oldVal.status)}
                              {' → '}
                              {(STATUS_CONFIG as Record<string, { label: string }>)[newVal.status as string]?.label ?? String(newVal.status)}
                            </p>
                          )}
                          {entry.action === 'progress_updated' && oldVal && newVal && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {oldVal.progress as number}% → {newVal.progress as number}%
                            </p>
                          )}
                          {entry.note && (
                            <p className="text-xs text-gray-500 mt-0.5 italic">{entry.note}</p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-1">
                            {formatDate(entry.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
