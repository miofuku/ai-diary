import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">
        智能黄历
      </h1>
      <div className="grid grid-cols-1 gap-4">
        <Link 
          href="/calendar" 
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          查看黄历
        </Link>
        <Link 
          href="/bazi" 
          className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          八字分析
        </Link>
        <Link 
          href="/personal" 
          className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          个性化服务
        </Link>
      </div>
    </main>
  )
}