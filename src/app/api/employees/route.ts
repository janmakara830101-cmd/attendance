import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET  /api/employees  — list all employees
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/employees  — bulk import from Excel
// Body: { employees: [{ name, email, telegram_chat_id, base_salary }] }
export async function POST(req: NextRequest) {
  try {
    const { employees } = await req.json()
    if (!Array.isArray(employees) || !employees.length) {
      return NextResponse.json({ error: 'employees array required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const results  = { created: 0, failed: [] as string[] }

    for (const emp of employees) {
      if (!emp.email || !emp.name) { results.failed.push(emp.email ?? '?'); continue }

      // Create auth user (sends invite email)
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email:         emp.email,
        email_confirm: true,
        password:      Math.random().toString(36).slice(-10), // temp password
        user_metadata: { name: emp.name, role: 'employee' },
      })

      if (authErr || !authUser.user) {
        results.failed.push(emp.email)
        continue
      }

      // Update profile with extra fields
      await supabase.from('profiles').update({
        name:             emp.name,
        base_salary:      Number(emp.base_salary ?? 0),
        telegram_chat_id: emp.telegram_chat_id ?? null,
        active_status:    true,
      }).eq('id', authUser.user.id)

      results.created++
    }

    return NextResponse.json(results)
  } catch (e) {
    console.error('[Employees Import]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
