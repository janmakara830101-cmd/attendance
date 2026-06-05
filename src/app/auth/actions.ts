'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Remove BOM, Zero-Width chars, and all non-ASCII using Unicode escapes */
function sanitize(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/﻿/g, '')    // BOM
    .replace(/​/g, '')    // Zero Width Space
    .replace(/‌/g, '')    // Zero Width Non-Joiner
    .replace(/‍/g, '')    // Zero Width Joiner
    .replace(/­/g, '')    // Soft Hyphen
    .replace(/[^\x00-\x7F]/g, '') // Any remaining non-ASCII
    .trim()
}

function sanitizeEmail(value: unknown): string {
  return sanitize(value).toLowerCase()
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
    const msg =
      error.message.includes('Invalid login') || error.message.includes('invalid_credentials')
        ? 'Email ​ឬ​ ​ពាក្យសម្ងាត់​មិនត្រឹមត្រូវ'
        : error.message.includes('Email not confirmed')
        ? '​សូម Confirm Email ​ជាមុនសិន ​(ពិនិត្យ Inbox)'
        : 'Login ​បរាជ័យ — ​សូមព្យាយាមម្ដងទៀត'
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
    redirect('/register?error=' + encodeURIComponent('Missing email or password'))
  }
  if (password.length < 6) {
    redirect('/register?error=' + encodeURIComponent('Password must be at least 6 characters'))
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role: 'employee' } },
  })

  if (error) {
    const msg = error.message.includes('already registered')
      ? 'Email already registered'
      : 'Registration failed — please try again'
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
