import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-2xl shadow-lg mb-6">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          ប្រព័ន្ធគ្រប់គ្រងវត្តមាន
        </h1>
        <h2 className="text-xl font-semibold text-indigo-600 mb-3">
          និងប្រាក់ខែបុគ្គលិក
        </h2>
        <p className="text-gray-500 text-sm max-w-sm mx-auto">
          Employee Attendance &amp; Payroll Management System
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 w-full max-w-2xl">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
          <div className="text-3xl mb-2">📅</div>
          <p className="font-semibold text-gray-700">ចុះវត្តមាន</p>
          <p className="text-xs text-gray-400 mt-1">Check-in / Check-out</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
          <div className="text-3xl mb-2">💰</div>
          <p className="font-semibold text-gray-700">គ្រប់គ្រងប្រាក់ខែ</p>
          <p className="text-xs text-gray-400 mt-1">Payroll Management</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
          <div className="text-3xl mb-2">📊</div>
          <p className="font-semibold text-gray-700">របាយការណ៍</p>
          <p className="text-xs text-gray-400 mt-1">Reports &amp; Analytics</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Link
          href="/login"
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl text-center transition-colors shadow-md"
        >
          ចូលប្រើប្រាស់
        </Link>
        <Link
          href="/register"
          className="flex-1 bg-white hover:bg-gray-50 text-indigo-600 font-semibold py-3 px-6 rounded-xl text-center transition-colors shadow-md border border-indigo-200"
        >
          ចុះឈ្មោះ
        </Link>
      </div>

      <p className="mt-8 text-xs text-gray-400">
        Powered by Next.js · Supabase · Tailwind CSS
      </p>
    </main>
  );
}
