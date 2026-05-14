/**
 * Import KH MKT Tháng 5 từ Excel → Supabase coordination_tasks
 * Chạy: node scripts/import-thang5.mjs
 *
 * Yêu cầu: file .env.local phải có NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY
 */

import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('=').map(s => s.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join('=')])
)

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCellText(cell) {
  const v = cell?.value
  if (!v) return ''
  if (typeof v === 'object' && v.richText) return v.richText.map(x => x.text).join('').trim()
  if (v instanceof Date) return v.toISOString().split('T')[0]
  return String(v).trim()
}

function parseDeadline(text) {
  if (!text) return null
  // ISO date từ Date object đã được convert
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  // "15/5" → "2026-05-15"
  const dmMatch = text.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (dmMatch) return `2026-${String(dmMatch[2]).padStart(2,'0')}-${String(dmMatch[1]).padStart(2,'0')}`
  // "Trước 8/5" → "2026-05-08"
  const beforeMatch = text.match(/(\d{1,2})\/(\d{1,2})/)
  if (beforeMatch) return `2026-${String(beforeMatch[2]).padStart(2,'0')}-${String(beforeMatch[1]).padStart(2,'0')}`
  // Các text khác (Tháng 5, Theo kế hoạch...) → cuối tháng 5
  if (text.includes('Tháng 5') || text.includes('tháng 5')) return '2026-05-31'
  return null
}

function parseTimeWeek(row) {
  // C6=T1, C7=T2, C8=T3, C9=T4, C10=T5
  const weeks = []
  for (let c = 6; c <= 10; c++) {
    const v = getCellText(row.getCell(c))
    if (v === 'x' || v === 'X') weeks.push(`Tuần ${c - 5}`)
  }
  if (weeks.length === 5) return 'Hàng tuần'
  if (weeks.length === 0) return null
  if (weeks.length === 1) return weeks[0]
  return weeks.join(', ')
}

// Map assignee text → best guess cho task_group / execute_dept
function mapAssigneeToDept(assigneeText) {
  const t = assigneeText.toUpperCase()
  if (t.includes('HCNS')) return 'HCNS'
  if (t.includes('TCKT')) return 'TCKT'
  if (t.includes('RD')) return 'RD'
  if (t.includes('SA')) return 'SA'
  if (t.includes('OTC')) return 'OTC'
  if (t.includes('ETC')) return 'ETC'
  if (t.includes('AGENCY') || t.includes('THIẾT KẾ') || t.includes('THIET KE')) return 'MKT'
  return 'MKT'
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔌 Kết nối Supabase...')

  // Load departments
  const { data: depts, error: deptErr } = await supabase.from('departments').select('*')
  if (deptErr) { console.error('❌ Lỗi load departments:', deptErr.message); process.exit(1) }

  const deptMap = Object.fromEntries(depts.map(d => [d.code, d.id]))
  const mktId = deptMap['MKT']
  if (!mktId) { console.error('❌ Không tìm thấy phòng MKT trong DB. Hãy chạy seed data trước.'); process.exit(1) }

  console.log('✅ Departments:', Object.keys(deptMap).join(', '))

  // Load admin user để set created_by
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single()

  const createdBy = adminProfile?.id ?? null

  // Tạo plan "KH MKT Tháng 5/2026"
  const { data: existingPlan } = await supabase
    .from('plans')
    .select('id')
    .eq('title', 'KH MKT Tháng 5/2026')
    .single()

  let planId = existingPlan?.id ?? null

  if (!planId) {
    // eslint-disable-next-line no-undef
    const { data: newPlan, error: planErr } = await supabase.from('plans').insert({
      title: 'KH MKT Tháng 5/2026',
      type: 'month',
      year: 2026,
      quarter: 2,
      month: 5,
      department_id: mktId,
      owner_id: createdBy,
      status: 'active',
    }).select('id').single()

    if (planErr) {
      console.warn('⚠️  Không tạo được plan (có thể thiếu RLS INSERT cho plans):', planErr.message)
    } else {
      planId = newPlan.id
      console.log('✅ Tạo plan:', planId)
    }
  } else {
    console.log('✅ Dùng plan có sẵn:', planId)
  }

  // Đọc Excel
  console.log('\n📖 Đọc file Excel...')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile('G:/AI FOR WORK/QUẢN TRỊ NỘI BỘ/TEST KH Tháng 5.xlsx')
  const sheet = wb.worksheets[0]

  // Parse tasks (rows 18-47, bỏ group header rows)
  const tasks = []
  let currentGroup = ''

  sheet.eachRow((row, rowNum) => {
    if (rowNum < 18) return

    const stt  = getCellText(row.getCell(1))
    const title = getCellText(row.getCell(2))
    const criteria = getCellText(row.getCell(3))
    const assigneeText = getCellText(row.getCell(4))
    const deadlineText = getCellText(row.getCell(5))

    if (!title) return

    // Group header rows (Ưu tiên 1, Nhiệm vụ 4...)
    if (stt.startsWith('Ưu tiên') || stt.startsWith('Nhiệm vụ')) {
      currentGroup = title
      return
    }

    // Skip column definition rows
    if (title === 'Mục tiêu' || stt === 'STT') return

    const executeDeptCode = mapAssigneeToDept(assigneeText)
    const executeDeptId = deptMap[executeDeptCode] ?? mktId
    const dueDate = parseDeadline(deadlineText)
    const timeWeek = parseTimeWeek(row)

    tasks.push({
      request_department_id: mktId,
      execute_department_id: executeDeptId,
      request_user_id: createdBy,
      plan_id: planId,
      task_group: currentGroup || null,
      title: title,
      success_criteria: criteria || null,
      description: assigneeText ? `Người thực hiện: ${assigneeText}` : null,
      time_month: 5,
      time_quarter: 2,
      time_week: timeWeek,
      due_date: dueDate,
      status: 'chua_hoan_thanh',
      progress_percent: 0,
      priority_urgency: 2,
      priority_importance: 3,
      priority_workload: 2,
      created_by: createdBy,
    })
  })

  console.log(`📋 Tìm thấy ${tasks.length} tasks để import`)
  tasks.forEach((t, i) => {
    console.log(`  ${i+1}. [${t.task_group ?? 'Chung'}] ${t.title.substring(0, 60)}`)
    console.log(`     → Deadline: ${t.due_date ?? 'chưa có'} | Tuần: ${t.time_week ?? '—'} | PB: ${Object.keys(deptMap).find(k => deptMap[k] === t.execute_department_id)}`)
  })

  console.log('\n⬆️  Đang insert vào Supabase...')
  const { data: inserted, error: insertErr } = await supabase
    .from('coordination_tasks')
    .insert(tasks)
    .select('id, code, title')

  if (insertErr) {
    console.error('❌ Lỗi insert:', insertErr.message)
    process.exit(1)
  }

  console.log(`\n✅ Import thành công ${inserted.length} tasks!`)
  inserted.forEach(t => console.log(`  ${t.code ?? '—'} | ${t.title.substring(0, 50)}`))
}

main().catch(err => {
  console.error('❌ Lỗi:', err)
  process.exit(1)
})
