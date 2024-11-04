'use client'

import { useEffect, useState } from 'react'
import type { DailyForecast as DailyForecastType } from '@/src/types'
import { useStore } from '@/src/lib/store'

export function DailyForecast() {
  const [forecast, setForecast] = useState<DailyForecastType | null>(null)
  const birthData = useStore(state => state.birthData)

  useEffect(() => {
    if (!birthData) return

    const fetchForecast = async () => {
      const response = await fetch('/api/daily-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthData })
      })
      const data = await response.json()
      setForecast(data)
    }

    fetchForecast()
  }, [birthData])

  if (!forecast) return null

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-lg font-semibold mb-4">今日运势</h3>
      <div className="space-y-4">
        <div>
          <h4 className="font-medium">宜</h4>
          <div className="flex flex-wrap gap-2">
            {forecast.auspiciousActivities.map((activity, index) => (
              <span key={index} className="px-2 py-1 bg-green-100 rounded">
                {activity}
              </span>
            ))}
          </div>
        </div>
        {/* Add more forecast details */}
      </div>
    </div>
  )
} 