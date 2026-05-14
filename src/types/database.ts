export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type TaskStatus =
  | 'chua_hoan_thanh'
  | 'dang_trien_khai'
  | 'da_hoan_thanh'
  | 'cho_phoi_hop'
  | 'tam_dung'
  | 'qua_han'

export type UserRole = 'admin' | 'bdi' | 'truong_phong' | 'staff' | 'viewer'

export type Recurrence = 'none' | 'weekly' | 'monthly' | 'meeting_schedule'

export type ResultQuality = 'dat_chuan' | 'vuot_chuan' | 'khong_dat' | 'dat_mot_phan'

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string
          code: string
          name: string
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          color?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          department_id: string | null
          role: UserRole
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          department_id?: string | null
          role?: UserRole
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          department_id?: string | null
          role?: UserRole
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      plans: {
        Row: {
          id: string
          title: string
          type: 'year' | 'quarter' | 'month' | 'week'
          year: number
          quarter: number | null
          month: number | null
          week: number | null
          department_id: string | null
          owner_id: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          type: 'year' | 'quarter' | 'month' | 'week'
          year: number
          quarter?: number | null
          month?: number | null
          week?: number | null
          department_id?: string | null
          owner_id?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          type?: 'year' | 'quarter' | 'month' | 'week'
          year?: number
          quarter?: number | null
          month?: number | null
          week?: number | null
          department_id?: string | null
          owner_id?: string | null
          status?: string
          created_at?: string
        }
      }
      coordination_tasks: {
        Row: {
          id: string
          code: string | null
          request_department_id: string
          execute_department_id: string
          request_user_id: string
          assignee_id: string | null
          supervisor_ids: string[] | null
          plan_id: string | null
          task_group: string | null
          title: string
          success_criteria: string | null
          description: string | null
          attachment_url: string | null
          time_quarter: number | null
          time_month: number | null
          time_week: string | null
          due_date: string | null
          second_due_date: string | null
          second_due_reason: string | null
          recurrence: Recurrence
          priority_urgency: number
          priority_importance: number
          priority_workload: number
          total_score: number | null
          progress_percent: number
          status: TaskStatus
          result_summary: string | null
          result_url: string | null
          result_quality: ResultQuality | null
          confirmed_at: string | null
          confirmed_by: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code?: string | null
          request_department_id: string
          execute_department_id: string
          request_user_id: string
          assignee_id?: string | null
          supervisor_ids?: string[] | null
          plan_id?: string | null
          task_group?: string | null
          title: string
          success_criteria?: string | null
          description?: string | null
          attachment_url?: string | null
          time_quarter?: number | null
          time_month?: number | null
          time_week?: string | null
          due_date?: string | null
          second_due_date?: string | null
          second_due_reason?: string | null
          recurrence?: Recurrence
          priority_urgency?: number
          priority_importance?: number
          priority_workload?: number
          progress_percent?: number
          status?: TaskStatus
          result_summary?: string | null
          result_url?: string | null
          result_quality?: ResultQuality | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string | null
          request_department_id?: string
          execute_department_id?: string
          request_user_id?: string
          assignee_id?: string | null
          supervisor_ids?: string[] | null
          plan_id?: string | null
          task_group?: string | null
          title?: string
          success_criteria?: string | null
          description?: string | null
          attachment_url?: string | null
          time_quarter?: number | null
          time_month?: number | null
          time_week?: string | null
          due_date?: string | null
          second_due_date?: string | null
          second_due_reason?: string | null
          recurrence?: Recurrence
          priority_urgency?: number
          priority_importance?: number
          priority_workload?: number
          progress_percent?: number
          status?: TaskStatus
          result_summary?: string | null
          result_url?: string | null
          result_quality?: ResultQuality | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      task_history: {
        Row: {
          id: string
          task_id: string
          user_id: string | null
          action: string
          old_value: Json | null
          new_value: Json | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id?: string | null
          action: string
          old_value?: Json | null
          new_value?: Json | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string | null
          action?: string
          old_value?: Json | null
          new_value?: Json | null
          note?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          task_id: string | null
          type: string
          title: string
          message: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          task_id?: string | null
          type: string
          title: string
          message?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          task_id?: string | null
          type?: string
          title?: string
          message?: string | null
          is_read?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type Department = Database['public']['Tables']['departments']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Plan = Database['public']['Tables']['plans']['Row']
export type CoordinationTask = Database['public']['Tables']['coordination_tasks']['Row']
export type TaskHistory = Database['public']['Tables']['task_history']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

// Joined types for components
export type CoordinationTaskWithRelations = CoordinationTask & {
  execute_department: Department | null
  request_department: Department | null
  assignee: Profile | null
  request_user: Profile | null
}

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; dot: string }> = {
  chua_hoan_thanh: {
    label: 'Chưa hoàn thành',
    color: 'bg-red-50 text-red-700 border-red-300',
    dot: 'bg-red-500',
  },
  dang_trien_khai: {
    label: 'Đang triển khai',
    color: 'bg-amber-50 text-amber-700 border-amber-300',
    dot: 'bg-amber-500',
  },
  da_hoan_thanh: {
    label: 'Đã hoàn thành',
    color: 'bg-green-50 text-green-700 border-green-300',
    dot: 'bg-green-500',
  },
  cho_phoi_hop: {
    label: 'Chờ phối hợp',
    color: 'bg-blue-50 text-blue-700 border-blue-300',
    dot: 'bg-blue-500',
  },
  tam_dung: {
    label: 'Tạm dừng',
    color: 'bg-gray-100 text-gray-600 border-gray-300',
    dot: 'bg-gray-400',
  },
  qua_han: {
    label: 'Quá hạn',
    color: 'bg-red-100 text-red-800 border-red-400',
    dot: 'bg-red-600',
  },
}

export const DEPT_BADGE_CONFIG: Record<string, string> = {
  MKT: 'bg-blue-50 text-blue-800 border-blue-200',
  OTC: 'bg-green-50 text-green-800 border-green-200',
  ETC: 'bg-amber-50 text-amber-800 border-amber-200',
  HCNS: 'bg-purple-50 text-purple-800 border-purple-200',
  TCKT: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  SA: 'bg-orange-50 text-orange-800 border-orange-200',
  RD: 'bg-pink-50 text-pink-800 border-pink-200',
  BDH: 'bg-gray-50 text-gray-800 border-gray-200',
  MKT_text: 'text-blue-800',
}

export const TASK_GROUPS_BY_DEPT: Record<string, string[]> = {
  HCNS: ['Tuyển dụng', 'Vinh Danh'],
  TCKT: ['Dữ liệu', 'Thanh toán'],
  OTC: ['Họp đánh giá KQ', 'Hoạt động thúc đẩy bán', 'Hội thảo', 'CSKH', 'Khảo sát'],
  ETC: ['Hoạt động thúc đẩy bán', 'CSKH', 'Hội thảo'],
  SA: ['Ban hành văn bản', 'Mua sắm CCDC', 'In ấn – Cấp phát'],
  RD: ['Triển khai SP', 'Thiết kế nhãn bao bì', 'Khảo sát'],
  MKT: ['Kế hoạch MKT', 'Chiến dịch', 'Nội dung'],
}
