import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTelegram, buildPayslipMessage } from '@/lib/telegram'

// POST /api/payroll/finalize  { month: '2026-06' }
// Marks all Pending payroll rows as Paid and sends Telegram payslips
export async function POST(req: NextRequest) {
  try {
    const { month } = await req.json()
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month ត្រូវជា YYYY-MM' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const [yearStr, monthStr] = month.split('-')
    const year     = Number(yearStr)
    const monthNum = Number(monthStr)

    // Fetch all pending payroll rows with employee profiles
    const { data: rows, error } = await supabase
      .from('payroll')
      .select('*, profiles(name, telegram_chat_id)')
      .eq('month', monthNum)
      .eq('year', year)
      .eq('payment_status', 'Pending')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!rows?.length) {
      return NextResponse.json({ message: 'គ្មានប្រាក់ខែដែលត្រូវទូទាត់' }, { status: 200 })
    }

    const paid: string[] = []

    for (const row of rows) {
      // Mark as Paid
      await supabase.from('payroll').update({
        payment_status: 'Paid',
        processed_at:   new Date().toISOString(),
      }).eq('id', row.id)

      // Send Telegram payslip to employee
      const profile = row.profiles as { name: string; telegram_chat_id: string | null } | null
      if (profile?.telegram_chat_id) {
        const msg = buildPayslipMessage({
          name:             profile.name,
          month,
          base:             Number(row.base_salary),
          bonuses:          Number(row.bonuses),
          bonusReasons:     row.bonus_reasons,
          deductions:       Number(row.deductions),
          deductionReasons: row.deduction_reasons,
          net:              Number(row.total_salary),
        })
        await sendTelegram(profile.telegram_chat_id, msg)
      }

      paid.push(profile?.name ?? row.employee_id)
    }

    return NextResponse.json({ success: true, month, paid_count: paid.length, paid })
  } catch (e) {
    console.error('[Payroll Finalize]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH /api/payroll/finalize  — adjust bonus / deduction for one record
export async function PATCH(req: NextRequest) {
  try {
    const { id, bonuses, bonus_reasons, deductions, deduction_reasons } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('payroll')
      .update({ bonuses, bonus_reasons, deductions, deduction_reasons })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[Payroll Adjust]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
