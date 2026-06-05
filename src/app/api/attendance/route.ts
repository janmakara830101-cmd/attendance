import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { haversineDistance } from '@/lib/haversine'
import { sendTelegram, notifyGroup } from '@/lib/telegram'
import type { AttendanceApiRequest } from '@/types'

// GET  /api/attendance?employee_id=xxx   → today's record
export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get('employee_id')
  if (!employeeId) return NextResponse.json({ error: 'employee_id required' }, { status: 400 })

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('date', today)
    .maybeSingle()

  return NextResponse.json(data ?? { check_in_time: null, check_out_time: null, status: null })
}

// POST /api/attendance  → check-in or check-out
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AttendanceApiRequest
    const { employee_id, latitude, longitude, type } = body

    if (!employee_id || latitude == null || longitude == null || !type) {
      return NextResponse.json({ error: 'ទិន្នន័យមិនគ្រប់គ្រាន់' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // ── Office settings ───────────────────────────────────────
    const { data: cfg, error: cfgErr } = await supabase
      .from('settings').select('*').single()
    if (cfgErr || !cfg) {
      return NextResponse.json({ error: 'មិនអាចទាញការកំណត់ការិយាល័យ' }, { status: 500 })
    }

    // ── Haversine distance check ──────────────────────────────
    const distance = haversineDistance(
      latitude, longitude,
      Number(cfg.office_lat), Number(cfg.office_lng),
    )
    const distM = Math.round(distance)

    if (distM > Number(cfg.allowed_radius_meters)) {
      return NextResponse.json({
        error: `អ្នកនៅឆ្ងាយពីការិយាល័យ ${distM} m — ត្រូវការ ≤ ${cfg.allowed_radius_meters} m`,
        distance: distM,
        allowed: false,
      }, { status: 403 })
    }

    // ── Employee profile ──────────────────────────────────────
    const { data: emp } = await supabase
      .from('profiles').select('*').eq('id', employee_id).single()
    if (!emp) return NextResponse.json({ error: 'រកមិនឃើញបុគ្គលិក' }, { status: 404 })

    const today = new Date().toISOString().split('T')[0]
    const now   = new Date()
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    })

    // ── Existing record for today ─────────────────────────────
    const { data: rec } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('date', today)
      .maybeSingle()

    // ── CHECK-IN ──────────────────────────────────────────────
    if (type === 'check_in') {
      if (rec?.check_in_time) {
        return NextResponse.json({ error: 'អ្នកបានចូលធ្វើការហើយថ្ងៃនេះ' }, { status: 409 })
      }

      const [lH, lM] = cfg.check_in_limit.split(':').map(Number)
      const limit = new Date(now); limit.setHours(lH, lM, 0, 0)
      const status = now > limit ? 'Late' : 'Present'

      const payload = {
        employee_id,
        date: today,
        check_in_time: now.toISOString(),
        status,
        check_in_lat: latitude,
        check_in_lng: longitude,
        location_lat: latitude,
        location_lng: longitude,
      }

      if (rec) {
        await supabase.from('attendance').update(payload).eq('id', rec.id)
      } else {
        await supabase.from('attendance').insert(payload)
      }

      const statusLabel = status === 'Late' ? '⏰ យឺត' : '✅ ទាន់ម៉ោង'
      await notifyGroup(
        `📢 <b>${emp.name}</b> បានចូលធ្វើការ\n⏰ ${timeStr}  |  ${statusLabel}\n📍 ចម្ងាយ: ${distM} m`,
      )
      if (emp.telegram_chat_id) {
        await sendTelegram(
          emp.telegram_chat_id,
          `✅ ចូលធ្វើការ!\n⏰ ${timeStr}\nស្ថានភាព: ${status === 'Late' ? 'យឺត' : 'ទាន់ម៉ោង'}\n📍 ${distM} m ពីការិយាល័យ`,
        )
      }

      return NextResponse.json({ success: true, status, time: timeStr, distance: distM })
    }

    // ── CHECK-OUT ─────────────────────────────────────────────
    if (type === 'check_out') {
      if (!rec?.check_in_time) {
        return NextResponse.json({ error: 'មិនទាន់ចូលធ្វើការ — សូមចូលធ្វើការជាមុនសិន' }, { status: 400 })
      }
      if (rec.check_out_time) {
        return NextResponse.json({ error: 'អ្នកបានចេញធ្វើការហើយថ្ងៃនេះ' }, { status: 409 })
      }

      await supabase.from('attendance').update({
        check_out_time: now.toISOString(),
        check_out_lat: latitude,
        check_out_lng: longitude,
      }).eq('id', rec.id)

      await notifyGroup(
        `📢 <b>${emp.name}</b> បានចេញធ្វើការ\n⏰ ${timeStr}  |  📍 ${distM} m`,
      )
      if (emp.telegram_chat_id) {
        await sendTelegram(
          emp.telegram_chat_id,
          `👋 ចេញធ្វើការ!\n⏰ ${timeStr}\nអរគុណសម្រាប់ការងាររបស់អ្នក 🙏`,
        )
      }

      return NextResponse.json({ success: true, time: timeStr, distance: distM })
    }

    return NextResponse.json({ error: 'type មិនត្រឹមត្រូវ' }, { status: 400 })
  } catch (e) {
    console.error('[Attendance API]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
