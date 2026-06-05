'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Remove BOM, Zero-Width chars, and any non-ASCII from email/password
 * Fixes: "Cannot convert argument to a ByteString" error
 */
function sanitize(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[﻿​‌‍­  ]/g, '') // BOM + invisible chars
    .replace(/[^\x00-\x7F]/g, '')  // remove any non-ASCII (> 127)
    .trim()
}

function sanitizeEmail(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[﻿​‌‍­]/g, '')
    .trim()
    .toLowerCase()
}

// ── Login ────────────────────────────────────────────────────
export async function login(formData: FormData) {
  const supabase = await createClient()

  const email    = sanitizeEmail(formData.get('email'))
  const password = sanitize(formData.get('password'))

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('សូមបំពេញ Email និងពាក្យសម្ងាត់'))
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Show friendly Khmer message instead of raw Supabase error
    const msg =
      error.message.includes('Invalid login') || error.message.includes('invalid_credentials')
        ? 'Email ឬ ពាក្យសម្ងាត់មិនត្រឹមត្រូវ'
        : error.message.includes('Email not confirmed')
        ? 'សូម Confirm Email ជាមុនសិន (ពិនិត្យ Inbox)'
        : 'Login បរាជ័យ — សូមព្យាយាមម្ដងទៀត'
    redirect('/login?error=' + encodeURIComponent(msg))
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// ── Register ─────────────────────────────────────────────────
export async function register(formData: FormData) {
  const supabase = await createClient()

  const name     = (formData.get('name') as string ?? '').trim()
  const email    = sanitizeEmail(formData.get('email'))
  const password = sanitize(formData.get('password'))

  if (!email || !password) {
    redirect('/register?error=' + encodeURIComponent('សូមបំពេញ Email និងពាក្យសម្ងាត់'))
  }
  if (password.length < 6) {
    redirect('/register?error=' + encodeURIComponent('ពាក្យសម្ងាត់ត្រូវការ ≥ 6 តួអក្សរ ASCII'))
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role: 'employee' } },
  })

  if (error) {
    const msg =
      error.message.includes('already registered')
        ? 'Email នេះបានចុះឈ្មោះហើយ'
        : 'ចុះឈ្មោះបរាជ័យ — សូមព្យាយាមម្ដងទៀត'
    redirect('/register?error=' + encodeURIComponent(msg))
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// ── Logout ───────────────────────────────────────────────────
export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
