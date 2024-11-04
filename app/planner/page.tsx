'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

export default function PlannerPage() {
  const router = useRouter()
  const isPremium = false // TODO: 从用户状态获取

  useEffect(() => {
    if (!isPremium) {
      // 可以选择直接跳转到订阅页面
      // router.push('/subscribe')
    }
  }, [isPremium])

  if (!isPremium) {
    return (
      <div className="container mx-auto p-4 min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <Lock className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <h1 className="text-2xl font-bold mb-2">升级会员</h1>
          <p className="text-gray-600 mb-4">
            开通会员即可使用智能规划功能
          </p>
          <button 
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            onClick={() => router.push('/subscribe')}
          >
            立即升级
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">智能规划</h1>
      {/* 智能规划内容 */}
    </main>
  )
} 