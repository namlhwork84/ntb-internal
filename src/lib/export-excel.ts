import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { CoordinationTaskWithRelations } from '@/types/database'
import { STATUS_CONFIG } from '@/types/database'
import { formatDate } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])
)

export async function exportTasksToExcel(
  tasks: CoordinationTaskWithRelations[],
  filename = 'phoi-hop-lien-phong-ban'
) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'NTB Pharma New — Quản Trị Nội Bộ'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Phối hợp liên PB', {
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' },
  })

  // ── Header row ─────────────────────────────────────────────────────────────
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF185FA5' }, // NTB blue
  }
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  const borderThin: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFDDDDDD' } }
  const allBorders: Partial<ExcelJS.Borders> = {
    top: borderThin, bottom: borderThin, left: borderThin, right: borderThin,
  }

  const columns: { header: string; key: string; width: number }[] = [
    { header: '#',              key: 'idx',          width: 5  },
    { header: 'Mã CV',         key: 'code',         width: 14 },
    { header: 'PB thực hiện',  key: 'exec_dept',    width: 14 },
    { header: 'PB yêu cầu',   key: 'req_dept',     width: 14 },
    { header: 'Nhóm NV',      key: 'task_group',   width: 18 },
    { header: 'Tên hành động', key: 'title',        width: 40 },
    { header: 'Tiêu chuẩn',   key: 'criteria',     width: 28 },
    { header: 'Người xử lý',  key: 'assignee',     width: 18 },
    { header: 'Tuần',         key: 'time_week',    width: 12 },
    { header: 'Deadline',     key: 'due_date',     width: 14 },
    { header: 'Tiến độ %',    key: 'progress',     width: 10 },
    { header: 'Trạng thái',   key: 'status',       width: 18 },
  ]

  sheet.columns = columns

  // Style header
  const headerRow = sheet.getRow(1)
  headerRow.height = 22
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.fill = headerFill
    cell.font = headerFont
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = allBorders
  })

  // ── Data rows ───────────────────────────────────────────────────────────────
  // Group by dept for visual clarity
  const grouped: Record<string, CoordinationTaskWithRelations[]> = {}
  for (const task of tasks) {
    const key = task.execute_department?.name ?? 'Khác'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(task)
  }

  let rowIdx = 1
  let globalIdx = 1

  for (const [deptName, deptTasks] of Object.entries(grouped)) {
    // Department group header
    const groupRow = sheet.addRow([`${deptName.toUpperCase()} — ${deptTasks.length} công việc`])
    groupRow.height = 18
    groupRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F8' } }
    groupRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF334155' } }
    groupRow.getCell(1).alignment = { vertical: 'middle' }
    sheet.mergeCells(groupRow.number, 1, groupRow.number, columns.length)
    rowIdx++

    for (const task of deptTasks) {
      const row = sheet.addRow({
        idx:        globalIdx++,
        code:       task.code ?? '',
        exec_dept:  task.execute_department?.code ?? '',
        req_dept:   task.request_department?.code ?? '',
        task_group: task.task_group ?? '',
        title:      task.title,
        criteria:   task.success_criteria ?? '',
        assignee:   task.assignee?.full_name ?? '',
        time_week:  task.time_week ?? '',
        due_date:   formatDate(task.due_date),
        progress:   task.progress_percent,
        status:     STATUS_LABELS[task.status] ?? task.status,
      })

      row.height = 20
      row.eachCell((cell, colNumber) => {
        cell.border = allBorders
        cell.alignment = { vertical: 'middle', wrapText: colNumber === 6 }
        cell.font = { size: 9 }
      })

      // Color-code progress cell
      const progressCell = row.getCell('progress')
      progressCell.alignment = { vertical: 'middle', horizontal: 'center' }
      if (task.progress_percent === 100) {
        progressCell.font = { size: 9, color: { argb: 'FF16A34A' }, bold: true }
      } else if (task.progress_percent >= 50) {
        progressCell.font = { size: 9, color: { argb: 'FFD97706' }, bold: true }
      }

      // Color-code status cell
      const statusCell = row.getCell('status')
      statusCell.alignment = { vertical: 'middle', horizontal: 'center' }
      if (task.status === 'da_hoan_thanh') {
        statusCell.font = { size: 9, color: { argb: 'FF16A34A' }, bold: true }
      } else if (task.status === 'qua_han') {
        statusCell.font = { size: 9, color: { argb: 'FFDC2626' }, bold: true }
      } else if (task.status === 'dang_trien_khai') {
        statusCell.font = { size: 9, color: { argb: 'FFD97706' }, bold: true }
      }

      rowIdx++
    }
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  sheet.addRow([])
  const footerRow = sheet.addRow([
    `Xuất lúc: ${new Date().toLocaleString('vi-VN')} — NTB Pharma New Quản Trị Nội Bộ`
  ])
  footerRow.getCell(1).font = { italic: true, size: 8, color: { argb: 'FF999999' } }
  sheet.mergeCells(footerRow.number, 1, footerRow.number, columns.length)

  // ── Export ──────────────────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const dateStr = new Date().toISOString().split('T')[0]
  saveAs(blob, `${filename}-${dateStr}.xlsx`)
}
