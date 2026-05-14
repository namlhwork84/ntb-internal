'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Department } from '@/types/database'

interface FilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  deptFilter: string
  onDeptChange: (v: string) => void
  statusFilter: string
  onStatusChange: (v: string) => void
  weekFilter: string
  onWeekChange: (v: string) => void
  departments: Department[]
  deptFilterLabel?: string
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'chua_hoan_thanh', label: 'Chưa hoàn thành' },
  { value: 'dang_trien_khai', label: 'Đang triển khai' },
  { value: 'da_hoan_thanh', label: 'Đã hoàn thành' },
  { value: 'cho_phoi_hop', label: 'Chờ phối hợp' },
  { value: 'tam_dung', label: 'Tạm dừng' },
  { value: 'qua_han', label: 'Quá hạn' },
]

const WEEK_OPTIONS = [
  { value: 'all', label: 'Tất cả tuần' },
  { value: 'Tuần 1', label: 'Tuần 1' },
  { value: 'Tuần 2', label: 'Tuần 2' },
  { value: 'Tuần 3', label: 'Tuần 3' },
  { value: 'Tuần 4', label: 'Tuần 4' },
  { value: 'Hàng tuần', label: 'Hàng tuần' },
]

export function FilterBar({
  search,
  onSearchChange,
  deptFilter,
  onDeptChange,
  statusFilter,
  onStatusChange,
  weekFilter,
  onWeekChange,
  departments,
  deptFilterLabel = 'Tất cả phòng ban',
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Tìm kiếm công việc..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Dept filter */}
      <Select value={deptFilter} onValueChange={onDeptChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Phòng ban" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{deptFilterLabel === 'Phòng yêu cầu' ? 'Tất cả phòng yêu cầu' : 'Tất cả phòng thực hiện'}</SelectItem>
          {departments.map((d) => (
            <SelectItem key={d.id} value={d.code}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Trạng thái" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Week filter */}
      <Select value={weekFilter} onValueChange={onWeekChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Tuần" />
        </SelectTrigger>
        <SelectContent>
          {WEEK_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
