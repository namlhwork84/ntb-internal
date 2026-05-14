'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { DEPT_BADGE_CONFIG } from '@/types/database'
import type { Department, Profile, UserRole } from '@/types/database'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { UserPlus, Pencil, Search, ShieldCheck, User, Users, CheckCircle2, XCircle } from 'lucide-react'

const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  admin:        { label: 'Quản trị viên', color: 'bg-red-50 text-red-700 border-red-200' },
  bdi:          { label: 'Ban Điều hành', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  truong_phong: { label: 'Trưởng phòng',  color: 'bg-blue-50 text-blue-700 border-blue-200' },
  staff:        { label: 'Nhân viên',     color: 'bg-gray-50 text-gray-700 border-gray-200' },
  viewer:       { label: 'Chỉ xem',       color: 'bg-slate-50 text-slate-600 border-slate-200' },
}

interface UserFormState {
  email: string
  password: string
  full_name: string
  department_id: string
  role: UserRole
  phone: string
}

const EMPTY_FORM: UserFormState = {
  email: '',
  password: '',
  full_name: '',
  department_id: '',
  role: 'staff',
  phone: '',
}

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: depts } = await supabase.from('departments').select('*').order('code')
    const { data: profs } = await supabase.from('profiles').select('*').order('full_name')
    const { data: { user } } = await supabase.auth.getUser()

    if (depts) setDepartments(depts as Department[])
    if (profs) {
      setProfiles(profs as Profile[])
      if (user) setCurrentProfile((profs as Profile[]).find((p) => p.id === user.id) ?? null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const isAdmin = currentProfile?.role === 'admin'

  // Filter profiles
  const filtered = profiles.filter((p) => {
    if (search && !p.full_name.toLowerCase().includes(search.toLowerCase())) return false
    if (deptFilter !== 'all' && p.department_id !== deptFilter) return false
    if (roleFilter !== 'all' && p.role !== roleFilter) return false
    return true
  })

  function openCreate() {
    setEditingProfile(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormSuccess(null)
    setDialogOpen(true)
  }

  function openEdit(profile: Profile) {
    setEditingProfile(profile)
    setForm({
      email: '',
      password: '',
      full_name: profile.full_name,
      department_id: profile.department_id ?? '',
      role: profile.role,
      phone: profile.phone ?? '',
    })
    setFormError(null)
    setFormSuccess(null)
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setFormError(null)
    setFormSuccess(null)

    if (editingProfile) {
      // UPDATE existing profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('profiles') as any).update({
        full_name: form.full_name.trim(),
        department_id: form.department_id || null,
        role: form.role,
        phone: form.phone.trim() || null,
      }).eq('id', editingProfile.id)

      setSaving(false)
      if (error) { setFormError(error.message); return }
      setFormSuccess('Cập nhật thành công.')
      await loadData()
    } else {
      // CREATE new user via API route
      if (!form.email.trim() || !form.password || !form.full_name.trim()) {
        setFormError('Vui lòng điền đầy đủ Email, Mật khẩu, và Họ tên.')
        setSaving(false)
        return
      }

      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          department_id: form.department_id || null,
          role: form.role,
          phone: form.phone.trim() || null,
        }),
      })
      const json = await res.json()
      setSaving(false)
      if (!res.ok) { setFormError(json.error ?? 'Lỗi tạo tài khoản.'); return }
      setFormSuccess('Tạo tài khoản thành công.')
      await loadData()
    }
  }

  async function handleToggleActive(profile: Profile) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any)
      .update({ is_active: !profile.is_active })
      .eq('id', profile.id)
    await loadData()
  }

  const deptById = Object.fromEntries(departments.map((d) => [d.id, d]))

  // Stats
  const totalActive = profiles.filter((p) => p.is_active).length
  const byRole = Object.fromEntries(
    (Object.keys(ROLE_CONFIG) as UserRole[]).map((r) => [r, profiles.filter((p) => p.role === r).length])
  )

  return (
    <div className="flex flex-col h-full">
      <Header title="Quản lý người dùng" />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Đang tải...</div>
        ) : (
          <>
            {/* ── Stats row ── */}
            <div className="grid grid-cols-6 gap-3">
              <StatCard icon={<Users className="h-4 w-4" />} label="Tổng user" value={profiles.length} color="blue" />
              <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Đang hoạt động" value={totalActive} color="green" />
              {(Object.entries(ROLE_CONFIG) as [UserRole, { label: string; color: string }][]).map(([role, cfg]) => (
                <StatCard key={role} icon={<ShieldCheck className="h-4 w-4" />} label={cfg.label} value={byRole[role] ?? 0} color="gray" />
              ))}
            </div>

            {/* ── Filter + Create ── */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Tìm tên người dùng..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Phòng ban" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả phòng ban</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Vai trò" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả vai trò</SelectItem>
                  {(Object.entries(ROLE_CONFIG) as [UserRole, { label: string }][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Button size="sm" className="ml-auto" onClick={openCreate}>
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Tạo tài khoản
                </Button>
              )}
            </div>

            {/* ── User table ── */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-8">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Họ tên</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[140px]">Phòng ban</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[140px]">Vai trò</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[120px]">SĐT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[100px]">Trạng thái</th>
                    {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[100px]">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="text-center text-gray-400 text-sm py-12">
                        Không tìm thấy người dùng.
                      </td>
                    </tr>
                  ) : filtered.map((p, idx) => {
                    const dept = deptById[p.department_id ?? '']
                    const roleConf = ROLE_CONFIG[p.role]
                    const deptBadge = dept ? (DEPT_BADGE_CONFIG[dept.code] ?? 'bg-gray-50 text-gray-700 border-gray-200') : ''
                    const isMe = p.id === currentProfile?.id

                    return (
                      <tr key={p.id} className={cn('border-b border-gray-50 transition-colors', !p.is_active && 'opacity-50', isMe && 'bg-blue-50/30')}>
                        <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-700 flex-shrink-0">
                              {p.full_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {p.full_name}
                                {isMe && <span className="ml-1.5 text-[10px] text-blue-500 font-normal">(bạn)</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {dept ? (
                            <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', deptBadge)}>
                              {dept.name}
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', roleConf.color)}>
                            {roleConf.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{p.phone ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1 text-xs font-medium',
                            p.is_active ? 'text-green-600' : 'text-gray-400'
                          )}>
                            {p.is_active
                              ? <><CheckCircle2 className="h-3.5 w-3.5" />Hoạt động</>
                              : <><XCircle className="h-3.5 w-3.5" />Vô hiệu</>
                            }
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEdit(p)}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {p.id !== currentProfile?.id && (
                                <button
                                  onClick={() => handleToggleActive(p)}
                                  className={cn('text-xs font-medium transition-colors',
                                    p.is_active ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-green-600'
                                  )}
                                  title={p.is_active ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
                                >
                                  {p.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Chỉnh sửa người dùng' : 'Tạo tài khoản mới'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!editingProfile && (
              <>
                <div>
                  <Label>Email *</Label>
                  <Input className="mt-1" type="email" placeholder="ten@ntbpharmanew.vn"
                    value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <Label>Mật khẩu *</Label>
                  <Input className="mt-1" type="password" placeholder="Tối thiểu 8 ký tự"
                    value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                </div>
                <Separator />
              </>
            )}

            <div>
              <Label>Họ và tên *</Label>
              <Input className="mt-1" placeholder="Nguyễn Văn A"
                value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phòng ban</Label>
                <Select value={form.department_id} onValueChange={(v) => setForm((f) => ({ ...f, department_id: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Chọn phòng" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vai trò</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as UserRole }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ROLE_CONFIG) as [UserRole, { label: string }][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Số điện thoại</Label>
              <Input className="mt-1" placeholder="0912 345 678"
                value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>

            {formError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{formError}</div>
            )}
            {formSuccess && (
              <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">{formSuccess}</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Đang lưu...' : editingProfile ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Local stat card ────────────────────────────────────────────────────────────
const STAT_COLORS = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  gray: 'bg-gray-50 text-gray-500',
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: number
  color: keyof typeof STAT_COLORS
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-2.5">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', STAT_COLORS[color])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
        <p className="text-lg font-bold text-gray-800 leading-tight">{value}</p>
      </div>
    </div>
  )
}
