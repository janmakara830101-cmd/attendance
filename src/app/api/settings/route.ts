import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('settings').select('*').single()
  if (error) return NextResponse.json({ error: 'Settings not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('settings')
      .update(body)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
