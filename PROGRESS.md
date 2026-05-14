# PROGRESS — NTB Internal

> **Cập nhật mỗi lần kết thúc session làm việc.**
> Khi clone về máy mới: đọc file này trước, sau đó đọc `CLAUDE.md`.

---

## Trạng thái deploy

| Môi trường | URL | Trạng thái |
|---|---|---|
| Production | https://ntb-internal.vercel.app | ✅ Live |
| GitHub | https://github.com/namlhwork84/ntb-internal | ✅ Up to date |
| Supabase | Project đã link, schema đã chạy | ✅ Active |

---

## Đã hoàn thành (Giai đoạn 1)

### Infrastructure
- [x] Next.js 16 + TypeScript + Tailwind CSS v4 + shadcn/ui
- [x] Supabase Auth (email/password)
- [x] Supabase DB schema đầy đủ (xem `supabase/schema.sql`)
- [x] Deploy Vercel + env vars đã set
- [x] RLS policies: coordination_tasks, profiles, notifications, plans

### Pages
- [x] `/login` — đăng nhập
- [x] `/phoi-hop` — phối hợp liên phòng ban (module chính)
- [x] `/tong-quan` — dashboard tổng quan
- [x] `/cong-viec` — công việc cá nhân
- [x] `/ke-hoach` — kế hoạch tháng/quý
- [x] `/bao-cao/tien-do` — báo cáo tiến độ
- [x] `/bao-cao/canh-bao` — cảnh báo deadline
- [x] `/admin` — quản lý user, phân quyền

### Components
- [x] Sidebar (navy #1B3270 + active green #16A34A)
- [x] Header + NotificationPanel (bell icon realtime)
- [x] KpiCards (6 cards: Tổng/Hoàn thành/Đang TK/Quá hạn/Tỉ lệ HT/% Tiến độ TB)
- [x] TaskTable (3-level: Dept → Task group → Row, có cột Hệ số)
- [x] TaskDrawer (7 sections chi tiết)
- [x] TaskForm (modal tạo yêu cầu)
- [x] FilterBar

### Data & Logic
- [x] Import Excel tháng 5/2026 (`scripts/import-thang5.mjs`) — 24 tasks đã nhập
- [x] Auto-generate code PH-YYYY-MM-NNN
- [x] Audit log tự động (task_history)
- [x] Cron job cảnh báo deadline (`supabase/functions/deadline-alert/`)
- [x] Brand identity đồng bộ toàn UI theo logo NTB

---

## Đang làm / Chưa làm (Giai đoạn 2 & 3)

### Giai đoạn 2
- [ ] `/cong-viec` — hoàn thiện thêm: tạo công việc cá nhân mới
- [ ] `/ke-hoach` — liên kết task với kế hoạch khi tạo task mới
- [ ] Dashboard `/tong-quan` — charts Recharts (biểu đồ tiến độ theo tháng)

### Giai đoạn 3
- [ ] Export Excel (`src/lib/export-excel.ts` đã có skeleton)
- [ ] Export PDF
- [ ] `/admin` — hoàn thiện: reset password, đổi phòng ban
- [ ] Thông báo Zalo OA (chưa chốt — xem CLAUDE.md mục 13)
- [ ] Import Excel hàng tháng: cân nhắc làm UI upload thay vì chạy script

### Bugs / Cần xem lại
- [ ] `(supabase.from('plans') as any)` — TypeScript workaround, cần fix type đúng
- [ ] Sidebar collapse trên màn hình < 1280px chưa implement
- [ ] Công việc lặp lại (recurrence) — logic tạo instance mới chưa có

---

## Cách setup khi sang máy mới

```bash
# 1. Clone repo
git clone https://github.com/namlhwork84/ntb-internal.git
cd ntb-internal

# 2. Cài dependencies
npm install

# 3. Tạo file .env.local (lấy key từ Supabase dashboard)
cp .env.example .env.local
# Điền NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY

# 4. Chạy local
npm run dev
```

> **Lưu ý:** `.env.local` không có trong repo (đã gitignore).
> Lấy key tại: Supabase Dashboard → Project Settings → API

---

## Session log

| Ngày | Nội dung |
|---|---|
| 11/05/2026 | Khởi tạo dự án, schema DB, layout, `/phoi-hop` cơ bản |
| 12/05/2026 | Auth, Drawer, Form, Notification, RLS, `/bao-cao`, `/ke-hoach` |
| 13/05/2026 | Deploy Vercel, import Excel tháng 5, fix mappings, sub-grouping TaskTable |
| 14/05/2026 | Brand identity (navy+green), đồng bộ toàn UI, push GitHub |
