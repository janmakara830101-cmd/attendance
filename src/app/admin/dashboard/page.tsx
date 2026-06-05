'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import ExcelImporter from '@/components/ExcelImporter'
import type { AttendanceRecord, PayrollRecord, Profile, Settings } from '@/types'

type Tab = 'attendance' | 'payroll' | 'employees' | 'settings'

// ─── helpers ────────────────────────────────────────────────
const fmtTime = (ts: string | null | undefined) => {
  if (!ts) return '—'
  const d = new Date(ts)
  return isNaN(d.getTime()) ? ts : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}
const currentMonth = () => new Date().toISOString().slice(0, 7) // 'YYYY-MM'

export default function AdminDashboard() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('attendance')

  // ── Attendance state ──────────────────────────────────────
  const [attDate,    setAttDate]    = useState(new Date().toISOString().split('T')[0])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [attSearch,  setAttSearch]  = useState('')
  const [attLoading, setAttLoading] = useState(false)

  // ── Payroll state ─────────────────────────────────────────
  const [month,      setMonth]      = useState(currentMonth())
  const [payroll,    setPayroll]    = useState<PayrollRecord[]>([])
  const [prLoading,  setPrLoading]  = useState(false)
  const [processing, setProcessing] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [adjModal,   setAdjModal]   = useState<PayrollRecord | null>(null)
  const [adjForm,    setAdjForm]    = useState({ bonuses: 0, bonus_reasons: '', deductions: 0, deduction_reasons: '' })

  // ── Employees state ───────────────────────────────────────
  const [employees,  setEmployees]  = useState<Profile[]>([])
  const [empLoading, setEmpLoading] = useState(false)

  // ── Settings state ────────────────────────────────────────
  const [settings,   setSettings]   = useState<Settings | null>(null)
  const [cfgForm,    setCfgForm]    = useState<Partial<Settings>>({})
  const [cfgSaving,  setCfgSaving]  = useState(false)
  const [cfgMsg,     setCfgMsg]     = useState('')

  // ── Toast ─────────────────────────────────────────────────
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DATA FETCHERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const fetchAttendance = useCallback(async () => {
    setAttLoading(true)
    const { data } = await supabase
      .from('attendance')
      .select('*, profiles(name)')
      .eq('date', attDate)
      .order('check_in_time', { ascending: false })
    setAttendance((data as AttendanceRecord[]) ?? [])
    setAttLoading(false)
  }, [attDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPayroll = useCallback(async () => {
    setPrLoading(true)
    const [y, m] = month.split('-').map(Number)
    const { data } = await supabase
      .from('payroll')
      .select('*, profiles(name, telegram_chat_id)')
      .eq('year', y).eq('month', m)
      .order('profiles(name)')
    setPayroll((data as PayrollRecord[]) ?? [])
    setPrLoading(false)
  }, [month]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchEmployees = useCallback(async () => {
    setEmpLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('name')
    setEmployees((data as Profile[]) ?? [])
    setEmpLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('settings').select('*').single()
    if (data) { setSettings(data); setCfgForm(data) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAttendance() }, [fetchAttendance])
  useEffect(() => { if (tab === 'payroll')   fetchPayroll()   }, [tab, fetchPayroll])
  useEffect(() => { if (tab === 'employees') fetchEmployees() }, [tab, fetchEmployees])
  useEffect(() => { if (tab === 'settings')  fetchSettings()  }, [tab, fetchSettings])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STATS (computed from today's attendance)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const presentCount = attendance.filter(a => a.status === 'Present').length
  const lateCount    = attendance.filter(a => a.status === 'Late').length
  const totalPayroll = payroll.reduce((s, p) => s + Number(p.total_salary), 0)
  const unpaidCount  = payroll.filter(p => p.payment_status === 'Pending').length

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ACTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const processPayroll = async () => {
    setProcessing(true)
    const res  = await fetch('/api/payroll/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month }) })
    const data = await res.json()
    if (res.ok) { showToast('ok', `✅ ប្រើសម្រួល ${data.employees_processed} នាក់`); fetchPayroll() }
    else          showToast('err', data.error)
    setProcessing(false)
  }

  const finalizeAll = async () => {
    if (!confirm('ប្តូរស្ថានភាពទូទាត់ហើយផ្ញើ Telegram ទៅបុគ្គលិក?')) return
    setFinalizing(true)
    const res  = await fetch('/api/payroll/finalize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month }) })
    const data = await res.json()
    if (res.ok) { showToast('ok', `💸 បានទូទាត់ ${data.paid_count} នាក់`); fetchPayroll() }
    else          showToast('err', data.error)
    setFinalizing(false)
  }

  const openAdj = (row: PayrollRecord) => {
    setAdjForm({ bonuses: row.bonuses, bonus_reasons: row.bonus_reasons ?? '', deductions: row.deductions, deduction_reasons: row.deduction_reasons ?? '' })
    setAdjModal(row)
  }

  const saveAdj = async () => {
    if (!adjModal) return
    const res  = await fetch('/api/payroll/finalize', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: adjModal.id, ...adjForm }),
    })
    if (res.ok) { showToast('ok', 'បានរក្សាទុក'); setAdjModal(null); fetchPayroll() }
    else          showToast('err', 'Save failed')
  }

  const saveSettings = async () => {
    setCfgSaving(true); setCfgMsg('')
    const res  = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfgForm) })
    if (res.ok) { setCfgMsg('✅ រក្សាទុករួច'); fetchSettings() }
    else          setCfgMsg('❌ Save failed')
    setCfgSaving(false)
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const filteredAtt = attendance.filter(a =>
    (a.profiles?.name ?? '').toLowerCase().includes(attSearch.toLowerCase())
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: '✅', label: 'វត្តមានថ្ងៃនេះ', value: presentCount,  sub: 'Present',  color: 'text-green-600'  },
          { icon: '⏰', label: 'ចូលយឺត',         value: lateCount,     sub: 'Late',      color: 'text-yellow-600' },
          { icon: '💰', label: 'ប្រាក់ខែសរុប',   value: `$${totalPayroll.toLocaleString()}`, sub: month, color: 'text-indigo-600' },
          { icon: '⏳', label: 'មិនទាន់បានបង',   value: unpaidCount,   sub: 'Pending',   color: 'text-orange-500' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{c.icon}</span>
              <span className={`text-xs font-medium ${c.color} bg-gray-50 px-2 py-0.5 rounded-full`}>{c.sub}</span>
            </div>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {([
            ['attendance', '📅 វត្តមាន'],
            ['payroll',    '💰 ប្រាក់ខែ'],
            ['employees',  '👥 បុគ្គលិក'],
            ['settings',   '⚙️ ការកំណត់'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors
                ${tab === key ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ═══ ATTENDANCE TAB ════════════════════════════════ */}
          {tab === 'attendance' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <input type="date" value={attDate} onChange={e => setAttDate(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                <input type="text" placeholder="ស្វែងរកឈ្មោះ…" value={attSearch} onChange={e => setAttSearch(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 min-w-[160px] focus:ring-2 focus:ring-indigo-400 outline-none" />
                <button onClick={fetchAttendance}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-sm font-medium">
                  🔄 ធ្វើបច្ចុប្បន្នភាព
                </button>
              </div>

              {attLoading ? (
                <div className="py-8 text-center text-gray-400 text-sm">កំពុងទាញ…</div>
              ) : filteredAtt.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">គ្មានទិន្នន័យ</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        {['ឈ្មោះ', 'ស្ថានភាព', 'ចូល', 'ចេញ', 'GPS ចម្ងាយ'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAtt.map(a => (
                        <tr key={a.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 py-3 font-medium text-gray-800">{a.profiles?.name ?? '—'}</td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              a.status === 'Present' ? 'bg-green-100 text-green-700' :
                              a.status === 'Late'    ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-600'}`}>
                              {a.status === 'Present' ? 'ទាន់ម៉ោង' : a.status === 'Late' ? 'យឺត' : 'អវត្តមាន'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-gray-600">{fmtTime(a.check_in_time)}</td>
                          <td className="px-3 py-3 text-gray-600">{fmtTime(a.check_out_time)}</td>
                          <td className="px-3 py-3 text-gray-400 text-xs">
                            {a.check_in_lat ? `${a.check_in_lat?.toFixed(4)}, ${a.check_in_lng?.toFixed(4)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══ PAYROLL TAB ═══════════════════════════════════ */}
          {tab === 'payroll' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                <button onClick={processPayroll} disabled={processing}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
                  {processing ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : '⚙️'}
                  គណនាប្រាក់ខែ
                </button>
                <button onClick={finalizeAll} disabled={finalizing || unpaidCount === 0}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
                  {finalizing ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : '💸'}
                  Finalize & Pay All ({unpaidCount})
                </button>
              </div>

              {prLoading ? (
                <div className="py-8 text-center text-gray-400 text-sm">កំពុងទាញ…</div>
              ) : payroll.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  គ្មានទិន្នន័យ — ចុច &quot;គណនាប្រាក់ខែ&quot; ជាមុនសិន
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        {['ឈ្មោះ', 'មូលដ្ឋាន', 'ប្រាក់រង្វាន់', 'ការកាត់', 'សុទ្ធ', 'ស្ថានភាព', ''].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payroll.map(p => (
                        <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 py-3 font-medium text-gray-800">{p.profiles?.name ?? '—'}</td>
                          <td className="px-3 py-3">${Number(p.base_salary).toFixed(0)}</td>
                          <td className="px-3 py-3 text-green-600">+${Number(p.bonuses).toFixed(0)}</td>
                          <td className="px-3 py-3 text-red-500">-${Number(p.deductions).toFixed(0)}</td>
                          <td className="px-3 py-3 font-bold text-indigo-700">${Number(p.total_salary).toFixed(2)}</td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              p.payment_status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {p.payment_status === 'Paid' ? '✅ បានបង' : '⏳ រង់ចាំ'}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <button onClick={() => openAdj(p)}
                              className="text-xs bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-700 px-2 py-1 rounded-lg transition-colors">
                              ✏️ កែ
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══ EMPLOYEES TAB ═════════════════════════════════ */}
          {tab === 'employees' && (
            <div className="space-y-6">
              {empLoading ? (
                <div className="py-8 text-center text-gray-400 text-sm">កំពុងទាញ…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        {['ឈ្មោះ', 'Role', 'ប្រាក់ខែ', 'Telegram ID', 'ស្ថានភាព'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map(e => (
                        <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 py-3 font-medium text-gray-800">{e.name}</td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              e.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {e.role}
                            </span>
                          </td>
                          <td className="px-3 py-3">${Number(e.base_salary).toFixed(0)}</td>
                          <td className="px-3 py-3 text-gray-400 text-xs">{e.telegram_chat_id ?? '—'}</td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              e.active_status ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {e.active_status ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Excel Importer */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="font-semibold text-gray-800 mb-3">📊 Import Excel</h3>
                <ExcelImporter />
              </div>
            </div>
          )}

          {/* ═══ SETTINGS TAB ══════════════════════════════════ */}
          {tab === 'settings' && (
            <div className="max-w-lg space-y-4">
              <h3 className="font-semibold text-gray-800">ការកំណត់ GPS ការិយាល័យ</h3>
              {[
                { key: 'office_name', label: 'ឈ្មោះការិយាល័យ', type: 'text' },
                { key: 'office_lat',  label: 'Latitude',         type: 'number' },
                { key: 'office_lng',  label: 'Longitude',        type: 'number' },
                { key: 'allowed_radius_meters', label: 'Radius (m)', type: 'number' },
                { key: 'check_in_limit',        label: 'ម៉ោងចូល (HH:MM)', type: 'time' },
                { key: 'late_deduction_usd',    label: 'ការកាត់ - យឺត ($)', type: 'number' },
                { key: 'absent_deduction_usd',  label: 'ការកាត់ - អវត្តមាន ($)', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={String((cfgForm as Record<string, unknown>)[f.key] ?? '')}
                    onChange={e => setCfgForm(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                </div>
              ))}
              {cfgMsg && <p className="text-sm text-gray-600">{cfgMsg}</p>}
              <button onClick={saveSettings} disabled={cfgSaving}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl text-sm font-semibold">
                {cfgSaving ? 'កំពុងរក្សាទុក…' : '💾 រក្សាទុក'}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ═══ Adjustment Modal ══════════════════════════════════ */}
      {adjModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">✏️ កែប្រែ — {(adjModal.profiles as { name: string } | undefined)?.name}</h3>
              <button onClick={() => setAdjModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">ប្រាក់រង្វាន់ ($)</label>
                  <input type="number" min={0} value={adjForm.bonuses}
                    onChange={e => setAdjForm(p => ({ ...p, bonuses: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">ការកាត់ ($)</label>
                  <input type="number" min={0} value={adjForm.deductions}
                    onChange={e => setAdjForm(p => ({ ...p, deductions: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">មូលហេតុ — ប្រាក់រង្វាន់</label>
                <input type="text" value={adjForm.bonus_reasons} placeholder="ឧ. ការអនុវត្តល្អ"
                  onChange={e => setAdjForm(p => ({ ...p, bonus_reasons: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">មូលហេតុ — ការកាត់</label>
                <input type="text" value={adjForm.deduction_reasons} placeholder="ឧ. ចូលយឺត, អវត្តមាន"
                  onChange={e => setAdjForm(p => ({ ...p, deduction_reasons: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveAdj}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm">
                💾 រក្សាទុក
              </button>
              <button onClick={() => setAdjModal(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm">
                បោះបង់
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
