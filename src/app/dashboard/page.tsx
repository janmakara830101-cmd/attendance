import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/auth/actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // ទាញ profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const displayName = profile?.name ?? user.email ?? 'បុគ្គលិក'
  const role = profile?.role === 'admin' ? 'អ្នកគ្រប់គ្រង' : 'បុគ្គលិក'
  const today = new Date().toLocaleDateString('km-KH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-800 text-sm">ប្រព័ន្ធវត្តមាន</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-800">{displayName}</p>
            <p className="text-xs text-gray-400">{role}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              ចេញ
            </button>
          </form>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            សួស្ដី, {displayName}! 👋
          </h1>
          <p className="text-gray-400 text-sm mt-1">{today}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">📅</span>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">ថ្ងៃនេះ</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">—</p>
            <p className="text-sm text-gray-500 mt-1">វត្តមានខែនេះ</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">⏰</span>
              <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">ខែនេះ</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">—</p>
            <p className="text-sm text-gray-500 mt-1">ចូលយឺត</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">💰</span>
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">ប្រាក់ខែ</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ${profile?.base_salary?.toLocaleString() ?? '0'}
            </p>
            <p className="text-sm text-gray-500 mt-1">ប្រាក់ខែមូលដ្ឋាន</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">សកម្មភាពរហ័ស</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: '🟢', label: 'ចូលធ្វើការ', color: 'bg-green-50 hover:bg-green-100 text-green-700' },
              { icon: '🔴', label: 'ចេញធ្វើការ', color: 'bg-red-50 hover:bg-red-100 text-red-700' },
              { icon: '📋', label: 'ប្រវត្តិវត្តមាន', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700' },
              { icon: '💵', label: 'ប្រាក់ខែ', color: 'bg-purple-50 hover:bg-purple-100 text-purple-700' },
            ].map((action) => (
              <button
                key={action.label}
                className={`${action.color} flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-colors cursor-pointer`}
              >
                <span className="text-2xl">{action.icon}</span>
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Coming Soon */}
        <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
          <p className="text-sm text-indigo-600 font-medium">
            🚧 មុខងារកំពុងត្រូវបានបង្កើត — Phase 3 (Check-in/Check-out) នឹងមកឆាប់ៗ
          </p>
        </div>

      </div>
    </main>
  )
}
