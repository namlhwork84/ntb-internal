-- =============================================
-- NTB PHARMA NEW — Quản trị nội bộ
-- Chạy file này trong Supabase SQL Editor
-- =============================================

-- Phòng ban
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  color text,
  created_at timestamptz DEFAULT now()
);

-- Người dùng (extend Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  department_id uuid REFERENCES departments(id),
  role text NOT NULL DEFAULT 'staff',
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Kế hoạch
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL,
  year int NOT NULL,
  quarter int,
  month int,
  week int,
  department_id uuid REFERENCES departments(id),
  owner_id uuid REFERENCES profiles(id),
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Công việc phối hợp liên phòng ban
CREATE TABLE IF NOT EXISTS coordination_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,

  request_department_id uuid NOT NULL REFERENCES departments(id),
  execute_department_id uuid NOT NULL REFERENCES departments(id),
  request_user_id uuid NOT NULL REFERENCES profiles(id),
  assignee_id uuid REFERENCES profiles(id),
  supervisor_ids uuid[],

  plan_id uuid REFERENCES plans(id),
  task_group text,

  title text NOT NULL,
  success_criteria text,
  description text,
  attachment_url text,

  time_quarter int,
  time_month int,
  time_week text,
  due_date date,

  second_due_date date,
  second_due_reason text,

  recurrence text DEFAULT 'none',

  priority_urgency int DEFAULT 2,
  priority_importance int DEFAULT 3,
  priority_workload int DEFAULT 2,
  total_score numeric GENERATED ALWAYS AS (priority_urgency * priority_importance * (priority_workload::numeric/2)) STORED,

  progress_percent int DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'chua_hoan_thanh',

  result_summary text,
  result_url text,
  result_quality text,

  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES profiles(id),

  notes text,

  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Lịch sử
CREATE TABLE IF NOT EXISTS task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES coordination_tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz DEFAULT now()
);

-- Thông báo
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  task_id uuid REFERENCES coordination_tasks(id),
  type text NOT NULL,
  title text NOT NULL,
  message text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_tasks_status ON coordination_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON coordination_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_execute_dept ON coordination_tasks(execute_department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_request_dept ON coordination_tasks(request_department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON coordination_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_history_task ON task_history(task_id);

-- =============================================
-- TRIGGER: auto-update updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON coordination_tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON coordination_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- TRIGGER: auto-generate code PH-YYYY-MM-NNN
-- =============================================
CREATE OR REPLACE FUNCTION generate_task_code()
RETURNS TRIGGER AS $$
DECLARE seq int;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM coordination_tasks
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now())
    AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM now());
  NEW.code := 'PH-' || TO_CHAR(now(), 'YYYY-MM') || '-' || LPAD(seq::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_code ON coordination_tasks;
CREATE TRIGGER trg_generate_code
  BEFORE INSERT ON coordination_tasks
  FOR EACH ROW EXECUTE FUNCTION generate_task_code();

-- =============================================
-- TRIGGER: audit log
-- =============================================
CREATE OR REPLACE FUNCTION log_task_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO task_history(task_id, action, old_value, new_value)
    VALUES (NEW.id, 'status_changed',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status));
  END IF;
  IF OLD.progress_percent IS DISTINCT FROM NEW.progress_percent THEN
    INSERT INTO task_history(task_id, action, old_value, new_value)
    VALUES (NEW.id, 'progress_updated',
      jsonb_build_object('progress', OLD.progress_percent),
      jsonb_build_object('progress', NEW.progress_percent));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_task_change ON coordination_tasks;
CREATE TRIGGER trg_log_task_change
  AFTER UPDATE ON coordination_tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_change();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE coordination_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Admin/BĐH thấy tất cả (phải tạo trước vì có FOR ALL)
DROP POLICY IF EXISTS "admin_see_all" ON coordination_tasks;
CREATE POLICY "admin_see_all" ON coordination_tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'bdi'))
  );

-- Staff thấy task của phòng mình
DROP POLICY IF EXISTS "staff_see_own_dept" ON coordination_tasks;
CREATE POLICY "staff_see_own_dept" ON coordination_tasks
  FOR SELECT USING (
    execute_department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
    OR request_department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Notification: chỉ thấy của mình
DROP POLICY IF EXISTS "own_notifications" ON notifications;
CREATE POLICY "own_notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Profiles: mọi user đã login đều đọc được (để xem tên người xử lý)
DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_all" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- User chỉ update profile của mình
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- =============================================
-- SEED DATA — PHÒNG BAN
-- =============================================
INSERT INTO departments (code, name, color) VALUES
  ('MKT',  'Marketing',         '#185FA5'),
  ('OTC',  'Kênh OTC',          '#27500A'),
  ('ETC',  'Kênh ETC',          '#633806'),
  ('HCNS', 'Hành chính NS',     '#3C3489'),
  ('TCKT', 'Tài chính KT',      '#085041'),
  ('SA',   'Sales Admin',       '#712B13'),
  ('RD',   'Nghiên cứu PT',     '#72243E'),
  ('BDH',  'Ban Điều hành',     '#444441')
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- Hàm tạo profile tự động khi user đăng ký
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
