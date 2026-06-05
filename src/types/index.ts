export interface Profile {
  id: string
  name: string
  role: 'admin' | 'employee'
  phone: string | null
  base_salary: number
  active_status: boolean
  telegram_chat_id: string | null
  created_at: string
}

export interface Settings {
  id: string
  office_name: string
  office_lat: number
  office_lng: number
  allowed_radius_meters: number
  check_in_limit: string   // 'HH:MM:SS'
  work_end: string
  late_deduction_usd: number
  absent_deduction_usd: number
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  date: string
  check_in_time: string | null
  check_out_time: string | null
  check_in_lat: number | null
  check_in_lng: number | null
  status: 'Present' | 'Late' | 'Absent'
  notes: string | null
  profiles?: { name: string }
}

export interface PayrollRecord {
  id: string
  employee_id: string
  month: number
  year: number
  base_salary: number
  bonuses: number
  bonus_reasons: string | null
  deductions: number
  deduction_reasons: string | null
  total_salary: number
  payment_status: 'Pending' | 'Paid'
  processed_at: string | null
  profiles?: { name: string; telegram_chat_id: string | null }
}

export interface AttendanceApiRequest {
  employee_id: string
  latitude: number
  longitude: number
  type: 'check_in' | 'check_out'
}

export interface AttendanceApiResponse {
  success?: boolean
  status?: string
  time?: string
  distance?: number
  error?: string
  allowed?: boolean
}
