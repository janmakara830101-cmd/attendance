'use client'

import { useState, useRef, useCallback } from 'react'

interface EmpRow {
  name: string
  email: string
  telegram_chat_id: string
  base_salary: number
}

type Stage = 'idle' | 'parsed' | 'uploading' | 'done' | 'error'

export default function ExcelImporter() {
  const [stage,   setStage]   = useState<Stage>('idle')
  const [rows,    setRows]    = useState<EmpRow[]>([])
  const [result,  setResult]  = useState<{ created: number; failed: string[] } | null>(null)
  const [errMsg,  setErrMsg]  = useState('')
  const [drag,    setDrag]    = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const parseFile = useCallback(async (file: File) => {
    try {
      const XLSX = await import('xlsx')
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const raw  = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

      const parsed: EmpRow[] = raw.map(r => ({
        name:             String(r['Name'] ?? r['ឈ្មោះ'] ?? '').trim(),
        email:            String(r['Email'] ?? r['អ៊ីមែល'] ?? '').trim().toLowerCase(),
        telegram_chat_id: String(r['Telegram Chat ID'] ?? r['Telegram'] ?? '').trim(),
        base_salary:      Number(r['Base Salary'] ?? r['ប្រាក់ខែ'] ?? 0),
      })).filter(r => r.name && r.email)

      if (!parsed.length) throw new Error('មិនរកឃើញទិន្នន័យ — ពិនិត្យ column headers')
      setRows(parsed)
      setStage('parsed')
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'មិនអាចអានឯកសារ')
      setStage('error')
    }
  }, [])

  const onFile = (f: File | null) => {
    if (!f) return
    if (!f.name.match(/\.(xlsx?|csv)$/i)) {
      setErrMsg('ឯកសារត្រូវជា .xlsx, .xls, ឬ .csv')
      setStage('error')
      return
    }
    setStage('idle')
    parseFile(f)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    onFile(e.dataTransfer.files[0])
  }

  const upload = async () => {
    setStage('uploading')
    try {
      const res = await fetch('/api/employees', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ employees: rows }),
      })
      const data = await res.json()
      if (res.ok) { setResult(data); setStage('done') }
      else        { setErrMsg(data.error ?? 'Upload failed'); setStage('error') }
    } catch {
      setErrMsg('Network error'); setStage('error')
    }
  }

  const reset = () => {
    setStage('idle'); setRows([]); setResult(null); setErrMsg('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {(stage === 'idle' || stage === 'error') && (
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
            drag ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
          }`}
        >
          <input
            ref={inputRef} type="file"
            accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => onFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-3xl mb-2">📊</p>
          <p className="font-semibold text-gray-700">អូស & ទម្លាក់ ឬ ចុចដើម្បីជ្រើសរើស</p>
          <p className="text-sm text-gray-400 mt-1">xlsx, xls, csv</p>
          <p className="text-xs text-gray-400 mt-3">
            Columns: <code className="bg-gray-100 px-1 rounded">Name | Email | Telegram Chat ID | Base Salary</code>
          </p>
        </div>
      )}

      {stage === 'error' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <span>⚠️</span> {errMsg}
        </div>
      )}

      {/* Preview table */}
      {(stage === 'parsed' || stage === 'uploading') && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">
               មើលជាមុន — {rows.length} បុគ្គលិក
            </p>
            <button onClick={reset} className="text-xs text-gray-400 hover:text-red-500">✕ ជ្រើសឯកសារផ្សេង</button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  {['ឈ្មោះ', 'Email', 'Telegram ID', 'ប្រាក់ខែ ($)'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                    <td className="px-3 py-2 text-gray-500">{r.email}</td>
                    <td className="px-3 py-2 text-gray-500">{r.telegram_chat_id || '—'}</td>
                    <td className="px-3 py-2 text-gray-800">${r.base_salary.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={upload}
            disabled={stage === 'uploading'}
            className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {stage === 'uploading'
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />កំពុង Upload…</>
              : <>📤 Upload ទៅ Supabase</>
            }
          </button>
        </div>
      )}

      {/* Result */}
      {stage === 'done' && result && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <p className="text-lg font-bold text-green-800 mb-2">✅ Import ជោគជ័យ!</p>
          <p className="text-sm text-green-700">បង្កើត: <b>{result.created}</b> គណនី</p>
          {result.failed.length > 0 && (
            <p className="text-sm text-red-600 mt-1">
              បរាជ័យ: {result.failed.join(', ')}
            </p>
          )}
          <button onClick={reset} className="mt-3 text-sm text-indigo-600 hover:underline">
            Import ឯកសារថ្មី
          </button>
        </div>
      )}
    </div>
  )
}
