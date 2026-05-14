import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  // Khởi tạo trong function để tránh lỗi build khi chưa có env vars
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const body = await req.json()
    const { email, password, full_name, department_id, role, phone } = body

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc.' }, { status: 400 })
    }

    // 1. Tạo auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? 'Lỗi tạo tài khoản.' }, { status: 400 })
    }

    // 2. Upsert profile
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: authData.user.id,
      full_name,
      department_id: department_id || null,
      role: role ?? 'staff',
      phone: phone || null,
      is_active: true,
    })

    if (profileError) {
      // Xóa auth user nếu profile thất bại
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, userId: authData.user.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
