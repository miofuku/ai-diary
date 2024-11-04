import { LuckyColorCard } from '@/components/personal/LuckyColorCard'
import { ActivityPlanner } from '@/components/personal/ActivityPlanner'

export default function PersonalPage() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">个性化推荐</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <LuckyColorCard />
        <ActivityPlanner />
      </div>
    </main>
  )
} 