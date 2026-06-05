'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Settings, AttendanceRecord } from '@/types'

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000
  const t = (d: number) => (d * Math.PI) / 180
  const a =
    Math.sin(t(lat2 - lat1) / 2) ** 2 +
    Math.cos(t(lat1)) * Math.cos(t(lat2)) * Math.sin(t(lng2 - lng1) / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface Props { employeeId: string; employeeName: string }
type GPS   = 'idle' | 'loading' | 'ok' | 'denied' | 'error'
type Toast = { type: 'success' | 'error'; msg: string } | null

export default function AttendanceScanner({ employeeId, employeeName }: Props) {
  const [gps,      setGps]      = useState<GPS>('idle')
  const [coords,   setCoords]   = useState<{ lat: number; lng: number } | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [today,    setToday]    = useState<Partial<AttendanceRecord> | null>(null)
  const [toast,    setToast]    = useState<Toast>(null)
  const [busy,     setBusy]     = useState(false)
  const watchRef = useRef<number | null>(null)

  // Fetch office settings + today's record
  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch(`/api/attendance?employee_id=${employeeId}`).then(r => r.json()),
    ]).then(([cfg, rec]) => {
      setSettings(cfg)
      setToday(rec)
    })
  }, [employeeId])

  // Update distance when coords or settings change
  useEffect(() => {
    if (coords && settings) {
      const d = haversine(coords.lat, coords.lng, settings.office_lat, settings.office_lng)
      setDistance(Math.round(d))
    }
  }, [coords, settings])

  // Start GPS watch
  const startGPS = useCallback(() => {
    if (!navigator.geolocation) { setGps('error'); return }
    setGps('loading')
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGps('ok')
      },
      err => {
        setGps(err.code === 1 ? 'denied' : 'error')
      },
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 },
    )
  }, [])

  useEffect(() => {
    startGPS()
    return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current) }
  }, [startGPS])

  // Auto-clear toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const handleAction = async (type: 'check_in' | 'check_out') => {
    if (!coords) { setToast({ type: 'error', msg: 'GPS មិនទាន់ត្រៀមរួម' }); return }
    setBusy(true)
    try {
      const res  = await fetch('/api/attendance', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ employee_id: employeeId, latitude: coords.lat, longitude: coords.lng, type }),
      })
      const data = await res.json()
      if (res.ok) {
        const msg = type === 'check_in'
          ? `✅ ចូលធ្វើការ ${data.time} — ${data.status === 'Late' ? 'យឺត' : 'ទាន់ម៉ោង'}`
          : `👋 ចេញធ្វើការ ${data.time}`
        setToast({ type: 'success', msg })
        setToday(prev => ({
          ...prev,
          check_in_time:  type === 'check_in'  ? data.time : prev?.check_in_time  ?? null,
          check_out_time: type === 'check_out' ? data.time : prev?.check_out_time ?? null,
          status:         type === 'check_in'  ? data.status : prev?.status ?? null,
        }))
      } else {
        setToast({ type: 'error', msg: data.error })
      }
    } catch {
      setToast({ type: 'error', msg: 'បរាជ័យ — សូមព្យាយាមម្ដងទៀត' })
    } finally {
      setBusy(false)
    }
  }

  const radius   = settings?.allowed_radius_meters ?? 50
  const inRange  = distance !== null && distance <= radius
  const distPct  = distance != null ? Math.min(100, (distance / (radius * 2)) * 100) : 0

  return (
    <div className="max-w-sm mx-auto space-y-4 select-none">

      {/* Toast */}
      {toast && (
        <div className={`flex items-start gap-2 p-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
          toast.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <span className="text-base">{toast.type === 'success' ? '✅' : '⚠️'}</span>
          {toast.msg}
        </div>
      )}

      {/* GPS + Distance card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-700">ទីតាំង GPS</span>
          {gps === 'loading' && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              កំពុងស្វែងរក…
            </span>
          )}
          {gps === 'ok' && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
              GPS ត្រៀមរួម
            </span>
          )}
          {(gps === 'denied' || gps === 'error') && (
            <span className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
              <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
              {gps === 'denied' ? 'ត្រូវការ GPS' : 'GPS error'}
            </span>
          )}
        </div>

        {/* Distance meter */}
        {gps === 'ok' && distance !== null && (
          <>
            <div className="text-center mb-3">
              <p className="text-3xl font-bold text-gray-900">{distance} m</p>
              <p className="text-sm text-gray-400 mt-0.5">ចម្ងាយពី {settings?.office_name ?? 'ការិយាល័យ'}</p>
            </div>

            {/* Progress bar */}
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  inRange ? 'bg-green-400' : 'bg-red-400'
                }`}
                style={{ width: `${distPct}%` }}
              />
            </div>

            {/* Range badge */}
            <div className={`flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold ${
              inRange
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-600'
            }`}>
              <span>{inRange ? '🟢' : '🔴'}</span>
              {inRange ? `ស្ថិតក្នុងតំបន់ (≤ ${radius} m)` : `នៅខាងក្រៅតំបន់`}
            </div>
          </>
        )}

        {gps === 'denied' && (
          <div className="text-center py-4 text-sm text-gray-500">
            <p className="text-2xl mb-2">📍</p>
            <p>សូមអនុញ្ញាតការចូលប្រើ GPS</p>
            <p className="text-xs text-gray-400 mt-1">Settings → Site permissions → Location</p>
          </div>
        )}

        {gps === 'loading' && (
          <div className="text-center py-6 text-sm text-gray-400">
            <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
            កំពុងស្វែងរក GPS…
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleAction('check_in')}
          disabled={!inRange || !!today?.check_in_time || busy}
          className="flex flex-col items-center gap-1.5 py-4 rounded-2xl font-semibold text-sm transition-all
            disabled:opacity-40 disabled:cursor-not-allowed
            enabled:bg-green-500 enabled:hover:bg-green-600 enabled:active:scale-95 enabled:text-white
            disabled:bg-gray-100 disabled:text-gray-400"
        >
          <span className="text-2xl">🟢</span>
          ចូលធ្វើការ
          {today?.check_in_time && <span className="text-xs opacity-70">{today.check_in_time}</span>}
        </button>

        <button
          onClick={() => handleAction('check_out')}
          disabled={!inRange || !today?.check_in_time || !!today?.check_out_time || busy}
          className="flex flex-col items-center gap-1.5 py-4 rounded-2xl font-semibold text-sm transition-all
            disabled:opacity-40 disabled:cursor-not-allowed
            enabled:bg-red-500 enabled:hover:bg-red-600 enabled:active:scale-95 enabled:text-white
            disabled:bg-gray-100 disabled:text-gray-400"
        >
          <span className="text-2xl">🔴</span>
          ចេញធ្វើការ
          {today?.check_out_time && <span className="text-xs opacity-70">{today.check_out_time}</span>}
        </button>
      </div>

      {/* Today status card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">ស្ថានភាពថ្ងៃនេះ</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">ចូល</p>
            <p className="text-sm font-semibold text-gray-800">
              {today?.check_in_time ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">ចេញ</p>
            <p className="text-sm font-semibold text-gray-800">
              {today?.check_out_time ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">ស្ថានភាព</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              today?.status === 'Present' ? 'bg-green-100 text-green-700' :
              today?.status === 'Late'    ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {today?.status === 'Present' ? 'ទាន់ម៉ោង' :
               today?.status === 'Late'    ? 'យឺត'     : '—'}
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}
