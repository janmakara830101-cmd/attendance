import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/payroll/process  { month: '2026-06' }
export async function POST(req: NextRequest) {
  try {
    const { month } = await req.json()
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month ត្រូវជា YYYY-MM' }, { status: 400 })
    }

    const supabase  = createAdminClient()
    const [yearStr, monthStr] = month.split('-')
    const year      = Number(yearStr)
    const monthNum  = Number(monthStr)
    const daysInMo  = new Date(year, monthNum, 0).getDate()
    const startDate = `${month}-01`
    const endDate   = `${month}-${String(daysInMo).padStart(2, '0')}`

    // Office deduction rules
    const { data: cfg } = await supabase.from('settings').select('*').single()
    const lateDeductPer   = Number(cfg?.late_deduction_usd   ?? 5)
    const absentDeductPer = Number(cfg?.absent_deduction_usd ?? 15)

    // Count working days (Mon–Fri)
    let workingDays = 0
    for (let d = 1; d <= daysInMo; d++) {
      const dow = new Date(year, monthNum - 1, d).getDay()
      if (dow !== 0 && dow !== 6) workingDays++
    }

    // Active employees
    const { data: employees, error: empErr } = await supabase
      .from('profiles').select('*').eq('active_status', true)
    if (empErr || !employees?.length) {
      return NextResponse.json({ error: 'រកមិនឃើញបុគ្គលិក' }, { status: 404 })
    }

    const results = []

    for (const emp of employees) {
      const { data: att } = await supabase
        .from('attendance')
        .select('status')
        .eq('employee_id', emp.id)
        .gte('date', startDate)
        .lte('date', endDate)

      const lateCount    = att?.filter(a => a.status === 'Late').length    ?? 0
      const presentCount = att?.filter(a => ['Present', 'Late'].includes(a.status)).length ?? 0
      const absentDays   = Math.max(0, workingDays - presentCount)

      const lateDeduct   = lateCount   * lateDeductPer
      const absentDeduct = absentDays  * absentDeductPer
      const totalDeduct  = lateDeduct  + absentDeduct

      const reasonParts  = [
        lateCount   > 0 ? `ចូលយឺត ${lateCount} ដង ($${lateDeduct})` : '',
        absentDays  > 0 ? `អវត្តមាន ${absentDays} ថ្ងៃ ($${absentDeduct})` : '',
      ].filter(Boolean)
      const deductionReasons = reasonParts.length ? reasonParts.join(', ') : 'គ្មាន'

      // Preserve existing bonuses if record exists
      const { data: existing } = await supabase
        .from('payroll')
        .select('*')
        .eq('employee_id', emp.id)
        .eq('month', monthNum)
        .eq('year', year)
        .maybeSingle()

      const bonuses      = existing?.bonuses      ?? 0
      const bonusReasons = existing?.bonus_reasons ?? null

      const payload = {
        employee_id:       emp.id,
        month:             monthNum,
        year:              year,
        base_salary:       emp.base_salary,
        deductions:        totalDeduct,
        deduction_reasons: deductionReasons,
        bonuses,
        bonus_reasons:     bonusReasons,
        payment_status:    existing?.payment_status ?? 'Pending',
      }

      if (existing) {
        await supabase.from('payroll').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('payroll').insert(payload)
      }

      const net = emp.base_salary - totalDeduct + bonuses
      results.push({
        name: emp.name, base: emp.base_salary,
        lateCount, absentDays, deductions: totalDeduct, bonuses, net,
      })
    }

    return NextResponse.json({
      success: true, month, working_days: workingDays,
      employees_processed: results.length, results,
    })
  } catch (e) {
    console.error('[Payroll Process]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
