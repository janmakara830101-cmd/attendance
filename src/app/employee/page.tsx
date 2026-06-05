import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logout } from '@/app/auth/actions'
import AttendanceScanner from '@/components/AttendanceScanner'

export default async function EmployeePage() {
  const supabase      = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  // Use admin client to bypass RLS for profile fetch
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('*').eq('id', user.id).single()

  // Redirect admin to admin dashboard
  if (profile?.role === 'admin') redirect('/admin/dashboard')

  const today = new Date().toLocaleDateString('km-KH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">
              {profile?.name?.[0] ?? 'E'}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{profile?.name ?? user.email}</p>
            <p className="text-xs text-gray-400">បុគ្គលិក</p>
          </div>
        </div>
        <form action={logout}>
          <button type="submit"
            className="text-sm text-gray-400 hover:text-red-500 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            ចេញ
          </button>
        </form>
      </nav>

      <div className="max-w-md mx-auto px-4 py-6">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">ចុះវត្តមាន</h1>
          <p className="text-sm text-gray-400 mt-0.5">{today}</p>
        </div>
        <AttendanceScanner
          employeeId={user.id}
          employeeName={profile?.name ?? 'បុគ្គលិក'}
        />
      </div>
    </main>
  )
}
