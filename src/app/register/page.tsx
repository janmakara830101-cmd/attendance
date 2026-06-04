import { register } from '@/app/auth/actions'

export default function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-xl mb-4">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ចុះឈ្មោះ</h1>
          <p className="text-gray-400 text-sm mt-1">Create your account</p>
        </div>

        {/* Error Message */}
        <ErrorMessage searchParams={searchParams} />

        {/* Form */}
        <form action={register} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ឈ្មោះពេញ
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="ឈ្មោះ នាមត្រកូល"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              អ៊ីមែល
            </label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="example@email.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ពាក្យសម្ងាត់
            </label>
            <input
              type="password"
              name="password"
              required
              autoComplete="new-password"
              minLength={6}
              placeholder="••••••••  (យ៉ាងតិច ៦ តួអក្សរ)"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-3 rounded-xl transition-colors mt-2 cursor-pointer"
          >
            ចុះឈ្មោះ
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          មានគណនីហើយ?{' '}
          <a href="/login" className="text-indigo-600 font-medium hover:underline">
            ចូលប្រើ
          </a>
        </p>
      </div>
    </main>
  )
}

async function ErrorMessage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  if (!params.error) return null

  return (
    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
      <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-red-600">{decodeURIComponent(params.error)}</p>
    </div>
  )
}
