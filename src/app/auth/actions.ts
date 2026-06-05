'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function sanitize(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[^\x20-\x7E]/g, '').trim()
}

function sanitizeEmail(value: unknown): string {
  return sanitize(value).toLowerCase()
}

// Login
export async function login(formData: FormData) {
  const supabase = await createClient()

  const email    = sanitizeEmail(formData.get('email'))
  const password = sanitize(formData.get('password'))

  if (!email || !password) {
    redirect('/login?error=Missing+email+or+password')
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Show EXACT Supabase error for debugging
    redirect('/login?error=' + encodeURIComponent('[Supabase] ' + error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// Register
export async function register(formData: FormData) {
  const supabase = await createClient()

  const name     = ((formData.get('name') as string) ?? '').trim()
  const email    = sanitizeEmail(formData.get('email'))
  const password = sanitize(formData.get('password'))

  if (!email || !password) {
    redirect('/register?error=Missing+email+or+password')
  }
  if (password.length < 6) {
    redirect('/register?error=Password+must+be+at+least+6+characters')
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role: 'employee' } },
  })

  if (error) {
    redirect('/register?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// Logout
export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
