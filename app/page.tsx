import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">
        Lunar Calendar Assistant
      </h1>
      <div className="grid grid-cols-1 gap-4">
        <Link 
          href="/calendar" 
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          View Calendar
        </Link>
      </div>
    </main>
  )
}