import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Role-based redirect hub
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role === 'admin') redirect('/admin/dashboard')
  redirect('/employee')
}
