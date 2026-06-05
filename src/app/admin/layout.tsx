import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logout } from '@/app/auth/actions'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  // Use admin client to bypass RLS for role check
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('name, role').eq('id', user.id).single()

  if (profile?.role !== 'admin') redirect('/employee')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar / Top nav */}
      <nav className="bg-indigo-700 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm">ប្រព័ន្ធគ្រប់គ្រង</p>
            <p className="text-xs text-indigo-200">Admin Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-indigo-200 hidden sm:block">{profile?.name}</span>
          <form action={logout}>
            <button type="submit"
              className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
              ចេញ
            </button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  )
}
